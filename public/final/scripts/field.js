// Water surfaces. A small height-field simulation (CPU, ~6 CSS px per cell) is stirred by the pointer and
// by the voices, uploaded as a texture, and its slope bends whatever the shader draws — the two voice
// lines in the hero, a body of lit water beside the moments, the slow water at the end — and catches the light.
//   window.IHField.set({ them, me, converge, base }) drives the hero; converge 1 = one still ink line.
// WebGL 1 on one full-screen triangle; without WebGL the static SVG fallback stays.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const paused = () => root.classList.contains('motion-paused');
  const still = () => reduced.matches || paused() || document.hidden;

  /* ---------- Ripple simulation ---------- */
  // Each cell keeps a height and a velocity; it is pulled towards its neighbours' average, damped, and
  // smoothed a little so ripples stay soft. Pressing lowers the surface along the pointer's path.
  class Ripples {
    constructor(cell = 6) { this.cell = cell; this.w = 0; this.h = 0; this.quietFor = 99; this.resize(8, 8); }
    resize(cssW, cssH) {
      const w = Math.max(8, Math.round(cssW / this.cell)), h = Math.max(8, Math.round(cssH / this.cell));
      if (w === this.w && h === this.h) return false;
      this.w = w; this.h = h;
      this.a = new Float32Array(w * h); this.b = new Float32Array(w * h); this.v = new Float32Array(w * h);
      this.bytes = new Uint8Array(w * h).fill(128);
      this.aspect = cssW / cssH;
      return true;
    }
    // Press a capsule from (x0,y0) to (x1,y1), in 0–1 surface coordinates (y down); reach is in heights.
    press(x0, y0, x1, y1, reach, depth) {
      const { w, h, a, aspect } = this;
      const minX = Math.max(0, Math.floor((Math.min(x0, x1) - reach / aspect) * w)), maxX = Math.min(w - 1, Math.ceil((Math.max(x0, x1) + reach / aspect) * w));
      const minY = Math.max(0, Math.floor((Math.min(y0, y1) - reach) * h)), maxY = Math.min(h - 1, Math.ceil((Math.max(y0, y1) + reach) * h));
      const abx = (x1 - x0) * aspect, aby = y1 - y0, len = abx * abx + aby * aby || 1e-6;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = ((x + .5) / w - x0) * aspect, py = (y + .5) / h - y0;
        const t = Math.max(0, Math.min(1, (px * abx + py * aby) / len));
        const d = Math.hypot(px - abx * t, py - aby * t);
        if (d < reach) { const k = 1 - d / reach; a[y * w + x] -= k * k * depth; }
      }
      this.quietFor = 0;
    }
    step() {
      const { w, h, v } = this;
      const src = this.a, dst = this.b;
      let peak = 0;
      for (let y = 0; y < h; y++) {
        const up = (y > 0 ? y - 1 : y) * w, down = (y < h - 1 ? y + 1 : y) * w, row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x, left = x > 0 ? i - 1 : i, right = x < w - 1 ? i + 1 : i;
          const avg = (src[left] + src[right] + src[up + x] + src[down + x]) * .25;
          const vel = (v[i] + (avg - src[i]) * 2) * .982;
          let next = src[i] + vel;
          next += (avg - next) * .06;
          v[i] = vel; dst[i] = next;
          const m = next < 0 ? -next : next;
          if (m > peak) peak = m;
        }
      }
      this.a = dst; this.b = src;
      return peak;
    }
    pack() {
      const { a, bytes } = this;
      for (let i = 0; i < a.length; i++) { const b = 128 + a[i] * 900; bytes[i] = b < 0 ? 0 : b > 255 ? 255 : b; }
      return bytes;
    }
  }

  /* ---------- Shared GLSL ---------- */
  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const COMMON = `precision mediump float;
uniform vec2 u_res;uniform float u_t;uniform float u_px;uniform sampler2D u_sim;uniform vec2 u_cell;uniform float u_water;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
// Slope of the simulated surface: xy bends what lies below, z is how much light the slope catches.
vec3 wake(vec2 uv){
  vec2 s=vec2(texture2D(u_sim,uv+vec2(u_cell.x,0.)).r-texture2D(u_sim,uv-vec2(u_cell.x,0.)).r,
              texture2D(u_sim,uv-vec2(0.,u_cell.y)).r-texture2D(u_sim,uv+vec2(0.,u_cell.y)).r)*u_water;
  return vec3(s*.1,dot(s,vec2(-.55,.83))*.6);
}
// A slow ambient swell: a few long cosine waves crossing at different angles.
vec3 swell(vec2 uv,float a){
  vec2 p=uv*vec2(u_res.x/u_res.y,1.);
  vec2 s=vec2(.8,.6)*cos(dot(p,vec2(.8,.6))*3.7+u_t*.8)
        +vec2(-.6,.8)*cos(dot(p,vec2(-.6,.8))*5.9-u_t*.95)*.6
        +vec2(.24,-.97)*cos(dot(p,vec2(.24,-.97))*9.1+u_t*1.2)*.4
        +vec2(-.93,-.37)*cos(dot(p,vec2(-.93,-.37))*15.3-u_t*1.5)*.25;
  return vec3(s*a,dot(s,vec2(-.5,.87))*.03);
}
// Edges that dissolve through grain instead of ending on a line. e = widths in px: left, right, bottom, top.
float dissolve(vec2 fc,vec4 e){
  float d=1.;
  if(e.x>0.)d=min(d,fc.x/e.x);
  if(e.y>0.)d=min(d,(u_res.x-fc.x)/e.y);
  if(e.z>0.)d=min(d,fc.y/e.z);
  if(e.w>0.)d=min(d,(u_res.y-fc.y)/e.w);
  d=clamp(d,0.,1.);
  return step(hash(floor(fc)+17.3),d*d*(3.-2.*d));
}`;

  // Hero: paper, two voices and the light on the water. Opaque, so it owns the hero's background.
  const HERO = COMMON + `
uniform float u_conv;uniform float u_base;uniform vec2 u_energy;uniform vec3 u_them;uniform vec3 u_me;uniform vec3 u_ink;uniform vec3 u_paper;
float wave(float x,float t,float s){return sin(x*7.+t*1.25+s)*.55+sin(x*15.-t*1.8+s*1.7)*.3+sin(x*31.+t*2.7+s*2.9)*.15;}
float line(float d,float w){return 1.-smoothstep(w*.5,w*.5+u_px,abs(d));}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec3 w=wake(vec2(uv.x,1.-uv.y));
  vec3 sw=swell(uv,.0016*(1.-u_conv));
  vec2 p=uv+vec2(w.x,-w.y)+sw.xy;
  float x=p.x,env=pow(sin(3.14159*clamp(x,0.,1.)),1.3),live=1.-u_conv,base=1.-u_base;
  vec3 col=u_paper*(1.+w.z*1.6+sw.z);
  for(int v=0;v<2;v++){
    float fv=float(v),e=mix(u_energy.x,u_energy.y,fv);
    vec3 c=mix(mix(u_them,u_me,fv),u_ink,u_conv);
    float centre=base+mix(.026,-.026,fv)*live;
    for(int i=0;i<5;i++){
      float fi=float(i);
      float amp=(.012+.05*e)*env*live*(1.-fi*.16);
      float y=centre+amp*wave(x+fi*.012,u_t*(1.+fi*.07),fv*3.3+fi*.55);
      float a=line((p.y-y)*u_res.y,(fi==0.?1.6:1.)*u_px)*(fi==0.?.85:.34-fi*.05);
      col=mix(col,c,a);
    }
  }
  col+=(hash(floor(gl_FragCoord.xy))-.5)*.022;
  gl_FragColor=vec4(col,1.);
}`;

  // Views panel: a body of pale water lit from above, caustics bent by the same ripples.
  const POOL = COMMON + `
uniform vec3 u_deep;uniform vec3 u_shallow;uniform vec3 u_light;uniform vec4 u_edge;
float caustic(vec2 p,float t){
  vec2 q=p;float c=0.;
  for(int i=0;i<4;i++){
    float fi=float(i);
    q+=vec2(sin(q.y*1.7+t*.55+fi*1.3),cos(q.x*1.5-t*.45+fi*2.1))*.6;
    c+=.07/abs(sin(q.x+t*.2)*sin(q.y-t*.15)+.07);
  }
  return c*.25;
}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec3 w=wake(vec2(uv.x,1.-uv.y));
  vec3 sw=swell(uv,.006);
  vec2 p=(uv+vec2(w.x,-w.y)*2.+sw.xy)*vec2(u_res.x/u_res.y,1.)*3.2;
  float c=caustic(p,u_t*.6);
  vec3 col=mix(u_deep,u_shallow,smoothstep(0.,1.,uv.y*.7+.25));
  col=mix(col,u_light,clamp(pow(c,1.6)*.22,0.,.55));
  col*=1.+w.z*1.6+sw.z*3.;
  col+=(hash(floor(gl_FragCoord.xy))-.5)*.03;
  float a=dissolve(gl_FragCoord.xy,u_edge);
  gl_FragColor=vec4(col*a,a);
}`;

  // Ending: slow, deep water. Two voices spread rings from where they speak and meet in the middle.
  const SHORE = COMMON + `
uniform vec2 u_a;uniform vec2 u_b;uniform vec3 u_deep;uniform vec3 u_mid;uniform vec3 u_them;uniform vec3 u_me;uniform vec4 u_edge;
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float rings(vec2 p,vec2 c,float t){float d=length(p-c);return (.5+.5*cos(d*22.-t*1.4))*exp(-d*1.9);}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 asp=vec2(u_res.x/u_res.y,1.);
  vec3 w=wake(vec2(uv.x,1.-uv.y));
  vec3 sw=swell(uv,.004);
  vec2 p=(uv+vec2(w.x,-w.y)*2.5+sw.xy)*asp;
  float n=fbm(p*1.25+vec2(u_t*.02,-u_t*.014));
  float m=fbm(p*2.4-vec2(u_t*.03,0.)+n*1.3);
  vec3 col=mix(u_deep,u_mid,smoothstep(.2,.9,n*.95+uv.y*.3));
  col=mix(col,u_mid*1.32,smoothstep(.55,.95,m)*.4);
  float ra=rings(p,u_a*asp,u_t),rb=rings(p,u_b*asp,u_t*1.13+1.7);
  col+=u_them*ra*.16+u_me*rb*.18+pow(ra*rb,1.4)*.3;
  col*=1.+w.z*1.8+sw.z*3.;
  col+=(hash(floor(gl_FragCoord.xy))-.5)*.075;
  float a=dissolve(gl_FragCoord.xy,u_edge);
  gl_FragColor=vec4(col*a,a);
}`;

  const rgbOf = value => {
    const probe = document.createElement('i');
    probe.style.color = value;
    document.body.append(probe);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    probe.remove();
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  };

  /* ---------- One water surface ---------- */
  function surface(canvas, { frag, cell = 6, scale = 1.25, uniforms = () => ({}), onFrame = null, target = canvas, alpha = false, host = canvas.closest('.field, .pool') }) {
    let gl;
    try { gl = canvas.getContext('webgl', { alpha, antialias: false, powerPreference: 'low-power' }); } catch { gl = null; }
    if (!gl) return null;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const cache = {};
    const u = name => (name in cache ? cache[name] : (cache[name] = gl.getUniformLocation(prog, name)));
    const sim = new Ripples(cell);
    let frame = 0, last = 0, t = 0, visible = false, carry = 0, water = 0, lastPointer = null, lost = false;

    function resize() {
      const s = Math.min(devicePixelRatio || 1, scale), w = canvas.clientWidth, h = canvas.clientHeight;
      const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      if (sim.resize(w, h)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, sim.w, sim.h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sim.bytes);
      return s;
    }
    function draw(dt) {
      const s = resize();
      // Fixed 120 Hz steps (at most four a frame) keep ripples the same speed on every display.
      if (sim.quietFor < 3) {
        carry += dt;
        let peak = 0;
        for (let n = 0; carry >= 1 / 120 && n < 4; n++) { peak = sim.step(); carry -= 1 / 120; }
        carry = Math.min(carry, 1 / 120);
        sim.quietFor += dt;
        water = peak > .0004 ? 1 : Math.max(0, water - dt);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sim.w, sim.h, gl.LUMINANCE, gl.UNSIGNED_BYTE, sim.pack());
      } else water = 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('u_res'), canvas.width, canvas.height);
      gl.uniform1f(u('u_t'), t);
      gl.uniform1f(u('u_px'), s);
      gl.uniform1i(u('u_sim'), 0);
      gl.uniform2f(u('u_cell'), 1 / sim.w, 1 / sim.h);
      gl.uniform1f(u('u_water'), water);
      for (const [name, value] of Object.entries(uniforms())) {
        if (Array.isArray(value)) gl[`uniform${value.length}fv`](u(name), value); else gl.uniform1f(u(name), value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      frame = 0;
      const dt = Math.min(.05, (now - (last || now)) / 1000);
      last = now;
      if (!still()) t += dt;
      const settling = onFrame ? onFrame(dt) : false;
      draw(dt);
      if (visible && !lost && (!still() || settling || sim.quietFor < 3)) frame = requestAnimationFrame(loop);
    }
    const wake = () => { if (!frame && visible && !lost) { last = 0; frame = requestAnimationFrame(loop); } };

    // The pointer drags a capsule through the water; faster strokes press deeper. A click drops a stone.
    if (fine) {
      target.addEventListener('pointermove', e => {
        if (reduced.matches || paused()) return;
        const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) { lastPointer = null; return; }
        if (lastPointer) {
          const speed = Math.hypot((x - lastPointer[0]) * r.width, (y - lastPointer[1]) * r.height);
          sim.press(lastPointer[0], lastPointer[1], x, y, .024, Math.min(speed / 40, 1) * .07);
        }
        lastPointer = [x, y];
        wake();
      }, { passive: true });
      target.addEventListener('pointerleave', () => { lastPointer = null; });
      target.addEventListener('pointerdown', e => {
        if (reduced.matches || paused()) return;
        const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) { sim.press(x, y, x, y, .05, .12); wake(); }
      });
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(canvas);
    document.addEventListener('ih:motion', wake);
    document.addEventListener('visibilitychange', wake);
    addEventListener('resize', wake);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; host?.classList.remove('is-live'); });
    host?.classList.add('is-live');
    return { wake, ratio: () => canvas.width / Math.max(1, canvas.clientWidth), drop(x, y, depth = .05, reach = .03) { sim.press(x, y, x, y, reach, depth); wake(); } };
  }

  /* ---------- Hero: two voices on the water ---------- */
  // On narrow screens the copy runs long, so the voices sit at the foot of the first screen instead.
  const state = { them: .55, me: .35, converge: 0, base: matchMedia('(max-width: 960px)').matches ? .95 : .815 };
  const target = { ...state };
  let colors = null, hero = null, dropClock = 0;
  const readColors = () => {
    const cs = getComputedStyle(root);
    colors = { them: rgbOf(cs.getPropertyValue('--them')), me: rgbOf(cs.getPropertyValue('--me')), ink: rgbOf(cs.getPropertyValue('--ink')), paper: rgbOf(cs.getPropertyValue('--paper')) };
  };
  readColors();
  const api = { live: false, set(values) { Object.assign(target, values); hero?.wake(); } };
  window.IHField = api;

  const canvas = document.querySelector('[data-field]');
  if (canvas) {
    hero = surface(canvas, {
      frag: HERO, cell: 6, scale: 1.5, target: canvas.closest('[data-hero]') || canvas,
      uniforms: () => ({ u_conv: state.converge, u_base: state.base, u_energy: [state.them, state.me], u_them: colors.them, u_me: colors.me, u_ink: colors.ink, u_paper: colors.paper }),
      onFrame(dt) {
        const k = Math.min(1, dt * 6);
        state.them += (target.them - state.them) * k;
        state.me += (target.me - state.me) * k;
        state.converge += (target.converge - state.converge) * Math.min(1, dt * 14);
        state.base += (target.base - state.base) * Math.min(1, dt * 14);
        // A voice speaking loudly drops small ripples onto the water beneath its line.
        dropClock += dt;
        if (!still() && state.converge < .2 && dropClock > .16) {
          dropClock = 0;
          for (const [lane, offset] of [['them', -.026], ['me', .026]]) {
            if (state[lane] > .6 && Math.random() < state[lane] - .45) hero.drop(.15 + Math.random() * .7, state.base + offset, .018, .018);
          }
        }
        return Math.abs(target.converge - state.converge) > .001 || Math.abs(target.base - state.base) > .0005;
      }
    });
    if (hero) { api.live = true; hero.wake(); }
  }

  /* ---------- Views: the pool behind the floating windows ---------- */
  // Narrow screens give each moment its own still card instead (motion.js), so the pool never starts there.
  const poolCanvas = document.querySelector('[data-pool]');
  if (poolCanvas && !matchMedia('(max-width: 960px)').matches) {
    let pool = null;
    pool = surface(poolCanvas, {
      frag: POOL, cell: 5, scale: 1, alpha: true, target: poolCanvas.closest('.pool') || poolCanvas,
      // The pool meets the text column, and the sections above and below, through grain.
      uniforms: () => { const k = pool ? pool.ratio() : 1; return { u_deep: [.62, .69, .7], u_shallow: [.86, .89, .88], u_light: [1, 1, .97], u_edge: [0, 90 * k, 70 * k, 70 * k] }; }
    });
    if (pool) { pool.wake(); api.pool = pool; }
  }

  /* ---------- Ending: slow water where two voices meet ---------- */
  const shoreCanvas = document.querySelector('[data-shore]');
  if (shoreCanvas) {
    const panel = shoreCanvas.parentElement;
    const voices = { a: [.3, .55], b: [.7, .45], aim: null };
    let shore = null, clock = 0;
    shore = surface(shoreCanvas, {
      frag: SHORE, cell: 7, scale: 1, alpha: true, target: panel, host: shoreCanvas,
      // Only the top edge dissolves into the paper: the water runs to the end of the page.
      uniforms: () => {
        const k = shore ? shore.ratio() : 1;
        return { u_a: voices.a, u_b: voices.b, u_deep: [.15, .22, .23], u_mid: [.34, .44, .43], u_them: colors.them, u_me: colors.me, u_edge: [0, 0, 0, 150 * k] };
      },
      // The two voices drift slowly; with a pointer over the water, "you" follow it.
      onFrame(dt) {
        if (!still()) clock += dt;
        voices.a = [.3 + Math.sin(clock * .11) * .06, .55 + Math.cos(clock * .09) * .08];
        const rest = [.7 + Math.cos(clock * .1) * .06, .45 + Math.sin(clock * .13) * .08], to = voices.aim || rest;
        voices.b = [voices.b[0] + (to[0] - voices.b[0]) * Math.min(1, dt * 2), voices.b[1] + (to[1] - voices.b[1]) * Math.min(1, dt * 2)];
        return Math.hypot(to[0] - voices.b[0], to[1] - voices.b[1]) > .002;
      }
    });
    if (shore) {
      shore.wake();
      if (fine) {
        panel.addEventListener('pointermove', e => { const r = panel.getBoundingClientRect(); voices.aim = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; shore.wake(); }, { passive: true });
        panel.addEventListener('pointerleave', () => { voices.aim = null; shore.wake(); });
      }
    }
  }
})();
