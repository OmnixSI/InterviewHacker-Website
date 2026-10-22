// Voice-aurora backdrop: raw WebGL, no library. Speech-like ribbons drift through a soft noise field.
// Pauses off-screen, when the tab is hidden and when motion is paused; draws a still frame for reduced motion.
// Without WebGL the CSS gradient fallback stays visible.
(() => {
  const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const FRAG = `precision highp float;
uniform vec2 res;uniform float t;uniform vec2 mouse;uniform float light;uniform float energy;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
vec3 ramp(float x){
 vec3 a=vec3(.545,.482,1.),b=vec3(.353,.847,1.),c=vec3(.369,.941,.706);
 return x<.5?mix(a,b,x*2.):mix(b,c,x*2.-1.);}
void main(){
 vec2 uv=gl_FragCoord.xy/res;vec2 q=uv;q.x*=res.x/res.y;
 float ar=res.x/res.y;
 // nebula
 float f=fbm(q*1.6+vec2(t*.03,-t*.02));
 float g=fbm(q*3.+f*1.8-vec2(0.,t*.05));
 vec3 col=mix(vec3(.40,.42,1.),vec3(.62,.32,.98),g)*pow(f,2.2)*.9;
 col+=vec3(.2,.6,.9)*pow(g,4.)*.5;
 float top=smoothstep(.15,1.,uv.y);
 col*=.35+top*.9;
 // speech ribbons
 float md=1.-smoothstep(0.,.45,abs(uv.x-mouse.x));
 for(int i=0;i<5;i++){
  float fi=float(i);
  float env=fbm(vec2(uv.x*2.2+fi*3.1,t*.25+fi))*1.6-.3;
  env=max(env,0.)*(.55+energy*.8)+md*.12*energy;
  float y=.56+fi*.035-.07+sin(uv.x*(7.+fi*2.3)+t*(.9+fi*.17)+fi*1.7)*.05*env
   +sin(uv.x*23.+t*2.1+fi)*.012*env;
  float d=abs(uv.y-y);
  float w=.0022+.002*env;
  float line=w/(d+w*.6);
  col+=ramp(uv.x)*line*(.16+.1*env)*(1.-fi*.12);
 }
 // vignette
 float v=smoothstep(1.25,.25,length((uv-vec2(.5,.62))*vec2(ar*.7,1.)));
 col*=v;
 float a=clamp(max(col.r,max(col.g,col.b))*1.15,0.,1.);
 if(light>.5){col=mix(col,col*vec3(.75,.7,1.),.5);a*=.55;}
 gl_FragColor=vec4(col,a);
}`;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  function start(canvas) {
    const host = canvas.parentElement;
    let gl;
    try {
      gl = canvas.getContext('webgl', {premultipliedAlpha: false, antialias: false, alpha: true, powerPreference: 'low-power'});
    } catch { gl = null; }
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = name => gl.getUniformLocation(prog, name);
    const uRes = u('res'), uT = u('t'), uMouse = u('mouse'), uLight = u('light'), uEnergy = u('energy');

    let visible = false, frame = 0, last = performance.now(), time = 7.3, energy = .4;
    const mouse = {x: .5, tx: .5};

    function resize() {
      const scale = Math.min(devicePixelRatio || 1, 1.5) * .6;
      const w = Math.max(2, Math.round(canvas.clientWidth * scale));
      const h = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }
    function draw() {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, time);
      gl.uniform2f(uMouse, mouse.x, .5);
      gl.uniform1f(uLight, root.dataset.theme === 'light' && !canvas.closest('.band-night') ? 1 : 0);
      gl.uniform1f(uEnergy, energy);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    const still = () => reduced.matches || root.classList.contains('motion-paused');
    function loop(now) {
      frame = 0;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      time += dt;
      mouse.x += (mouse.tx - mouse.x) * .04;
      energy += (.4 + .35 * Math.sin(time * .7) * Math.sin(time * 1.9) - energy) * .05;
      draw();
      if (visible && !still() && !document.hidden) frame = requestAnimationFrame(loop);
    }
    function wake() {
      if (frame) return;
      if (visible && !still() && !document.hidden) { last = performance.now(); frame = requestAnimationFrame(loop); }
      else draw();
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, {rootMargin: '100px'}).observe(canvas);
    host.closest('section')?.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
    }, {passive: true});
    addEventListener('resize', () => { if (!frame) draw(); }, {passive: true});
    document.addEventListener('visibilitychange', wake);
    document.addEventListener('ih:motion', wake);
    document.addEventListener('ih:theme', () => { if (!frame) draw(); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); host.classList.remove('is-live'); });
    draw();
    host.classList.add('is-live');
    return {wake};
  }

  for (const canvas of document.querySelectorAll('canvas[data-shader="aurora"]')) start(canvas);
})();
