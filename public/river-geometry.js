(function(root){'use strict';
const presets={serrano:{depth:2.6,width:2.6,curve:.35,rough:.23,neck:.15},rapidos:{depth:1.65,width:2.5,curve:.12,rough:.32,neck:.25},pozon:{depth:3.5,width:3,curve:.2,rough:.12,neck:.1},curva:{depth:2.7,width:2.5,curve:1.05,rough:.18,neck:.15},estrecho:{depth:2.5,width:2.7,curve:.15,rough:.18,neck:.48}};
function create(kind='serrano',seed=42){const p=presets[kind]||presets.serrano;const phase=(seed%997)/997*6.28;
function center(x){return p.curve*Math.sin(x*.35+phase)}
function width(x){return p.width*(1-p.neck*Math.exp(-x*x/3))}
function bed(x,z){const n=(z-center(x))/width(x);return 2.4-p.depth*(1-.65*Math.min(1,n*n)) +p.rough*(.6*Math.sin(x*1.8+phase)+.4*Math.cos(z*3+x*.7))-(kind==='pozon'?.55*Math.exp(-x*x/5):0)}
return {center,width,bed,surface:2.4,kind,seed};}
const api={create,presets};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiverGeometry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
