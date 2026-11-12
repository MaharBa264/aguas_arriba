// The background canvas supplies the sky and water. Geometry shares one depth buffer.
function createSceneRenderer(background, terrain) {
  const canvas=document.createElement('canvas');
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true});
  if(!gl)return null;
  const program=gl.createProgram();
  const vertex=`
    attribute vec3 position,other;
    attribute vec4 color;
    attribute float width;
    uniform vec3 eye,right,up,forward;
    uniform vec2 screen;
    uniform float focal;
    varying lowp vec4 tint;
    vec3 camera(vec3 p){vec3 v=p-eye;return vec3(dot(v,right),dot(v,up),dot(v,forward));}
    void main(){
      vec3 p=camera(position);
      vec2 xy=p.xy*focal*2.0/screen;
      if(width!=0.0){
        vec3 b=camera(other);
        vec2 ray=b.xy/max(.05,b.z)-p.xy/max(.05,p.z);
        vec2 normal=vec2(-ray.y,ray.x)/max(.000001,length(ray));
        float thick=max(1.15,abs(width)*focal/max(.05,p.z));
        xy+=sign(width)*normal*thick*p.z/screen;
      }
      gl_Position=vec4(xy,1.002*p.z-.20,p.z);
      tint=color;
    }`;
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,'precision mediump float; varying lowp vec4 tint; void main(){gl_FragColor=tint;}']]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))return null;
    gl.attachShader(program,shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const locations={};for(const name of ['eye','right','up','forward','screen','focal'])locations[name]=gl.getUniformLocation(program,name);
  const attributes=['position','other','color','width'].map(name=>gl.getAttribLocation(program,name));
  const palette=new Map();
  function rgba(css){
    if(!palette.has(css)){
      let v=css[0]==='#'?css.slice(1).match(/../g).map(x=>parseInt(x,16)):css.match(/\d+/g).map(Number);
      if(v.length===3)v.push(255);palette.set(css,v.map(c=>c/255));
    }
    return palette.get(css);
  }
  function mesh(){return {buffer:gl.createBuffer(),data:new Float32Array(0),length:0}}
  function upload(mesh,objects,usage){
    const size=objects.reduce((sum,obj)=>sum+(obj.width?6:3)*11,0);
    if(mesh.data.length<size)mesh.data=new Float32Array(size);
    let i=0;
    function put(p,q,color,width){
      for(let k=0;k<3;k++)mesh.data[i++]=p[k];for(let k=0;k<3;k++)mesh.data[i++]=q[k];
      for(let k=0;k<4;k++)mesh.data[i++]=color[k];mesh.data[i++]=width;
    }
    for(const obj of objects){
      const [a,b,c]=obj.v,col=rgba(obj.col),w=obj.width;
      if(w){put(a,b,col,w);put(a,b,col,-w);put(b,a,col,-w);put(a,b,col,-w);put(b,a,col,w);put(b,a,col,-w)}
      else{put(a,a,col,0);put(b,b,col,0);put(c,c,col,0)}
    }
    mesh.length=i/11;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data.subarray(0,i),usage);
  }
  function draw(mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    for(let i=0;i<4;i++){gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],[3,3,4,1][i],gl.FLOAT,false,44,[0,12,24,40][i])}
    gl.drawArrays(gl.TRIANGLES,0,mesh.length);
  }
  const fixed=mesh(),moving=mesh();upload(fixed,terrain,gl.STATIC_DRAW);
  canvas.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0';canvas.setAttribute('aria-hidden','true');
  background.after(canvas);
  return function render(objects,eye,right,up,forward,w,h,focal){
    if(gl.isContextLost()){canvas.style.display='none';return false}canvas.style.display='block';
    if(canvas.width!==background.width||canvas.height!==background.height){canvas.width=background.width;canvas.height=background.height}
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    for(const [name,value] of Object.entries({eye,right,up,forward}))gl.uniform3fv(locations[name],value);
    gl.uniform2f(locations.screen,w,h);gl.uniform1f(locations.focal,focal);draw(fixed);
    upload(moving,objects,gl.STREAM_DRAW);draw(moving);return true;
  };
}
