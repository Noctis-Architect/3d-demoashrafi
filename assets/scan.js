/* ساخت مدل از هندسه دقیق اسکن (assets/models/*.js) + مواد خودمان.
   فرم، برجستگی و کنده‌کاری‌ها عیناً همان فایل سه‌بعدی اصلی است؛ رنگ پیش‌فرض هر بخش از رنگ خود مدل گرفته شده
   و بافت (پارچه، چرم، چوب، رنگ) روی آن می‌نشیند. */
import { THREE, slot, kit, productPage } from './product.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.mjs';
import { loadImg, tex, neutral } from './geo.js';

await MeshoptDecoder.ready;
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/* سایه‌روشن اسکن (فرورفتگی کنده‌کاری‌ها، چین پارچه) به صورت رنگ رأس.
   K: سقف روشنایی؛ رنگ ماده به همان نسبت جبران می‌شود تا رنگ میانگین دقیقاً رنگ پیش‌فرض باشد. */
export const SHADE_K=0.8;
export function buildScan(M,{shadeGamma=1}={}){
  const g=new THREE.Group(); g.name=M.id;
  for(const s of M.slots){
    const vb=new Uint8Array(s.nv*16); MeshoptDecoder.decodeVertexBuffer(vb,s.nv,16,b64(s.vb));
    const ib=new Uint32Array(s.ni); MeshoptDecoder.decodeIndexBuffer(new Uint8Array(ib.buffer),s.ni,4,b64(s.ib));
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int16Array(vb.buffer),8),3,0,true));
    geo.setAttribute('normal',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(vb.buffer),16),3,8,true));
    geo.setAttribute('uv',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Uint16Array(vb.buffer),8),2,6,true));
    const col=new Uint8Array(s.nv*3);
    for(let i=0;i<s.nv;i++){ const v=Math.min(255,Math.round(Math.pow(vb[i*16+6]/127.5,shadeGamma)*SHADE_K*255)); col[i*3]=col[i*3+1]=col[i*3+2]=v; }
    geo.setAttribute('color',new THREE.BufferAttribute(col,3,true));
    geo.setIndex(new THREE.BufferAttribute(ib,1));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const m=new THREE.Mesh(geo,slot[s.slot]); m.name=s.slot;
    m.scale.setScalar(M.half); m.position.fromArray(M.center); g.add(m);
  }
  return g;
}

/* ---------- مواد ---------- */
const C={};
const lin=hex=>new THREE.Color(hex);                       // three رنگ hex را خطی نگه می‌دارد
/* بافت سه‌جهته (triplanar) در فضای خود مدل: نقش پارچه/چوب بدون درز روی هر سطحی، مستقل از UV اسکن */
function triplanar(mat,tile,half){
  mat.onBeforeCompile=sh=>{ sh.uniforms.triK={value:half/tile};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTriP; varying vec3 vTriN;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTriP=position; vTriN=normal;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float triK; varying vec3 vTriP; varying vec3 vTriN;')
      .replace('#include <map_fragment>',`#ifdef USE_MAP
  vec3 tb=pow(abs(normalize(vTriN)),vec3(4.0)); tb/=tb.x+tb.y+tb.z; vec3 tp=vTriP*triK;
  diffuseColor*=texture2D(map,tp.zy)*tb.x+texture2D(map,tp.xz)*tb.y+texture2D(map,tp.xy)*tb.z;
#endif`); };
  mat.customProgramCacheKey=()=>'tri'+tile+half;
  return mat;
}
/* نرمال‌مپ خود اسکن: ریزبرجستگی کنده‌کاری و بافت سطح، روی UV اصلی */
export function scanNormal(url){ return C['n'+url]??=new Promise((res,rej)=>new THREE.TextureLoader().load(url,t=>{
  t.flipY=false; t.colorSpace=THREE.NoColorSpace; t.anisotropy=8; res(t); },undefined,rej)); }

const GREY=200, GL=Math.pow(GREY/255,2.2);                 // روشنایی میانگین بافت خاکستری‌شده (خطی)
async function greyTex(id,contrast=1){ const k='g'+id+contrast; if(C[k]) return C[k];
  const img=await loadImg(`tex/${id}_diff_1k.jpg`); return C[k]??=tex(neutral(img,GREY,contrast),true,1); }

/* چرم: دانه‌بندی رویه‌ای (بدون فایل) */
function leatherTex(){ return C.leather??=(()=>{ const N=kit.MOBILE?512:1024, c=document.createElement('canvas'); c.width=c.height=N;
  const x=c.getContext('2d'), d=x.createImageData(N,N), a=d.data; let sd=7; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const P=128, pts=[]; for(let i=0;i<P*P/6;i++) pts.push([rnd()*N,rnd()*N]);
  const G=32, cell=N/G, grid=Array.from({length:G*G},()=>[]); for(const p of pts) grid[((p[1]/cell)|0)*G+((p[0]/cell)|0)].push(p);
  for(let y=0;y<N;y++) for(let xx=0;xx<N;xx++){ let d1=1e9,d2=1e9; const gx=(xx/cell)|0, gy=(y/cell)|0;
    for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){ const cl=grid[((gy+j+G)%G)*G+((gx+i+G)%G)];
      for(const p of cl){ let dx=Math.abs(p[0]-xx), dy=Math.abs(p[1]-y); dx=Math.min(dx,N-dx); dy=Math.min(dy,N-dy); const dd=dx*dx+dy*dy; if(dd<d1){ d2=d1; d1=dd; } else if(dd<d2) d2=dd; } }
    const e=Math.min(1,(Math.sqrt(d2)-Math.sqrt(d1))/2.2), v=GREY-26*(1-e)+rnd()*8, k=(y*N+xx)*4; a[k]=a[k+1]=a[k+2]=v; a[k+3]=255; }
  x.putImageData(d,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; })(); }

const P=THREE.MeshPhysicalMaterial;
function base(hex,extra){ return new P({color:lin(hex).multiplyScalar(1/(SHADE_K*GL)),vertexColors:true,...extra}); }
/* انواع سطح؛ همه با رنگ دلخواه و نرمال‌مپ اسکن */
export const SURF={
  async fabric(hex,M,{id='rough_linen',tile=0.22,sheen=0.7}={}){ const [map,nm]=await Promise.all([greyTex(id,1.1),scanNormal(M.normalMap)]);
    const c=lin(hex); return triplanar(base(hex,{name:'fabric',map,normalMap:nm,roughness:0.95,sheen,sheenRoughness:0.45,sheenColor:c.clone().lerp(new THREE.Color('#fff'),0.3)}),tile,M.half); },
  async velvet(hex,M){ const [map,nm]=await Promise.all([greyTex('velour_velvet',0.8),scanNormal(M.normalMap)]);
    const c=lin(hex); return triplanar(base(hex,{name:'velvet',map,normalMap:nm,roughness:0.9,sheen:1,sheenRoughness:0.35,sheenColor:c.clone().lerp(new THREE.Color('#fff'),0.4)}),0.18,M.half); },
  async leather(hex,M,{gloss=0.42}={}){ const nm=await scanNormal(M.normalMap);
    return triplanar(base(hex,{name:'leather',map:leatherTex(),normalMap:nm,roughness:gloss,clearcoat:0.35,clearcoatRoughness:0.35,specularIntensity:0.7}),0.09,M.half); },
  async wood(hex,M,{gloss=true}={}){ const [map,nm]=await Promise.all([greyTex('cherry_veneer',0.6),scanNormal(M.normalMap)]);
    return triplanar(base(hex,{name:'wood',map,normalMap:nm,roughness:gloss?0.45:0.7,...(gloss?{clearcoat:1,clearcoatRoughness:0.08}:{})}),0.35,M.half); },
  async paint(hex,M,{sheenFinish='satin'}={}){ const [map,nm]=await Promise.all([greyTex('cherry_veneer',0.25),scanNormal(M.normalMap)]);
    return triplanar(base(hex,{name:'paint',map,normalMap:nm,roughness:sheenFinish==='gloss'?0.3:0.62,...(sheenFinish==='gloss'?{clearcoat:0.8,clearcoatRoughness:0.1}:{})}),0.4,M.half); },
  metal(hex){ return new P({name:'metal',color:hex,metalness:1,roughness:0.3,vertexColors:true}); },
};
/* ماده ساده و فوری تا بافت‌ها برسند */
export function quickMat(hex,rough=0.7){ return new P({color:lin(hex).multiplyScalar(1/SHADE_K),roughness:rough,vertexColors:true}); }

/* ---------- صفحه محصول اسکن‌شده ----------
   D.parts: هر بخش مدل (اسلات) با گزینه‌های رنگ؛ اولین رنگ = رنگ اصلی خود مدل.
   D.extra: گزینه‌های دیگر (مثلاً جنس تشک یا براقی). */
export function scanPage(M,D){
  const extra=D.extra||[];
  const options=[...D.parts.map(p=>({key:p.slot,q:p.q,label:p.label,type:'swatch',items:p.items})),...extra];
  const defaults={}; for(const o of options) defaults[o.key]=o.items[0].v;
  productPage({
    id:M.id, name:D.name, code:D.code, arTitle:D.name, sub:D.sub, options, defaults, exposure:D.exposure??0.6,
    hint:'بکشید تا بچرخد · دو انگشت برای زوم و دیدن ریزکاری‌ها',
    dims:()=>[M.dims[0],M.dims[2],M.dims[1]],
    geoKey:()=>'scan',
    matKey:S=>options.map(o=>S[o.key]).join('|'),
    quick:S=>Object.fromEntries(D.parts.map(p=>[p.slot,quickMat(S[p.slot],p.quickRough??0.7)])),
    async materials(S){ return Object.fromEntries(await Promise.all(D.parts.map(async p=>[p.slot,await p.surf(S[p.slot],S,M)]))); },
    summary:(S,L)=>[D.name,...options.map(o=>o.label+': '+L(o.key))].join('، '),
    arDefault:()=>false, arFile:()=>`ar/${M.id}.glb`, arVariants:[],
    build:()=>buildScan(M,D.shade),
  });
}
