// Builds and draws the scene: river, angler, rod, line and wind.
// World coordinates in metres. +X is the delivery direction and Y is vertical.
(() => {
  const {el, idx, canvas, state} = Controls;
  const context = canvas.getContext('2d');
  const tau = Math.PI * 2;
  const mix = (a, b, u) => a + (b - a) * u;

  const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map(v => v * k);
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));

  // ---- Geometry. Every helper appends to `scene`, which callers swap to build a cache. ----
  let scene = [];
  const light = [-.45, .79, .41];
  // Three printed tones: cool violet in shadow and warm yellow in sunlight.
  const ink = '#302b49';
  const swatches = new Map();
  function shade(hex, value) {
    if (!swatches.has(hex)) {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const tone = (tint, amount) => 'rgb(' + rgb.map((v, i) => Math.round(mix(v, tint[i], amount))).join(',') + ')';
      swatches.set(hex, [tone([60, 43, 98], .50), hex, tone([255, 226, 145], .38)]);
    }
    return swatches.get(hex)[value < -.10 ? 0 : value < .48 ? 1 : 2];
  }
  function face(a, b, d, col) {
    const normal = unit(cross(sub(b, a), sub(d, a)));
    scene.push({v: [a, b, d], col: shade(col, dot(normal, light))});
  }
  function stroke(a, b, col, width) { scene.push({v: [a, b], col, width}); }
  // Capped cone from a (radius r) to b (radius R).
  function tube(a, b, r, R, col, n = 8) {
    const axis = unit(sub(b, a)), i = unit(cross(axis, Math.abs(axis[1]) > .85 ? [1, 0, 0] : [0, 1, 0])), j = cross(axis, i);
    const ring = (v, rad, k) => add(v, add(mul(i, rad * Math.cos(k * tau / n)), mul(j, rad * Math.sin(k * tau / n))));
    for (let k = 0; k < n; k++) {
      const a1 = ring(a, r, k), a2 = ring(a, r, k + 1), b1 = ring(b, R, k), b2 = ring(b, R, k + 1);
      face(a1, a2, b1, col); face(b1, a2, b2, col); face(b, b1, b2, col); face(a, a2, a1, col);
    }
  }
  // Ellipsoid centred on o with radii r.
  function oval(o, r, col, n = 9) {
    const point = (i, j) => {
      const a = i * Math.PI / 5, b = j * tau / n;
      return add(o, [r[0] * Math.sin(a) * Math.cos(b), r[1] * Math.cos(a), r[2] * Math.sin(a) * Math.sin(b)]);
    };
    for (let i = 0; i < 5; i++) for (let j = 0; j < n; j++) {
      const a = point(i, j), b = point(i, j + 1), d = point(i + 1, j), e = point(i + 1, j + 1);
      if (i) face(a, b, d, col);
      if (i < 4) face(d, b, e, col);
    }
    // Broken contour from an oblique meridian, anchored to the form.
    for (let row=1;row<4;row++) {
      const j=n*.30+.20*Math.sin(row);
      stroke(point(row,j),point(row+1,j-.14),n===5?'#476a68':ink,n===5?.019:.008);
    }
  }
  // Stack of elliptical rings [x, y, radiusX, radiusZ], joined into a sleeve.
  function garment(rings, col) {
    const n = 12;
    const point = ([x, y, rx, rz], i) => [x + rx * Math.cos(tau * i / n), y, rz * Math.sin(tau * i / n)];
    for (let row = 1; row < rings.length; row++) for (let i = 0; i < n; i++) {
      const a = point(rings[row - 1], i), b = point(rings[row - 1], i + 1), d = point(rings[row], i), e = point(rings[row], i + 1);
      face(a, d, b, col); face(d, e, b, col);
    }
  }

  // ---- Terrain: built once, with a fixed seed so it never changes between visits. ----
  let seed = 917;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function bank(x, sign) { return sign * (11 + .85 * Math.sin(x * .18 + sign) + .55 * Math.cos(x * .43)); }
  for (const side of [-1, 1]) {
    const strips = [];
    for (let x = -60; x <= 60; x += 3) {
      const z = bank(x, side);
      strips.push([[x, -.04, z], [x, .24 + rand() * .18, z + side * 1.6], [x, .8 + rand() * 1.4, z + side * 7], [x, 3 + rand() * 3, z + side * 16], [x, 5 + 4 * Math.sin(x * .12) + rand() * 3, z + side * 29]]);
    }
    for (let k = 1; k < strips.length; k++) for (let n = 0; n < 4; n++) {
      const a = strips[k - 1], b = strips[k], col = ['#e7ad72', '#a0bd64', '#a68aa7', '#e6a98f'][n];
      // Both banks face the sky; the linework sits on their actual slopes.
      if (side > 0) {
        face(a[n], a[n + 1], b[n], col); face(b[n], a[n + 1], b[n + 1], col);
      } else {
        face(a[n], b[n], a[n + 1], col); face(b[n], b[n + 1], a[n + 1], col);
      }
      const raised = v => add(v, [0, .035, 0]);
      const midway = (v, w, u) => v.map((c, i) => mix(c, w[i], u));
      if (n === 0 || n === 3) {
        stroke(raised(a[n + 1]), raised(midway(a[n + 1], b[n + 1], .83)), n ? '#826080' : '#876052', n ? .055 : .039);
      }
      if (n >= 2 && k % 3 !== 0) {
        for (let h = 0; h < 4; h++) {
          const start = midway(a[n], b[n], .14 + .15 * h);
          const end = midway(start, a[n + 1], .36 + .04 * h);
          stroke(raised(start), raised(end), n === 2 ? '#806888' : '#bb8a93', .032);
        }
      }
    }
    // Trees. The near bank stays clear in front of the angler.
    for (let k = 0; k < 66; k++) {
      const x = rand() * 83 - 41, offset = 2 + rand() * 3, z = bank(x, side) + side * offset;
      const column = Math.floor((x + 60) / 3), u = (x + 60) / 3 - column;
      const ground = level => mix(strips[column][level][1], strips[column + 1][level][1], u);
      const y = mix(ground(1), ground(2), (offset - 1.6) / 5.4) - .09, t = .55 + rand() * 1.45;
      if (side > 0 && Math.abs(x) < 16) continue;
      const lean = .27 * Math.sin(k * 3.7);
      const fork = [x + lean, y + t, z];
      tube([x, y, z], fork, .075, .045, '#925c5d', 5);
      // Asymmetric clumps and short broken marks give the foliage a drawn silhouette.
      for (let l = 0; l < 3; l++) {
        const cx = x + lean + (l - 1) * .36 * t, cy = y + t * (1.38 + (l === 1 ? .31 : 0));
        const cz = z + .16 * Math.cos(k + l);
        const radius = t * (.46 + .11 * rand());
        oval([cx, cy, cz], [radius, radius * .79, radius * .68], ['#388579', '#67a759', '#93b75c'][l], 5);
        for (const sign of [-1, 1]) {
          stroke([cx - radius * .65, cy, cz + sign * radius * .46],
            [cx - radius * .30, cy - radius * .23, cz + sign * radius * .58], '#365669', .028);
        }
      }
    }
  }
  for (let k = 0; k < 56; k++) {
    const x = rand() * 50 - 25, z = rand() * 17 - 8.5, r = .07 + rand() ** 2 * .59;
    const height = (.38 + rand() * .55) * r, count = 7;
    const cap = [x - .31*r, height, z + .12*r], rim = [], shoulder = [];
    for (let j=0; j<count; j++) {
      const a=tau*j/count, dx=Math.cos(a)*r*(1.1+.67*rand()), dz=Math.sin(a)*r*(.74+.26*rand());
      rim.push([x+dx,.013,z+dz]);
      shoulder.push([x+dx*.74,height*(.52+.25*rand()),z+dz*.74]);
    }
    for (let j=0; j<count; j++) {
      const next=(j+1)%count, col=k%3===0?'#b59a91':'#898999';
      face(rim[j],shoulder[j],rim[next],col);
      face(rim[next],shoulder[j],shoulder[next],col);
      face(shoulder[next],shoulder[j],cap,col);
      if(j%3!==1)stroke(shoulder[j],shoulder[next],'#665273',.015);
      stroke(rim[j],rim[next],'#476673',.013);
    }
    for(let j=0;j<3;j++) {
      const start=shoulder[j],end=shoulder[j+1];
      const notch=start.map((v,i)=>mix(v,end[i],.42));
      stroke(notch,notch.map((v,i)=>mix(v,cap[i],.23)), '#685974',.013);
    }
    stroke([x-1.65*r,.016,z+.28*r],[x-.65*r,.016,z+.98*r],'#fff2c9',.024);
  }
  // Tapered swashes sit on the water, so their perspective follows the camera.
  for (let k = 0; k < 420; k++) {
    const x = rand()*66-33, z = rand()*22-11, len=.25+rand()**2*2.5, width=.025+.13*rand();
    const a=[x,.008,z], b=[x+.29*len,.008,z+width], c=[x+.76*len,.008,z+.66*width], end=[x+len,.008,z+.035];
    const color=['#3d9eac','#75cfbc','#b4ead1','#2f92a2'][k%4];
    scene.push({v:[a,b,c],col:color}, {v:[a,c,end],col:color});
    if(k%4===0)stroke(b,c,'#fff1c1',.022);
  }
  const world = scene;
  const renderer = createSceneRenderer(canvas, world);
  // Decided once per frame. In software mode the body is drawn with everything else.
  let useGpu = false;

  // ---- Angler ----
  let bodyCache = [], bodyKey = '';
  function makeBody(jacket, skin) {
    for (const side of [-1, 1]) {
      const hip = [-.02, .90, side * .105], knee = [.055 + side * .095, .51, side * .145], ankle = [side * .17, .14, side * .17];
      tube(hip, knee, .117, .09, '#466f70'); tube(knee, ankle, .09, .075, '#39616b');
      oval(add(ankle, [.045, -.058, 0]), [.15, .085, .09], '#454c40');
    }
    garment([[-.02, .78, .135, .17], [-.02, .93, .16, .20], [0, 1.10, .14, .165], [.015, 1.33, .17, .21], [.012, 1.46, .135, .228], [.035, 1.52, .092, .09]], jacket);
    garment([[0, .98, .162, .185], [0, 1.04, .153, .18]], '#414d42');
    garment([[.008, 1.07, .155, .175], [.017, 1.34, .178, .219], [.011, 1.445, .145, .222], [.035, 1.495, .105, .122]], '#93874c');
    for (const side of [-1, 1]) oval([.15, 1.23, side * .096], [.042, .069, .073], '#8d8969');
    // Side seams, trouser creases, eyebrow and collar are drawn on the model.
    for (const side of [-1,1]) {
      const z = side * .22;
      stroke([.03,1.43,z],[.085,1.34,z],ink,.014);
      stroke([.085,1.34,z],[.06,1.25,z*.98],ink,.012);
      for (let j=0;j<4;j++) {
        stroke([-.055+j*.025,1.18,side*.181],[-.084+j*.025,1.12,side*.181],'#574457',.009);
      }
      stroke([.101,1.716,side*.071],[.145,1.704,side*.058],ink,.013);
      stroke([.12+side*.095,.51,side*.205],[.044+side*.095,.47,side*.226],ink,.011);
    }
    tube([.034, 1.46, 0], [.047, 1.59, 0], .078, .069, skin);
    oval([.057, 1.666, 0], [.109, .144, .09], skin); oval([.150, 1.651, 0], [.035, .029, .034], skin);
    for (const side of [-1, 1]) { oval([.042, 1.653, side * .087], [.027, .035, .013], skin); oval([.132, 1.693, side * .059], [.013, .008, .011], '#453c31'); }
    oval([.017, 1.721, 0], [.095, .085, .092], '#51483a');
    if (el('hat').checked) { oval([.038, 1.772, 0], [.123, .065, .105], '#d67746'); oval([.137, 1.752, 0], [.116, .013, .103], '#915649'); }
  }
  // Shoulder to wrist as two fixed-length links. The elbow leans towards the pole vector.
  function limb(shoulder, wrist, pole, jacket, skin) {
    const upper = .30, lower = .26, reach = sub(wrist, shoulder), direction = unit(reach);
    const distance = Math.min(upper + lower - .004, Math.max(.06, Math.hypot(...reach)));
    const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance), radius = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
    const out = unit(sub(pole, mul(direction, dot(direction, pole))));
    const elbow = add(shoulder, add(mul(direction, along), mul(out, radius)));
    tube(shoulder, elbow, .092, .07, jacket); oval(shoulder, [.09, .088, .088], jacket, 7);
    const cuff = add(elbow, mul(sub(wrist, elbow), .8));
    tube(elbow, cuff, .072, .048, jacket); oval(elbow, [.072, .072, .072], jacket, 7);
    tube(cuff, wrist, .04, .034, skin);
  }
  function person(grip, angle, bend, lateral) {
    const jacket = el('coat').value, skin = '#cf9069', key = jacket + el('hat').checked;
    if (key !== bodyKey) {
      const moving = scene;
      scene = []; makeBody(jacket, skin); bodyCache = scene; scene = moving;
      bodyKey = key;
      if (renderer) renderer.setBody(bodyCache);
    }
    if (!useGpu) for (const part of bodyCache) scene.push(part);

    // Rod frame: "axis" runs up the rod, "top" is the side of the cork under the thumb.
    const axis = [Math.cos(angle), Math.sin(angle), 0], top = [-axis[1], axis[0], 0];
    const along = (point, a, t = 0, z = 0) => add(point, [axis[0] * a + top[0] * t, axis[1] * a + top[1] * t, z]);

    // Casting arm. The wrist sits behind the fist, so the forearm follows the rod butt
    // and the wrist opens on the back cast and closes on the forward stop. The shoulder
    // rises and reaches a little with the hand.
    const wrist = along(grip, -.078, -.012, .018);
    limb([.045 + grip[0] * .10, 1.438 + .07 * (grip[1] - 1.35), .201], wrist, [-.3, -1, .35], jacket, skin);
    tube(wrist, along(grip, -.03), .034, .04, skin, 7);            // Heel of the hand.
    tube(along(grip, -.05), along(grip, .05), .043, .041, skin, 8); // Fingers closed round the cork.
    tube(along(grip, -.025, .037), along(grip, .055, .034), .015, .011, skin, 5); // Thumb on top.

    // Line hand: it holds the line below the first guide and shadows the rod hand.
    const lineHand = [.27 + .05 * (grip[0] - .3), 1.10 + .12 * (grip[1] - 1.35), -.10];
    limb([.028, 1.435, -.202], add(lineHand, [-.06, .02, -.01]), [-.36, -1, -.4], jacket, skin);
    tube(add(lineHand, [-.06, .02, -.01]), add(lineHand, [-.02, .005, 0]), .034, .038, skin, 7);
    tube(add(lineHand, [-.03, 0, 0]), add(lineHand, [.045, 0, 0]), .038, .035, skin, 7);

    // Cork grip, reel and rod.
    const base = along(grip, -.19);
    tube(base, along(grip, .16), .032, .028, '#ba9c6f');
    const reel = add(along(base, .03, -.06), [0, 0, -.025]), reelRadius = idx('reel') ? .062 : .05;
    tube(reel, add(reel, [0, 0, .05]), reelRadius, reelRadius, '#34494b');
    let prev = grip;
    for (let i = 1; i <= 24; i++) {
      const q = i / 24, next = CastModel.rodPoint(grip, angle, bend, cast.rod, q, lateral);
      stroke(prev, next, '#272f2b', .028 - .016 * q);
      prev = next;
    }
    // The line hand feeds the line up to the first guide.
    const guide = CastModel.rodPoint(grip, angle, bend, cast.rod, .2, lateral);
    stroke(lineHand, guide, '#ffcb4c', .012);
  }

  // ---- Cast: simulated in a worker when possible, shortly after the settings settle. ----
  const settleDelay = 150; // ms
  let settings = Controls.settings(), castKey = JSON.stringify(settings), cast = CastModel.simulate(settings);
  let requestedKey = castKey, changedAt = 0, pending = null, worker = null;
  function applyCast(result, key) {
    cast = result; castKey = key; settings = JSON.parse(key);
    Controls.setCast(cast);
  }
  try {
    // Fails when the page is opened as a file in some browsers. The main thread takes over.
    worker = new Worker('cast-worker.js');
    worker.onmessage = ({data}) => {
      pending = null;
      // A result for settings that changed meanwhile is dropped. The next frame asks again.
      if (data.key === requestedKey) applyCast(data.result, data.key);
    };
    worker.onerror = () => { worker.terminate(); worker = null; pending = null; };
  } catch { worker = null; }
  function refreshCast(now) {
    const desired = Controls.settings(), key = JSON.stringify(desired);
    if (key !== requestedKey) { requestedKey = key; changedAt = now; }
    if (key === castKey || pending || now - changedAt < settleDelay) return;
    if (worker) { pending = key; worker.postMessage({key, settings: desired}); }
    else applyCast(CastModel.simulate(desired), key);
  }

  // Smooth curve through four consecutive nodes (Catmull-Rom), from p1 to p2.
  const curve = (p0, p1, p2, p3, u) => p1.map((v, i) => .5 * (2 * v + (p2[i] - p0[i]) * u + (2 * p0[i] - 5 * v + 4 * p2[i] - p3[i]) * u * u + (3 * v - p0[i] - 3 * p2[i] + p3[i]) * u ** 3));
  function drawCast(time) {
    const last = cast.frames.length - 1, index = time / cast.duration * last, k = Math.min(last, Math.floor(index)), u = index - k;
    const a = cast.frames[k], b = cast.frames[Math.min(k + 1, last)];
    person(a.hand.map((v, i) => mix(v, b.hand[i], u)), mix(a.angle, b.angle, u), mix(a.curvature, b.curvature, u), mix(a.lateral, b.lateral, u));
    const nodes = [];
    for (let j = 0; j < a.points.length; j += 3) nodes.push([0, 1, 2].map(i => mix(a.points[j + i], b.points[j + i], u)));
    // Fly line in gold, leader in cream, tippet (its last fifth) in white.
    const end = nodes.length - 1, pieces = 3, tippetStart = cast.line + .8 * cast.leader;
    let prev = nodes[0];
    for (let n = 0; n < end; n++) {
      const metres = (n + .5) * cast.ds, main = metres <= cast.line, tippet = metres > tippetStart;
      const col = main ? '#ffcb4c' : tippet ? '#fff9ed' : '#fff1ca', width = main ? .038 + settings.weight * .006 : tippet ? .022 : .028;
      for (let piece = 1; piece <= pieces; piece++) {
        const next = curve(nodes[Math.max(0, n - 1)], nodes[n], nodes[n + 1], nodes[Math.min(end, n + 2)], piece / pieces);
        stroke(prev, next, col, width);
        prev = next;
      }
    }
    if (cast.landing && time >= cast.landing.time) { // Ripple where the fly touched down.
      const r = .07 + .58 * (time - cast.landing.time);
      const at = k => [cast.landing.x + r * Math.cos(tau * k / 32), .024, cast.landing.z + r * Math.sin(tau * k / 32)];
      for (let i = 0; i < 32; i++) stroke(at(i), at(i + 1), '#e1f2dd', .018);
    }
    oval(prev, [.058, .042, .043], '#b54625', 5); // The fly.
  }

  // ---- Software fallback: painter's algorithm on the 2D canvas. ----
  // The terrain is cached in three depth layers for the current camera.
  let w, h, scale, camera, right, up, forward;
  let cachedTerrainKey = '', terrainLayers = [];
  function projectObjects(objects) {
    const queue = [];
    for (const obj of objects) {
      const verts = obj.v.map(pt => {
        const v = sub(pt, camera), z = dot(v, forward);
        return [w * .5 + scale * dot(v, right) / z, h * .5 - scale * dot(v, up) / z, z];
      });
      const offscreen = [0, 1].some(k => verts.every(v => v[k] < -6) || verts.every(v => v[k] > (k ? h : w) + 6));
      if (verts.some(v => v[2] < .15) || offscreen) continue;
      queue.push({obj, verts, z: verts.reduce((sum, v) => sum + v[2], 0) / verts.length});
    }
    return queue.sort((a, b) => b.z - a.z);
  }
  function paintItems(ctx, items) {
    for (const {obj, verts, z} of items) {
      ctx.beginPath();
      verts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (obj.width) {
        ctx.strokeStyle = obj.col; ctx.lineWidth = Math.max(obj.width < .02 ? .65 : 1.15, obj.width * scale / z); ctx.lineCap = 'round'; ctx.stroke();
      } else { ctx.closePath(); ctx.fillStyle = obj.col; ctx.fill(); }
    }
  }
  function paintSoftware(viewKey, dist, ratio) {
    const bucket = z => z > dist + 2 ? 0 : z < dist - 2 ? 2 : 1;
    if (cachedTerrainKey !== viewKey) {
      const terrain = [[], [], []];
      for (const item of projectObjects(world)) terrain[bucket(item.z)].push(item);
      terrainLayers = terrain.map(items => {
        const layer = document.createElement('canvas');
        layer.width = canvas.width; layer.height = canvas.height;
        const ctx = layer.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        paintItems(ctx, items);
        return layer;
      });
      cachedTerrainKey = viewKey;
    }
    const moving = [[], [], []];
    for (const item of projectObjects(scene)) moving[bucket(item.z)].push(item);
    for (let i = 0; i < 3; i++) { context.drawImage(terrainLayers[i], 0, 0, w, h); paintItems(context, moving[i]); }
  }
  function paintBackground() {
    const sky = context.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6ccbd7'); sky.addColorStop(.54, '#ffdfb1'); sky.addColorStop(1, '#ffecc7');
    context.fillStyle = sky; context.fillRect(0, 0, w, h);
    const horizon = h * .5 - scale * Math.tan(state.elevation);
    // Distant dry-brush cloud shapes. Their azimuth stays fixed when orbiting.
    const cloudColors=['#fff2cf','#fae4c2','#ffeac6'];
    for(let i=0;i<36;i++){
      const bearing=i*tau/36-state.yaw;
      if(Math.cos(bearing)<.3)continue;
      const x=w*.5+scale*Math.tan(bearing);
      const y=horizon-scale*(.19+.19*(.5+.5*Math.sin(i*17.4)))/Math.cos(bearing);
      const span=scale*(.19+.07*Math.cos(i*2.8)), rise=span*.11;
      context.fillStyle=cloudColors[i%3];
      context.beginPath();context.moveTo(x-span,y);
      for(const [dx,dy] of [[-.72,-.29],[-.52,-.24],[-.25,-.84],[-.02,-.92],[.12,-.55],[.36,-.48],[.51,-.22],[1,0],[.38,.12],[-.47,.14]])context.lineTo(x+span*dx,y+rise*dy);
      context.fill();
      context.fillRect(x+.05*span,y+rise*.40,span*.66,Math.max(1,rise*.12));
    }
    const water = context.createLinearGradient(0, Math.min(h * .8, Math.max(0, horizon)), 0, h);
    water.addColorStop(0, '#97d9bc'); water.addColorStop(.48, '#64c6ba'); water.addColorStop(1, '#348ea1');
    context.fillStyle = water; context.fillRect(0, Math.max(0, horizon), w, h);
  }

  // ---- Frame loop. A frame is skipped when nothing it depends on has changed. ----
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0, travel = 0, previousView, previousFrame;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.06, (now - last) / 1000);
    last = now;
    if (state.playing) {
      state.progress = Math.min(1, state.progress + dt * Number(el('rate').value) / cast.duration);
      if (state.progress === 1) state.playing = false;
      Controls.sync();
    }
    w = canvas.clientWidth; h = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = h * 1.18;
    const dist = (state.detail ? Math.max(5.7, scale * 7 / w) : Math.max(11.5, scale * 24 / w)) / state.zoom;
    const {yaw, elevation} = state;
    const normal = [Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation)];
    // Zooming into the detail view closes in on the arm rather than on the empty air above it.
    camera = add(state.detail ? [.3, 2 - .32 * (state.zoom - 1), 0] : [.8, 2.75, 0], mul(normal, dist));
    forward = mul(normal, -1); right = [Math.cos(yaw), 0, -Math.sin(yaw)]; up = cross(right, forward);

    refreshCast(now);
    useGpu = !!renderer && renderer.ready;
    const showParticles = settings.wind > 0 && el('dust').checked;
    const drifting = showParticles && !reducedMotion.matches;
    const viewKey = [w, h, ratio, yaw, elevation, state.zoom, state.detail, useGpu].join('|');
    const frameKey = [viewKey, state.progress, castKey, el('coat').value, el('hat').checked, idx('reel'), showParticles].join('|');
    if (frameKey === previousFrame && !drifting) return;
    previousFrame = frameKey;
    // With WebGL the 2D canvas only holds the backdrop, so it is repainted when the view changes.
    if (!useGpu || viewKey !== previousView) { paintBackground(); previousView = viewKey; }

    scene = [];
    const time = Controls.time(), speed = CastModel.windAt(settings, time), dir = settings.dir;
    el('speed').value = Math.round(speed) + ' km/h';
    drawCast(time);
    if (drifting) travel += dt * speed * .09;
    if (showParticles) for (let i = 0; i < 68; i++) {
      const x = ((i * 2.71 + travel * Math.cos(dir)) % 22 + 22) % 22 - 11, z = ((i * 1.97 + travel * Math.sin(dir)) % 10 + 10) % 10 - 5, y = .32 + i * .671 % 4;
      stroke([x, y, z], [x + .014 * speed * Math.cos(dir), y, z + .014 * speed * Math.sin(dir)], '#f1fbdfaa', .018);
    }
    if (useGpu) renderer.render(scene, camera, right, up, forward, w, h, scale);
    else paintSoftware(viewKey, dist, ratio);
  }

  Controls.setCast(cast);
  Controls.setView('side');
  requestAnimationFrame(frame);
})();
