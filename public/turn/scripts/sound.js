// Turn — sound. Every sound is synthesized live with the Web Audio API; there are no audio files.
//
// Off on every visit. Nothing is created until the reader presses the header Sound toggle: the AudioContext is
// made (and resumed) inside that click, the choice is not remembered, and the microphone is never touched.
// The context is suspended when sound is off or the tab is hidden.
//
//   IH.sound.enabled            true while sound is on
//   IH.sound.enable() / disable() / toggle()
//   IH.sound.play(name, opts)   no-op while sound is off. Names:
//     pluck {who, x, strength}  a plucked string (Karplus–Strong), pitch from x on the A minor pentatonic
//     them / me                 turn cues: the other side (A3 + fifth, warm) and the answer (E4 bell) — an open fifth
//     word                      a pencil touching paper, per surfacing word (capped at about 8 a second)
//     voice {who, level}        a whispered murmur in that voice's colour (fired by IH.emit('voice'))
//     tick, tap, toggle {on}, open, close, type, blink, result {ms}, success, error, whoosh {dir}
//   IH.emit('sound', on)        fired when the reader turns sound on or off
//
// Listens to IH 'pluck', 'turn', 'voice' (plays them), 'tick' (the ambient bed follows the time of day) and
// 'section' / 'lines' (the bed becomes water at the end). Global hooks, so sections need no code:
//   press on a[href], button, [role=button]           → tap   (keyboard Enter/Space too)
//   change of checkbox / radio; aria-pressed, aria-checked, aria-selected (tabs) flipped by the reader → toggle
//   aria-expanded flipped by the reader, <details> toggled → open / close
//   hover → tick on the Sound toggle only (no hover sounds anywhere else; call play('tick') yourself if you must)
//   [data-sound="none"] on an element or ancestor silences these hooks there.
// No sounds on scroll or on typing.
//
// Mix: one shared context → voices (dry bus + send to a short, warm, generated-impulse reverb) → master fade →
// gentle compressor → trim. Designed peaks sit near −18 dBFS for the loudest cues and far lower for UI sounds.
(() => {
  const IH = window.IH;
  if (!IH) return;
  const root = document.documentElement;
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  const dB = v => Math.pow(10, v / 20);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // A minor pentatonic (A C D E G). The other side lives around A3, you a fifth higher around E4.
  const PLUCK_NOTES = { them: [57, 60, 62, 64, 67, 69], me: [64, 67, 69, 72, 74, 76] };
  const LADDER = [57, 60, 62, 64, 67, 69, 72, 74, 76];
  const PAN = { them: -0.14, me: 0.14 }; // the two channels, barely apart

  // Calibrated with OfflineAudioContext renders (see the scratch test): the compressor adds make-up gain, trim
  // takes it back so quiet sounds pass at unity and only stacked peaks get squeezed.
  const TRIM = dB(-5.5);
  const WET = 0.62;

  /* =====================================================================================================
     Engine: builds the graph and every sound on any BaseAudioContext (live, or offline for tests).
     ===================================================================================================== */
  function createEngine(ctx) {
    const sr = ctx.sampleRate;
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const trim = ctx.createGain();
    trim.gain.value = TRIM;
    master.connect(comp); comp.connect(trim); trim.connect(ctx.destination);
    const bus = ctx.createGain();
    bus.connect(master);
    const verbIn = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = impulse();
    const wet = ctx.createGain();
    wet.gain.value = WET;
    verbIn.connect(verb); verb.connect(wet); wet.connect(master);
    const white = whiteNoise(2);
    let active = 0;
    let water = false;

    /* ---------- buffers ---------- */
    function whiteNoise(seconds) {
      const b = ctx.createBuffer(1, Math.floor(sr * seconds), sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    // A short warm room: ~1.2 s RT60, 9 ms pre-delay, a few early reflections, highs dying faster than lows.
    function impulse() {
      const len = Math.floor(sr * 1.25), pre = Math.floor(sr * 0.009);
      const b = ctx.createBuffer(2, len, sr);
      const taps = [[0.013, 0.34], [0.019, 0.26], [0.027, 0.22], [0.037, 0.16], [0.046, 0.12]];
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) {
          const t = (i - pre) / sr;
          const a = 0.08 + 0.5 * Math.exp(-t / 0.35);
          lp += a * (Math.random() * 2 - 1 - lp);
          const att = Math.min(1, t / 0.006);
          d[i] = lp * att * Math.exp(-t / 0.18);
        }
        for (const [s, g] of taps) {
          const i = pre + Math.floor((s + (ch ? 0.0031 : 0)) * sr);
          if (i < len) d[i] += g * (ch ? -1 : 1);
        }
        const fade = Math.floor(sr * 0.06);
        for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
      }
      return b;
    }
    // Seamlessly looping pink noise at a low sample rate (the bed never goes above ~2 kHz).
    function pinkLoop(seconds = 7, rate = 22050) {
      const L = Math.floor(rate * seconds), X = Math.floor(rate * 0.5);
      const tmp = new Float32Array(L + X);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, sum = 0;
      for (let i = 0; i < tmp.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        tmp[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
        sum += tmp[i] * tmp[i];
      }
      const norm = 0.25 / Math.sqrt(sum / tmp.length);
      const b = ctx.createBuffer(1, L, rate), d = b.getChannelData(0);
      for (let i = 0; i < L; i++) d[i] = tmp[i] * norm;
      for (let i = 0; i < X; i++) { const u = i / X; d[i] = d[i] * Math.sqrt(u) + tmp[L + i] * norm * Math.sqrt(1 - u); }
      return b;
    }
    // Karplus–Strong string, rendered once per note and brightness, then cached.
    const ksCache = new Map();
    function ks(midi, bright) {
      const key = midi * 2 + bright;
      if (ksCache.has(key)) return ksCache.get(key);
      const f = mtof(midi);
      const N = Math.max(8, Math.floor(sr / f - 0.5));
      const f0 = sr / (N + 0.5); // the averaging filter adds half a sample; playbackRate corrects the rest
      const t60 = 2.6 * Math.pow(220 / f, 0.45);
      const len = Math.floor(sr * Math.min(2.4, t60 * 0.85));
      const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
      // Excitation: the shape of a string pulled aside at a fifth of its length (a triangle: a round, strong
      // fundamental), plus a little smoothed noise, comb-filtered at the same point, for the touch of the finger.
      const ex = new Float32Array(N);
      const P = Math.max(1, Math.round(N * 0.2));
      let lp = 0, nr = 0;
      const a = bright ? 0.6 : 0.3;
      for (let i = 0; i < N; i++) { lp += a * (Math.random() * 2 - 1 - lp); ex[i] = lp; }
      const nz = new Float32Array(N);
      for (let i = 0; i < N; i++) { nz[i] = ex[i] - ex[(i - P + N) % N]; nr += nz[i] * nz[i]; }
      nr = Math.sqrt(nr / N) || 1;
      const mix = bright ? 0.42 : 0.2;
      let mean = 0;
      for (let i = 0; i < N; i++) {
        const tri = i < P ? i / P : (N - i) / (N - P);
        d[i] = tri + mix * nz[i] / nr * 0.5;
        mean += d[i];
      }
      mean /= N;
      for (let i = 0; i < N; i++) d[i] -= mean;
      const rho = Math.pow(0.001, 1 / (f0 * t60));
      d[N] = rho * 0.5 * d[0];
      for (let n = N + 1; n < len; n++) d[n] = rho * 0.5 * (d[n - N] + d[n - N - 1]);
      let peak = 0;
      for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
      const k = peak ? 1 / peak : 1;
      const fin = Math.floor(sr * 0.0015), fout = Math.floor(sr * 0.18);
      for (let i = 0; i < len; i++) {
        let g = k;
        if (i < fin) g *= 0.5 - 0.5 * Math.cos(Math.PI * i / fin);
        if (i > len - fout) g *= 0.5 - 0.5 * Math.cos(Math.PI * (len - i) / fout);
        d[i] *= g;
      }
      const v = { buffer: b, f0 };
      ksCache.set(key, v);
      return v;
    }

    /* ---------- voice plumbing ---------- */
    // One output per sound: a gain into the dry bus, an optional stereo position, and a send to the room.
    function out({ send = 0.15, pan = 0, gain = 1 } = {}) {
      const g = ctx.createGain();
      g.gain.value = gain;
      let head = g, p = null, s = null;
      if (pan && ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); head = p; }
      head.connect(bus);
      if (send > 0) { s = ctx.createGain(); s.gain.value = send; head.connect(s); s.connect(verbIn); }
      active++;
      return {
        node: g, pan: p,
        // Release the nodes when the last source of this sound ends.
        end(src) { src.onended = () => { active--; try { g.disconnect(); p?.disconnect(); s?.disconnect(); } catch (e) { /* already gone */ } }; }
      };
    }
    // Silent start, linear attack, exponential decay to −60 dB below the peak, then a short linear run to zero.
    function env(param, t, peak, a, d, hold = 0) {
      param.value = 0; // a GainNode starts at 1: silence it until its own start time, too
      param.setValueAtTime(0, t);
      param.linearRampToValueAtTime(peak, t + a);
      if (hold) param.setValueAtTime(peak, t + a + hold);
      param.exponentialRampToValueAtTime(Math.max(1e-7, peak * 1e-3), t + a + hold + d);
      param.linearRampToValueAtTime(0, t + a + hold + d + 0.015);
      return t + a + hold + d + 0.02;
    }
    // A smooth swell (raised-cosine up, raised-cosine down) that starts and ends at exactly zero.
    function swell(param, t, peak, dur, rise = 0.5) {
      const n = 64, c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const v = u < rise ? Math.sin(Math.PI / 2 * u / rise) : Math.cos(Math.PI / 2 * (u - rise) / (1 - rise));
        c[i] = peak * v * v;
      }
      param.value = 0;
      param.setValueCurveAtTime(c, t, dur);
      return t + dur;
    }
    function osc(type, f, t, detune = 0) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (detune) o.detune.setValueAtTime(detune, t);
      return o;
    }
    // A plain enveloped oscillator into dest; returns [oscillator, stop time].
    function tone(dest, { type = 'sine', f, t, peak, a = 0.005, d = 0.5, hold = 0, detune = 0, glide = 0, glideT = 0.05 }) {
      const o = osc(type, f, t, detune);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + glideT);
      const g = ctx.createGain();
      const stop = env(g.gain, t, peak, a, d, hold);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(stop);
      return [o, stop];
    }
    // A filtered noise burst into dest.
    function burst(dest, { t, dur, peak, f, q = 1, type = 'bandpass', a = 0.001, f2 = 0 }) {
      const src = ctx.createBufferSource();
      src.buffer = white;
      const bp = ctx.createBiquadFilter();
      bp.type = type; bp.frequency.setValueAtTime(f, t); bp.Q.value = q;
      if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ctx.createGain();
      const stop = env(g.gain, t, peak, a, dur);
      src.connect(bp); bp.connect(g); g.connect(dest);
      src.start(t, Math.random() * (white.duration - dur - 0.1));
      src.stop(stop);
      return [src, stop];
    }
    const last = list => list.reduce((m, x) => (x[1] > m[1] ? x : m))[0];

    /* ---------- the sounds ---------- */
    const plucks = [];
    const S = {
      pluck(t, { who = 'me', x = 0.5, strength = 0.6 } = {}) {
        who = who === 'them' ? 'them' : 'me';
        const notes = PLUCK_NOTES[who];
        const s = clamp(Number(strength) || 0, 0, 1);
        const m = notes[clamp(Math.floor(clamp(Number(x) || 0, 0, 0.9999) * notes.length), 0, notes.length - 1)];
        const { buffer, f0 } = ks(m, s > 0.55 ? 1 : 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const rate = mtof(m) / f0 * Math.pow(2, rnd(3) / 1200);
        src.playbackRate.value = rate;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 0.4;
        lp.frequency.value = (who === 'them' ? 1300 : 1900) + 3800 * s * s;
        const v = out({ send: water ? 0.5 : 0.24, pan: (clamp(Number(x) || 0.5, 0, 1) - 0.5) * 0.7 + PAN[who] });
        const g = v.node.gain;
        const peak = dB(-28 + 11 * s + rnd(0.8));
        const end = t + buffer.duration / rate;
        g.setValueAtTime(0, t);
        g.linearRampToValueAtTime(peak, t + 0.003);
        g.setValueAtTime(peak, end - 0.04);
        g.linearRampToValueAtTime(0, end);
        src.connect(lp); lp.connect(v.node);
        src.start(t); src.stop(end + 0.01);
        v.end(src);
        // At most eight strings ring at once; the oldest lets go quickly.
        plucks.push({ g, end });
        const now = ctx.currentTime;
        for (let i = plucks.length - 1; i >= 0; i--) if (plucks[i].end < now) plucks.splice(i, 1);
        while (plucks.length > 8) {
          const o = plucks.shift();
          o.g.cancelScheduledValues(now);
          o.g.setTargetAtTime(0, now, 0.015);
        }
      },

      // The other side's turn: low and warm, A3 with its fifth.
      them(t) {
        const v = out({ send: 0.3, pan: PAN.them, gain: dB(-18.5) });
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
        lp.connect(v.node);
        const parts = [
          tone(lp, { type: 'triangle', f: mtof(57), t, peak: 1, a: 0.03, d: 0.85, detune: rnd(3) }),
          tone(lp, { type: 'sine', f: mtof(64), t: t + 0.012, peak: 0.42, a: 0.045, d: 0.7, detune: rnd(3) })
        ];
        v.end(last(parts));
      },

      // Your turn: a brighter bell on E4 with a faint octave shimmer. Over a ringing "them", an open fifth.
      me(t) {
        const v = out({ send: 0.36, pan: PAN.me, gain: dB(-20) });
        const f = mtof(64);
        // body: sine with a quick FM brightness at the strike. A 1:3 ratio keeps every sideband harmonic
        // (octave, two octaves…) and puts none at 0 Hz, so there is no DC thump.
        const car = osc('sine', f, t, rnd(3));
        const mod = osc('sine', f * 3, t);
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 3 * 0.55, t);
        mg.gain.exponentialRampToValueAtTime(f * 3 * 0.004, t + 0.34);
        mod.connect(mg); mg.connect(car.frequency);
        const cg = ctx.createGain();
        const stop = env(cg.gain, t, 1, 0.006, 1.15);
        car.connect(cg); cg.connect(v.node);
        car.start(t); mod.start(t); car.stop(stop); mod.stop(stop);
        // shimmer: the octave, slow to arrive, with a gentle tremolo on its own stage
        const sh = osc('sine', f * 2, t, 4 + rnd(2));
        const trem = ctx.createGain(); trem.gain.value = 0.7;
        const lfo = osc('sine', 5.2, t);
        const lg = ctx.createGain(); lg.gain.value = 0.3;
        lfo.connect(lg); lg.connect(trem.gain);
        const sg = ctx.createGain();
        const stop2 = env(sg.gain, t + 0.03, 0.17, 0.08, 1.35);
        sh.connect(trem); trem.connect(sg); sg.connect(v.node);
        sh.start(t); lfo.start(t); sh.stop(stop2); lfo.stop(stop2);
        // strike: two octaves up, gone in a moment
        tone(v.node, { f: f * 4, t, peak: 0.1, a: 0.002, d: 0.14 });
        v.end(sh);
      },

      // A pencil touching paper: a tiny, slightly pitched noise tick.
      word(t) {
        const v = out({ send: 0.05, pan: PAN.me + rnd(0.25), gain: dB(-26.5 + rnd(1.5)) });
        const f = mtof(pick([98, 100, 103, 105])) * (1 + rnd(0.012));
        const parts = [
          burst(v.node, { t, dur: 0.016, peak: 1, f, q: 5, a: 0.0012 }),
          burst(v.node, { t, dur: 0.006, peak: 0.14, f: 6800, q: 1.2, a: 0.0008 })
        ];
        v.end(last(parts));
      },

      // Someone speaking: a whispered vowel, low and muffled, in that voice's colour. Your words already have the
      // pencil tick ('word'), so by default only the other side murmurs.
      voice(t, { who = 'them', level = 0.5, force = false } = {}) {
        who = who === 'me' ? 'me' : 'them';
        if (who === 'me' && !force) return;
        const lvl = clamp(Number(level) || 0, 0, 1);
        if (lvl < 0.04) return;
        const F = pick(who === 'them' ? [[650, 1080], [570, 840], [700, 1220]] : [[440, 1800], [400, 2000], [520, 1700]]);
        const v = out({ send: 0.12, pan: PAN[who] * 1.4, gain: dB((who === 'them' ? -37 : -40) + 5 * lvl) });
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.5;
        lp.connect(v.node);
        const src = ctx.createBufferSource();
        src.buffer = white;
        const g = ctx.createGain();
        const dur = 0.1 + Math.random() * 0.05;
        const stop = env(g.gain, t, 1, 0.03, dur);
        src.connect(g);
        F.forEach((f, i) => {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = f * (1 + rnd(0.04));
          bp.Q.value = i ? 9 : 6;
          const bg = ctx.createGain(); bg.gain.value = i ? 0.6 : 1;
          g.connect(bp); bp.connect(bg); bg.connect(lp);
        });
        src.start(t, Math.random() * (white.duration - 0.4));
        src.stop(stop);
        v.end(src);
      },

      // Hover on the few controls that opt in: barely there.
      tick(t) {
        const v = out({ send: 0.04, gain: dB(-24) });
        v.end(burst(v.node, { t, dur: 0.008, peak: 1, f: 4200 * (1 + rnd(0.04)), q: 3 })[0]);
      },
      // Press: a short bright click over a soft low knock.
      tap(t) {
        const v = out({ send: 0.06, gain: dB(-19) });
        const parts = [
          burst(v.node, { t, dur: 0.012, peak: 1, f: 3200 * (1 + rnd(0.05)), q: 2.5 }),
          tone(v.node, { f: 210, glide: 140, glideT: 0.05, t, peak: 0.1, a: 0.002, d: 0.05 })
        ];
        v.end(last(parts));
      },
      // A tiny text change.
      type(t) {
        const v = out({ send: 0.03, gain: dB(-27 + rnd(1.5)) });
        v.end(burst(v.node, { t, dur: 0.006, peak: 1, f: 5600 * (1 + rnd(0.05)), q: 4 })[0]);
      },
      // A switch: a fourth up for on (E5 → A5), down for off.
      toggle(t, { on = true } = {}) {
        const v = out({ send: 0.12, gain: dB(-24) });
        const [a, b] = on ? [76, 81] : [81, 76];
        const parts = [
          burst(v.node, { t, dur: 0.008, peak: 0.6, f: 3000, q: 2.5 }),
          tone(v.node, { f: mtof(a), t: t + 0.004, peak: 0.42, a: 0.003, d: 0.12, detune: rnd(3) }),
          tone(v.node, { f: mtof(b), t: t + 0.064, peak: 0.42, a: 0.003, d: 0.16, detune: rnd(3) })
        ];
        v.end(last(parts));
      },
      // A soft airy swell up (open) or down (close), with a faint fourth gliding underneath.
      open(t) { S._air(t, true); },
      close(t) { S._air(t, false); },
      _air(t, up) {
        const v = out({ send: 0.22, gain: dB(-25) });
        const dur = up ? 0.34 : 0.28;
        const src = ctx.createBufferSource();
        src.buffer = white;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(up ? 700 : 2600, t);
        bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 700, t + dur);
        const g = ctx.createGain();
        swell(g.gain, t, 1, dur, up ? 0.6 : 0.3);
        src.connect(bp); bp.connect(g); g.connect(v.node);
        src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.01);
        const o = osc('sine', mtof(up ? 76 : 81), t);
        o.frequency.exponentialRampToValueAtTime(mtof(up ? 81 : 76), t + dur);
        const og = ctx.createGain();
        swell(og.gain, t, 0.05, dur, up ? 0.6 : 0.3);
        o.connect(og); og.connect(v.node);
        o.start(t); o.stop(t + dur + 0.01);
        v.end(src);
      },
      // Game start: a tongue "tsk", then a small wooden click.
      blink(t) {
        const v = out({ send: 0.1, gain: dB(-20) });
        const parts = [
          burst(v.node, { t, dur: 0.028, peak: 1, f: 4400, q: 1.6, a: 0.0015 }),
          burst(v.node, { t: t + 0.075, dur: 0.01, peak: 0.6, f: 2400, q: 3 }),
          tone(v.node, { f: 1600, glide: 900, glideT: 0.03, t: t + 0.075, peak: 0.16, a: 0.001, d: 0.035 })
        ];
        v.end(last(parts));
      },
      // Game result: the faster the answer, the higher the note.
      result(t, { ms } = {}) {
        ms = Number(ms);
        if (!Number.isFinite(ms) || ms < 0) { S.error(t); return; }
        const u = clamp((Math.log(1100) - Math.log(Math.max(1, ms))) / (Math.log(1100) - Math.log(140)), 0, 1);
        const m = LADDER[Math.round(u * (LADDER.length - 1))];
        const v = out({ send: 0.32, gain: dB(-20) });
        const bell = S._bell(v.node, mtof(m), t, 1, 0.95);
        tone(v.node, { f: mtof(m - 12), t: t + 0.01, peak: 0.22, a: 0.02, d: 0.8 });
        v.end(bell); // the bell rings longest; releasing on a shorter voice would cut it off with a click
      },
      _bell(dest, f, t, peak, d) {
        const car = osc('sine', f, t, rnd(3));
        const mod = osc('sine', f * 3, t);
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 3 * 0.4, t);
        mg.gain.exponentialRampToValueAtTime(f * 3 * 0.004, t + 0.26);
        mod.connect(mg); mg.connect(car.frequency);
        const g = ctx.createGain();
        const stop = env(g.gain, t, peak, 0.005, d);
        car.connect(g); g.connect(dest);
        car.start(t); mod.start(t); car.stop(stop); mod.stop(stop);
        tone(dest, { f: f * 2, t: t + 0.01, peak: peak * 0.12, a: 0.03, d: d * 0.8, detune: 3 });
        return car;
      },
      // Done: an unhurried A–C–E over a soft A3, into the room.
      success(t) {
        const v = out({ send: 0.4, gain: dB(-21.5) });
        S._bell(v.node, mtof(69), t, 0.8, 1.0);
        S._bell(v.node, mtof(72), t + 0.17, 0.8, 1.0);
        const lastNote = S._bell(v.node, mtof(76), t + 0.34, 0.9, 1.8);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(v.node);
        tone(lp, { type: 'triangle', f: mtof(57), t, peak: 0.32, a: 0.25, d: 1.7 });
        v.end(lastNote);
      },
      // Not quite: two soft low notes, C4 down to A3.
      error(t) {
        const v = out({ send: 0.16, gain: dB(-21) });
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5; lp.connect(v.node);
        const parts = [
          tone(lp, { type: 'triangle', f: mtof(60), t, peak: 1, a: 0.012, d: 0.3, detune: rnd(3) }),
          tone(lp, { type: 'triangle', f: mtof(57), t: t + 0.15, peak: 1, a: 0.012, d: 0.36, detune: rnd(3) })
        ];
        v.end(last(parts));
      },
      // A big scene change: a filtered-noise sweep that crosses the stereo field.
      whoosh(t, { dir = 'up' } = {}) {
        const up = !(dir === 'down' || dir === 'out' || dir === 'back' || dir < 0);
        const v = out({ send: 0.26, gain: dB(-20) });
        const dur = 0.8;
        const src = ctx.createBufferSource();
        src.buffer = white;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.1;
        bp.frequency.setValueAtTime(up ? 260 : 2400, t);
        bp.frequency.exponentialRampToValueAtTime(up ? 2400 : 260, t + dur);
        const g = ctx.createGain();
        swell(g.gain, t, 1, dur, 0.45);
        src.connect(bp); bp.connect(g); g.connect(v.node);
        if (v.pan) { v.pan.pan.setValueAtTime(up ? -0.35 : 0.35, t); v.pan.pan.linearRampToValueAtTime(up ? 0.35 : -0.35, t + dur); }
        src.start(t, Math.random() * 1); src.stop(t + dur + 0.01);
        v.end(src);
      },
      // The room opens (first time sound is turned on): A3, E4, A4 and a faint E5, arriving one by one.
      room(t) {
        const v = out({ send: 0.5, gain: dB(-24) });
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.4; lp.connect(v.node);
        const parts = [
          tone(lp, { type: 'triangle', f: mtof(57), t, peak: 0.9, a: 0.32, d: 2.2, detune: rnd(2) }),
          tone(lp, { f: mtof(64), t: t + 0.12, peak: 0.6, a: 0.3, d: 2.1, detune: rnd(3) }),
          tone(lp, { f: mtof(69), t: t + 0.24, peak: 0.42, a: 0.3, d: 2.0, detune: rnd(3) }),
          tone(lp, { f: mtof(76), t: t + 0.36, peak: 0.16, a: 0.4, d: 1.9, detune: 5 })
        ];
        const src = ctx.createBufferSource();
        src.buffer = white;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.7;
        const g = ctx.createGain();
        swell(g.gain, t, 0.12, 1.3, 0.4);
        src.connect(bp); bp.connect(g); g.connect(v.node);
        src.start(t); src.stop(t + 1.32);
        v.end(last(parts));
      }
    };

    /* ---------- ambient bed ---------- */
    // Filtered pink noise with a very slow breath; colour follows the time of day. At the end it becomes water.
    // keyframes: [minutes, lowpass Hz, breath Hz, level dB]
    const DAY = [[0, 300, 0.035, -1.5], [300, 340, 0.04, -1.5], [480, 1150, 0.085, 0], [540, 1450, 0.1, 0], [720, 1300, 0.09, 0],
      [900, 900, 0.075, 0], [1080, 680, 0.06, -0.5], [1200, 500, 0.05, -1], [1320, 380, 0.04, -1.5], [1440, 300, 0.035, -1.5]];
    const BED = dB(-38);
    function dayParams(min) {
      min = ((min % 1440) + 1440) % 1440;
      let i = 0;
      while (i < DAY.length - 2 && DAY[i + 1][0] <= min) i++;
      const [m0, c0, r0, l0] = DAY[i], [m1, c1, r1, l1] = DAY[i + 1];
      const u = clamp((min - m0) / Math.max(1, m1 - m0), 0, 1);
      return { cut: Math.exp(Math.log(c0) + (Math.log(c1) - Math.log(c0)) * u), rate: r0 + (r1 - r0) * u, lvl: l0 + (l1 - l0) * u };
    }
    let bed = null, bedMin = 540;
    function startBed(min, wat, immediate = false) {
      water = !!wat;
      bedMin = min;
      if (bed) { setBed(true); fadeBed(true); return; }
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = pinkLoop(); src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45; hp.Q.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
      const amp = ctx.createGain();
      const fade = ctx.createGain();
      const breath = osc('sine', 0.07, t);
      const breathAmp = ctx.createGain(), breathCut = ctx.createGain();
      const wave = osc('sine', 0.11, t), wave2 = osc('sine', 0.173, t);
      const waveAmp = ctx.createGain(), waveCut = ctx.createGain(), wave2Amp = ctx.createGain();
      breath.connect(breathAmp); breathAmp.connect(amp.gain);
      breath.connect(breathCut); breathCut.connect(lp.frequency);
      wave.connect(waveAmp); waveAmp.connect(amp.gain);
      wave.connect(waveCut); waveCut.connect(lp.frequency);
      wave2.connect(wave2Amp); wave2Amp.connect(amp.gain);
      src.connect(hp); hp.connect(lp); lp.connect(amp); amp.connect(fade); fade.connect(master);
      fade.gain.setValueAtTime(immediate ? 1 : 0, t);
      if (!immediate) fade.gain.setTargetAtTime(1, t + 0.2, 1.1);
      bed = { src, lp, amp, fade, breath, breathAmp, breathCut, wave, wave2, waveAmp, waveCut, wave2Amp };
      setBed(true);
      src.start(t, Math.random() * 6); breath.start(t); wave.start(t); wave2.start(t);
    }
    function setBed(immediate = false) {
      if (!bed) return;
      const t = ctx.currentTime, tau = immediate ? 0.001 : 0.9;
      const p = dayParams(bedMin);
      const set = (param, v) => { if (immediate) param.setValueAtTime(v, t); else param.setTargetAtTime(v, t, tau); };
      const base = water ? BED * dB(1.5) : BED * dB(p.lvl);
      const cut = water ? 520 : p.cut;
      set(bed.lp.frequency, cut);
      set(bed.amp.gain, base);
      set(bed.breathAmp.gain, base * (water ? 0.12 : 0.3));
      set(bed.breathCut.gain, cut * (water ? 0.08 : 0.14));
      set(bed.breath.frequency, water ? 0.05 : p.rate);
      // Water: two slow, unrelated waves lift the level and open the filter together, like a wash on the shore.
      set(bed.waveAmp.gain, water ? base * 0.5 : 0);
      set(bed.wave2Amp.gain, water ? base * 0.28 : 0);
      set(bed.waveCut.gain, water ? 300 : 0);
    }
    function fadeBed(on) {
      if (!bed) return;
      const t = ctx.currentTime, g = bed.fade.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.setTargetAtTime(on ? 1 : 0, t, on ? 1.1 : 0.08);
    }

    return {
      ctx, master,
      get active() { return active; },
      play(name, opts, t) { const fn = S[name]; if (fn && name[0] !== '_') fn(t ?? ctx.currentTime + 0.005, opts || {}); },
      startBed, fadeBed,
      setTime(min) { bedMin = min; setBed(); },
      setWater(on) { if (water === !!on) return; water = !!on; setBed(); },
      fade(on, tau = 0.08) {
        const t = ctx.currentTime, g = master.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(on ? 1 : 0, t, tau);
      }
    };
  }

  /* =====================================================================================================
     Live controller: toggle, rate limits, lifecycle, hooks.
     ===================================================================================================== */
  let ctx = null, eng = null, on = false, opened = false, suspendTimer = 0, minutes = 539, waterMode = IH.state?.lines === 'water';
  const toggles = [...document.querySelectorAll('[data-sound-toggle]')];
  if (!AC) toggles.forEach(b => { b.hidden = true; });

  // Repeats never machine-gun: each sound has a minimum gap, and all sounds share a small budget per second.
  const GAP = { tick: 0.07, tap: 0.1, type: 0.045, word: 0.12, voice: 0.16, toggle: 0.08, open: 0.12, close: 0.12, whoosh: 0.35,
    them: 0.25, me: 0.25, blink: 0.15, result: 0.2, success: 0.6, error: 0.3, pluck: 0.03, room: 1 };
  const STREAM = new Set(['pluck', 'word', 'voice']);
  const lastAt = {};
  const buckets = { ui: { tokens: 8, cap: 8, rate: 12, t: 0 }, stream: { tokens: 12, cap: 12, rate: 18, t: 0 } };
  function allowed(name, opts) {
    const now = performance.now() / 1000;
    const key = name === 'pluck' || name === 'voice' ? name + (opts?.who || '') : name;
    if (now - (lastAt[key] ?? -9) < (GAP[name] ?? 0.05)) return false;
    const b = buckets[STREAM.has(name) ? 'stream' : 'ui'];
    b.tokens = Math.min(b.cap, b.tokens + (now - b.t) * b.rate); b.t = now;
    if (b.tokens < 1) return false;
    // Under heavy load keep the meaningful sounds and drop the decorative ones.
    if (eng.active > 22 && (name === 'word' || name === 'voice' || name === 'type' || name === 'tick')) return false;
    b.tokens -= 1;
    lastAt[key] = now;
    return true;
  }
  const HIT = new Set(['them', 'me', 'success', 'result', 'room']);
  let lastName = '';
  let hitTimer = 0;
  function play(name, opts) {
    if (!on || !eng || document.hidden || ctx.state !== 'running') return;
    if (!allowed(name, opts)) return;
    try { eng.play(name, opts); lastName = name; } catch (e) { /* a sound must never break the page */ }
    // The meter in the header answers the sounds that carry meaning.
    if (HIT.has(name) || (name === 'pluck' && (opts?.strength ?? 0) > 0.35)) {
      toggles.forEach(b => b.classList.add('is-hit'));
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => toggles.forEach(b => b.classList.remove('is-hit')), 110);
    }
  }

  function ensure() {
    if (ctx) return true;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    eng = createEngine(ctx);
    return true;
  }
  function enable() {
    if (on || !ensure()) return;
    on = true;
    clearTimeout(suspendTimer);
    const first = !opened;
    opened = true;
    const start = () => {
      if (!on) return;
      eng.fade(true, 0.05);
      eng.startBed(minutes, waterMode);
      const t = ctx.currentTime + 0.03;
      if (first) eng.play('room', {}, t);
      else eng.play('toggle', { on: true }, t);
    };
    // resume() is called inside the click, which is what lets the context start. Older iOS also wants a source
    // started synchronously inside the gesture: one silent sample.
    const r = ctx.resume?.();
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0); } catch (e) { /* fine */ }
    if (ctx.state === 'running' || !r) start(); else r.then(start, () => {});
    sync();
    if (first) showHint();
    IH.emit('sound', true);
  }
  function disable() {
    if (!on) return;
    // The switch-off is the last thing you hear, then everything fades and the context sleeps.
    if (ctx.state === 'running') eng.play('toggle', { on: false }, ctx.currentTime + 0.005);
    on = false;
    const t = ctx.currentTime;
    eng.master.gain.cancelScheduledValues(t);
    eng.master.gain.setValueAtTime(eng.master.gain.value, t);
    eng.master.gain.setTargetAtTime(0, t + 0.2, 0.07);
    eng.fadeBed(false);
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => { if (!on) ctx.suspend?.(); }, 900);
    sync();
    hideHint();
    IH.emit('sound', false);
  }
  const toggle = () => (on ? disable() : enable());

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    clearTimeout(suspendTimer);
    if (document.hidden) {
      if (on) eng.fade(false, 0.03);
      suspendTimer = setTimeout(() => ctx.suspend?.(), 160);
    } else if (on) {
      ctx.resume?.().then(() => eng.fade(true, 0.15), () => {});
    }
  });
  // iOS can interrupt the context (calls, other apps); the next touch brings it back.
  addEventListener('pointerdown', () => { if (on && ctx && ctx.state !== 'running' && !document.hidden) ctx.resume?.(); }, { passive: true, capture: true });

  /* ---------- the toggle ---------- */
  function sync() {
    for (const b of toggles) {
      b.setAttribute('aria-pressed', String(on));
      const label = on ? b.dataset.labelOn : b.dataset.labelOff;
      if (label) b.setAttribute('aria-label', label);
      b.classList.toggle('is-on', on);
      // Bars settle from wherever they were dancing instead of snapping flat.
      if (!on && b.animate) {
        for (const bar of b.querySelectorAll('.sound-toggle__bars i')) {
          const cs = getComputedStyle(bar), from = cs.transform;
          const flat = parseFloat(cs.getPropertyValue('--flat')) || 0.17;
          if (from && from !== 'none') bar.animate([{ transform: from }, { transform: `scaleY(${flat})` }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      }
    }
    root.classList.toggle('sound-on', on);
  }
  toggles.forEach(b => b.addEventListener('click', toggle));

  /* ---------- first-time hint ---------- */
  let hint = null, hintTimer = 0;
  function showHint() {
    const btn = toggles.find(b => b.offsetParent !== null);
    // Only point at the lines when they are live and can actually be plucked.
    const lines = IH.lines || document.querySelector('.lines.is-live');
    if (!btn || !lines || !['hero', 'gap', 'day', 'water'].includes(IH.state?.lines || 'hero')) return;
    const touch = matchMedia('(pointer: coarse)').matches;
    hint = document.createElement('p');
    hint.className = 'sound-hint';
    hint.setAttribute('role', 'status');
    hint.innerHTML = '<svg class="sound-hint__lines" viewBox="0 0 18 12" aria-hidden="true"><path class="sound-hint__them" d="M1 4c3 0 5-2.4 8-2.4S14 4 17 4"/><path class="sound-hint__me" d="M1 9h16"/></svg><span></span>';
    const text = touch ? IH.t('碰一下那两根线', 'Try touching the lines') : IH.t('拨一下那两根线', 'Try plucking the lines');
    document.body.append(hint);
    place();
    addEventListener('resize', place);
    // Text goes in after the live region exists, so screen readers announce it.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!hint) return; hint.lastChild.textContent = text; place(); hint.classList.add('is-in'); }));
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 4600);
    function place() {
      if (!hint) return;
      // Right-aligned under the toggle, kept inside the viewport, the notch always pointing at the toggle.
      const r = btn.getBoundingClientRect(), w = hint.offsetWidth, cx = r.left + r.width / 2;
      let right = Math.max(12, innerWidth - r.right);
      if (innerWidth - right - w < 12) right = Math.max(12, innerWidth - 12 - w);
      hint.style.top = `${Math.round(r.bottom + 10)}px`;
      hint.style.right = `${Math.round(right)}px`;
      hint.style.setProperty('--notch', `${Math.round(clamp(innerWidth - right - cx, 14, w - 14))}px`);
    }
    hint._place = place;
  }
  function hideHint() {
    clearTimeout(hintTimer);
    const h = hint;
    if (!h) return;
    hint = null;
    removeEventListener('resize', h._place);
    h.classList.remove('is-in');
    h.classList.add('is-out');
    setTimeout(() => h.remove(), 420);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') hideHint(); });

  /* ---------- runtime events ---------- */
  IH.on('pluck', d => { play('pluck', d); if (hint) setTimeout(hideHint, 900); });
  IH.on('turn', d => play(d?.who === 'me' ? 'me' : 'them'));
  IH.on('voice', d => play('voice', d));
  let timeQueued = 0;
  IH.on('tick', d => {
    if (typeof d?.minutes !== 'number') return;
    minutes = d.minutes;
    if (!on || timeQueued) return;
    timeQueued = setTimeout(() => { timeQueued = 0; if (on) eng.setTime(minutes); }, 180);
  });
  const setWater = w => { waterMode = w; if (on) eng.setWater(w); };
  IH.on('section', s => { if (s?.lines) setWater(s.lines === 'water'); });
  IH.on('lines', o => { if (o?.mode) setWater(o.mode === 'water'); });

  /* ---------- global hooks ---------- */
  let lastInput = -1e4, lastKey = -1e4;
  const recent = () => performance.now() - lastInput < 900;
  const silenced = el => !!el.closest('[data-sound="none"], [data-sound="off"]');
  addEventListener('pointerdown', () => { lastInput = performance.now(); }, { passive: true, capture: true });
  addEventListener('keydown', e => {
    const field = e.target.closest?.('textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])');
    const act = e.key === 'Enter' || (e.key === ' ' && !field);
    if (act || (e.key.startsWith('Arrow') && e.target !== document.body)) lastInput = performance.now();
    if (act) lastKey = lastInput;
  }, { capture: true });
  addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') lastKey = lastInput = performance.now(); }, { capture: true });

  // Hover: the Sound toggle only.
  document.addEventListener('pointerover', e => {
    if (!on || e.pointerType !== 'mouse') return;
    const el = e.target.closest?.('[data-sound-toggle]');
    if (!el || el.contains(e.relatedTarget) || el.disabled) return;
    play('tick');
  }, { passive: true });

  // Press. Controls that change a state (switches, tabs, disclosures) get their state sound instead.
  const TAP = 'a[href], button, [role="button"], input[type="submit"], input[type="button"], input[type="reset"], [data-sound="tap"]';
  const STATEFUL = '[data-sound-toggle], [aria-pressed], [aria-expanded], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], summary, :disabled, [aria-disabled="true"]';
  const tapTarget = t => {
    const el = t?.closest?.(TAP);
    return el && !el.matches(STATEFUL) && !silenced(el) ? el : null;
  };
  document.addEventListener('pointerdown', e => {
    if (!on || e.button !== 0) return;
    if (tapTarget(e.target)) play('tap');
  }, { passive: true, capture: true });
  // Keyboard activation produces a click with no pointer (detail 0) right after Enter/Space.
  document.addEventListener('click', e => {
    if (!on || e.detail !== 0 || performance.now() - lastKey > 120) return;
    if (tapTarget(e.target)) play('tap');
  }, true);

  // Switches and choices. Within a group (radios, segmented buttons, tabs), picking a later option goes up.
  const indexIn = (el, sel) => {
    const group = el.matches('input[type="radio"]') && el.name
      ? [...(el.form || document).querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)]
      : [...(el.parentElement?.children || [])].filter(c => c.matches(sel));
    return { i: group.indexOf(el), n: group.length };
  };
  document.addEventListener('change', e => {
    const el = e.target;
    if (!on || !recent() || silenced(el)) return;
    if (el.matches('input[type="checkbox"]')) play('toggle', { on: el.checked });
    else if (el.matches('input[type="radio"]') && el.checked) play('toggle', { on: indexIn(el).i > 0 });
  }, true);
  document.addEventListener('toggle', e => {
    const el = e.target;
    if (!on || !recent() || !(el instanceof Element) || silenced(el)) return;
    if (el.tagName === 'DETAILS') play(el.open ? 'open' : 'close');
    else if (e.newState) play(e.newState === 'open' ? 'open' : 'close');
  }, true);
  const ATTRS = ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded'];
  const mo = 'MutationObserver' in window ? new MutationObserver(list => {
    if (!on || !recent()) return;
    // One sound per batch: prefer the element that turned on.
    const changed = list.filter(m => {
      const el = m.target;
      return m.oldValue !== el.getAttribute(m.attributeName) && !el.matches('[data-sound-toggle], [data-motion-toggle]') && !silenced(el);
    });
    if (!changed.length) return;
    const m = changed.find(c => c.target.getAttribute(c.attributeName) === 'true') || changed[0];
    const el = m.target, attr = m.attributeName, v = el.getAttribute(attr) === 'true';
    if (attr === 'aria-expanded') { play(v ? 'open' : 'close'); return; }
    if (attr === 'aria-selected') { if (v) play('toggle', { on: indexIn(el, '[aria-selected]').i > 0 }); return; }
    const g = indexIn(el, `[${attr}]`);
    if (g.n > 1) { if (v) play('toggle', { on: g.i > 0 }); } else play('toggle', { on: v });
  }) : null;
  mo?.observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ATTRS });
  // The motion button is a switch too, but its own icon swap is the feedback; give it the toggle sound here.
  document.querySelector('[data-motion-toggle]')?.addEventListener('click', () => play('toggle', { on: !IH.paused }));

  /* ---------- API ---------- */
  IH.sound = {
    get enabled() { return on; },
    /** 'none' until the first enable, then the AudioContext state ('running' / 'suspended'). */
    get state() { return ctx ? ctx.state : 'none'; },
    /** The last sound that actually played (for debugging section hooks). */
    get last() { return lastName; },
    enable, disable, toggle, play,
    // Test hook: render one sound (or 'bed') through the full chain offline. Returns a Promise<AudioBuffer>.
    renderOffline(name, opts = {}, seconds = 2, rate = 48000) {
      if (!OAC) return Promise.reject(new Error('No OfflineAudioContext'));
      const oc = new OAC(2, Math.ceil(seconds * rate), rate);
      const e = createEngine(oc);
      const list = Array.isArray(name) ? name : [{ name, opts, at: opts.at ?? 0.05 }];
      for (const s of list) {
        if (s.name === 'bed') e.startBed(s.opts?.minutes ?? 540, !!s.opts?.water, true);
        else e.play(s.name, s.opts || {}, s.at ?? 0.05);
      }
      return oc.startRendering();
    }
  };
})();
