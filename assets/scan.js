/* ساخت مدل از هندسه دقیق اسکن (assets/models/*.js) + مواد خودمان.
   فرم، برجستگی و کنده‌کاری‌ها عیناً همان فایل سه‌بعدی اصلی است؛ رنگ پیش‌فرض هر بخش از رنگ خود مدل گرفته شده.
   رویه پارچه/چرم در تبدیل صاف شده (چین و ناهمواری اسکن حذف) تا جنس‌های مختلف پارچه روی آن دیده شود. */
import { THREE, slot, kit, productPage } from './product.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.mjs';
import { loadImg, tex, neutral } from './geo.js';

await MeshoptDecoder.ready;
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/* سایه‌روشن اسکن (فرورفتگی کنده‌کاری‌ها) به صورت رنگ رأس.
   K: سقف روشنایی؛ رنگ ماده به همان نسبت جبران می‌شود تا رنگ میانگین دقیقاً رنگ پیش‌فرض باشد. */
export const SHADE_K=0.8;
const GEOC={};
function scanGeo(M,s){ return GEOC[M.id+s.slot]??=(()=>{
  const vb=new Uint8Array(s.nv*16); MeshoptDecoder.decodeVertexBuffer(vb,s.nv,16,b64(s.vb));
  const ib=new Uint32Array(s.ni); MeshoptDecoder.decodeIndexBuffer(new Uint8Array(ib.buffer),s.ni,4,b64(s.ib));
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int16Array(vb.buffer),8),3,0,true));
  geo.setAttribute('normal',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(vb.buffer),16),3,8,true));
  geo.setAttribute('uv',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Uint16Array(vb.buffer),8),2,6,true));
  const col=new Uint8Array(s.nv*3);
  for(let i=0;i<s.nv;i++){ const v=Math.min(255,Math.round(vb[i*16+6]/127.5*SHADE_K*255)); col[i*3]=col[i*3+1]=col[i*3+2]=v; }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3,true));
  geo.setIndex(new THREE.BufferAttribute(ib,1));
  // rn: نرمال با دقت کامل در مرورگر (روی سطوح صاف پارچه، نرمال ۸ بیتی فایل نوار و خط‌های هم‌تراز می‌سازد)
  if(s.rn){ geo.deleteAttribute('normal'); geo.computeVertexNormals(); }
  geo.computeBoundingBox(); geo.computeBoundingSphere(); return geo; })(); }
/* map: نام بخش مدل ← نام جایگاه ماده (مثلاً هر سه کشو ← front) */
export function buildScan(M,map={}){
  const g=new THREE.Group(); g.name=M.id;
  for(const s of M.slots){ const m=new THREE.Mesh(scanGeo(M,s),slot[map[s.slot]||s.slot]); m.name=s.slot;
    m.scale.setScalar(M.half); m.position.fromArray(M.center); g.add(m); }
  return g;
}

/* ---------- مواد ---------- */
const C={};
const lin=hex=>new THREE.Color(hex);
/* بافت سه‌جهته در فضای خود مدل (بدون درز، مستقل از UV اسکن).
   vert: رگه چوب روی سطوح ایستاده عمودی (پایه‌ها)؛ وگرنه افقی (رویه کشو، دامنه). روی سطح افقی همیشه در طول. */
function triplanar(mat,tile,half,vert=false,ntile=tile){
  // رنگ و (اگر باشد) نرمال‌مپ پارچه با تصویر سه‌جهته در فضای مدل: بدون درز و مستقل از UV اسکن
  const triN=!!mat.normalMap && !mat.userData.uvNormal;
  mat.onBeforeCompile=sh=>{ sh.uniforms.triK={value:half/tile}; sh.uniforms.triKN={value:half/ntile};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTriP; varying vec3 vTriN; varying vec3 vNM0; varying vec3 vNM1; varying vec3 vNM2;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTriP=position; vTriN=normal; vNM0=normalMatrix[0]; vNM1=normalMatrix[1]; vNM2=normalMatrix[2];');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float triK; uniform float triKN; varying vec3 vTriP; varying vec3 vTriN; varying vec3 vNM0; varying vec3 vNM1; varying vec3 vNM2;')
      .replace('#include <map_fragment>',`float triL=1.0;
#ifdef USE_MAP
  vec3 tb=pow(abs(normalize(vTriN)),vec3(4.0)); tb/=tb.x+tb.y+tb.z; vec3 tp=vTriP*triK;
  vec4 triS=texture2D(map,${vert?'tp.yz':'tp.zy'})*tb.x+texture2D(map,tp.xz)*tb.y+texture2D(map,${vert?'tp.yx':'tp.xy'})*tb.z;
  diffuseColor*=triS; triL=triS.g*${(1/GL).toFixed(4)};
#endif`);
    // پارچه تیره: بافت روی پرز (sheen) هم اثر می‌گذارد — روی مشکی، نخ و پرز فقط از درخشش پرز دیده می‌شود
    if(mat.sheen>0) sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_SHEEN\n  material.sheenColor*=clamp(pow(triL,3.0),0.0,3.5);\n#endif');
    if(triN) sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`{
  vec3 n0=normalize(vTriN); vec3 tw=pow(abs(n0),vec3(4.0)); tw/=tw.x+tw.y+tw.z; vec3 q=vTriP*triKN;
  vec3 tX=texture2D(normalMap,q.zy).xyz*2.0-1.0, tY=texture2D(normalMap,q.xz).xyz*2.0-1.0, tZ=texture2D(normalMap,q.xy).xyz*2.0-1.0;
  tX.xy*=normalScale; tY.xy*=normalScale; tZ.xy*=normalScale;
  // UDN: برآمدگی هر تصویر روی دو محور مماس همان صفحه
  vec3 nObj=normalize(n0+vec3(0.0,tX.y,tX.x)*tw.x+vec3(tY.x,0.0,tY.y)*tw.y+vec3(tZ.x,tZ.y,0.0)*tw.z);
  normal=normalize(mat3(vNM0,vNM1,vNM2)*nObj)*faceDirection; }`); };
  mat.customProgramCacheKey=()=>'tri'+tile+half+vert+(triN?'n'+ntile:'');
  return mat;
}
/* نرمال‌مپ خود اسکن: ریزبرجستگی کنده‌کاری، روی UV اصلی (فقط برای چوب) */
export function scanNormal(url){ return C['n'+url]??=new Promise((res,rej)=>new THREE.TextureLoader().load(url,t=>{
  t.flipY=false; t.colorSpace=THREE.NoColorSpace; t.anisotropy=8; res(t); },undefined,rej)); }

const GREY=200, GL=Math.pow(GREY/255,2.2);
async function norTex(id){ const k='n'+id; if(C[k]) return C[k]; const img=await loadImg(`tex/${id}_nor_gl_1k.jpg`); return C[k]??=tex(img,false,1); }
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
function base(hex,extra){ return new P({color:lin(hex).multiplyScalar(1/(SHADE_K*GL)),vertexColors:true,side:THREE.DoubleSide,shadowSide:THREE.DoubleSide,...extra}); }
const sheenOf=(hex,k)=>lin(hex).lerp(new THREE.Color('#fff'),k);

/* جنس‌های پارچه (برای گزینه «جنس پارچه») */
export const FABRICS={
  linen:      {label:'کتان',      id:'rough_linen',           tile:0.20, contrast:1.1, sheen:0.25, rough:0.95},
  boucle:     {label:'بوکله',     proc:'boucle',              tile:0.12, sheen:0.3,  rough:1, ns:1.3},   // فایل wool_boucle در واقع چهارخانه است؛ بوکله با کد ساخته می‌شود
  chenille:   {label:'شنیل',      id:'terlenka',              tile:0.14, contrast:1.35, sheen:0.6, rough:0.88},
  herringbone:{label:'جناغی',     id:'poly_wool_herringbone', tile:0.16, contrast:1.1, sheen:0.15, rough:0.95},
  velvet:     {label:'مخمل',      id:'velour_velvet',         tile:0.18, contrast:0.8, sheen:1,    rough:0.85},
  leather:    {label:'چرم',       leather:true},
};
/* مثل عکس محصول: شنیل با راه‌های نامنظم افقی (اسلاب) برای رویه، و نقش لانه‌زنبوری ریز برای کوسن‌ها — هر دو با کد ساخته می‌شوند */
FABRICS.slub={label:'شنیل راه‌راه (مثل عکس)',id:'terlenka',nid:'terlenka',proc:'slub',tile:0.3,ntile:0.06,ns:2.8,sheen:0.4,sr:0.85,sc:0.3,rough:1,spec:0.08};
FABRICS.hex={label:'لانه‌زنبوری (مثل عکس)',id:'terlenka',hex:true,tile:0.2,contrast:0.9,sheen:0.4,rough:0.88};
FABRICS.dots={label:'نقش‌دار',id:'terlenka',tile:0.2,contrast:0.9,sheen:0.35,rough:0.9,dots:true};
/* کوسن‌های راه‌راه مبل A466 (مثل عکس): کتانی با راه‌های عمودی تیره و بریده‌بریده، و کتانی با راه‌های باریک روشن */
FABRICS.stripe={label:'راه‌راه تیره (مثل عکس)',id:'rough_linen',tile:0.2,rough:0.95,sheen:0.2,stripe:{v:60,period:0.032,width:0.0035,dash:true}};
FABRICS.pinstripe={label:'راه‌راه روشن (مثل عکس)',id:'rough_linen',tile:0.2,rough:0.95,sheen:0.2,stripe:{v:252,period:0.016,width:0.0028}};
/* گلدوزی طلایی ست سلطنتی (مثل عکس): ژاکارد گل‌دار با نقش طلایی روی زمینه رنگ انتخابی */
FABRICS.damask={label:'گلدوزی طلایی (مثل عکس)',id:'floral_jacquard',tile:0.5,damask:[1.1,0.99,0.72],sheen:0.15,sr:0.55,sc:0.2,rough:0.8,ns:1.0,spec:0.25};
export const fabricItems=keys=>keys.map(k=>({v:k,label:FABRICS[k].label}));
/* بافت روی UV متری (برای قطعه‌های ساخته‌شده با کد): پراکنده + نرمال‌مپ واقعی پارچه */
async function uvTex(id,contrast,tile,kind){ const k='uv'+id+contrast+tile+kind; if(C[k]) return C[k];
  const img=await loadImg(`tex/${id}_${kind==='n'?'nor_gl':'diff'}_1k.jpg`);
  const t=kind==='n'?tex(img,false,tile):tex(neutral(img,GREY,contrast),true,tile); return C[k]=t; }
/* شنیل اسلاب: رشته‌های کوتاه و بلند افقی روشن‌تر/تیره‌تر روی زمینه پرزدار؛ تکرارشونده بدون درز */
function slubTex(){ return C.slub??=(()=>{ const N=1024, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  let sd=11; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const d=x.createImageData(N,N), a=d.data;   // پرز ریز
  for(let i=0;i<N*N;i++){ const v=GREY-8+(rnd()-0.5)*22; a[i*4]=a[i*4+1]=a[i*4+2]=v; a[i*4+3]=255; }
  x.putImageData(d,0,0);
  const streak=(px,py,len,th,v,al)=>{ for(const ox of [0,-N,N]) for(const oy of [0,-N,N]){ x.strokeStyle=`rgba(${v},${v},${v},${al})`; x.lineWidth=th; x.lineCap='round';
      x.beginPath(); x.moveTo(px+ox,py+oy); x.bezierCurveTo(px+ox+len*0.33,py+oy+(rnd()-0.5)*3,px+ox+len*0.66,py+oy+(rnd()-0.5)*3,px+ox+len,py+oy+(rnd()-0.5)*2); x.stroke(); } };
  for(let i=0;i<700;i++){ const dark=rnd()<0.5; streak(rnd()*N,rnd()*N,30+rnd()*rnd()*200,2.5+rnd()*3,dark?Math.round(GREY-45-rnd()*25):Math.round(GREY+18+rnd()*18),0.22+rnd()*0.3); }
  for(let i=0;i<3200;i++){ const dark=rnd()<0.35; streak(rnd()*N,rnd()*N,6+rnd()*26,3+rnd()*4,dark?Math.round(GREY-40-rnd()*20):Math.round(GREY+28+rnd()*20),0.3+rnd()*0.35); }   // نخ‌های ضخیم کوتاه (اسلاب و نوپ)
  x.filter='blur(1.6px)'; x.drawImage(c,0,0); x.filter='none';   // نرم: نخ واقعی لبه تیز ندارد
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; })(); }
/* راه‌راه کوسن: زمینه کتانی (پرز ریز) با نخ‌های عمودی؛ dash: راه‌های بریده‌بریده مثل دوخت دستی. tile متر = کل تصویر */
function stripeTex(F){ const k='st'+F.stripe.v+F.stripe.period; return C[k]??=(()=>{ const N=512, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  let sd=17; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const d=x.createImageData(N,N), a=d.data; for(let i=0;i<N*N;i++){ const v=GREY+(rnd()-0.5)*16; a[i*4]=a[i*4+1]=a[i*4+2]=v; a[i*4+3]=255; } x.putImageData(d,0,0);
  const S=F.stripe, px=N/F.tile, per=S.period*px, n=Math.round(N/per), step=N/n, v=S.v;
  for(let i=0;i<n;i++){ const cx=(i+0.5)*step+(rnd()-0.5)*step*0.12; x.strokeStyle=`rgb(${v},${v},${v})`; x.lineCap='round';
    if(S.dash){ for(let y=-20;y<N+20;){ const L=(0.008+rnd()*0.006)*px, G=(0.003+rnd()*0.003)*px; x.lineWidth=S.width*px*(0.8+rnd()*0.5);
        x.beginPath(); x.moveTo(cx+(rnd()-0.5)*1.5,y); x.lineTo(cx+(rnd()-0.5)*1.5,Math.min(y+L,N+20)); x.stroke(); y+=L+G; } }
    else { x.lineWidth=S.width*px; x.beginPath(); x.moveTo(cx,0); for(let y=0;y<=N;y+=32) x.lineTo(cx+(rnd()-0.5)*1.2,y); x.stroke(); } }
  x.filter='blur(0.7px)'; x.drawImage(c,0,0); x.filter='none';
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/F.tile,1/F.tile); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; })(); }
/* ژاکارد → گلدوزی: نقش روشن‌تر تصویر به رنگ نخ طلایی (نسبت به زمینه) و زمینه خنثی؛ رنگ زمینه را خود ماده می‌دهد */
async function damaskTex(F){ const k='dm'+F.id; if(C[k]) return C[k]; const img=await loadImg(`tex/${F.id}_diff_1k.jpg`);
  const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d'); x.drawImage(img,0,0);
  const d=x.getImageData(0,0,c.width,c.height), a=d.data, L=new Float32Array(a.length/4); let lo=255, hi=0;
  for(let i=0;i<L.length;i++){ L[i]=0.3*a[i*4]+0.59*a[i*4+1]+0.11*a[i*4+2]; } const srt=Float32Array.from(L).sort(); lo=srt[Math.floor(L.length*0.3)]; hi=srt[Math.floor(L.length*0.85)];
  const [gr,gg,gb]=F.damask;
  for(let i=0;i<L.length;i++){ const t=Math.min(1,Math.max(0,(L[i]-lo)/(hi-lo))), m=t*t*(3-2*t), n=1+(L[i]-(lo+hi)/2)/400;
    a[i*4]=Math.min(255,GREY*n*(1+(gr-1)*m)); a[i*4+1]=Math.min(255,GREY*n*(1+(gg-1)*m)); a[i*4+2]=Math.min(255,GREY*n*(1+(gb-1)*m)); }
  x.putImageData(d,0,0); return C[k]=tex(c,true,1); }
/* لانه‌زنبوری ریز کوسن‌ها (مثل عکس): شش‌ضلعی‌های تیره با خط دور روشن‌تر */
function hexTex(tile){ return C['hex'+tile]??=(()=>{ const N=512, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  x.fillStyle='rgb(150,150,150)'; x.fillRect(0,0,N,N); const r=N/30, w=Math.sqrt(3)*r;
  for(let row=-1;row<=N/(1.5*r)+1;row++) for(let col=-1;col<=N/w+1;col++){ const cx=col*w+(row%2)*w/2, cy=row*1.5*r;
    x.beginPath(); for(let k=0;k<6;k++){ const an=Math.PI/6+k*Math.PI/3; x.lineTo(cx+r*0.9*Math.cos(an),cy+r*0.9*Math.sin(an)); } x.closePath();
    x.fillStyle='rgb(165,165,165)'; x.fill(); x.lineWidth=r*0.24; x.strokeStyle='rgb(225,225,225)'; x.stroke(); }
  x.filter='blur(1.5px)'; x.drawImage(c,0,0); x.filter='none';
  const d=x.getImageData(0,0,N,N), a=d.data; let sd=5; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  for(let i=0;i<a.length;i+=4){ const v=(rnd()-0.5)*30; a[i]+=v; a[i+1]+=v; a[i+2]+=v; } x.putImageData(d,0,0);   // پرز
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/tile,1/tile); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; })(); }
/* بوکله: نخ حلقه‌حلقه و گره‌دار، حلقه‌های ریز درهم (حدود ۳ میلی‌متر) با پرز؛ ارتفاع → رنگ و نرمال‌مپ، بدون درز */
function boucleTex(){ return C.boucle??=(()=>{ const N=kit.MOBILE?512:1024, s=N/1024, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  let sd=29; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  x.fillStyle='rgb(96,96,96)'; x.fillRect(0,0,N,N);
  const loop=(px,py,r,lw,v,al,a0,sp)=>{ for(const ox of [0,-N,N]) for(const oy of [0,-N,N]){ const X=px+ox, Y=py+oy; if(X<-60*s||Y<-60*s||X>N+60*s||Y>N+60*s) continue;
    x.strokeStyle=`rgba(${v},${v},${v},${al})`; x.lineWidth=lw; x.beginPath(); x.ellipse(X,Y,r,r*(0.6+rnd()*0.4),rnd()*Math.PI,a0,a0+sp); x.stroke(); } };
  x.lineCap='round';
  for(let i=0;i<5200;i++){ const r=(9+rnd()*rnd()*20)*s; loop(rnd()*N,rnd()*N,r,(4+rnd()*5)*s,Math.round(120+rnd()*110),0.35+rnd()*0.4,rnd()*6.3,3+rnd()*3); }
  for(let i=0;i<900;i++){ const r=(4+rnd()*6)*s; loop(rnd()*N,rnd()*N,r,(5+rnd()*4)*s,Math.round(200+rnd()*50),0.5+rnd()*0.4,0,6.3); }   // گره‌های کوچک برجسته
  x.filter=`blur(${1.2*s}px)`; x.drawImage(c,0,0); x.filter='none';
  const d=x.getImageData(0,0,N,N), a=d.data, h=new Float32Array(N*N);
  for(let i=0;i<N*N;i++) h[i]=(a[i*4]+(rnd()-0.5)*14)/255;
  // رنگ: روشنی ملایم دور مقدار میانی (رنگ اصلی را خود ماده می‌دهد)
  for(let i=0;i<N*N;i++){ const v=GREY-34+h[i]*70; a[i*4]=a[i*4+1]=a[i*4+2]=Math.max(0,Math.min(255,v)); a[i*4+3]=255; }
  x.putImageData(d,0,0);
  const cn=document.createElement('canvas'); cn.width=cn.height=N; const xn=cn.getContext('2d'), dn=xn.createImageData(N,N), b=dn.data, H=(i,j)=>h[((j+N)%N)*N+((i+N)%N)], k=3.2;
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){ const nx=-(H(i+1,j)-H(i-1,j))*k, ny=(H(i,j+1)-H(i,j-1))*k, l=Math.hypot(nx,ny,1), o=(j*N+i)*4;
    b[o]=(nx/l*0.5+0.5)*255; b[o+1]=(ny/l*0.5+0.5)*255; b[o+2]=(1/l*0.5+0.5)*255; b[o+3]=255; }
  xn.putImageData(dn,0,0);
  const mk=(cv,srgb)=>{ const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace; t.anisotropy=8; return t; };
  return {map:mk(c,true),nor:mk(cn,false)}; })(); }
const tiled=(t,tile)=>{ const o=t.clone(); o.repeat.set(1/tile,1/tile); o.needsUpdate=true; return o; };
/* نقش خال‌خالی کوسن (مثل عکس محصول): زمینه تیره با خال‌های روشن ریز در شبکه مورب */
function dotsTex(tile){ return C['dots'+tile]??=(()=>{ const N=512, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  x.fillStyle='rgb(150,150,150)'; x.fillRect(0,0,N,N); const st=N/16;
  for(let j=0;j<16;j++) for(let i=0;i<16;i++){ const cx=(i+(j%2)*0.5)*st, cy=j*st+st/2;
    x.fillStyle='rgb(245,245,245)'; x.beginPath(); x.ellipse(cx,cy,st*0.2,st*0.16,0,0,Math.PI*2); x.fill(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/tile,1/tile); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; })(); }

/* انواع سطح؛ رنگ دلخواه. پارچه و چرم بدون سایه‌روشن اسکن (صاف و تمیز)، چوب با نرمال‌مپ اسکن برای ریزکاری کنده‌کاری */
export const SURF={
  async upholstery(hex,M,kind='linen'){ const F=FABRICS[kind];
    if(M.uv){ // قطعه با UV متری: بافت و نرمال‌مپ واقعی پارچه
      if(F.leather) return base(hex,{name:'leather',map:(()=>{ const t=leatherTex().clone(); t.repeat.set(1/0.09,1/0.09); t.needsUpdate=true; return t; })(),roughness:0.6,specularIntensity:0.5,sheen:0.2,sheenColor:sheenOf(hex,0.2)});
      if(F.proc==='boucle'){ const B=boucleTex(); return base(hex,{name:'fabric',map:tiled(B.map,F.tile),normalMap:tiled(B.nor,F.tile),normalScale:new THREE.Vector2(F.ns,F.ns),roughness:F.rough,sheen:F.sheen,sheenRoughness:0.5,sheenColor:sheenOf(hex,0.3)}); }
      const [map,nm]=await Promise.all([F.stripe?stripeTex(F):F.hex?hexTex(0.16):F.dots?dotsTex(0.22):F.proc==='slub'?(()=>{ const t=slubTex().clone(); t.repeat.set(1/F.tile,1/F.tile); t.needsUpdate=true; return t; })():uvTex(F.id,F.contrast,F.tile,'d'),uvTex(F.id,1,F.tile,'n')]);
      return base(hex,{name:'fabric',map,normalMap:nm,normalScale:new THREE.Vector2(2,2),roughness:F.rough,sheen:F.sheen,sheenRoughness:0.45,sheenColor:sheenOf(hex,0.25)}); }
    if(F.leather) return SURF.leather(hex,M);
    const [map,nm]=F.proc==='boucle'?[boucleTex().map,boucleTex().nor]:await Promise.all([F.proc==='slub'?slubTex():F.damask?damaskTex(F):greyTex(F.id,F.contrast),norTex(F.nid||F.id)]);
    return triplanar(base(hex,{name:'fabric',map,normalMap:nm,normalScale:new THREE.Vector2(F.ns??1.4,F.ns??1.4),roughness:F.rough,specularIntensity:F.spec??0.3,sheen:F.sheen,sheenRoughness:F.sr??0.6,sheenColor:sheenOf(hex,F.sc??0.42)}),F.tile,M.half,false,F.ntile??F.tile); },
  async leather(hex,M){ return triplanar(base(hex,{name:'leather',map:leatherTex(),roughness:0.6,specularIntensity:0.5,sheen:0.2,sheenRoughness:0.6,sheenColor:sheenOf(hex,0.2)}),0.09,M.half); },
  /* چوب با رگه واقعی گردو. grain: شدت رگه (۱ = چوب رنگ‌شده، کم = رنگ روغنی روی چوب). finish: matte | satin | gloss */
  async wood(hex,M,{grain=1,finish='satin',vert=true}={}){ const [map,nm]=await Promise.all([greyTex('natural_walnut_veneer',grain),M.normalMap?scanNormal(M.normalMap):null]);
    const F={matte:{roughness:0.78},satin:{roughness:0.58,clearcoat:0.15,clearcoatRoughness:0.35},gloss:{roughness:0.42,clearcoat:0.5,clearcoatRoughness:0.15}}[finish];
    return triplanar(base(hex,{name:'wood',userData:{uvNormal:true},map,...(nm?{normalMap:nm,normalScale:new THREE.Vector2(0.8,0.8)}:{}),specularIntensity:0.45,...F}),0.32,M.half,vert); },
  metal(hex,rough=0.38){ return C['m'+hex+rough]??=new P({name:'metal',color:hex,metalness:1,roughness:rough,side:THREE.DoubleSide,shadowSide:THREE.DoubleSide}); },
  inner(){ return C.inner??=greyTex('natural_walnut_veneer',0.6).then(map=>{ const t=map.clone(); t.repeat.set(1/0.3,1/0.3); t.needsUpdate=true;
    return new P({name:'inner',color:lin('#c9a27a').multiplyScalar(1/GL),map:t,roughness:0.85}); }); },
  /* داخل بدنه پشت کشوها؛ با رنگ دلخواه (همان رنگ بدنه، تیره‌تر چون نور کمتری می‌گیرد) */
  cavity(hex='#2a1d14',dim=1){ return C['cav'+hex+dim]??=new P({name:'cavity',color:lin(hex).multiplyScalar(dim),roughness:0.9,side:THREE.BackSide}); },
};
/* ماده ساده و فوری تا بافت‌ها برسند */
export function quickMat(hex,rough=0.7){ return new P({color:lin(hex).multiplyScalar(1/SHADE_K),roughness:rough,vertexColors:true}); }

/* قطعه‌های ساخته‌شده با کد رنگ رأس ندارند؛ مواد ما vertexColors دارند → سفید یکنواخت (همان ضریب K) */
const VC=new WeakSet();
function withShade(g){ g.traverse(o=>{ const geo=o.geometry; if(!o.isMesh||!geo||geo.attributes.color||VC.has(geo)) return;
  const n=geo.attributes.position.count; geo.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(n*3).fill(Math.round(SHADE_K*255)),3,true)); VC.add(geo); }); }

/* ---------- صفحه محصول اسکن‌شده ----------
   D.parts: بخش‌های رنگ‌پذیر {slot,q,label,items,surf(hex,S,M)}؛ اولین رنگ = رنگ اصلی خود مدل.
   D.extra: گزینه‌های دیگر. D.slotMap/D.post/D.geoKey/D.moreMats برای قطعه‌های اضافه (کشو، دستگیره). */
export function scanPage(M,D){
  const extra=D.extra||[];
  const options=[...D.parts.map(p=>({key:p.slot,q:p.q,label:p.label,type:'swatch',items:p.items})),...extra];
  const defaults={}; for(const o of options) defaults[o.key]=o.items[0].v;
  const partMats=async S=>Object.fromEntries(await Promise.all(D.parts.flatMap(p=>[p.slot,...(p.also||[])].map(async sl=>[sl,await p.surf(S[p.slot],S,M,sl)]))));
  productPage({
    id:M.id, name:D.name, code:D.code, arTitle:D.name, sub:D.sub, options, defaults, exposure:D.exposure??0.6,
    hint:D.hint||'بکشید تا بچرخد · دو انگشت برای زوم و دیدن ریزکاری‌ها',
    dims:S=>D.dims?D.dims(S):[M.dims[0],M.dims[2],M.dims[1]],
    geoKey:S=>D.geoKey?D.geoKey(S):'scan',
    matKey:S=>options.map(o=>S[o.key]).join('|'),
    quick:S=>({...Object.fromEntries(D.parts.flatMap(p=>[p.slot,...(p.also||[])].map(sl=>[sl,quickMat(S[p.slot],0.7)]))),...(D.quickMore?.(S)||{})}),
    async materials(S){ return {...await partMats(S),...(D.moreMats?await D.moreMats(S):{})}; },
    summary:(S,L)=>[D.name,...options.map(o=>o.label+': '+L(o.key))].join('، '),
    arDefault:()=>false, arFile:()=>`ar/${M.id}.glb`, arVariants:[],
    build:S=>{ const g=D.build?D.build(S):buildScan(M,D.slotMap); D.post?.(g,S,M); withShade(g); return g; },
  });
}
