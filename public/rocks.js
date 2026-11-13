// The renderer and line solver use the same triangulated upper surfaces.
const RiverRocks = (() => {
  function create(seed) {
    let state = seed >>> 0;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const rocks = [], cells = new Map();
    const cell = (x,z) => Math.floor(x)*128 + Math.floor(z);
    function triangle(a,b,c) {
      const ux=b[0]-a[0], uz=b[2]-a[2], vx=c[0]-a[0], vz=c[2]-a[2];
      const det=ux*vz-uz*vx;
      return {a,b,c, ux,uz,vx,vz, det};
    }
    for(let k=0;k<56;k++){
      // Include one rock along the delivery, where contact is easy to observe.
      const x=k ? random()*50-25 : 4+random()*5;
      const z=k ? random()*17-8.5 : .35+(random()-.5)*.35;
      const radius=k ? .13+.58*random()**2 : .40+.20*random();
      if(Math.hypot(x,z)<1.3+radius)continue;
      const height=radius*(.48+.41*random()), angle=random()*Math.PI*2;
      const cap=[x-.16*radius,height,z+.07*radius], rim=[], shoulder=[], faces=[];
      for(let i=0;i<8;i++){
        const a=angle+i*Math.PI/4;
        const dx=Math.cos(a)*radius*(1+.3*random()), dz=Math.sin(a)*radius*(.78+.22*random());
        rim.push([x+dx,0,z+dz]); shoulder.push([x+.74*dx,height*(.42+.16*random()),z+.74*dz]);
      }
      for(let i=0;i<8;i++){
        const j=(i+1)%8;
        faces.push(triangle(rim[i],shoulder[i],rim[j]),triangle(rim[j],shoulder[i],shoulder[j]),triangle(shoulder[j],shoulder[i],cap));
      }
      const rock={faces,shoulder,x,z,radius,height}; rocks.push(rock);
      for(let cx=Math.floor(x-1.31*radius);cx<=Math.floor(x+1.31*radius);cx++)
        for(let cz=Math.floor(z-radius);cz<=Math.floor(z+radius);cz++){
          const key=cell(cx,cz); if(!cells.has(key))cells.set(key,[]);
          cells.get(key).push(rock);
        }
    }
    function top(x,z){
      let h=0;
      const nearby=cells.get(cell(x,z));
      if(nearby)for(const rock of nearby){
        if(Math.abs(x-rock.x)>1.31*rock.radius || Math.abs(z-rock.z)>rock.radius)continue;
        for(const f of rock.faces){
          const dx=x-f.a[0], dz=z-f.a[2];
          const u=(dx*f.vz-dz*f.vx)/f.det, v=(f.ux*dz-f.uz*dx)/f.det;
          if(u>=-1e-8 && v>=-1e-8 && u+v<=1.00000001)
            h=Math.max(h,f.a[1]+u*(f.b[1]-f.a[1])+v*(f.c[1]-f.a[1]));
        }
      }
      return h;
    }
    return {rocks,top};
  }
  return {create};
})();
if(typeof module!=='undefined')module.exports=RiverRocks;
