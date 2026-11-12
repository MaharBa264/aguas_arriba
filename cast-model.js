// SI units. The prescribed input is the grip motion. Everything downstream
// of the flexible tip is a freely moving mass, including the terminal fly.
const CastModel = (() => {
  const step = 1 / 360, count = 44, frameskip = 4;
  const rodLengths = [2.286, 2.743, 3.048], leaders = [2.286, 2.743, 3.658];
  const limit = x => Math.min(1, Math.max(0, x));
  const ease = x => (x = limit(x), x*x*(3-2*x));
  function windAt(settings, t) {
    return settings.wind * (settings.gust ? .78+.16*Math.sin(4.3*t)+.06*Math.sin(9*t) : 1);
  }
  function rodPoint(hand, angle, bend, length, q, lateral=0) {
    // Integrate a unit tangent along an arc in its instantaneous bending plane.
    const turn=Math.hypot(bend,lateral), half=turn*q*.5;
    const along=length*q*(Math.abs(half)<1e-7?1:Math.sin(2*half)/(2*half));
    const normal=turn<1e-7?length*q*q*.5:2*length*Math.sin(half)**2/(turn*turn);
    const c=Math.cos(angle), sn=Math.sin(angle);
    return [hand[0]+along*c-normal*bend*sn,hand[1]+along*sn+normal*bend*c,hand[2]+normal*lateral];
  }
  function simulate(s) {
    const rod = rodLengths[s.rod], leader=leaders[s.leader], line=5.6, ds=(line+leader)/count;
    const size=(count+1)*3, pos=new Float64Array(size), prev=pos.slice(), vel=pos.slice();
    const mass=new Float64Array(count+1), inv=mass.slice(), diameter=mass.slice();
    for(let i=1;i<=count;i++){
      const metres=(i-.5)*ds, u=metres/line, taper=limit((metres-line)/leader);
      const profile=s.line===0 ? .86+.24*Math.sin(Math.PI*limit((u-.36)/.64)) : .8+.25*Math.sin(Math.PI*u);
      diameter[i]=metres<line ? [.00091,.00105,.00119][s.weight]*profile :
        .00054*(1-taper)+[.00020,.00015,.00013][s.tip]*taper;
      const density=metres<line?920:1150;
      mass[i]=density*Math.PI*.25*diameter[i]**2*ds;
      if(i===count)mass[i]+= .000045;
      inv[i]=1/mass[i];
    }
    const stroke=(t,a,b)=>{
      const u=limit((t-a)/(b-a));
      return u**3*(4-3*u); // Accelerate progressively, brake to zero at the stop.
    };
    let tipAngle=-.43,omega=0,lateral=0,lateralRate=0;
    let landing=null;
    // Effective rotational inertia for the first bending mode (kg m²).
    const modalInertia=.016*(rod/2.743)**2;
    const normals=new Float64Array(count*3),diag=mass.slice(),off=mass.slice(),rhs=mass.slice();
    const frames=[];
    for(let n=0;n<=360*10;n++){
      const t=n*step, lift=ease(t/.42), back=stroke(t,.38,.69), front=stroke(t,1.56,1.88), lower=ease((t-2.5)/.78);
      const sweep=back-front;
      const angle=-.43+1.30*lift+1.49*back-1.25*front-1.54*lower;
      const hand=[.36+.09*lift-.60*sweep-.09*lower,
        1.36+.16*lift+.11*sweep-.10*Math.sin(Math.PI*sweep)-.16*lower,.35];
      const natural=27*2.743/rod;
      omega+=step*(natural**2*(angle-tipAngle)-2*.68*natural*omega);
      tipAngle+=omega*step;
      lateralRate+=step*(-(natural**2)*lateral-2*.68*natural*lateralRate);
      lateral+=step*lateralRate;
      let curvature=2*(tipAngle-angle);
      const predictedBend=curvature,predictedLateral=lateral;
      const tip=rodPoint(hand,angle,curvature,rod,1,lateral);
      if(!n){
        pos.set(tip);
        for(let i=1;i<=count;i++){let j=i*3,dy=Math.min(ds*.48,Math.max(0,pos[j-2]-.025));pos.set([pos[j-3]+Math.sqrt(ds*ds-dy*dy),pos[j-2]-dy,tip[2]],j)}
      }else{
        prev.set(pos);pos.set(tip);
        const wind=windAt(s,t)/3.6, wx=wind*Math.cos(s.dir),wz=wind*Math.sin(s.dir);
        for(let i=1;i<=count;i++){
          const j=3*i, vx=vel[j],vy=vel[j+1],vz=vel[j+2];
          const tx=(prev[j]-prev[j-3])/ds,ty=(prev[j+1]-prev[j-2])/ds,tz=(prev[j+2]-prev[j-1])/ds;
          const rx=wx-vx,ry=-vy,rz=wz-vz, along=rx*tx+ry*ty+rz*tz;
          const nx=rx-along*tx,ny=ry-along*ty,nz=rz-along*tz;
          const drag=.5*1.225*diameter[i]*ds*inv[i];
          const normal=drag*1.05*Math.hypot(nx,ny,nz), tangent=drag*.025*Math.abs(along)*along;
          const fly=i===count ? .5*1.225*.000025*inv[i]*Math.hypot(rx,ry,rz) : 0;
          const floating=prev[j+1]<=.026;
          const wet=floating ? 14 : 0;
          vel[j]+=step*(normal*nx+tangent*tx+fly*rx-wet*vx);
          vel[j+1]+=step*(normal*ny+tangent*ty+fly*ry-9.81);
          vel[j+2]+=step*(normal*nz+tangent*tz+fly*rz-wet*vz);
          for(let k=0;k<3;k++)pos[j+k]+=step*vel[j+k];
        }
        // Newton projection of all segment lengths together. The constraint
        // Jacobian times inverse mass times its transpose is tridiagonal.
        for(let iter=0;iter<8;iter++){
          // Project the first link against the flexible tip. Its reaction
          // acts on both bending coordinates in the same constraint solve.
          const eps=.0001, anchor=rodPoint(hand,angle,curvature,rod,1,lateral);
          const derivative=(bend,side)=>rodPoint(hand,angle,bend,rod,1,side).map((v,k)=>(v-anchor[k])/eps);
          const inPlane=derivative(curvature+eps,lateral),sideways=derivative(curvature,lateral+eps);
          let lever=0,sideLever=0;
          for(let i=0;i<count;i++){
            let j=i*3, dx=pos[j+3]-pos[j],dy=pos[j+4]-pos[j+1],dz=pos[j+5]-pos[j+2],len=Math.hypot(dx,dy,dz)||ds;
            normals[j]=dx/len;normals[j+1]=dy/len;normals[j+2]=dz/len;
            diag[i]=inv[i]+inv[i+1];rhs[i]=ds-len;
            if(i===0){
              for(let k=0;k<3;k++){lever+=normals[k]*inPlane[k];sideLever+=normals[k]*sideways[k]}
              diag[i]+=(lever**2+sideLever**2)/modalInertia;
            }
            if(i){off[i]=-inv[i]*(normals[j]*normals[j-3]+normals[j+1]*normals[j-2]+normals[j+2]*normals[j-1]);
              let r=off[i]/diag[i-1];diag[i]-=r*off[i];rhs[i]-=r*rhs[i-1]}
          }
          for(let i=count-1;i>=0;i--){
            rhs[i]=(rhs[i]-(i<count-1?off[i+1]*rhs[i+1]:0))/diag[i];
            for(let k=0;k<3;k++){let correction=rhs[i]*normals[i*3+k];pos[i*3+k]-=inv[i]*correction;pos[(i+1)*3+k]+=inv[i+1]*correction}
          }
          curvature-=rhs[0]*lever/modalInertia;
          lateral-=rhs[0]*sideLever/modalInertia;
          pos.set(rodPoint(hand,angle,curvature,rod,1,lateral));
          for(let i=1;i<=count;i++)pos[3*i+1]=Math.max(.025,pos[3*i+1]);
        }
        tipAngle+=(curvature-predictedBend)*.5;
        omega+=(curvature-predictedBend)*.5/step;
        lateralRate+=(lateral-predictedLateral)/step;
        for(let j=0;j<size;j++)vel[j]=(pos[j]-prev[j])/step;
      }
      if(t>2.38 && !landing && pos[size-2]<=.02501){
        landing={time:t,x:pos[size-3],z:pos[size-1]};
      }
      if(n%frameskip===0 && landing && t>landing.time+.48 && pos[size-2]<=.026){
        frames.push({hand,angle,curvature,lateral,points:Float32Array.from(pos)});
        break;
      }
      if(n%frameskip===0)frames.push({hand,angle,curvature,lateral,points:Float32Array.from(pos)});
    }
    return {frames,rod,line,ds,landing,duration:(frames.length-1)*frameskip*step};
  }
  return {simulate,rodPoint,windAt};
})();
if(typeof module!=='undefined')module.exports=CastModel;
