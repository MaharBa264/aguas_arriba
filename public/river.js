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
  // A continuous skin between cross sections avoids visible ball-and-socket joints.
  // Both triangles of a panel share its light, so the diagonal never appears on fabric or skin.
  const clothTones=new Map();
  function figureTone(color,normal) {
    if (!clothTones.has(color)) {
      const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
      const ramp=[-.50,-.34,-.18,-.06,.05,.17,.30].map(amount=>{
        const tint=amount<0?[79,56,80]:[255,223,163];
        return 'rgb('+rgb.map((v,i)=>Math.round(mix(v,tint[i],Math.abs(amount)))).join(',')+')';
      });
      clothTones.set(color,ramp);
    }
    const lighting=dot(normal,[.39,.77,.50]);
    return clothTones.get(color)[Math.min(6,Math.max(0,Math.floor(3.5+lighting*3.5)))];
  }
  function skinPanels(rings, col) {
    for (let row=1; row<rings.length; row++) {
      const lo=rings[row-1], hi=rings[row];
      for (let i=0; i<lo.length; i++) {
        const j=(i+1)%lo.length, a=lo[i], b=lo[j], c=hi[i], d=hi[j];
        const normal=unit(cross(sub(d,a),sub(b,c)));
        const tone=figureTone(col,normal);
        scene.push({v:[a,c,b],col:tone, skin:true},{v:[b,c,d],col:tone, skin:true});
      }
    }
  }
  function profile(sections, col, sides=18) {
    // Each horizontal section describes its centre (x,y,z) and its two radii.
    skinPanels(sections.map(([x,y,z,rx,rz])=>Array.from({length:sides},(_,i)=>{
      const angle=tau*i/sides;
      return [x+rx*Math.cos(angle),y,z+rz*Math.sin(angle)];
    })),col);
  }
  function lineArt(points, color, width) {
    for(let i=1;i<points.length;i++)stroke(points[i-1],points[i],color,width);
  }
  function sleeve(sections,col) {
    const rings=sections.map(([point,radius],i)=>{
      const axis=unit(sub(sections[Math.min(i+1,sections.length-1)][0],sections[Math.max(0,i-1)][0]));
      const tangent=unit(cross([0,0,1],axis)), across=cross(tangent,axis);
      return Array.from({length:10},(_,j)=>add(point,add(mul(tangent,radius*Math.cos(tau*j/10)),mul(across,radius*.89*Math.sin(tau*j/10)))));
    });
    skinPanels(rings,col);
  }
  const lerpPoint=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  function makeBody(jacket, skin) {
    for (const side of [-1,1]) {
      const ankle=side*.15, knee=.062+side*.10, z=side*.145;
      profile([[ankle,.105,z,.069,.068],[ankle,.20,z,.075,.074],[ankle*.6,.34,z,.092,.088],
        [knee,.49,z,.094,.094],[knee-.025,.57,z,.104,.098],[.018+side*.06,.71,z*.91,.121,.109],
        [-.018,.86,z*.76,.132,.123],[-.018,.93,z*.72,.109,.107]],'#516d67');
      profile([[ankle+.049,.025,z,.149,.088],[ankle+.053,.054,z,.157,.093],[ankle+.053,.089,z,.15,.091],
        [ankle+.028,.136,z,.112,.085],[ankle,.19,z,.079,.076],[ankle,.244,z,.079,.078]],'#4b4c42');
      profile([[ankle,.227,z,.083,.08],[ankle,.249,z,.085,.081],[ankle,.257,z,.077,.074]],'#766e52');
      lineArt([[knee+.08,.529,z+side*.044],[knee+.039,.50,z+side*.09],[knee-.026,.487,z+side*.088]],'#38505a',.009);
    }
    profile([[-.019,.80,0,.137,.188],[-.035,.92,0,.153,.20],[-.051,1.03,0,.14,.164],
      [-.052,1.14,0,.111,.125],[-.038,1.29,0,.111,.154],[.0,1.40,0,.109,.173],
      [.017,1.466,0,.092,.134],[.035,1.514,0,.070,.082]],jacket);
    // Soft fishing vest, a bound hem and two gusseted pockets.
    profile([[-.047,1.025,0,.145,.176],[-.049,1.057,0,.157,.188],[-.035,1.205,0,.176,.209],
      [-.017,1.335,0,.186,.231],[.002,1.419,0,.158,.231],[.031,1.48,0,.092,.118]],'#93905d');
    profile([[-.047,1.028,0,.147,.182],[-.049,1.055,0,.159,.191]],'#626446');
    for(const side of [-1,1]) {
      const z=side*.109;
      profile([[.093,1.082,z,.031,.042],[.102,1.098,z,.049,.059],[.107,1.168,z,.046,.057],
        [.102,1.188,z,.041,.05]],'#ac9c64',12);
      lineArt([[.139,1.17,z+side*.029],[.153,1.15,z],[.138,1.168,z-side*.029]],'#615844',.008);
      lineArt([[.104,1.45,side*.068],[.123,1.38,side*.087],[.142,1.31,side*.047],
        [.128,1.20,side*.048],[.111,1.06,side*.042]],'#605745',.012);
    }
    profile([[.034,1.45,0,.086,.085],[.047,1.545,0,.077,.073],[.065,1.611,0,.085,.075]],skin);
    profile([[.023,1.475,0,.101,.102],[.041,1.506,0,.101,.095],[.039,1.55,0,.087,.088]],'#427e80');

    // The head has separate brow, cheek, jaw and chin widths and turns slightly towards the near bank.
    const firstHeadPart=scene.length;
    const cheek=[.057,1.624,0,.123,.103];
    profile([[.072,1.541,0,.037,.039],[.074,1.552,0,.063,.061],[.075,1.576,0,.095,.085],
      [.064,1.598,0,.115,.098],cheek],'#5d4942',22);
    profile([cheek,[.054,1.655,0,.124,.106],[.05,1.695,0,.123,.109],[.039,1.745,0,.128,.113],
      [.026,1.79,0,.118,.106],[.018,1.831,0,.091,.084],[.015,1.85,0,.01,.015]],skin,22);
    profile([[.168,1.638,0,.022,.021],[.182,1.651,0,.033,.030],[.179,1.666,0,.034,.027],
      [.160,1.697,0,.017,.017],[.153,1.722,0,.012,.014]],skin,14);
    for(const side of [-1,1]) {
      profile([[.013,1.628,side*.103,.010,.007],[.015,1.64,side*.106,.024,.014],
        [.009,1.672,side*.11,.026,.018],[.008,1.681,side*.104,.016,.009]],skin,12);
      lineArt([[.135,1.699,side*.073],[.151,1.702,side*.059],[.156,1.699,side*.052]],ink,.008);
      lineArt([[.130,1.717,side*.078],[.146,1.722,side*.064],[.158,1.719,side*.048]],'#503b34',.013);
      lineArt([[.169,1.631,side*.009],[.174,1.627,side*.027],[.158,1.624,side*.045]],'#624439',.009);
      stroke([.158,1.614,side*.047],[.172,1.614,side*.016],'#503b39',.006);
    }
    const wearingCap=el('hat').checked;
    profile([[-.018,1.69,0,.087,.104],[-.010,1.72,0,.107,.110],[.007,1.747,0,.120,.114],
      [.017,wearingCap?1.759:1.796,0,.118,.110],[.012,wearingCap?1.766:1.836,0,.087,.087],
      [.006,wearingCap?1.769:1.854,0,.006,.006]],'#524541');
    if(wearingCap){
      profile([[.015,1.746,0,.146,.134],[.016,1.765,0,.150,.137],[.009,1.799,0,.143,.131],
        [-.003,1.831,0,.115,.104],[-.022,1.851,0,.070,.066],[-.024,1.857,0,.004,.006]],'#c16b41');
      profile([[.117,1.742,0,.128,.115],[.120,1.751,0,.14,.119],[.110,1.758,0,.129,.113]],'#92563d');
      lineArt([[-.072,1.815,.086],[-.006,1.802,.113],[.06,1.776,.118]],'#92553e',.007);
    }
    const turn=.38, c=Math.cos(turn), sn=Math.sin(turn);
    // Vertices are shared between panels; transform each exactly once.
    const transformed=new Set();
    for(let i=firstHeadPart;i<scene.length;i++)for(const v of scene[i].v){
      if(transformed.has(v))continue;
      transformed.add(v);
      const x=v[0]-.035,z=v[2];v[0]=.035+x*c-z*sn;v[2]=x*sn+z*c;
    }
  }
  // Shoulder to wrist as two fixed-length links. The elbow leans towards the pole vector.
  function limb(shoulder, wrist, pole, jacket, skin) {
    const upper = .30, lower = .26, reach = sub(wrist, shoulder), direction = unit(reach);
    const distance = Math.min(upper + lower - .004, Math.max(.06, Math.hypot(...reach)));
    const along = (upper ** 2 - lower ** 2 + distance ** 2) / (2 * distance), radius = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
    const out = unit(sub(pole, mul(direction, dot(direction, pole))));
    const elbow = add(shoulder, add(mul(direction, along), mul(out, radius)));
    const cuff=lerpPoint(elbow,wrist,.54);
    sleeve([[lerpPoint(shoulder,[.012,1.40,shoulder[2]*.53],.56),.062],[shoulder,.091],
      [lerpPoint(shoulder,elbow,.28),.089],[lerpPoint(shoulder,elbow,.68),.074],[lerpPoint(shoulder,elbow,.91),.070],
      [lerpPoint(elbow,lerpPoint(shoulder,wrist,.5),.08),.067],[lerpPoint(elbow,wrist,.08),.065],
      [lerpPoint(elbow,wrist,.20),.073],[cuff,.059]],jacket);
    sleeve([[lerpPoint(elbow,wrist,.45),.061],[cuff,.065],[lerpPoint(elbow,wrist,.60),.059]],jacket);
    sleeve([[cuff,.049],[lerpPoint(elbow,wrist,.69),.050],[lerpPoint(elbow,wrist,.90),.035],[wrist,.034]],skin);
  }
  // The hips start each transfer just before the grip, the ribs follow, and
  // the head watches the unrolling line. Evaluate in cast time so scrubbing
  // backwards and slow playback produce exactly the same pose.
  function castingPose(time, timing) {
    const ramp=(a,b)=>{
      const u=Math.max(0,Math.min(1,(time-a)/(b-a)));
      return u*u*u*(10+u*(6*u-15));
    };
    const [back,stopBack]=timing.back, [front,stopFront]=timing.front;
    const [lower,settled]=timing.lower || [stopFront,stopFront+1];
    const transfer=delay=>.8*ramp(back-.16+delay,stopBack+.17+delay)
      +.2*ramp(back+delay,front+delay)
      -1.65*ramp(front-.13+delay,stopFront+.13+delay)
      +.43*ramp(lower+.1+delay,settled+.2+delay);
    const hips=transfer(0), ribs=transfer(.065);
    const look=ramp(stopBack-.06,front+.01)-ramp(front+.01,stopFront+.15);
    return [hips,ribs,look];
  }
  // Same height-weighted pose as the WebGL body pass. The feet stay planted.
  function posedPoint(point,pose) {
    const [x,y,z]=point,[hips,ribs,look]=pose;
    const weight=(lo,hi)=>{const u=Math.max(0,Math.min(1,(y-lo)/(hi-lo)));return u*u*(3-2*u)};
    const leg=weight(.14,.88), chest=weight(.86,1.48), head=weight(1.52,1.68);
    const turn=.13*hips*leg+.31*ribs*chest+.38*look*head;
    const cs=Math.cos(turn),sn=Math.sin(turn);
    return [x*cs-z*sn-.067*hips*leg-.09*ribs*Math.max(0,y-.85),
      y-.018*hips*hips*leg+.065*ribs*z*chest, x*sn+z*cs+.019*hips*leg];
  }
  let bodyPose=[0,0,0], softwareBody=[], bodyVertices=[];
  function prepareSoftwareBody() {
    const byPoint=new Map();
    softwareBody=bodyCache.map(part=>({...part,v:part.v.map(point=>{
      if(!byPoint.has(point))byPoint.set(point,[...point]);
      return byPoint.get(point);
    })}));
    bodyVertices=Array.from(byPoint);
  }
  function person(grip, angle, bend, lateral) {
    const jacket = el('coat').value, skin = '#cf9069', key = jacket + el('hat').checked;
    if (key !== bodyKey) {
      const moving = scene;
      scene = []; makeBody(jacket, skin); bodyCache = scene; scene = moving;
      bodyKey = key; softwareBody=[];
      if (renderer) renderer.setBody(bodyCache);
    }
    if (!useGpu) {
      if (!softwareBody.length) prepareSoftwareBody();
      for(const [rest,vertex] of bodyVertices){
        const point=posedPoint(rest,bodyPose);
        for(let k=0;k<3;k++)vertex[k]=point[k];
      }
      scene.push(...softwareBody);
    }

    // Rod frame: "axis" runs up the rod, "top" is the side of the cork under the thumb.
    const axis = [Math.cos(angle), Math.sin(angle), 0], top = [-axis[1], axis[0], 0];
    const along = (point, a, t = 0, z = 0) => add(point, [axis[0] * a + top[0] * t, axis[1] * a + top[1] * t, z]);

    // Casting arm. The wrist sits behind the fist, so the forearm follows the rod butt
    // and the wrist opens on the back cast and closes on the forward stop. The shoulder
    // rises and reaches a little with the hand.
    const wrist = along(grip, -.078, -.012, .018);
    const shoulder=posedPoint([.052,1.443,.201],bodyPose);
    limb(shoulder,wrist,[-.32-.17*bodyPose[1],-.94,.38+.13*bodyPose[0]],jacket,skin);
    sleeve([[wrist,.033],[along(grip,-.045,0,.021),.044],[along(grip,.013,0,.022),.047],[along(grip,.052,0,.012),.034]],skin);
    for(let i=0;i<4;i++){
      const x=-.035+i*.023;
      sleeve([[along(grip,x,-.005,.032),.014],[along(grip,x,-.028,.022),.014],[along(grip,x,-.031,-.005),.011]],skin);
    }
    sleeve([[along(grip,-.02,.026,.023),.021],[along(grip,.014,.043,.013),.019],[along(grip,.061,.035,.002),.012]],skin);

    // Line hand: it holds the line below the first guide and shadows the rod hand.
    const lineHand=posedPoint([.28+.12*(grip[0]-.3),1.12+.18*(grip[1]-1.35),-.14],bodyPose);
    limb(posedPoint([.028, 1.435, -.202],bodyPose), add(lineHand, [-.06, .02, -.01]), [-.36, -1, -.4], jacket, skin);
    sleeve([[add(lineHand,[-.06,.02,-.01]),.032],[add(lineHand,[-.021,.009,0]),.041],
      [add(lineHand,[.014,-.002,.003]),.039],[add(lineHand,[.040,.006,0]),.016],
      [add(lineHand,[.043,.014,0]),.004]],skin);
    sleeve([[add(lineHand,[-.012,.024,.014]),.018],[add(lineHand,[.012,.033,.014]),.015],
      [add(lineHand,[.037,.018,.006]),.008]],skin);

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
    bodyPose=castingPose(time,cast.timing);
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
      if (obj.skin) {
        const [a,b,c]=verts;
        if ((b[0]-a[0])*(c[1]-a[1]) >= (b[1]-a[1])*(c[0]-a[0])) continue;
      }
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
      } else { ctx.closePath(); ctx.fillStyle = obj.col; ctx.fill();
        if (obj.skin) { ctx.strokeStyle=obj.col; ctx.lineWidth=.5; ctx.stroke(); }
      }
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
  document.addEventListener('visibilitychange',()=>{ last=0; });
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? (now-last)/1000 : 0;
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
    if (useGpu) renderer.render(scene, camera, right, up, forward, w, h, scale, bodyPose);
    else paintSoftware(viewKey, dist, ratio);
  }

  Controls.setCast(cast);
  Controls.setView('side');
  requestAnimationFrame(frame);
})();
