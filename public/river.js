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
  // Tapered swashes sit on the water, so their perspective follows the camera.
  for (let k = 0; k < 420; k++) {
    const x = rand()*66-33, z = rand()*22-11, len=.25+rand()**2*2.5, width=.025+.13*rand();
    const a=[x,.008,z], b=[x+.29*len,.008,z+width], c=[x+.76*len,.008,z+.66*width], end=[x+len,.008,z+.035];
    const color=['#3d9eac','#75cfbc','#b4ead1','#2f92a2'][k%4];
    scene.push({v:[a,b,c],col:color}, {v:[a,c,end],col:color});
    if(k%4===0)stroke(b,c,'#fff1c1',.022);
  }
  const landscape = scene;
  let rockField;
  function terrainFor(seed) {
    rockField = RiverRocks.create(seed);
    scene = [];
    rockField.rocks.forEach(({faces,shoulder},k)=>{
      for(const {a,b,c} of faces)face(a,b,c,k%3===0?'#b59a91':'#898999');
      for(let j=0;j<shoulder.length;j+=3)stroke(shoulder[j],shoulder[(j+1)%shoulder.length],'#665273',.015);
    });
    return landscape.concat(scene);
  }
  let world = terrainFor(Controls.settings().rockSeed);
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
        [-.018,.86,z*.64,.111,.098],[-.022,.91,z*.52,.088,.076]],'#516d67');
      profile([[ankle+.049,.025,z,.149,.088],[ankle+.053,.054,z,.157,.093],[ankle+.053,.089,z,.15,.091],
        [ankle+.028,.136,z,.112,.085],[ankle,.19,z,.079,.076],[ankle,.244,z,.079,.078]],'#4b4c42');
      profile([[ankle,.227,z,.083,.08],[ankle,.249,z,.085,.081],[ankle,.257,z,.077,.074]],'#766e52');
      lineArt([[knee+.08,.529,z+side*.044],[knee+.039,.50,z+side*.09],[knee-.026,.487,z+side*.088]],'#38505a',.009);
    }
    // Shirt and bib share the seam vertices. The suspenders are panels of
    // the shirt itself, so all three deform together as the shoulders turn.
    const sides=40;
    const rows=[
      [-.019,.82,.150,.204,0],[-.035,.94,.159,.202,0],[-.051,1.03,.149,.178,0],
      [-.044,1.085,.146,.177,.19],[-.023,1.32,.142,.186,.018],
      [.005,1.42,.118,.189,0],[.021,1.472,.094,.140,0],[.038,1.512,.069,.079,0]
    ];
    const rings=rows.map(([x,y,rx,rz,rise])=>Array.from({length:sides},(_,i)=>{
      const a=tau*i/sides;
      return [x+rx*Math.cos(a),y+rise*Math.max(0,Math.cos(a))**.65,rz*Math.sin(a)];
    }));
    for(let row=1;row<rings.length;row++)for(let i=0;i<sides;i++){
      const j=(i+1)%sides,a=rings[row-1][i],b=rings[row-1][j],c=rings[row][i],d=rings[row][j];
      const band=Math.abs(Math.sin(tau*(i+.5)/sides));
      const cloth=row<=3?'#516d67':band>.43 && band<.67?'#424b46':jacket;
      const tone=figureTone(cloth,unit(cross(sub(d,a),sub(b,c))));
      scene.push({v:[a,c,b],col:tone,skin:true},{v:[b,c,d],col:tone,skin:true});
    }
    profile([[.034,1.45,0,.080,.079],[.049,1.54,0,.069,.066],[.065,1.61,0,.080,.074]],skin);
    // A folded neckerchief with its knot and two short tails to one side.
    profile([[.033,1.477,0,.086,.096],[.041,1.506,0,.098,.096],[.044,1.543,0,.081,.080]],'#ad5137');
    face([.048,1.52,.083],[.095,1.497,.076],[.116,1.422,.088],'#b8573b');
    face([.048,1.52,.083],[.077,1.497,.093],[.036,1.446,.109],'#cb6943');

    const firstHeadPart=scene.length;
    const wearingCap=el('hat').checked;
    // Horizontal sections model the skull. The front half has a flatter face
    // than the nape, with recessed orbits and projecting cheekbones.
    const skull=[
      [1.532,.085,.018,.026],[1.548,.083,.068,.063],[1.570,.078,.093,.082],
      [1.597,.064,.107,.099],[1.622,.054,.115,.109],[1.650,.046,.121,.117],
      [1.679,.040,.127,.124],[1.706,.039,.126,.121],[1.731,.035,.135,.122],
      [1.761,.028,.140,.125],[1.804,.018,.137,.121],[1.840,.010,.115,.107],
      [1.863,.006,.079,.076],[1.879,.002,.002,.002]
    ];
    function section(y){
      let i=1;
      while(i<skull.length-1 && skull[i][0]<y)i++;
      return lerpPoint(skull[i-1],skull[i],Math.max(0,Math.min(1,(y-skull[i-1][0])/(skull[i][0]-skull[i-1][0]))));
    }
    function cheek(y,z){
      const [,x,rx,rz]=section(y), lateral=Math.min(1,Math.abs(z)/rz);
      const orbit=Math.exp(-(((y-1.702)/.021)**2+((lateral-.50)/.29)**2));
      return x+rx*(1-lateral**2.65)**(1/2.65)-.015*orbit;
    }
    const sidesHead=40, angles=Array.from({length:sidesHead},(_,i)=>tau*i/sidesHead);
    function surface(y,a){
      const [,x,rx,rz]=section(y), z=rz*Math.sin(a);
      return [Math.cos(a)>=0 ? cheek(y,z) : x+rx*Math.cos(a),y,z];
    }
    // The beard boundary follows the cheek, dips below the lips and rises at the ear.
    const beardEdge=a=>1.592+.078*Math.sin(a)**2+.012*Math.exp(-((Math.sin(a)/.21)**2));
    const beardRows=[0,.25,.53,.77,1].map(t=>angles.map(a=>surface(mix(1.532,beardEdge(a),t),a)));
    skinPanels(beardRows,'#63504a');
    const hairline=a=>1.697+.076*Math.cos(a)+.014*Math.sin(2*a)-.007*Math.cos(7*a);
    // Cut the skull at the hairline so the skin cannot poke through the hair.
    const cheeks=[beardRows.at(-1),...[.18,.38,.62,.82,1].map(t=>
      angles.map(a=>surface(mix(beardEdge(a),hairline(a),t),a)))];
    skinPanels(cheeks,skin);

    // Filled patches on the curved face: concentric outlines form a shallow relief.
    function patch(y,z,outline,color,depth,bulge=0){
      const point=(dy,dz,d)=>[cheek(y+dy,z+dz)+d,y+dy,z+dz];
      const center=point(0,0,depth+bulge);
      const ring=outline.map(([dz,dy])=>point(dy,dz,depth));
      for(let i=0;i<ring.length;i++)scene.push({v:[ring[i],ring[(i+1)%ring.length],center],col:color});
    }
    const ellipse=(w,h)=>Array.from({length:16},(_,i)=>[w*Math.cos(tau*i/16),h*Math.sin(tau*i/16)]);
    for(const side of [-1,1]){
      const z=.055*side, y=1.704;
      const almond=[[-.034,0],[-.024,.012],[-.007,.017],[.011,.016],[.027,.010],[.035,0],[.021,-.010],[0,-.013],[-.020,-.009]];
      patch(y,z,almond,'#503e3d',.006,.006);
      patch(y,z,almond.map(([x,h])=>[x*.87,h*.77]),'#efdebd',.009,.007);
      patch(y,z,ellipse(.014,.013),'#463c36',.017,.003);
      patch(y+.004,z+.003,ellipse(.0028,.0028),'#fff3d0',.021);
      patch(1.737,z,[[-.034,-.004],[-.021,.007],[.005,.010],[.024,.005],[.034,-.003],[.006,.001]],'#513b34',.005);
      // Rounded-square rims have a real cross-section, including on the profile.
      const rim=[];
      for(let i=0;i<32;i++){
        const a=tau*i/32, c=Math.cos(a),s=Math.sin(a);
        const zz=side*(.056+.047*Math.sign(c)*Math.abs(c)**.48);
        const yy=1.704+.031*Math.sign(s)*Math.abs(s)**.52;
        rim.push([.192-.031*(Math.abs(zz)/.103)**2,yy,zz]);
      }
      const frameColor='#493c39';
      for(let i=0;i<rim.length;i++)tube(rim[i],rim[(i+1)%rim.length],.0038,.0038,frameColor,5);
      const temple=[rim[3],[.104,1.722,side*.120],[.022,1.712,side*.128],[-.008,1.687,side*.117]];
      for(let i=1;i<temple.length;i++)tube(temple[i-1],temple[i],.004,.0038,frameColor,6);
      profile([[.014,1.645,side*.111,.009,.007],[.009,1.66,side*.117,.021,.014],
        [.006,1.683,side*.121,.028,.017],[.005,1.700,side*.118,.022,.012],[.012,1.709,side*.112,.010,.006]],skin,12);
      lineArt([[.008,1.661,side*.131],[-.004,1.680,side*.139],[.010,1.692,side*.134]],'#9c674f',.004);
    }
    tube([.191,1.715,-.013],[.191,1.715,.013],.004,.004,'#493c39',6);
    // Bridge, rounded tip and alae share one tapered surface.
    profile([[.177,1.650,0,.010,.010],[.183,1.656,0,.028,.024],
      [.186,1.666,0,.043,.026],[.181,1.679,0,.039,.019],
      [.168,1.701,0,.031,.014],[.158,1.726,0,.015,.011]],skin,20);
    for(const side of [-1,1])stroke([.204,1.658,side*.016],[.200,1.659,side*.022],'#92634c',.004);
    const smile=[[-.045,.009],[-.032,.005],[0,.002],[.032,.006],[.044,.011],[.030,-.005],[.003,-.013],[-.023,-.008]];
    patch(1.627,0,smile,'#73473d',.005,.005);
    patch(1.627,0,smile.slice(0,5).concat([[.020,-.002],[0,-.004],[-.023,-.001]]),'#e8cba5',.011);
    // Scalloped hairline and ridged crown form a single swept mass.
    const hair=[cheeks.at(-1)];
    for(const t of [0,.11,.32,.57,.78,.91,1]){
      hair.push(angles.map(a=>{
        const wave=Math.cos(8*a+.9*Math.sin(2*a)+2*t);
        const edge=hairline(a);
        const y=mix(edge,wearingCap?1.761:1.879,t);
        const p=surface(y,a);
        const lift=(wearingCap ? .002 : .021)*(1-t)*(.95+.55*wave);
        return [p[0]+Math.cos(a)*lift,p[1]+(wearingCap?0:.013*t),p[2]+Math.sin(a)*lift];
      }));
    }
    skinPanels(hair,'#51423d');
    if(!wearingCap){
      // Overlapping swept locks taper into the temples and break up the crown.
      for(let lock=0;lock<9;lock++){
        const base=tau*lock/9;
        const strands=[0,.18,.43,.70,.91].map(t=>{
          const mid=base+.68*t, width=.32*Math.sin(Math.PI*(.04+.93*t));
          return [-1,0,1].map(k=>{
            const a=mid+k*width, y=mix(hairline(a)-.003,1.88,t);
            const p=surface(y,a), offset=.021*(1-t)+.001+(1-Math.abs(k))*.014*Math.sin(Math.PI*t);
            return [p[0]+offset*Math.cos(a),y+.018*t,p[2]+offset*Math.sin(a)];
          });
        });
        for(let r=1;r<strands.length;r++)for(let k=0;k<2;k++){
          const [a,b]=strands[r-1].slice(k),[c,d]=strands[r].slice(k);
          const col=k?'#594a40':'#675348';
          scene.push({v:[a,c,b],col},{v:[b,c,d],col});
        }
      }
    }
    if(wearingCap){
      // A soft, slightly slouched cap with a curved, tapered bill.
      profile([[.027,1.752,0,.151,.135],[.016,1.776,0,.149,.132],
        [.001,1.807,0,.143,.128],[-.022,1.842,0,.116,.109],
        [-.046,1.86,0,.075,.078],[-.057,1.868,0,.002,.003]],'#bb653e',24);
      const brim=[];
      for(let i=-8;i<=8;i++){
        const u=i/8, arch=1-u*u;
        brim.push([[.071+.065*arch,1.750+.020*arch,.116*u],
          [.084+.148*arch,1.738+.027*arch,.126*u]]);
      }
      for(let i=1;i<brim.length;i++){
        const [a,b]=brim[i-1],[c,d]=brim[i];
        scene.push({v:[a,c,b],col:'#ab603c'},{v:[b,c,d],col:'#ab603c'});
        stroke(b,d,'#6a4940',.007);
      }
    }
    const turn=.24, c=Math.cos(turn), sn=Math.sin(turn);
    // Vertices are shared between panels; transform each exactly once.
    const transformed=new Set();
    for(let i=firstHeadPart;i<scene.length;i++)for(const v of scene[i].v){
      if(transformed.has(v))continue;
      transformed.add(v);
      const x=(v[0]-.035)*.99,z=v[2]*1.02;
      v[0]=.035+x*c-z*sn; v[2]=x*sn+z*c; v[1]=1.53+(v[1]-1.53)*.98;
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
    sleeve([[lerpPoint(shoulder,[.012,1.40,shoulder[2]*.53],.56),.062],[shoulder,.078],
      [lerpPoint(shoulder,elbow,.28),.079],[lerpPoint(shoulder,elbow,.68),.074],[lerpPoint(shoulder,elbow,.91),.070],
      [lerpPoint(elbow,lerpPoint(shoulder,wrist,.5),.08),.067],[lerpPoint(elbow,wrist,.08),.065],
      [lerpPoint(elbow,wrist,.20),.066],[cuff,.059]],jacket);
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
    const nextSettings=JSON.parse(key);
    if(nextSettings.rockSeed!==settings.rockSeed){
      world=terrainFor(nextSettings.rockSeed);
      renderer?.setTerrain(world);
      cachedTerrainKey='';
    }
    cast = result; castKey = key; settings = nextSettings;
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
        if(next[1]<.70) next[1]=Math.max(next[1],rockField.top(next[0],next[2])+.005);
        stroke(prev, next, col, width);
        prev = next;
      }
    }
    if (cast.landing && cast.landing.surface !== 'rock' && time >= cast.landing.time) { // Ripple where the fly touched down.
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
