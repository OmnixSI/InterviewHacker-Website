// Two-voice field. Amber ribbons are the other side, indigo ribbons are you. The page drives three numbers:
//   energy  — how loudly each side is talking (set by the demo),
//   converge — 0: two live voices, 1: one still ink line (set by scroll),
//   base    — where that line sits, in viewport fractions from the top.
// WebGL 1 on a single full-screen triangle; the SVG in .field stays visible whenever WebGL is unavailable.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => root.classList.contains('motion-paused');
  const state = { them: .55, me: .35, converge: 0, base: .79, mouse: .5, mouseAmp: 0 };
  const api = { live: false, set(values) { Object.assign(target, values); wake(); } };
  const target = { them: state.them, me: state.me, converge: 0, base: state.base };
  window.IHField = api;

  const canvas = document.querySelector('[data-field]');
  const field = canvas?.closest('.field');

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `precision mediump float;
uniform vec2 u_res;uniform float u_t;uniform float u_conv;uniform float u_base;uniform vec2 u_energy;
uniform vec3 u_them;uniform vec3 u_me;uniform vec3 u_ink;uniform float u_px;uniform vec2 u_mouse;
float wave(float x,float t,float s){
  return sin(x*7.0+t*1.25+s)*.55+sin(x*15.0-t*1.8+s*1.7)*.3+sin(x*31.0+t*2.7+s*2.9)*.15;
}
float line(float d,float w){return 1.0-smoothstep(w*.5,w*.5+u_px,abs(d));}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  float x=uv.x;
  float env=pow(sin(3.14159*clamp(x,0.,1.)),1.3);
  float live=1.0-u_conv;
  float bump=u_mouse.y*exp(-pow((x-u_mouse.x)*7.0,2.0));
  float base=1.0-u_base;
  vec4 acc=vec4(0.);
  for(int v=0;v<2;v++){
    float fv=float(v);
    float e=mix(u_energy.x,u_energy.y,fv);
    vec3 c=mix(mix(u_them,u_me,fv),u_ink,u_conv);
    float centre=base+mix(.026,-.026,fv)*live;
    for(int i=0;i<5;i++){
      float fi=float(i);
      float amp=(.012+.05*e+.025*bump)*env*live*(1.0-fi*.16);
      float y=centre+amp*wave(x+fi*.012,u_t*(1.0+fi*.07),fv*3.3+fi*.55);
      float d=(uv.y-y)*u_res.y;
      float a=line(d,(fi==0.0?1.6:1.0)*u_px)*(fi==0.0?.85:.34-fi*.05)*mix(1.0,.9,u_conv);
      acc.rgb+=c*a*(1.0-acc.a);acc.a+=a*(1.0-acc.a);
    }
  }
  gl_FragColor=acc;
}`;

  let gl = null, prog = null, uni = {}, frame = 0, visible = true, last = 0, t = 0, colors = {};

  function readColors() {
    const cs = getComputedStyle(root);
    const rgb = name => {
      const probe = document.createElement('i');
      probe.style.color = cs.getPropertyValue(name).trim();
      document.body.append(probe);
      const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
      probe.remove();
      return [m[0] / 255, m[1] / 255, m[2] / 255];
    };
    colors = { them: rgb('--them'), me: rgb('--me'), ink: rgb('--ink') };
  }

  function init() {
    if (!canvas) return false;
    try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch { gl = null; }
    if (!gl) return false;
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['u_res', 'u_t', 'u_conv', 'u_base', 'u_energy', 'u_them', 'u_me', 'u_ink', 'u_px', 'u_mouse']) uni[n] = gl.getUniformLocation(prog, n);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  function resize() {
    // Thin lines need real resolution, but 1.5× is enough on retina and keeps fill cost flat.
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * scale), h = Math.round(canvas.clientHeight * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return scale;
  }

  function draw() {
    const scale = resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uni.u_res, canvas.width, canvas.height);
    gl.uniform1f(uni.u_t, t);
    gl.uniform1f(uni.u_conv, state.converge);
    gl.uniform1f(uni.u_base, state.base);
    gl.uniform2f(uni.u_energy, state.them, state.me);
    gl.uniform3fv(uni.u_them, colors.them);
    gl.uniform3fv(uni.u_me, colors.me);
    gl.uniform3fv(uni.u_ink, colors.ink);
    gl.uniform1f(uni.u_px, scale);
    gl.uniform2f(uni.u_mouse, state.mouse, state.mouseAmp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const still = () => reduced.matches || paused() || document.hidden;
  function loop(now) {
    frame = 0;
    const dt = Math.min(.05, (now - (last || now)) / 1000);
    last = now;
    if (!still()) t += dt;
    // Ease towards targets so scroll and demo changes never snap.
    const k = Math.min(1, dt * 6);
    state.them += (target.them - state.them) * k;
    state.me += (target.me - state.me) * k;
    state.converge += (target.converge - state.converge) * Math.min(1, dt * 14);
    state.base += (target.base - state.base) * Math.min(1, dt * 14);
    state.mouseAmp *= .96;
    draw();
    const settling = Math.abs(target.converge - state.converge) > .001 || Math.abs(target.base - state.base) > .0005;
    if (visible && (!still() || settling)) frame = requestAnimationFrame(loop);
  }
  function wake() {
    if (!api.live || frame || !visible) return;
    last = 0;
    frame = requestAnimationFrame(loop);
  }

  if (canvas && init()) {
    api.live = true;
    readColors();
    field.classList.add('is-live');
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(canvas);
    document.addEventListener('ih:theme', () => requestAnimationFrame(() => { readColors(); wake(); }));
    document.addEventListener('ih:motion', wake);
    document.addEventListener('visibilitychange', wake);
    addEventListener('resize', wake);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); api.live = false; cancelAnimationFrame(frame); frame = 0; field.classList.remove('is-live'); });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      addEventListener('pointermove', e => { state.mouse = e.clientX / innerWidth; state.mouseAmp = Math.min(1, state.mouseAmp + .06); if (!still()) wake(); }, { passive: true });
    }
    wake();
  }

  /* ---------- Download: the same idea in 2D — two voices close into one line ---------- */
  const mini = document.querySelector('[data-mini-field]');
  if (mini) {
    const ctx = mini.getContext('2d');
    let miniVisible = false, miniFrame = 0, mt = 0, mlast = 0;
    api.mini = { converge: 0 };
    function miniDraw(now) {
      miniFrame = 0;
      const dt = Math.min(.05, (now - (mlast || now)) / 1000);
      mlast = now;
      if (!still()) mt += dt;
      const dpr = Math.min(devicePixelRatio || 1, 2), w = mini.clientWidth, h = mini.clientHeight;
      if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const live = 1 - api.mini.converge, mid = h / 2, bars = Math.floor(w / 7);
      if (live > .01) {
        for (let i = 0; i < bars; i++) {
          const x = i / bars, env = Math.sin(Math.PI * x);
          const a = (Math.abs(Math.sin(i * .37 + mt * 6)) * .6 + Math.abs(Math.sin(i * .11 - mt * 2.4)) * .4) * env * h * .42 * live;
          const b = (Math.abs(Math.sin(i * .29 - mt * 5)) * .6 + Math.abs(Math.sin(i * .07 + mt * 1.8)) * .4) * env * h * .3 * live;
          ctx.fillStyle = `rgb(${colors.them?.map(c => c * 255).join(',') || '229,154,77'})`;
          ctx.globalAlpha = .85; ctx.fillRect(i * 7, mid - a - 2, 3, a);
          ctx.fillStyle = `rgb(${colors.me?.map(c => c * 255).join(',') || '132,135,255'})`;
          ctx.fillRect(i * 7, mid + 2, 3, b);
        }
        ctx.globalAlpha = 1;
      }
      if (miniVisible && !still()) miniFrame = requestAnimationFrame(miniDraw);
    }
    api.mini.wake = () => { if (!miniFrame && miniVisible) { mlast = 0; miniFrame = requestAnimationFrame(miniDraw); } };
    if (!colors.them) {
      // The hero may have no WebGL; the mini field still needs the palette.
      try { readColors(); } catch { /* defaults above */ }
      document.addEventListener('ih:theme', () => requestAnimationFrame(readColors));
    }
    new IntersectionObserver(([e]) => { miniVisible = e.isIntersecting; api.mini.wake(); }).observe(mini);
    document.addEventListener('ih:motion', () => api.mini.wake());
  }
})();
