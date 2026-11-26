/* Procedural hydraulic approximation; not a mass-conserving CFD solver. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function velocityAt(x,y,z,t,rocks=[],speed=.7){
 const h=clamp((y+2)/4.4,0,1), bank=clamp((3-Math.abs(z))/.65,0,1);
 const profile=Math.pow(h,.32)*(1-.12*Math.pow(h,8));
 let u=speed*profile*bank,v=0,w=0;
 for(const r of rocks){
  const X=x-r.x,Y=y-r.y,Z=z-r.z,R=r.r;
  const d=Math.hypot(X,Y/.8,Z);
  if(d<R)return {x:0,y:0,z:0};
  const influence=Math.exp(-Math.pow(Y/(R*1.3),2));
  const near=Math.exp(-Math.pow((d-R)/(R*.7),2))*influence;
  const lateral=Z/(Math.abs(Z)+R*.25);
  if(X<0){u*=1-.7*near*Math.abs(X)/d;w+=speed*.65*near*lateral;v+=speed*.35*near*Math.max(0,Y)/d;}
  else {const wake=Math.exp(-X/(R*3))*Math.exp(-Math.pow(Z/(R*.65+X*.18),2))*influence;
   u-=speed*1.1*wake*profile;w+=speed*.22*wake*Math.sin(t*3-X/R);v+=speed*.09*wake*Math.cos(t*3-X/R);}
  u+=speed*.35*near*Math.abs(Z)/d;
 }
 return {x:clamp(u,-speed*.6,speed*1.8),y:v,z:w};
}
const api={velocityAt};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiverHydraulics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
