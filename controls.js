
const el=id=>document.getElementById(id), cv=document.querySelector('canvas'),c=cv.getContext('2d');
const methods={mosca:{gear:{rod:['Largo de caña','7,5 pies','9 pies','10 pies'],weight:['Clase de caña y línea','#3','#5','#7'],reel:['Reel','Bobina estándar','Bobina de eje grande'],line:['Perfil de línea flotante','Peso adelantado (WF)','Doble cono (DT)'],leader:['Largo del líder','7,5 pies','9 pies','12 pies'],tip:['Tippet','3X','5X','6X']},phases:['Levante','Golpe atrás','Pausa atrás','Golpe adelante','Presentación'],hints:['Elevá la punta para despegar la línea.','Acelerá hacia atrás y detené la caña.','La caña se detuvo. El bucle todavía viaja.','Acelerá adelante y volvé a detener la punta.','Seguí el líder hasta donde posa la mosca.']}};
const m=methods.mosca;for(const [id,[label,...opts]] of Object.entries(m.gear)){let l=document.createElement('label');l.textContent=label;let s=document.createElement('select');s.id=id;opts.forEach(o=>s.add(new Option(o)));if(['rod','weight','leader','tip'].includes(id))s.selectedIndex=1;l.append(s);el('gear').append(l)}
let p=0,yaw=.27,playing=false,last=0,travel=0;const tau=Math.PI*2,idx=id=>el(id).selectedIndex, mix=(a,b,u)=>a+(b-a)*u;
function phase(){const t=castTime();return t<.38?0:t<.69?1:t<1.56?2:t<1.88?3:4}
function sync(){
 let label=m.phases[phase()],hint=m.hints[phase()];
 if(cast.landing && castTime()>=cast.landing.time){label='La mosca toca el agua';hint='La onda marca el punto de contacto.'}
 el('phase').textContent=label;el('hint').textContent=hint;el('time').value=p*1000;el('play').textContent=playing?'Ⅱ Pausa':'▶ Reproducir'}
el('play').onclick=()=>{if(p>=1)p=0;playing=!playing;sync()};el('time').oninput=e=>{playing=false;p=e.target.value/1000;sync()};addEventListener('scroll',()=>{playing=false;p=Math.min(1,scrollY/Math.max(1,document.querySelector('.grid').offsetHeight-document.querySelector('.stage').offsetHeight+125));sync()},{passive:true});
el('puntano').onclick=()=>{el('wind').value=32;el('dir').value=90;el('gust').checked=el('dust').checked=true;el('note').textContent=' Para el compadre.'};

