/* کاناپه چستر — بدنه کامل با کد؛ کلاف و پایه‌های کنده‌کاری از فایل اصلی.
   دسته‌ها و پشتی یک لبه لوله‌ای پیوسته‌اند (مثل فایل و عکس): از جلوی دسته راست، دور گوشه، پشتی، تا جلوی دسته چپ.
   اندازه‌ها از برش‌های فایل سه‌بعدی: نشیمن ۴۷، لبه لوله‌ای ۷۴ (بیرون‌زدگی ~۲۷ از رویه داخلی)، پلان قوس‌دار (دو سر ۱۶ سانت جلوتر).
   دوخت کانالی عمودی روی رویه داخلی و لوله. همه سطوح UV متری دارند تا بافت و نرمال‌مپ واقعی پارچه درست بنشیند. */
import { THREE, slot } from './product.js';
import { rrect, slabY } from './geo.js';
import { cushion } from './sectional.js';

export const CH={ armIn:0.86, seatY0:0.30, seatY1:0.468, baseY0:0.25, backFront:-0.23, front:0.345, armFront:0.345, R:0.14, bend:0.16 };   // همه از فایل
export const bendZ=x=>CH.bend*Math.pow(Math.min(1.12,Math.abs(x)),2);     // قوس پلان (z += …)
function bent(g,armFace=false){ const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=Math.abs(p.getX(i)), z=p.getZ(i);
    // جلوی دسته در فایل رو به لبه بیرونی کمی عقب می‌رود تا ستون کنده‌کاری روی آن بنشیند
    const slope=armFace&&x>0.93?-0.49*(x-0.93)*Math.min(1,Math.max(0,(z-0.25)/0.095)):0;
    p.setZ(i,z+bendZ(p.getX(i))+slope); }
  g.computeVertexNormals(); return g; }

/* مسیر رویه داخلی لبه (پلان x,z): دسته راست ← گوشه گرد ← پشتی ← گوشه ← دسته چپ */
function rimPath(){ const {armIn:A,backFront:B,armFront:F,R}=CH, pts=[];
  const line=(x0,z0,x1,z1,n)=>{ for(let k=0;k<n;k++){ const t=k/n; pts.push([x0+(x1-x0)*t,z0+(z1-z0)*t]); } };
  const arc=(cx,cz,a0,a1,n)=>{ for(let k=0;k<n;k++){ const a=a0+(a1-a0)*k/n; pts.push([cx+R*Math.cos(a),cz+R*Math.sin(a)]); } };
  line(A,F,A,B+R,60); arc(A-R,B+R,0,-Math.PI/2,24); line(A-R,B,-A+R,B,240); arc(-A+R,B+R,-Math.PI/2,-Math.PI,24); line(-A,B+R,-A,F,60); pts.push([-A,F]);
  const L=[0]; for(let i=1;i<pts.length;i++) L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const T=pts.map((p,i)=>{ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)], l=Math.hypot(b[0]-a[0],b[1]-a[1]); return [(b[0]-a[0])/l,(b[1]-a[1])/l]; });
  return {pts,L,T}; }
/* پروفیل لبه در (n بیرون از رویه داخلی، y): رویه داخلی، لوله رو به بیرون، رویه بیرونی تا پایین */
const RIM=[[0,0.30],[0,0.60],[0.016,0.676],[0.066,0.728],[0.14,0.746],[0.212,0.733],[0.252,0.693],[0.266,0.643],[0.245,0.596],[0.214,0.57],[0.178,0.562],[0.17,0.53],[0.17,0.25],[0.06,0.25]];
function profile(n){ const c=new THREE.CatmullRomCurve3(RIM.map(([a,b])=>new THREE.Vector3(a,b,0)),true,'centripetal',0.5);
  return c.getSpacedPoints(n).slice(0,-1).map(v=>[v.x,v.y]); }

function rimGeo(){ const {pts,L,T}=rimPath(), P=profile(140), M=P.length, S=pts.length, pos=[], uv=[], idx=[];
  const plen=[0]; for(let i=1;i<=M;i++){ const a=P[i-1], b=P[i%M]; plen.push(plen[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1])); }
  // نرمال دوبعدی پروفیل (برای فرورفتگی کانال‌ها)
  const pn=P.map((p,i)=>{ const a=P[(i-1+M)%M], b=P[(i+1)%M], tx=b[0]-a[0], ty=b[1]-a[1], l=Math.hypot(tx,ty)||1; return [ty/l,-tx/l]; });
  const area=P.reduce((s,p,i)=>s+p[0]*P[(i+1)%M][1]-P[(i+1)%M][0]*p[1],0), sg=area>0?-1:1;   // pn رو به بیرون پروفیل
  const PER=0.112, DEP=0.0065;
  const quilted=p=>p[1]>0.43&&!(p[0]>0.14&&p[1]<0.565);           // رویه داخلی بالای نشیمن + لوله
  for(let k=0;k<S;k++){ const [x,z]=pts[k], [tx,tz]=T[k], nx=-tz, nz=tx;   // بیرون
    const ph=(L[k]/PER)%1, puff=Math.pow(Math.max(0,Math.sin(Math.PI*ph)),0.35);   // بالشتک پهن با شیار باریک
    for(let i=0;i<M;i++){ const p=P[i], d=quilted(p)?DEP*(puff-0.85):0, n=p[0]+sg*pn[i][0]*d, y=p[1]+sg*pn[i][1]*d;
      pos.push(x+nx*n,y,z+nz*n); uv.push(L[k],plen[i]); } }
  for(let k=0;k<S-1;k++) for(let i=0;i<M;i++){ const a=k*M+i, b=k*M+(i+1)%M, c=(k+1)*M+(i+1)%M, d=(k+1)*M+i; idx.push(a,b,c,a,c,d); }
  // درپوش دو سر دسته
  const capR=[];
  for(const [k,s] of [[0,-1],[S-1,1]]){ const base=pos.length/3; capR.push([idx.length,s,T[k]]); let cx=0,cy=0; P.forEach(p=>{ cx+=p[0]/M; cy+=p[1]/M; });
    const [x,z]=pts[k], [tx,tz]=T[k], nx=-tz, nz=tx; pos.push(x+nx*cx,cy,z+nz*cx); uv.push(0,0);
    for(let i=0;i<M;i++){ pos.push(pos[(k*M+i)*3],pos[(k*M+i)*3+1],pos[(k*M+i)*3+2]); uv.push(P[i][0],P[i][1]); }
    for(let i=0;i<M;i++){ const p=base+1+i, q=base+1+(i+1)%M; idx.push(base,p,q); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx);
  orient(g);
  // درپوش‌ها: رو به بیرونِ امتداد مسیر
  const ix=g.index.array, pa=g.attributes.position.array;
  capR.forEach(([st,s_,t],ci)=>{ const en=ci?ix.length:capR[1][0];
    for(let i=st;i<en;i+=3){ const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
      const ux=pa[b]-pa[a],uz=pa[b+2]-pa[a+2],uy=pa[b+1]-pa[a+1],vx=pa[c]-pa[a],vy=pa[c+1]-pa[a+1],vz=pa[c+2]-pa[a+2];
      const nx=uy*vz-uz*vy, nz=ux*vy-uy*vx; if((nx*t[0]+nz*t[1])*s_<0){ const tt=ix[i+1]; ix[i+1]=ix[i+2]; ix[i+2]=tt; } } });
  return bent(g,true); }
/* جهت همه مثلث‌ها رو به بیرون: با نرمال پروفیل/درپوش مقایسه می‌شود (حجم علامت‌دار هر بخش) */
function orient(g){ const p=g.attributes.position.array, ix=g.index.array; let vol=0;
  for(let i=0;i<ix.length;i+=3){ const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    vol+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])-p[a+1]*(p[b]*p[c+2]-p[b+2]*p[c])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]); }
  if(vol<0) for(let i=0;i<ix.length;i+=3){ const t=ix[i+1]; ix[i+1]=ix[i+2]; ix[i+2]=t; } }

let GEO=null;
function geos(){ if(GEO) return GEO;
  // بدنه زیر تشک جلو (بین دو دسته، تا پشتی)
  // بدنه زیر تشک: روی ریل چوبی (۲۵ سانت)، جلو هم‌سطح جلوی تشک (مثل فایل، بدون پله)
  const s=new THREE.Shape(); rrect(s,2*CH.armIn+0.004,CH.front-CH.backFront,0.012);
  const base=slabY(s,CH.baseY0,CH.seatY0+0.004,0.01); base.translate(0,0,(CH.front+CH.backFront)/2); bent(base);
  return GEO={rim:rimGeo(),base}; }
/* تشک یکسره قوس‌دار با قیطان بالا و پایین */
let SEAT=null;
function seatGroup(){ if(SEAT) return SEAT.clone();
  const w=2*CH.armIn-0.006, d=CH.front-CH.backFront, h=CH.seatY1-CH.seatY0;
  const c=cushion(w,h,d,0.035,{crown:0.01,bulge:0.002,mat:slot.cushion,welt:slot.welt});
  c.traverse(o=>{ if(!o.isMesh) return; o.geometry=o.geometry.clone(); o.geometry.translate(0,CH.seatY0+h/2,CH.backFront+d/2); bent(o.geometry); });
  SEAT=c; return c.clone(); }

export function buildChesterBody(g){ const G=geos();
  g.add(new THREE.Mesh(G.rim,slot.fabric)); g.add(new THREE.Mesh(G.base,slot.fabric)); g.add(seatGroup()); return g; }
export const backFrontZ=x=>CH.backFront+bendZ(x);
