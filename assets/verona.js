/* قطعات مشترک مجموعه ورونا (کنسول و میز تلویزیون): پایه خراطی، کشو/در با قاب برجسته، دستگیره، مدالیون، نوار مهره‌ای، دامنه */
import { THREE, slot } from './product.js';
import { V3, lathe, sweep, rrect, slabY, slabZ, mesh } from './geo.js';

export const FINISHES=[
  {v:'#0c0c0d',label:'مشکی براق',gloss:1}, {v:'#3a2417',label:'گردویی'}, {v:'#9a6038',label:'راش فندقی'},
  {v:'#d6ae84',label:'راش طبیعی'}, {v:'#6a1c22',label:'زرشکی براق',gloss:1}, {v:'#efe9df',label:'سفید صدفی',gloss:1},
];
export const TOPS=[{v:'wood',label:'هم‌رنگ چوب'},{v:'carrara',label:'مرمر سفید'},{v:'nero',label:'مرمر مشکی'}];
export const TRIMS=[{v:'gold',label:'طلایی',color:'#d4ab62'},{v:'silver',label:'نقره‌ای',color:'#d5d6d8'},{v:'none',label:'بدون'}];
export const TOPNAME={wood:'هم‌رنگ چوب',carrara:'مرمر سفید کارارا',nero:'مرمر مشکی مارکینا'};

/* مواد: سه جایگاه wood / top / trim */
export function veronaQuick(S){ const f=FINISHES.find(x=>x.v===S.finish), P=THREE.MeshPhysicalMaterial, t=TRIMS.find(x=>x.v===S.trim);
  const wood=new P({color:S.finish,roughness:f.gloss?0.3:0.55,clearcoat:f.gloss?1:0.4,clearcoatRoughness:0.06});
  return { wood, top:S.top==='wood'?wood:new P({color:S.top==='nero'?'#1c1c1e':'#ecebe8',roughness:0.15,clearcoat:0.6}),
    trim:t.color?new THREE.MeshStandardMaterial({color:t.color,metalness:1,roughness:0.28}):wood }; }
export async function veronaMaterials(S,kit){ const f=FINISHES.find(x=>x.v===S.finish), t=TRIMS.find(x=>x.v===S.trim);
  const wood=await kit.wood(S.finish,{gloss:!!f.gloss}), top=S.top==='wood'?wood:await kit.marble(S.top);
  return { wood, top, trim:t.color?kit.metal(t.color):wood }; }
export const veronaKey=S=>S.finish+S.top+S.trim;
export function veronaPrewarm(kit){ kit.marble('carrara').catch(()=>{}); kit.marble('nero').catch(()=>{}); }

const GEO={};
/* پایه خراطی شیاردار به ارتفاع LH */
export function legGeo(LH,scale=1){ const k='leg'+LH+'_'+scale; if(GEO[k]) return GEO[k];
  const s=scale, b=LH-0.075*s, fl=(r,y,a)=> (y>0.09*s&&y<b-0.05*s) ? r*(1-0.09*Math.pow(Math.max(0,Math.cos(10*a)),2)) : r;
  const prof=[[0,0.028],[0.019,0.028],[0.024,0.036*s],[0.025,0.046*s],[0.018,0.056*s],[0.017,0.066*s],[0.020,0.074*s],
    [0.0195,0.09*s],[0.021,Math.min(0.2,b*0.35)],[0.024,Math.min(0.32,b*0.6)],[0.027,b-0.07*s],[0.028,b-0.05*s],[0.024,b-0.042*s],[0.026,b-0.036*s],
    [0.033,b-0.022*s],[0.035,b-0.008*s],[0.03,b],[0.026,b+0.004],[0.03,b+0.01],[0,b+0.012]];
  return GEO[k]={ turned:lathe(prof,{radial:48,flute:fl}),
    sabot:lathe([[0,0],[0.016,0],[0.02,0.006],[0.021,0.02],[0.019,0.028],[0,0.028]],{radial:40}),
    ring:lathe([[0.0245,b-0.05*s],[0.03,b-0.047*s],[0.03,b-0.039*s],[0.0245,b-0.036*s]],{radial:40}),
    block:slabY(rrect(new THREE.Shape(),0.06,0.06,0.006),b+0.012,LH,0.004) }; }
export function addLegs(g,LH,xs,zs,scale){ const L=legGeo(LH,scale);
  for(const x of xs) for(const z of zs){ g.add(mesh(L.turned,slot.wood,x,0,z)); g.add(mesh(L.block,slot.wood,x,0,z)); g.add(mesh(L.sabot,slot.trim,x,0,z)); g.add(mesh(L.ring,slot.trim,x,0,z)); } }
/* پنل برجسته (کشو یا در) رو به +z، مرکز (x,y)، جلوی بدنه در z */
export function panel(g,w,h,x,y,z,{knobs=[[0,0]]}={}){
  g.add(mesh(slabZ(rrect(new THREE.Shape(),w,h,0.006),0.014,0.004,3,10),slot.wood,x,y,z+0.005));
  g.add(mesh(slabZ(rrect(new THREE.Shape(),w-0.03,h-0.03,0.004),0.008,0.003,2,8),slot.wood,x,y,z+0.014));
  for(const [kx,ky] of knobs) g.add(mesh(knobGeo(),slot.trim,x+kx,y+ky,z+0.016)); }
export function knobGeo(){ if(GEO.knob) return GEO.knob; const k=lathe([[0,0],[0.006,0.001],[0.005,0.008],[0.004,0.012],[0.011,0.018],[0.012,0.024],[0.008,0.029],[0,0.03]],{radial:32}); k.rotateX(Math.PI/2); return GEO.knob=k; }
/* مدالیون بیضی با قاب مهره‌ای و گل وسط */
export function medallion(g,x,y,z){
  if(!GEO.med){ const pts=[]; for(let i=0;i<40;i++){ const a=2*Math.PI*i/40; pts.push(V3(0.058*Math.cos(a),0.034*Math.sin(a),0)); }
    const ov=new THREE.Shape(); ov.absellipse(0,0,0.052,0.028,0,2*Math.PI,false,0);
    const ros=lathe([[0,0.012],[0.01,0.01],[0.016,0.004],[0.018,0]],{radial:40,flute:(r,y,a)=>r*(0.86+0.14*Math.abs(Math.cos(4*a)))}); ros.rotateX(Math.PI/2);
    GEO.med={ ring:sweep(pts,[0.0055],{closed:true,seg:120,radial:10,bead:0.3,period:0.012,flat:0.8}), oval:slabZ(ov,0.012,0.004,3,24), ros }; }
  g.add(mesh(GEO.med.ring,slot.trim,x,y,z+0.006)); g.add(mesh(GEO.med.oval,slot.wood,x,y,z+0.002)); g.add(mesh(GEO.med.ros,slot.trim,x,y,z+0.008)); }
/* نوار مهره‌ای افقی به طول L */
export function bead(g,L,x,y,z,r=0.0045){ g.add(mesh(sweep([V3(-L/2,0,0),V3(0,0,0),V3(L/2,0,0)],[r],{seg:Math.round(L*80),radial:10,bead:0.25,period:0.012}),slot.trim,x,y,z)); }
/* دامنه کنده‌کاری با قوس وسط */
export function skirt(g,sw,x,y,z){ const sk=new THREE.Shape(); sk.moveTo(-sw/2,0); sk.lineTo(sw/2,0); sk.lineTo(sw/2,-0.012);
  sk.bezierCurveTo(sw*0.25,-0.012,0.08,-0.016,0.035,-0.03); sk.quadraticCurveTo(0,-0.05,-0.035,-0.03); sk.bezierCurveTo(-0.08,-0.016,-sw*0.25,-0.012,-sw/2,-0.012); sk.closePath();
  g.add(mesh(slabZ(sk,0.02,0.005,3,16),slot.wood,x,y,z)); }
/* رویه + ابزار زیر رویه */
export function topSlab(g,W,D,H,t=0.032){ g.add(mesh(slabY(rrect(new THREE.Shape(),W,D,0.02),H-t,H,0.009),slot.top));
  g.add(mesh(slabY(rrect(new THREE.Shape(),W-0.03,D-0.035,0.014),H-t-0.016,H-t+0.002,0.007),slot.wood)); return H-t-0.016; }
export const box=(g,w,d,y0,y1,x=0,z=0)=>g.add(mesh(slabY(rrect(new THREE.Shape(),w,d,0.006),y0,y1,0.004),slot.wood,x,0,z));
/* پایه کوتاه خراطی (برای میز تلویزیون): سم یراق + گلدانی کوتاه + مکعب */
export function addFeet(g,h,xs,zs){ const k='foot'+h; if(!GEO[k]){
    GEO[k]={ turned:lathe([[0,0.02],[0.022,0.02],[0.03,0.032],[0.034,0.05],[0.031,0.066],[0.024,0.078],[0.022,h-0.03],[0.027,h-0.024],[0.03,h-0.016],[0,h-0.014]],{radial:40,flute:(r,y,a)=>y>0.03&&y<0.07?r*(1-0.07*Math.pow(Math.max(0,Math.cos(10*a)),2)):r}),
      sabot:lathe([[0,0],[0.018,0],[0.022,0.006],[0.023,0.016],[0.021,0.022],[0,0.022]],{radial:40}),
      block:slabY(rrect(new THREE.Shape(),0.064,0.064,0.006),h-0.016,h,0.004) }; }
  const F=GEO[k]; for(const x of xs) for(const z of zs){ g.add(mesh(F.turned,slot.wood,x,0,z)); g.add(mesh(F.sabot,slot.trim,x,0,z)); g.add(mesh(F.block,slot.wood,x,0,z)); } }
