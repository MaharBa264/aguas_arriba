const test=require('node:test'),assert=require('node:assert/strict');
const {velocityAt:v}=require('../public/river-hydraulics.js');
test('bed and banks slow the unobstructed flow',()=>{
 assert.equal(v(0,-2,0,0).x,0);
 assert.equal(v(0,0,3,0).x,0);
 assert.ok(v(0,1,0,0).x>v(0,-1.8,0,0).x);
});
test('still water stays still',()=>assert.deepEqual(v(0,0,0,0,[],0),{x:0,y:0,z:0}));
test('solid rock and wake',()=>{
 const rocks=[{x:0,y:-1,z:0,r:.6}];
 assert.deepEqual(v(0,-1,0,0,rocks),{x:0,y:0,z:0});
 assert.ok(v(.7,-1,0,0,rocks).x<v(.7,-1,0,0).x);
 assert.ok(v(-.6,-1,.4,0,rocks).z>0);
});
test('finite velocities throughout representative domain',()=>{
 const rocks=[{x:0,y:-1,z:0,r:.6}];
 for(let x=-3;x<=3;x+=.3)for(let y=-2;y<=2.4;y+=.3)for(let z=-3;z<=3;z+=.3)
 assert.ok(Object.values(v(x,y,z,1,rocks)).every(Number.isFinite));
});
