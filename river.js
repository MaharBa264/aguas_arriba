// World coordinates in metres. +X is the delivery direction and Y is vertical.
let elevation=.19, zoom=1, drag;
const clamp=v=>Math.max(0,Math.min(1,v)), smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const between=(x,a,b)=>smooth((x-a)/(b-a));
const cameraViews={oblique:[.27,.19],side:[0,.09],rear:[-1.39,.27],above:[.10,1.23],detail:[.36,.14]};
let detailView=false;
function setView(key){detailView=key==='detail';[yaw,elevation]=cameraViews[key];el('view').value=key}
el('view').onchange=e=>setView(e.target.value);
el('zoom').oninput=e=>zoom=+e.target.value;
cv.onpointerdown=e=>{drag=[e.clientX,e.clientY,yaw,elevation];cv.setPointerCapture(e.pointerId)};
cv.onpointermove=e=>{if(!drag)return;yaw=drag[2]-(e.clientX-drag[0])*.009;elevation=Math.max(.035,Math.min(1.48,drag[3]+(e.clientY-drag[1])*.008));el('view').value='free'};
cv.onpointerup=cv.onpointercancel=()=>drag=null;
el('study').onclick=()=>{document.querySelector('.stage').scrollIntoView({block:'start'});requestAnimationFrame(()=>requestAnimationFrame(()=>{p=1.10/cast.duration;playing=false;setView('side');sync()}))};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1));
let scene=[], world=[],scale,w,h,camera,right,up,forward;
function color(hex,f){let n=parseInt(hex.slice(1),16);return 'rgb('+[16,8,0].map(s=>Math.min(255,Math.round(((n>>s)&255)*f))).join(',')+')'}
function face(a,b,d,col){let norm=unit(cross(sub(b,a),sub(d,a)));scene.push({v:[a,b,d],col:color(col,.78+.26*Math.abs(dot(norm,[-.45,.79,.41])))})}
function stroke(a,b,col,width){scene.push({v:[a,b],col,width})}
function tube(a,b,r,R,col,n=8){let axis=unit(sub(b,a)),i=unit(cross(axis,Math.abs(axis[1])>.85?[1,0,0]:[0,1,0])),j=cross(axis,i);
let ring=(v,rad,k)=>add(v,add(mul(i,rad*Math.cos(k*tau/n)),mul(j,rad*Math.sin(k*tau/n))));
for(let k=0;k<n;k++){let a1=ring(a,r,k),a2=ring(a,r,k+1),b1=ring(b,R,k),b2=ring(b,R,k+1);face(a1,a2,b1,col);face(b1,a2,b2,col);face(b,b1,b2,col);face(a,a2,a1,col)}}
function oval(o,r,col,n=9){let point=(i,j)=>{let a=i*Math.PI/5,b=j*tau/n;return add(o,[r[0]*Math.sin(a)*Math.cos(b),r[1]*Math.cos(a),r[2]*Math.sin(a)*Math.sin(b)])};for(let i=0;i<5;i++)for(let j=0;j<n;j++){let a=point(i,j),b=point(i,j+1),d=point(i+1,j),e=point(i+1,j+1);if(i)face(a,b,d,col);if(i<4)face(d,b,e,col)}}
let seed=917;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function bank(x,sign){return sign*(11+.85*Math.sin(x*.18+sign)+.55*Math.cos(x*.43))}
for(let side of [-1,1]){
 let strips=[];for(let x=-60;x<=60;x+=3){let z=bank(x,side);strips.push([[x,-.04,z],[x,.24+rand()*.18,z+side*1.6],[x,.8+rand()*1.4,z+side*7],[x,3+rand()*3,z+side*16],[x,5+4*Math.sin(x*.12)+rand()*3,z+side*29]])}
 for(let k=1;k<strips.length;k++)for(let n=0;n<4;n++){let a=strips[k-1],b=strips[k],col=['#b8a27a','#8f996e','#69836d','#849a90'][n];face(a[n],a[n+1],b[n],col);face(b[n],a[n+1],b[n+1],col)}
 for(let k=0;k<66;k++){let x=rand()*83-41,z=bank(x,side)+side*(2+rand()*3),y=.48,t=.55+rand()*1.45;if(side>0&&Math.abs(x)<16)continue;tube([x,y,z],[x,y+t,z],.07,.045,'#655747',4);tube([x,y+t*.5,z],[x,y+t*1.8,z],t*.5,.02,'#516f52',6)}
}
for(let k=0;k<95;k++){let x=rand()*50-25,z=rand()*10-5,r=.09+rand()*.33;oval([x,-r*.17,z],[r*1.6,r,r*.9],'#778984',5)}
for(let k=0;k<650;k++){let x=rand()*66-33,z=rand()*22-11;stroke([x,.008,z],[x+rand()*.8+.12,.009,z+.02],'#acd3c4',.012)}
world=scene;
let gpuRender=createSceneRenderer(cv,world);
let bodyCache,bodyKey='';
function garment(rings,col){
 const n=12;
 const point=([x,y,rx,rz],i)=>[x+rx*Math.cos(tau*i/n),y,rz*Math.sin(tau*i/n)];
 for(let row=1;row<rings.length;row++)for(let i=0;i<n;i++){
   const a=point(rings[row-1],i),b=point(rings[row-1],i+1),d=point(rings[row],i),e=point(rings[row],i+1);
   face(a,b,d,col);face(d,b,e,col);
 }
}
function makeBody(jacket,skin){
 for(let side of [-1,1]){
   let hip=[-.02,.90,side*.105],knee=[.055+side*.095,.51,side*.145],ankle=[side*.17,.14,side*.17];
   tube(hip,knee,.117,.09,'#646e60');tube(knee,ankle,.09,.075,'#586354');
   oval(add(ankle,[.045,-.058,0]),[.15,.085,.09],'#454c40');
 }
 garment([[-.02,.78,.135,.17],[-.02,.93,.16,.20],[0,1.10,.14,.165],[.015,1.33,.17,.21],[.012,1.46,.135,.228],[.035,1.52,.092,.09]],jacket);
 garment([[0,.98,.162,.185],[0,1.04,.153,.18]],'#414d42');
 garment([[.008,1.07,.155,.175],[.017,1.34,.178,.219],[.011,1.445,.145,.222],[.035,1.495,.105,.122]],'#74785a');
 for(let side of [-1,1]){oval([.15,1.23,side*.096],[.042,.069,.073],'#8d8969')}
 tube([.034,1.46,0],[.047,1.59,0],.078,.069,skin);
 oval([.057,1.666,0],[.109,.144,.09],skin);oval([.150,1.651,0],[.035,.029,.034],skin);
 for(let side of [-1,1]){oval([.042,1.653,side*.087],[.027,.035,.013],skin);oval([.132,1.693,side*.059],[.013,.008,.011],'#453c31')}
 oval([.017,1.721,0],[.095,.085,.092],'#51483a');
 if(el('hat').checked){oval([.038,1.772,0],[.123,.065,.105],'#506552');oval([.137,1.752,0],[.116,.013,.103],'#404f40')}
}
function arm(shoulder,hand,pole,jacket,skin){
 // Two fixed-length links. Project the elbow guide onto the plane normal to the reach.
 const axis=sub(hand,shoulder),distance=Math.hypot(...axis),direction=unit(axis);
 const upper=.32,lower=.30,along=(upper**2-lower**2+distance**2)/(2*distance);
 const radius=Math.sqrt(Math.max(0,upper**2-along**2));
 const out=unit(sub(pole,mul(direction,dot(direction,pole))));
 const elbow=add(shoulder,add(mul(direction,along),mul(out,radius)));
 tube(shoulder,elbow,.095,.071,jacket);oval(shoulder,[.09,.088,.088],jacket,7);
 const cuff=add(elbow,mul(sub(hand,elbow),.69));
 tube(elbow,cuff,.073,.05,jacket);oval(elbow,[.074,.073,.074],jacket,7);
 tube(cuff,hand,.047,.038,skin);oval(hand,[.055,.062,.043],skin,7);
}
function person(hand,angle,bend,lateral){
 const jacket=el('coat').value,skin='#bb8969',key=jacket+el('hat').checked;
 if(key!==bodyKey){const moving=scene;scene=[];makeBody(jacket,skin);bodyCache=scene;scene=moving;bodyKey=key}
 scene.push(...bodyCache);
 const shoulder=[.045+hand[0]*.10,1.438,.201];
 arm(shoulder,hand,[-.48,-1,.22],jacket,skin);
 arm([.028,1.435,-.202],[.26+.035*Math.sin(angle),1.14,-.117],[-.36,-1,-.4],jacket,skin);
 let L=cast.rod,axis=[Math.cos(angle),Math.sin(angle),0],normal=[-axis[1],axis[0],0],base=add(hand,mul(axis,-.19));tube(base,add(hand,mul(axis,.16)),.032,.028,'#ba9c6f');let reel=add(base,[0,-.04,.025]);tube(reel,add(reel,[0,0,.076]),idx('reel')?.103:.083,idx('reel')?.103:.083,'#34494b');
 let prev=hand;
 for(let i=1;i<=24;i++){let q=i/24,next=CastModel.rodPoint(hand,angle,bend,L,q,lateral);stroke(prev,next,'#272f2b',.028-.016*q);prev=next}
}
const castSettings=()=>({rod:idx('rod'),line:idx('line'),weight:idx('weight'),leader:idx('leader'),tip:idx('tip'),wind:+el('wind').value,dir:+el('dir').value*Math.PI/180,gust:el('gust').checked});
let settings=castSettings(), castKey=JSON.stringify(settings), cast=CastModel.simulate(settings), pending=null, worker;
try{worker=new Worker('cast-worker.js');worker.onmessage=({data})=>{
 pending=null;if(data.key===JSON.stringify(castSettings())){cast=data.result;castKey=data.key;settings=JSON.parse(data.key);sync()}
};worker.onerror=()=>{worker.terminate();worker=null;pending=null}}catch{}
function refreshCast(){
 let desired=castSettings(),key=JSON.stringify(desired);
 if(key===castKey||pending)return;
 if(worker){pending=key;worker.postMessage({key,settings:desired})}
 else{cast=CastModel.simulate(desired);settings=desired;castKey=key;sync()}
}
function castTime(){
 return p*cast.duration;
}
function drawCast(time){
 const index=time/cast.duration*(cast.frames.length-1),k=Math.min(cast.frames.length-1,Math.floor(index)),u=index-k;
 const a=cast.frames[k],b=cast.frames[Math.min(k+1,cast.frames.length-1)];
 person(a.hand.map((v,i)=>mix(v,b.hand[i],u)),mix(a.angle,b.angle,u),mix(a.curvature,b.curvature,u),mix(a.lateral,b.lateral,u));
 let prev;
 for(let j=0;j<a.points.length;j+=3){
   let next=[0,1,2].map(i=>mix(a.points[j+i],b.points[j+i],u));
   let main=j/3*cast.ds<=cast.line,tippet=j>=a.points.length-12;
   if(prev)stroke(prev,next,main?'#ffcb4c':tippet?'#fff9ed':'#fff1ca',main?.038+settings.weight*.006:tippet?.022:.028);
   prev=next
 }
 if(cast.landing && time>=cast.landing.time){
   const age=time-cast.landing.time,r=.07+.58*age;
   for(let i=0;i<32;i++){
     const at=k=>[cast.landing.x+r*Math.cos(tau*k/32),.024,cast.landing.z+r*Math.sin(tau*k/32)];
     stroke(at(i),at(i+1),'#e1f2dd',.018);
   }
 }
 oval(prev,[.058,.042,.043],'#b54625',5)
}
// Software rendering fallback. Cache the terrain in three depth layers for the current camera.
let cachedTerrainKey='',terrainLayers=[];
function projectObjects(objects){
 let queue=[];for(let obj of objects){let verts=obj.v.map(pt=>{let v=sub(pt,camera),z=dot(v,forward);return [w*.5+scale*dot(v,right)/z,h*.5-scale*dot(v,up)/z,z]});if(verts.some(v=>v[2]<.15)||[0,1].some((k)=>verts.every(v=>v[k]<-6)||verts.every(v=>v[k]>(k?h:w)+6)))continue;let z=verts.reduce((sum,v)=>sum+v[2],0)/verts.length;queue.push({obj,verts,z})}

 return queue.sort((a,b)=>b.z-a.z);
}
function paintItems(ctx,items){
for(let {obj,verts,z} of items){ctx.beginPath();verts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(obj.width){ctx.strokeStyle=obj.col;ctx.lineWidth=Math.max(obj.width<.02?.65:1.15,obj.width*scale/z);ctx.lineCap='round';ctx.stroke()}else{ctx.closePath();ctx.fillStyle=obj.col;ctx.fill()}}

}
function paintSoftware(viewKey,dist,d){
 const bucket=z=>z>dist+2?0:z<dist-2?2:1;
 if(cachedTerrainKey!==viewKey){
   const terrain=[[],[],[]];
   for(const item of projectObjects(world))terrain[bucket(item.z)].push(item);
   terrainLayers=terrain.map(items=>{
     const layer=document.createElement('canvas');layer.width=cv.width;layer.height=cv.height;
     const ctx=layer.getContext('2d');ctx.setTransform(d,0,0,d,0,0);paintItems(ctx,items);return layer;
   });
   cachedTerrainKey=viewKey;
 }
 const moving=[[],[],[]];
 for(const item of projectObjects(scene))moving[bucket(item.z)].push(item);
 for(let i=0;i<3;i++){c.drawImage(terrainLayers[i],0,0,w,h);paintItems(c,moving[i])}
}

let previousView, previousFrame;
function frame(t){
 let dt=Math.min(.06,(t-last)/1000);last=t;if(playing){p=Math.min(1,p+dt*Number(el('rate').value)/cast.duration);if(p===1)playing=false;sync()}
 w=cv.clientWidth;h=cv.clientHeight;let d=Math.min(devicePixelRatio,2);
 if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){cv.width=Math.round(w*d);cv.height=Math.round(h*d)}c.setTransform(d,0,0,d,0,0);
 scale=h*1.18;let dist=(detailView?Math.max(5.7,scale*7/w):Math.max(11.5,scale*24/w))/zoom;
 let normal=[Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)];
 camera=add(detailView?[.3,2.0,0]:[.8,2.75,0],mul(normal,dist));forward=mul(normal,-1);right=[Math.cos(yaw),0,-Math.sin(yaw)];up=cross(right,forward);
 refreshCast();
 const viewKey=[w,h,d,yaw,elevation,zoom,detailView].join('|');
 const frameKey=[viewKey,p,castKey,el('coat').value,el('hat').checked,idx('reel'),el('dust').checked].join('|');
 const hasParticles=settings.wind>0 && el('dust').checked;
 if(frameKey===previousFrame&&!hasParticles){requestAnimationFrame(frame);return}
 previousFrame=frameKey;
 if(!gpuRender||viewKey!==previousView){
 let sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#9fc8c8');sky.addColorStop(.52,'#eadfc4');sky.addColorStop(1,'#e3dcc1');c.fillStyle=sky;c.fillRect(0,0,w,h);
 let horizon=h*.5-scale*Math.tan(elevation);let water=c.createLinearGradient(0,Math.min(h*.8,Math.max(0,horizon)),0,h);water.addColorStop(0,'#b3cec0');water.addColorStop(1,'#3c827e');c.fillStyle=water;c.fillRect(0,Math.max(0,horizon),w,h);
 previousView=viewKey;
 }
 scene=[];let time=castTime(),speed=CastModel.windAt(settings,time),dir=settings.dir;
 el('speed').value=Math.round(speed)+' km/h';drawCast(time);
 travel+=dt*speed*.09;if(el('dust').checked&&speed>0){for(let i=0;i<68;i++){let x=((i*2.71+travel*Math.cos(dir))%22+22)%22-11,z=((i*1.97+travel*Math.sin(dir))%10+10)%10-5,y=.32+i*.671%4;stroke([x,y,z],[x+.014*speed*Math.cos(dir),y,z+.014*speed*Math.sin(dir)],'#f1fbdfaa',.018)}}
 if(gpuRender){
   if(gpuRender(scene,camera,right,up,forward,w,h,scale)){requestAnimationFrame(frame);return}
   gpuRender=null;previousView=null;previousFrame=null;
 }
 paintSoftware(viewKey,dist,d);
 requestAnimationFrame(frame)
}
setView('side');sync();requestAnimationFrame(frame);
