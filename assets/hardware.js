/* یراق: دستگیره‌ها (دکمه، حلقه آویز، دستگیره بلند، صدفی). نقطه (x,y,z) = سطح جلوی کشو، رو به +z */
import { THREE, slot } from './product.js';
import { lathe, slabZ, mesh } from './geo.js';

export const HANDLES=[{v:'knob',label:'دکمه‌ای'},{v:'ring',label:'حلقه‌ای'},{v:'bar',label:'دستگیره بلند'},{v:'shell',label:'صدفی'},{v:'none',label:'بدون (فشاری)'}];
export const TRIMS=[{v:'#d4ab62',label:'طلایی'},{v:'#c9ccd0',label:'نقره‌ای'},{v:'#8a5a3b',label:'برنز'},{v:'#1d1d1f',label:'مشکی'}];

const GEO={};
function knobGeo(){ if(GEO.knob) return GEO.knob; const k=lathe([[0,0],[0.006,0.001],[0.005,0.008],[0.004,0.012],[0.011,0.018],[0.012,0.024],[0.008,0.029],[0,0.03]],{radial:32}); k.rotateX(Math.PI/2); return GEO.knob=k; }
export function addHandle(g,type,x,y,z,{span=0.3}={}){
  if(type==='none') return;
  if(type==='knob') return g.add(mesh(knobGeo(),slot.trim,x,y,z));
  if(type==='ring'){ if(!GEO.ring){ const ros=lathe([[0,0],[0.013,0],[0.013,0.003],[0.009,0.006],[0.004,0.011],[0,0.012]],{radial:32,flute:(r,y,a)=>r*(0.88+0.12*Math.abs(Math.cos(4*a)))}); ros.rotateX(Math.PI/2);
      GEO.ring={ros,ring:new THREE.TorusGeometry(0.019,0.0028,10,40)}; }
    g.add(mesh(GEO.ring.ros,slot.trim,x,y,z));
    const pv=new THREE.Group(); pv.position.set(x,y-0.002,z+0.009); pv.add(mesh(GEO.ring.ring,slot.trim,0,-0.019,0));
    pv.userData.swing={phi:0.1,v:0,psi:0,w:0,L:0.019,rest:0.1}; pv.rotation.x=-0.1; g.add(pv); return; }
  if(type==='bar'){ const L=Math.max(0.08,Math.min(0.16,span*0.4)), k='bar'+L;
    if(!GEO[k]){ const post=lathe([[0,0],[0.006,0],[0.0045,0.004],[0.0045,0.022],[0,0.022]],{radial:20}); post.rotateX(Math.PI/2);
      const bar=lathe([[0,-L/2-0.004],[0.0045,-L/2],[0.0055,0],[0.0045,L/2],[0,L/2+0.004]],{radial:20}); GEO[k]={post,bar}; }
    const G=new THREE.Group(); G.add(mesh(GEO[k].post,slot.trim,0,-L/2+0.01,0)); G.add(mesh(GEO[k].post,slot.trim,0,L/2-0.01,0)); G.add(mesh(GEO[k].bar,slot.trim,0,0,0.022));
    G.rotation.z=Math.PI/2; G.position.set(x,y,z); g.add(G); return; }
  if(type==='shell'){ if(!GEO.shell){ const sh=new THREE.Shape(); sh.absellipse(0,0,0.045,0.02,Math.PI,2*Math.PI,false,0); sh.lineTo(-0.045,0.004); sh.lineTo(0.045,0.004);
      GEO.shell=slabZ(sh,0.012,0.004,3,24); }
    g.add(mesh(GEO.shell,slot.trim,x,y+0.008,z+0.003)); }
}
