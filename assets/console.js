/* کنسول کلاسیک — بدنه با کد: رویه موج‌دار، دامنه جلو با سینه قوسی و لبه کنگره‌ای، سه کشوی بازشو، دامنه پشت.
   همه منحنی‌ها از نقشه عمق جلوی فایل سه‌بعدی اصلی اندازه‌گیری شده‌اند (هر ۱ تا ۵ سانت):
   دو کشوی کناری با لبه پایین قوس‌دار و پله کوچک گوشه بیرونی، کشوی وسط مستطیل کوچک، هر سه ۱٫۲ تا ۲٫۲ سانت جلوتر از دامنه.
   پایه‌ها/ستون‌های گوشه و گل وسط دامنه = کنده‌کاری اصلی فایل. */
import { THREE, slot } from './product.js';
import { mesh } from './geo.js';
import { mergeVertices } from '../lib/three/addons/utils/BufferGeometryUtils.js';
import { addHandle } from './hardware.js';

/* ---------- اندازه‌ها (متر) ---------- */
const XS=(a,b,s)=>{ const o=[]; for(let x=a;x<=b+1e-9;x+=s) o.push(+x.toFixed(3)); return o; };
// لبه جلو و پشت رویه در y=0.785، x از ‎-0.65 تا 0.65
const TOP_F=[0.165,0.176,0.162,0.147,0.156,0.177,0.196,0.207,0.206,0.193,0.167,0.147,0.149,0.151,0.149,0.147,0.166,0.192,0.205,0.206,0.195,0.177,0.158,0.151,0.164,0.173,0.159];
const TOP_B=[-0.196,-0.206,-0.204,-0.206,-0.207,-0.204,-0.192,-0.19,-0.194,-0.2,-0.203,-0.202,-0.197,-0.196,-0.194,-0.195,-0.197,-0.2,-0.202,-0.196,-0.19,-0.195,-0.203,-0.205,-0.204,-0.206,-0.203];
// x از ‎-0.55 تا 0.55: رویه دامنه بالای کشوها (z)، رویه دامنه زیر کشوها (z)، لبه پایین کنگره (y)
const APR_Z=[0.141,0.134,0.137,0.151,0.172,0.186,0.187,0.175,0.146,0.13,0.13,0.13,0.13,0.13,0.146,0.175,0.187,0.186,0.172,0.151,0.137,0.134,0.141];
// وسط (|x|≤0.15) = سطح خود دامنه پشت گل منبت (اندازه بالای گل، نه روی گل) تا کنده‌کاری اصلی زیرش دفن نشود
const APR_ZL=[0.142,0.138,0.14,0.155,0.175,0.19,0.192,0.18,0.15,0.134,0.134,0.134,0.134,0.134,0.15,0.18,0.192,0.19,0.175,0.155,0.14,0.138,0.142];
const APR_Y=[0.616,0.57,0.556,0.534,0.52,0.516,0.517,0.526,0.548,0.559,0.557,0.557,0.557,0.559,0.548,0.526,0.517,0.518,0.522,0.535,0.556,0.571,0.621];
// لبه پایین کشوی کناری، |x| از 0.16 تا 0.53 (هر ۱ سانت؛ میانگین چپ و راست فایل)
const SIDE_B=[0.601,0.597,0.592,0.588,0.585,0.582,0.579,0.575,0.573,0.571,0.569,0.567,0.566,0.566,0.566,0.567,0.568,0.57,0.572,0.575,0.577,0.58,0.583,0.587,0.59,0.594,0.597,0.601,0.604,0.607,0.61,0.612,0.616,0.632,0.646,0.651,0.653,0.654];
export const C={ topY0:0.765, topY1:0.797, apronTop:0.765, xIn:0.555, back:-0.178, t:0.018, gap:0.0028,
  side:{u0:0.158,u1:0.535,top:0.731,proud:0.006}, mid:{x:0.129,y0:0.617,y1:0.722,proud:0.022}, front:0.022 };
/* برآمدگی جلوی دو بخش کناری (دامنه، کشوها و لبه جلوی رویه) ۳۰٪ کمتر از اسکن، به خواست کارفرما؛ دو سر و وسط ثابت */
const BULGE=0.7, soften=(a,base)=>a.map(z=>z>base?+(base+(z-base)*BULGE).toFixed(4):z);
const lerpTab=(xs,ys)=>x=>{ if(x<=xs[0]) return ys[0]; if(x>=xs[xs.length-1]) return ys[ys.length-1];
  const i=Math.min(xs.length-2,Math.floor((x-xs[0])/(xs[1]-xs[0]))), t=(x-xs[i])/(xs[i+1]-xs[i]);
  // هموار (کاتمول-رام) بین نمونه‌ها
  const p0=ys[Math.max(0,i-1)], p1=ys[i], p2=ys[i+1], p3=ys[Math.min(ys.length-1,i+2)];
  return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t); };
const AX=XS(-0.55,0.55,0.05), TX=XS(-0.65,0.65,0.05);
const APR_Zs=soften(APR_Z,0.137), APR_ZLs=soften(APR_ZL,0.14), TOP_Fs=soften(TOP_F,0.15);
/* وسط (کشوی کوچک و ستون‌های دو طرفش) کاملاً تخت و صاف؛ قوس از ‎|x|=0.135 به بعد نرم شروع می‌شود */
const flatMid=(f,z0)=>x=>{ const a=Math.abs(x); if(a<=0.135) return z0; if(a>=0.17) return f(x); const t=(a-0.135)/0.035, k=t*t*(3-2*t); return z0+(f(x)-z0)*k; };
/* لبه پشت رویه کاملاً صاف (کنسول به دیوار می‌چسبد)؛ موج اسکن در پشت حذف شده */
const TOP_BACK=-0.1995;
export const zTop=flatMid(lerpTab(AX,APR_Zs),0.13), zLow=flatMid(lerpTab(AX,APR_ZLs),0.134), yBottom=lerpTab(AX,APR_Y), zTopF=lerpTab(TX,TOP_Fs), zTopB=()=>TOP_BACK;
const sideB=lerpTab(XS(0.16,0.53,0.01),SIDE_B);
/* رویه دامنه: بالا z=zTop، پایین کمی جلوتر (zLow) با گذر نرم */
export const zApron=(x,y)=>{ const k=Math.min(1,Math.max(0,(0.70-y)/0.10)); return zTop(x)+(zLow(x)-zTop(x))*k*k*(3-2*k); };
/* سه کشو: بازه x، لبه بالا، لبه پایین (تابع x) و رویه جلو */
const DRAWERS=[-1,0,1].map(s=>s?{ x0:s<0?-C.side.u1:C.side.u0, x1:s<0?-C.side.u0:C.side.u1, top:C.side.top, bot:x=>sideB(Math.abs(x)), proud:C.side.proud, s }
                                :{ x0:-C.mid.x, x1:C.mid.x, top:C.mid.y1, bot:()=>C.mid.y0, proud:C.mid.proud, s });

/* ---------- هندسه ---------- */
/* نوار خم‌دار: رویه جلو z=zf(x,y)، از y0(x) تا y1(x)، ضخامت t رو به عقب؛ بسته از همه طرف */
function ribbon(x0,x1,y0,y1,{t=C.t,zf=zApron,n=null}={}){
  const N=n||Math.max(4,Math.round((x1-x0)/0.008)), R=8, pos=[], idx=[];
  const Y0=typeof y0==='function'?y0:()=>y0, Y1=typeof y1==='function'?y1:()=>y1;
  const P=(i,j,back)=>{ const x=x0+(x1-x0)*i/N, a=Y0(x), b=Y1(x), y=a+(b-a)*j/R; return [x,y,zf(x,y)-(back?t:0)]; };
  const quad=(a,b,c,d)=>idx.push(a,b,c,a,c,d);
  const face=(fn,flip)=>{ const base=pos.length/3, W=N+1;
    for(let j=0;j<=R;j++) for(let i=0;i<=N;i++) pos.push(...fn(i,j));
    for(let j=0;j<R;j++) for(let i=0;i<N;i++){ const a=base+j*W+i, b=a+1, c=a+W+1, d=a+W; flip?quad(a,d,c,b):quad(a,b,c,d); } };
  face((i,j)=>P(i,j,false),false); face((i,j)=>P(i,j,true),true);
  // لبه‌های بالا و پایین و دو سر
  const strip=(fnA,fnB,M,flip)=>{ const base=pos.length/3; for(let k=0;k<=M;k++){ pos.push(...fnA(k)); pos.push(...fnB(k)); }
    for(let k=0;k<M;k++){ const a=base+2*k; flip?quad(a,a+2,a+3,a+1):quad(a,a+1,a+3,a+2); } };
  strip(i=>P(i,R,false),i=>P(i,R,true),N,true); strip(i=>P(i,0,false),i=>P(i,0,true),N,false);
  strip(j=>P(0,j,false),j=>P(0,j,true),R,false); strip(j=>P(N,j,false),j=>P(N,j,true),R,true);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  g.computeVertexNormals();
  // نرمال رویه جلو/پشت از خود منحنی (بدون درز بین تکه‌های کنار هم)
  const nr=g.attributes.normal.array, NF=(N+1)*(R+1), e=1e-4;
  for(let k=0;k<2*NF;k++){ const x=pos[k*3], y=pos[k*3+1], dx=(zf(x+e,y)-zf(x-e,y))/(2*e), dy=(zf(x,y+e)-zf(x,y-e))/(2*e), l=Math.hypot(dx,dy,1), sg=k<NF?1:-1;
    nr[k*3]=-dx/l*sg; nr[k*3+1]=-dy/l*sg; nr[k*3+2]=sg/l; }
  return g; }
/* ریزکردن مثلث‌ها در جهت x (تقسیم وسط ضلع؛ هم‌خوان بین مثلث‌های همسایه) تا بعد از خم‌کردن صاف بماند */
function splitX(g,maxDx=0.008){ const p=g.toNonIndexed().attributes.position.array, out=[];
  const rec=(a,b,c,d=0)=>{ const E=[[a,b,c],[b,c,a],[c,a,b]]; let best=null, bl=maxDx;
    for(const [u,v,w] of E){ const l=Math.abs(u[0]-v[0]); if(l>bl){ bl=l; best=[u,v,w]; } }
    if(!best||d>12){ out.push(...a,...b,...c); return; }
    const [u,v,w]=best, m=[(u[0]+v[0])/2,(u[1]+v[1])/2,(u[2]+v[2])/2]; rec(u,m,w,d+1); rec(m,v,w,d+1); };
  for(let i=0;i<p.length;i+=9) rec([p[i],p[i+1],p[i+2]],[p[i+3],p[i+4],p[i+5]],[p[i+6],p[i+7],p[i+8]]);
  const r=new THREE.BufferGeometry(); r.setAttribute('position',new THREE.Float32BufferAttribute(out,3)); return r; }
/* رویه کشو: شکل تخت (x,y) با لبه گرد، ضخامت T، سپس خم‌شده روی منحنی z=zf(x) (رویه جلو) */
function bentSlab(pts,T,zf,bv=0.004){
  const sh=new THREE.Shape(pts);
  let g=bv?new THREE.ExtrudeGeometry(sh,{depth:T-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelOffset:-bv,bevelSegments:4,curveSegments:2})
         :new THREE.ExtrudeGeometry(sh,{depth:T,bevelEnabled:false,curveSegments:2});
  g.translate(0,0,-(T-bv)); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g=splitX(g); const a=g.attributes.position.array;
  for(let i=0;i<a.length;i+=3) a[i+2]+=zf(a[i]);
  if(bv) g=mergeVertices(g,1e-5); g.computeVertexNormals(); return g; }
/* محفظه کشو: دیواره‌های دور طرح دهانه رو به عقب + دیواره ته؛ جلو باز. نرمال‌ها رو به بیرون */
function tunnelGeo(pts,depth,zf){ const P=[], L=pts.length;
  const ring=[]; for(let i=0;i<L;i++){ const a=pts[i], b=pts[(i+1)%L], n=Math.max(1,Math.ceil(Math.abs(b.x-a.x)/0.008));
    for(let k=0;k<n;k++) ring.push([a.x+(b.x-a.x)*k/n,a.y+(b.y-a.y)*k/n]); }
  for(let i=0;i<ring.length;i++){ const [x0,y0]=ring[i], [x1,y1]=ring[(i+1)%ring.length];
    const A=[x0,y0,zf(x0)], B=[x1,y1,zf(x1)], Cc=[x1,y1,zf(x1)-depth], D=[x0,y0,zf(x0)-depth];
    P.push(...A,...Cc,...B, ...A,...D,...Cc); }
  const cap=splitX(new THREE.ShapeGeometry(new THREE.Shape(pts))).attributes.position.array;
  for(let i=0;i<cap.length;i+=9){ const v=[0,6,3].map(o=>[cap[i+o],cap[i+o+1]]); for(const [x,y] of v) P.push(x,y,zf(x)-depth); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.computeVertexNormals(); return g; }
function drawerOutline(D,inflate=0){ const pts=[], x0=D.x0-inflate, x1=D.x1+inflate, n=Math.max(2,Math.round((x1-x0)/0.01));
  for(let i=0;i<=n;i++){ const x=x0+(x1-x0)*i/n; pts.push(new THREE.Vector2(x,D.bot(Math.min(D.x1,Math.max(D.x0,x)))-inflate)); }
  pts.push(new THREE.Vector2(x1,D.top+inflate),new THREE.Vector2(x0,D.top+inflate)); return pts; }
/* رویه موج‌دار پله‌دار (مثل عکس و فایل اصلی): لایه پایین ۱٫۷ سانت تا لبه کامل،
   پله ۵ تا ۸ میلی‌متر به داخل، لایه بالا ۱٫۳ سانت با لبه بالای گرد */
function topOutline(){ const f=[], b=[];
  for(let x=-0.648;x<=0.648;x+=0.012){ f.push(new THREE.Vector2(x,zTopF(x))); b.push(new THREE.Vector2(x,zTopB(x))); }
  const end=(s)=>{ const o=[]; for(let k=1;k<12;k++){ const t=k/12, z=zTopF(s*0.648)+(zTopB(s*0.648)-zTopF(s*0.648))*t; o.push(new THREE.Vector2(s*(0.648+0.008*Math.sin(Math.PI*t)),z)); } return o; };
  return new THREE.Shape().setFromPoints([...f,...end(1),...b.reverse(),...end(-1).reverse()]); }
function topLayer(sh,y0,y1,bv,inset){
  const g=new THREE.ExtrudeGeometry(sh,{depth:y1-y0-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelOffset:-bv-inset,bevelSegments:5,curveSegments:4});
  g.rotateX(Math.PI/2); g.translate(0,y1-bv,0); g.computeVertexNormals(); return g; }
function topGeo(){ const sh=topOutline();
  return [topLayer(sh,C.topY0,0.783,0.0025,0), topLayer(sh,0.7815,C.topY1,0.0055,0.006)]; }

/* ---------- ساخت ---------- */
const BOX={}; const box=(w,h,d)=>BOX[[w,h,d].map(v=>v.toFixed(3))]??=new THREE.BoxGeometry(w,h,d);
let GEO=null;
function bodyGeo(){ if(GEO) return GEO; const G={apron:[],fronts:[]}, gp=C.gap;
  G.top=topGeo();
  // دامنه جلو با سه دهانه کشو (هر دهانه = طرح کشو + درز ۲٫۸ میلی‌متری)
  let x=-C.xIn;
  for(const D of DRAWERS){ const a=D.x0-gp, b=D.x1+gp;
    G.apron.push(ribbon(x,a,yBottom,C.apronTop));
    G.apron.push(ribbon(a,b,yBottom,xx=>D.bot(Math.min(D.x1,Math.max(D.x0,xx)))-gp));
    G.apron.push(ribbon(a,b,D.top+gp,C.apronTop)); x=b; }
  G.apron.push(ribbon(x,C.xIn,yBottom,C.apronTop));
  for(const D of DRAWERS) G.fronts.push(bentSlab(drawerOutline(D),C.front,xx=>zTop(xx)+D.proud));
  // حفره پشت هر دهانه: همان طرح دهانه رو به عقب (فقط از داخل دیده می‌شود)
  G.holes=DRAWERS.map(D=>tunnelGeo(drawerOutline(D,gp+0.0005),0.25,xx=>zTop(xx)-0.006));
  // کشوی تزئینی: فقط یک پشت‌بند کم‌عمق پشت درز دهانه (داخلی در کار نیست)
  G.shallow=DRAWERS.map(D=>tunnelGeo(drawerOutline(D,gp+0.0005),0.03,xx=>zTop(xx)-0.006));
  return GEO=G; }
/* real=true: کشوهای بازشو با جعبه؛ false: کشوی تزئینی — فقط در کشو با دستگیره، ثابت و بدون جعبه و فضای داخلی */
export function buildConsoleBody(g,handle,real=true){
  const W=slot.front, G=bodyGeo();
  for(const t of G.top) g.add(new THREE.Mesh(t,slot.top));
  for(const a of G.apron) g.add(new THREE.Mesh(a,W));
  // دامنه پشت
  g.add(mesh(box(2*C.xIn,C.apronTop-0.625,C.t),W,0,(C.apronTop+0.625)/2,C.back));
  // جای هر کشو داخل بدنه: بیرونش هم‌رنگ بدنه (از پشت/زیر تمیز دیده می‌شود)، داخلش تیره‌تر؛ جلویش باز است
  for(const h of real?G.holes:G.shallow){ g.add(new THREE.Mesh(h,W)); g.add(new THREE.Mesh(h,slot.cavity)); }
  // کشوها: رویه + جعبه (جعبه داخل کوچک‌ترین ارتفاع دهانه جا می‌شود)
  DRAWERS.forEach((D,i)=>{ const d=new THREE.Group(), cx=(D.x0+D.x1)/2;
    d.add(new THREE.Mesh(G.fronts[i],W));
    const hy=D.s?0.664:(C.mid.y0+C.mid.y1)/2, hx=D.s?D.s*0.345:0;
    addHandle(d,handle,hx,hy,zTop(hx)+D.proud+0.0005,{span:D.x1-D.x0});
    if(!real){ g.add(d); return; }
    const bx0=D.s<0?D.x0+0.065:D.x0+0.014, bx1=D.s>0?D.x1-0.065:D.x1-0.014, bw=bx1-bx0, bcx=(bx0+bx1)/2;
    let yb=0; for(let k=0;k<=20;k++) yb=Math.max(yb,D.bot(bx0+bw*k/20)); yb+=0.006;
    const yt=D.top-0.01, bh=yt-yb, dd=0.2;
    // جعبه تا پشت رویه قوس‌دار کشو می‌رسد (کف و بدنه‌ها هم‌منحنی رویه؛ بدون فاصله)
    const zb=x=>zTop(x)+D.proud-C.front-0.0005;
    let zf=1; for(let k=0;k<=20;k++) zf=Math.min(zf,zb(bx0+bw*k/20));
    const tw=0.012, M=slot.inner, zBk=zf-dd;
    G.floor??=[]; d.add(new THREE.Mesh(G.floor[i]??=(()=>{ const pts=[];
      for(let k=0;k<=40;k++){ const x=bx0+bw*k/40; pts.push(new THREE.Vector2(x,zb(x))); }
      pts.push(new THREE.Vector2(bx1,zBk),new THREE.Vector2(bx0,zBk));
      const f=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:0.008,bevelEnabled:false,curveSegments:2});
      f.rotateX(Math.PI/2); f.translate(0,yb+0.008,0); f.computeVertexNormals(); return f; })(),M));
    for(const s of [-1,1]){ const xs=bcx+s*(bw/2-tw/2), L=zb(xs)-zBk; d.add(mesh(box(tw,bh,L),M,xs,yb+bh/2,zBk+L/2)); }
    d.add(mesh(box(bw,bh,tw),M,bcx,yb+bh/2,zBk+tw/2));
    d.userData.open={type:'drawer',dist:0.18}; g.add(d); });
  return g; }

/* ---------- طلاکاری روی برجستگی کنده‌کاری‌ها (مثل عکس محصول) ----------
   برآمدگی هر رأس از هندسه خود اسکن حساب می‌شود (همسایه‌ها زیر صفحه مماس = لبه/برگ برجسته) و چند بار هموار می‌شود. */
/* top: سهم برجسته‌ترین سطح که طلا می‌شود (کنسول ۱۸٪؛ ست رز کمتر، فقط نوک برگ و گل‌ها مثل عکس) */
export function gildAttr(geo,top=0.18){ if(geo.attributes.gild) return geo;
  const P=geo.attributes.position, N=geo.attributes.normal, I=geo.index.array, n=P.count;
  const p=new Float32Array(n*3), nr=new Float32Array(n*3);
  for(let i=0;i<n;i++){ p[i*3]=P.getX(i); p[i*3+1]=P.getY(i); p[i*3+2]=P.getZ(i); nr[i*3]=N.getX(i); nr[i*3+1]=N.getY(i); nr[i*3+2]=N.getZ(i); }
  const s=new Float32Array(n), w=new Float32Array(n);
  const acc=(i,j)=>{ const dx=p[j*3]-p[i*3], dy=p[j*3+1]-p[i*3+1], dz=p[j*3+2]-p[i*3+2], l2=dx*dx+dy*dy+dz*dz; if(l2<1e-14) return;
    s[i]-=(nr[i*3]*dx+nr[i*3+1]*dy+nr[i*3+2]*dz)/l2; w[i]++; };
  for(let t=0;t<I.length;t+=3){ const a=I[t], b=I[t+1], c=I[t+2]; acc(a,b); acc(a,c); acc(b,a); acc(b,c); acc(c,a); acc(c,b); }
  let v=new Float32Array(n); for(let i=0;i<n;i++) v[i]=w[i]?s[i]/w[i]:0;
  for(let it=0;it<4;it++){ const o=new Float32Array(n), c=new Float32Array(n);
    for(let t=0;t<I.length;t+=3){ const a=I[t], b=I[t+1], d=I[t+2]; o[a]+=v[b]+v[d]; o[b]+=v[a]+v[d]; o[d]+=v[a]+v[b]; c[a]+=2; c[b]+=2; c[d]+=2; }
    for(let i=0;i<n;i++) o[i]=(v[i]+o[i])/(1+c[i]); v=o; }
  // آستانه از توزیع خود مدل: ۱۸٪ برجسته‌ترین سطح طلا
  const sorted=Float32Array.from(v).sort(), lo=sorted[Math.floor(n*(1-top-0.04))], hi=sorted[Math.floor(n*(1-top*5/9))];
  const g=new Uint8Array(n); for(let i=0;i<n;i++){ const k=Math.min(1,Math.max(0,(v[i]-lo)/(hi-lo))); g[i]=Math.round(k*k*(3-2*k)*255); }
  geo.setAttribute('gild',new THREE.BufferAttribute(g,1,true)); return geo; }
/* ماده را طلاکاری‌پذیر می‌کند: جاهایی که gild دارند فلز طلایی با برق نرم (روی سایه‌روشن خود اسکن) */
export function gildMat(mat,hex){ const prev=mat.onBeforeCompile, key=mat.customProgramCacheKey?.()||'', gold=new THREE.Color(hex);
  mat.onBeforeCompile=(sh,r)=>{ prev?.call(mat,sh,r); sh.uniforms.gold={value:gold};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float gild; varying float vGild;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGild=gild;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 gold; varying float vGild;')
      .replace('#include <color_fragment>','#include <color_fragment>\n#ifdef USE_COLOR\n float gS=clamp(vColor.r/0.8,0.55,1.1);\n#else\n float gS=1.0;\n#endif\n diffuseColor.rgb=mix(diffuseColor.rgb,gold*gS,vGild);')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.38,vGild);')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,1.0,vGild);'); };
  mat.customProgramCacheKey=()=>key+'gild'; return mat; }

/* گل منبت وسط و باقی‌مانده لبه کشوی وسط از مدل اصلی برداشته می‌شود؛ گل کامل و قرینه از assets/models/console-medallion.js می‌آید */
export function trimCarve(mesh){ const geo=mesh.geometry; if(geo.userData.trimmed) return; geo.userData.trimmed=true;
  const P=geo.attributes.position, I=geo.index.array, sc=mesh.scale.x, o=mesh.position, keep=[];
  const W=i=>[P.getX(i)*sc+o.x,P.getY(i)*sc+o.y,P.getZ(i)*sc+o.z];
  for(let t=0;t<I.length;t+=3){ let out=true;
    for(let k=0;k<3;k++){ const [x,y,z]=W(I[t+k]); if(!(Math.abs(x)<0.135&&y>0.515&&y<0.64&&z>0.1)) { out=false; break; } }
    if(!out) keep.push(I[t],I[t+1],I[t+2]); }
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(keep),1)); }
