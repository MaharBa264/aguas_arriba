// WebGL layer drawn over the background canvas, which supplies the sky and water.
// All geometry shares one depth buffer. Three vertex buffers: the terrain (uploaded
// once), the angler's body (uploaded when the outfit changes) and the moving parts
// (uploaded every frame).
function createSceneRenderer(background, terrain) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {alpha: true, antialias: true, premultipliedAlpha: true});
  if (!gl) return null;

  const vertexSource = `
    attribute vec3 position,other;
    attribute vec4 color;
    attribute float width;
    uniform vec3 eye,right,up,forward;
    uniform vec2 screen;
    uniform float focal;
    varying lowp vec4 tint;
    uniform vec3 pose;
    uniform bool poseBody;
    vec3 camera(vec3 p){
      if(poseBody){
        float leg=smoothstep(.14,.88,p.y), chest=smoothstep(.86,1.48,p.y), head=smoothstep(1.52,1.68,p.y);
        float turn=.13*pose.x*leg+.31*pose.y*chest+.38*pose.z*head;
        float c=cos(turn),s=sin(turn);
        p=vec3(p.x*c-p.z*s-.067*pose.x*leg-.09*pose.y*max(0.,p.y-.85),
          p.y-.018*pose.x*pose.x*leg+.065*pose.y*p.z*chest,
          p.x*s+p.z*c+.019*pose.x*leg);
      }
      vec3 v=p-eye;return vec3(dot(v,right),dot(v,up),dot(v,forward));}
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
  const fragmentSource = 'precision mediump float; varying lowp vec4 tint; void main(){gl_FragColor=tint;}';
  const floatsPerVertex = 11, attributeSizes = [3, 3, 4, 1], attributeOffsets = [0, 12, 24, 40];

  let locations, attributes, fixed, body, moving, bodyObjects = [], ready = false;

  // Builds every GL resource. Runs at start-up and again after a lost context returns.
  function init() {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return false;
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    locations = {};
    for (const name of ['eye', 'right', 'up', 'forward', 'screen', 'focal', 'pose', 'poseBody']) locations[name] = gl.getUniformLocation(program, name);
    attributes = ['position', 'other', 'color', 'width'].map(name => gl.getAttribLocation(program, name));
    const mesh = () => ({buffer: gl.createBuffer(), data: new Float32Array(0), length: 0});
    fixed = mesh(); body = mesh(); moving = mesh();
    upload(fixed, terrain, gl.STATIC_DRAW);
    upload(body, bodyObjects, gl.STATIC_DRAW);
    return true;
  }

  const palette = new Map();
  function rgba(css) {
    if (!palette.has(css)) {
      const v = css[0] === '#' ? css.slice(1).match(/../g).map(x => parseInt(x, 16)) : css.match(/\d+/g).map(Number);
      if (v.length === 3) v.push(255);
      palette.set(css, v.map(c => c / 255));
    }
    return palette.get(css);
  }

  // Objects are triangles {v:[a,b,c],col} or line segments {v:[a,b],col,width}.
  // A segment becomes a camera-facing quad, widened in the vertex shader.
  function upload(mesh, objects, usage) {
    const size = objects.reduce((sum, obj) => sum + (obj.width ? 6 : 3) * floatsPerVertex, 0);
    if (mesh.data.length < size) mesh.data = new Float32Array(size);
    let i = 0;
    function put(p, q, color, width) {
      for (let k = 0; k < 3; k++) mesh.data[i++] = p[k];
      for (let k = 0; k < 3; k++) mesh.data[i++] = q[k];
      for (let k = 0; k < 4; k++) mesh.data[i++] = color[k];
      mesh.data[i++] = width;
    }
    for (const obj of objects) {
      const [a, b, c] = obj.v, col = rgba(obj.col), w = obj.width;
      if (w) { put(a, b, col, w); put(a, b, col, -w); put(b, a, col, -w); put(a, b, col, -w); put(b, a, col, w); put(b, a, col, -w); }
      else { put(a, a, col, 0); put(b, b, col, 0); put(c, c, col, 0); }
    }
    mesh.length = i / floatsPerVertex;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data.subarray(0, i), usage);
  }

  function draw(mesh) {
    if (!mesh.length) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(attributes[i]);
      gl.vertexAttribPointer(attributes[i], attributeSizes[i], gl.FLOAT, false, floatsPerVertex * 4, attributeOffsets[i]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length);
  }

  if (!init()) return null;
  ready = true;
  canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0';
  canvas.setAttribute('aria-hidden', 'true');
  background.after(canvas);
  // Without preventDefault the browser never restores the context.
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; canvas.style.display = 'none'; });
  canvas.addEventListener('webglcontextrestored', () => { ready = init(); });

  return {
    // False while the context is lost: the caller draws in software meanwhile.
    get ready() { return ready && !gl.isContextLost(); },
    setBody(objects) {
      bodyObjects = objects;
      if (this.ready) upload(body, objects, gl.STATIC_DRAW);
    },
    render(objects, eye, right, up, forward, w, h, focal, pose) {
      canvas.style.display = 'block';
      if (canvas.width !== background.width || canvas.height !== background.height) { canvas.width = background.width; canvas.height = background.height; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const [name, value] of Object.entries({eye, right, up, forward})) gl.uniform3fv(locations[name], value);
      gl.uniform2f(locations.screen, w, h);
      gl.uniform1f(locations.focal, focal);
      draw(fixed);
      gl.uniform3fv(locations.pose,pose);
      gl.uniform1i(locations.poseBody,1);
      draw(body);
      gl.uniform1i(locations.poseBody,0);
      upload(moving, objects, gl.STREAM_DRAW);
      draw(moving);
    }
  };
}
