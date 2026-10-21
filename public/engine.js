// A small WebGL signal engine. Shapes morph on the GPU; no external renderer or network.
export function mountSignalEngine(canvas, {onRenderer = () => {}} = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = canvas.parentElement;
  let paused = false;
  let width = 1, height = 1, dpr = 1, visible = true, raf = 0, time = 0, previous = 0, lastFrame = 0;
  let target = [1,0,0], weights = [1,0,0], pointer = [0,0], targetPointer = [0,0], energy = 0;
  const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:true, preserveDrawingBuffer:true, powerPreference:'low-power'});
  const points = 3600;
  const data = new Float32Array(points * 10);
  for (let i=0; i<points; i++) {
    const u = (i % 120) / 120, v = Math.floor(i / 120) / 30;
    const a = u * Math.PI * 2, b = v * Math.PI * 2;
    const r = 1.42 + .37 * Math.cos(b);
    const theta = Math.acos(1 - 2 * (i + .5) / points), phi = i * 2.399963;
    const h = i / (points - 1), helix = h * Math.PI * 7;
    const strand = i % 2 ? Math.PI : 0;
    const n = i * 10;
    data.set([Math.cos(a)*r, Math.sin(b)*.37, Math.sin(a)*r,
      Math.sin(theta)*Math.cos(phi)*1.64, Math.cos(theta)*1.64, Math.sin(theta)*Math.sin(phi)*1.64,
      Math.cos(helix+strand)*(.8+.13*Math.sin(a)), (h-.5)*3.25, Math.sin(helix+strand)*.8,
      Math.abs((Math.sin(i*23.17)*43758.5453)%1)], n);
  }
  let draw;
  if (gl) {
    const vertex = `precision highp float;
      attribute vec3 a_torus; attribute vec3 a_sphere; attribute vec3 a_helix; attribute float a_seed;
      uniform vec3 u_weights; uniform vec2 u_res; uniform vec2 u_pointer; uniform float u_time; uniform float u_energy; uniform float u_dpr; uniform mediump float u_glow;
      varying mediump vec3 v_color; varying mediump float v_alpha;
      void main(){
        vec3 p=a_torus*u_weights.x+a_sphere*u_weights.y+a_helix*u_weights.z;
        float pulse=sin(length(p)*8.-u_time*2.8)*.015 + u_energy*.09;
        p*=1.+pulse;
        float ay=u_time*.13+u_pointer.x*.45, ax=-.48+u_pointer.y*.3;
        p.xz=mat2(cos(ay),-sin(ay),sin(ay),cos(ay))*p.xz;
        p.yz=mat2(cos(ax),-sin(ax),sin(ax),cos(ax))*p.yz;
        float az=-.28;
        p.xy=mat2(cos(az),-sin(az),sin(az),cos(az))*p.xy;
        float scale=2.15/(5.0+p.z);
        gl_Position=vec4(p.x*scale*u_res.y/u_res.x,p.y*scale+.18,p.z*.06,1.);
        gl_PointSize=clamp((2.8+a_seed*1.2)*(1.1-p.z*.16)*u_dpr*(1.+u_glow*3.),1.,22.);
        float hue=clamp(a_seed*.6+.4+sin(u_time*.2+p.y)*.15,0.,1.);
        v_color=mix(vec3(.55,.37,1.),vec3(.69,1.,.31),hue);
        v_color=mix(v_color,vec3(.85,1.,.73),u_energy*.45);
        v_alpha=(.65+(p.z+2.)*.08);
      }`;
    const fragment = `precision mediump float; varying mediump vec3 v_color; varying mediump float v_alpha; uniform float u_points; uniform mediump float u_glow;
      void main(){float a=v_alpha*(u_points>.5?1.:.065)*(1.-u_glow*.94);if(u_points>.5){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;a*=pow(1.-d,1.25);}gl_FragColor=vec4(v_color*a,a);}`;
    function compile(type, source) { const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader; }
    const vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,fragment);
    if (vs && fs) {
      const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if (gl.getProgramParameter(program,gl.LINK_STATUS)) {
        gl.useProgram(program);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        for(const [name,size,offset] of [['a_torus',3,0],['a_sphere',3,12],['a_helix',3,24],['a_seed',1,36]]){
          const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,offset);
        }
        const uniforms=Object.fromEntries(['u_weights','u_res','u_pointer','u_time','u_energy','u_dpr','u_points','u_glow'].map(n=>[n,gl.getUniformLocation(program,n)]));
        gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.disable(gl.DEPTH_TEST);
        draw=()=>{
          gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform3fv(uniforms.u_weights,weights);gl.uniform2f(uniforms.u_res,width,height);gl.uniform2fv(uniforms.u_pointer,pointer);
          gl.uniform1f(uniforms.u_time,time);gl.uniform1f(uniforms.u_energy,energy);gl.uniform1f(uniforms.u_dpr,dpr);
          gl.uniform1f(uniforms.u_glow,0);gl.uniform1f(uniforms.u_points,0);gl.drawArrays(gl.LINE_STRIP,0,points);
          gl.uniform1f(uniforms.u_points,1);gl.uniform1f(uniforms.u_glow,1);gl.drawArrays(gl.POINTS,0,points);
          gl.uniform1f(uniforms.u_glow,0);gl.drawArrays(gl.POINTS,0,points);
        };
        onRenderer('WEBGL / 3,600 PARTICLES');
      }
    }
  }
  // Graceful visual fallback when GPU rendering is unavailable.
  function useFallback() {
    const fallback=document.createElement('canvas');const originalId=canvas.id;canvas.replaceWith(fallback);canvas=fallback;canvas.id=originalId;canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d');
    draw=()=>{
      if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      const radius=Math.min(width*.39,height*.3);
      for(let i=0;i<1200;i++){
        const n=i*3*10, p=[0,0,0];
        for(let k=0;k<3;k++)p[k]=data[n+k]*weights[0]+data[n+3+k]*weights[1]+data[n+6+k]*weights[2];
        const a=time*.13+.4, x=p[0]*Math.cos(a)+p[2]*Math.sin(a), z=-p[0]*Math.sin(a)+p[2]*Math.cos(a);
        const y=p[1]*.8-z*.45, sc=radius/(2+z*.12);
        ctx.fillStyle=i%3?'#c5ff6599':'#a193ff99';ctx.fillRect(width*.5+x*sc,height*.41+y*sc,1.3,1.3);
      }
    };onRenderer('CANVAS / SIGNAL FIELD');
  }
  if (!draw) useFallback();
  function redraw(){ try{draw();}catch{stop();onRenderer('STATIC / SIGNAL FIELD');} }
  function resize(){const r=stage.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.8);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);redraw();}
  function stop(){cancelAnimationFrame(raf);raf=0;previous=0;}
  function frame(now){raf=0;if(document.hidden||!visible||reduced.matches||paused)return;
    if(now-lastFrame>1000/(window.innerWidth<800?30:60)){const dt=previous?Math.min((now-previous)/1000,.08):.016;previous=now;lastFrame=now;time+=dt;
      for(let i=0;i<3;i++)weights[i]+=(target[i]-weights[i])*(1-Math.exp(-6*dt));
      pointer=pointer.map((v,i)=>v+(targetPointer[i]-v)*(1-Math.exp(-7*dt)));energy=Math.max(0,energy-dt*.7);redraw();}
    raf=requestAnimationFrame(frame);
  }
  function start(){if(!raf&&!document.hidden&&visible&&!reduced.matches&&!paused)raf=requestAnimationFrame(frame);}
  stage.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=stage.getBoundingClientRect();targetPointer=[(event.clientX-r.left)/r.width-.5,(event.clientY-r.top)/r.height-.5];},{passive:true});
  stage.addEventListener('pointerleave',()=>{targetPointer=[0,0];});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();}).observe(stage);
  reduced.addEventListener('change',()=>{if(reduced.matches){stop();weights=[...target];pointer=[0,0];energy=0;redraw();}else start();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop();useFallback();resize();start();});
  resize();start();
  return {setPaused(value){paused=value;if(paused){stop();weights=[...target];redraw();}else start();},setShape(index){target=[0,0,0];target[index]=1;if(reduced.matches||paused||document.hidden){weights=[...target];redraw();}else start();},pulse(){energy=1;if(reduced.matches){redraw();energy=0;}else start();}};
}
