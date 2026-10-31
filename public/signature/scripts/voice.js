/* Two voices, one conversation. Decorative physics; sound only after an explicit opt-in. */
(() => {
  'use strict';

  const surface = document.querySelector('[data-voice-surface]');
  const canvas = surface?.querySelector('[data-voice-canvas]');
  const soundButton = document.querySelector('[data-voice-sound]');
  const pluckButtons = [...document.querySelectorAll('[data-voice-pluck]')];
  if (!surface || !canvas) return;

  let context;
  try { context = canvas.getContext('2d', { alpha: true }); } catch { /* The SVG is the fallback. */ }
  if (!context) {
    if (soundButton) soundButton.hidden = true;
    for (const button of pluckButtons) button.hidden = true;
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const voices = ['them', 'you'];
  const strings = voices.map(who => ({ who, points: [], velocity: [] }));
  const frequencies = [220, 261.6256, 293.6648, 329.6276, 391.9954];
  const audioSources = new Set();
  let width = 0, height = 0, dpr = 1, raf = 0, lastFrame = 0, elapsed = 0, remainder = 0;
  let inView = false, paused = root.dataset.motion === 'paused';
  let lastPointer = null, lastPluck = 0, lastTone = 0;
  let audio = null, soundOn = false, soundPending = false;
  let colors = ['#ae774e', '#756277'];

  const mayMove = () => inView && !document.hidden && !paused && !reduce.matches;
  const resting = (i, x) => {
    const center = i === 0 ? .39 : .66;
    const wave = Math.sin(x * Math.PI * 3 + i * 1.1) * Math.sin(x * Math.PI);
    return height * center + wave * Math.min(height * .035, 5);
  };

  function draw() {
    if (!width || !height) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    strings.forEach((string, i) => {
      const count = string.points.length;
      context.strokeStyle = colors[i];
      context.lineWidth = 1.3;
      context.globalAlpha = .85;
      context.beginPath();
      context.moveTo(0, resting(i, 0));
      for (let j = 1; j < count - 1; j++) {
        const x = j / (count - 1) * width;
        const y = resting(i, j / (count - 1)) + string.points[j];
        const nextX = (j + 1) / (count - 1) * width;
        const nextY = resting(i, (j + 1) / (count - 1)) + string.points[j + 1];
        context.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
      }
      context.lineTo(width, resting(i, 1));
      context.stroke();
    });
    context.globalAlpha = 1;
  }

  function stopMotion() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    elapsed = 0;
    remainder = 0;
    strings.forEach(string => { string.points.fill(0); string.velocity.fill(0); });
    draw();
  }

  function frame(now) {
    raf = 0;
    if (!mayMove()) { stopMotion(); return; }
    const delta = lastFrame ? Math.min(50, now - lastFrame) : 16.667;
    lastFrame = now;
    elapsed += delta / 1000;
    remainder += delta;
    const steps = Math.min(3, Math.floor(remainder / 16.667));
    remainder -= steps * 16.667;
    let energy = 0;
    for (let step = 0; step < steps; step++) {
      for (const string of strings) {
        const p = string.points, v = string.velocity;
        for (let j = 1; j < p.length - 1; j++) {
          v[j] = (v[j] + (p[j - 1] + p[j + 1] - 2 * p[j]) * .22 - p[j] * .004) * .972;
        }
        for (let j = 1; j < p.length - 1; j++) {
          p[j] += v[j];
        }
      }
    }
    for (const string of strings) {
      for (let j = 1; j < string.points.length - 1; j++) energy += Math.abs(string.points[j]) + Math.abs(string.velocity[j]);
    }
    draw();
    if (energy > .5 && elapsed < 5) raf = requestAnimationFrame(frame);
    else stopMotion();
  }

  function refresh() {
    const rect = surface.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const count = Math.max(32, Math.min(108, Math.round(width / 12)));
    for (const string of strings) {
      string.points = new Float32Array(count);
      string.velocity = new Float32Array(count);
    }
    const css = getComputedStyle(surface);
    colors = [css.getPropertyValue('--voice-them').trim() || '#ae774e', css.getPropertyValue('--voice-you').trim() || '#756277'];
    stopMotion();
    surface.dataset.voiceReady = 'true';
  }

  function stopSound() {
    for (const source of audioSources) {
      try { source.stop(); } catch { /* Already finished. */ }
    }
    audioSources.clear();
  }

  function syncSound() {
    if (!soundButton) return;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    const label = soundOn ? soundButton.dataset.labelOn : soundButton.dataset.labelOff;
    if (label) {
      soundButton.setAttribute('aria-label', label);
      soundButton.title = label;
      const target = soundButton.querySelector('[data-voice-sound-label]');
      if (target) target.textContent = label;
    }
  }

  async function tone(who, x) {
    if (!soundOn || !audio || document.hidden || paused) return;
    const now = performance.now();
    if (now - lastTone < 100) return;
    lastTone = now;
    // An already opted-in context can be suspended by the browser while the tab is hidden.
    if (audio.state === 'suspended') {
      try { await audio.resume(); } catch { soundOn = false; syncSound(); return; }
    }
    if (audio.state !== 'running' || !soundOn || document.hidden || paused) return;
    if (audioSources.size > 5) return;
    const frequency = frequencies[Math.min(4, Math.floor(x * 5))] * (who === 'you' ? 1.5 : 1);
    const rate = audio.sampleRate;
    const samples = Math.round(rate * 1.1);
    const period = Math.round(rate / frequency);
    const buffer = audio.createBuffer(1, samples, rate);
    const data = buffer.getChannelData(0);
    // Karplus–Strong: a filtered, decaying pluck, generated locally without audio files.
    for (let i = 0; i < period; i++) data[i] = (Math.random() * 2 - 1) * .32;
    for (let i = period; i < samples; i++) data[i] = (data[i - period] + data[i - period + 1]) * .497;
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(.2, audio.currentTime + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + 1.05);
    source.connect(gain);
    gain.connect(audio.destination);
    audioSources.add(source);
    source.onended = () => { audioSources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }

  function pluck(who, position = .58, strength = 15, audible = false) {
    const index = voices.indexOf(who);
    if (index < 0) return;
    const x = Math.max(.025, Math.min(.975, position));
    if (audible) tone(who, x);
    if (!mayMove()) return;
    const string = strings[index];
    const middle = x * (string.points.length - 1);
    const amplitude = Math.max(-height * .18, Math.min(height * .18, strength));
    for (let j = 1; j < string.points.length - 1; j++) {
      const distance = Math.abs(j - middle);
      if (distance < 7) string.points[j] += amplitude * Math.pow(1 - distance / 7, 2);
    }
    elapsed = 0;
    if (!raf) { lastFrame = 0; raf = requestAnimationFrame(frame); }
  }

  function locate(event) {
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const y = event.clientY - rect.top;
    const distances = voices.map((_, i) => y - resting(i, x));
    const index = Math.abs(distances[0]) < Math.abs(distances[1]) ? 0 : 1;
    return { x, y, index, distance: distances[index] };
  }

  // Do not capture the pointer or prevent touch defaults: the band remains a normal scrolling surface.
  surface.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !mayMove()) return;
    const point = locate(event), now = performance.now();
    if (lastPointer && Math.abs(point.distance) < 17 && now - lastPluck > 75) {
      const dy = point.y - lastPointer.y;
      if (Math.abs(dy) > 1) {
        lastPluck = now;
        pluck(voices[point.index], point.x, Math.sign(dy) * Math.min(20, Math.abs(dy) * 1.4 + 5), true);
      }
    }
    lastPointer = point;
  }, { passive: true });
  surface.addEventListener('pointerleave', () => { lastPointer = null; }, { passive: true });
  surface.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const point = locate(event);
    if (Math.abs(point.distance) < 30) pluck(voices[point.index], point.x, point.distance < 0 ? -18 : 18, true);
  }, { passive: true });
  for (const button of pluckButtons) {
    button.addEventListener('click', () => pluck(button.dataset.voicePluck, .58, 18, true));
  }

  if (soundButton) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      soundButton.hidden = true;
    } else {
      soundButton.addEventListener('click', async () => {
        if (soundPending) return;
        if (soundOn) { soundOn = false; stopSound(); syncSound(); return; }
        soundPending = true;
        try {
          audio ||= new Audio();
          await audio.resume();
          soundOn = audio.state === 'running' && !document.hidden;
          syncSound();
          if (soundOn) tone('you', .5);
        } catch {
          soundOn = false;
          syncSound();
          // A blocked AudioContext never prevents use of the visual interaction.
        } finally { soundPending = false; }
      });
    }
  }

  document.addEventListener('signature:voice', event => {
    // Product controls reinforce the voice metaphor visually; they do not start background audio.
    pluck(event.detail?.who, .55, 13, false);
  });
  document.addEventListener('signature:motion', event => {
    paused = event.detail?.paused ?? root.dataset.motion === 'paused';
    if (paused) { stopMotion(); stopSound(); }
  });
  reduce.addEventListener?.('change', stopMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopMotion();
      stopSound();
      if (audio?.state === 'running') void audio.suspend().catch(() => {});
    }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      if (!inView) { stopMotion(); stopSound(); }
    }, { rootMargin: '40px' }).observe(surface);
  } else inView = true;
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(surface);
  else addEventListener('resize', refresh, { passive: true });

  addEventListener('pagehide', () => { stopMotion(); stopSound(); if (audio) void audio.suspend().catch(() => {}); });
  syncSound();
  refresh();
})();
