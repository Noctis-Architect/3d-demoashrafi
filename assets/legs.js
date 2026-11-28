/* پایه‌های مخروطی صاف چوبی (مبل A466 و تک‌نفره‌اش).
   پایه‌های اسکن برآمدگی‌های حلقه‌ای اضافه داشتند (و دو پایه مبل ال شکسته بود)؛ این پایه‌ها با کد ساخته می‌شوند،
   ولی جای کف، جهت (زاویه کجی)، طول و شعاع بالا و پایین هر پایه از خود فایل سه‌بعدی اندازه‌گیری شده است. */
import { THREE, slot } from './product.js';

const GEO={};
/* مخروط صاف با ته گرد (لبه پایین کمی پخ‌دار مثل پایه تراشیده)؛ محور +Y، کف روی y=0. UV متری. */
function legGeo(len,r0,r1){ const key=[len,r0,r1].join(); return GEO[key]??=(()=>{
  const pts=[], fil=Math.min(0.004,r0*0.3);
  pts.push(new THREE.Vector2(0,0));
  for(let i=0;i<=6;i++){ const a=i/6*Math.PI/2; pts.push(new THREE.Vector2(r0-fil+fil*Math.sin(a),fil-fil*Math.cos(a))); }   // پخ گرد کف
  for(let i=1;i<=24;i++){ const t=i/24; pts.push(new THREE.Vector2(r0+(r1-r0)*t,fil+(len-fil)*t)); }
  pts.push(new THREE.Vector2(0,len));
  const g=new THREE.LatheGeometry(pts,40); g.computeVertexNormals(); return g; })(); }

/* legs: [{b:[x,y,z] کف پایه, d:[dx,dy,dz] جهت محور (رو به بالا), len}] به متر، در مختصات خود مدل.
   r0/r1: شعاع کف و سر پایه. */
export function addLegs(g,legs,{r0=0.015,r1=0.026}={}){
  const up=new THREE.Vector3(0,1,0);
  for(const L of legs){ const m=new THREE.Mesh(legGeo(L.len,L.r0??r0,L.r1??r1),slot.legs); m.name='legs';
    m.quaternion.setFromUnitVectors(up,new THREE.Vector3(...L.d).normalize()); m.position.set(...L.b); g.add(m); }
}
