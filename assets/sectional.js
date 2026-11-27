/* مبل ال «ساحل» — تمام با کد. ابعاد و فرم از برش‌های فایل سه‌بعدی اصلی اندازه‌گیری شده:
   ارتفاع نشیمن ۴۷، پشتی ۸۵، دسته ۶۴ (پهنای ۱۵)، عمق بدنه ۱۰۸، شزلون ۲۰۶، پایه چوبی ۹ سانت.
   ماژول‌ها: [شزلون یا نشیمن دسته‌دار] + نشیمن‌های بی‌دسته + نشیمن دسته‌دار. سمت شزلون با آینه‌کردن عوض می‌شود.
   حس واقعی: هر قطعه رویه‌دار یک جعبه نرم با لبه گرد، شکم ملایم، چین‌های پارچه (بیشتر نزدیک لبه‌ها و عمود بر آن‌ها)
   و گودی جای نشستن؛ سایه تماس (AO) بین قطعه‌ها هم پخته و در رنگ رأس ذخیره می‌شود. */
import { THREE, slot } from './product.js';
import { V3, sweep, MOBILE } from './geo.js';

export const DIM={ legH:0.092, baseTop:0.27, seatTop:0.47, backTop:0.72, armTop:0.64, armW:0.15, backD:0.15,
  zBack:-1.03, zFront:0.05, zChaise:1.03, seatW:0.75, chaiseW:0.95, cushT:0.22 };
const STEP=MOBILE?0.022:0.016;   // فاصله رأس‌ها (متر)

/* ---------- نویز برای چین پارچه ---------- */
const hash=(i,j,k)=>{ let h=(i*374761393+j*668265263+k*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
const fade=t=>t*t*(3-2*t);
function vnoise(x,y,z){ const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z), u=fade(x-i),v=fade(y-j),w=fade(z-k);
  const L=(a,b,t)=>a+(b-a)*t, c=(a,b,cc)=>hash(i+a,j+b,k+cc);
  return 2*L(L(L(c(0,0,0),c(1,0,0),u),L(c(0,1,0),c(1,1,0),u),v),L(L(c(0,0,1),c(1,0,1),u),L(c(0,1,1),c(1,1,1),u),v),w)-1; }

/* ---------- جعبه رویه‌دار نرم ----------
   w,h,d ابعاد؛ r شعاع لبه؛ bulge شکم وسط وجه‌ها؛ wr دامنه چین؛ dents: [{x,z,s,depth}] گودی جای نشستن روی وجه بالا؛
   seed: هر قطعه چین متفاوت؛ pipe: قیطان دور لبه بالا و پایین (مثل تشک). */
const G={};
function upBox(w,h,d,{r=0.03,bulge=0.004,wr=0.0015,dents=[],seed=0,pipe=false,pr=0.0055}={}){
  const key=[w,h,d,r,bulge,wr,seed,pipe,JSON.stringify(dents)].map(v=>typeof v==='number'?v.toFixed(4):v).join();
  return G[key]??=(()=>{
  const H=[w/2,h/2,d/2]; r=Math.min(r,...H.map(v=>v-0.002)); const I=H.map(v=>v-r); const spec={w,h,d,r,bulge,dents};
  // نمونه‌های هر محور: بخش صاف یکنواخت، بخش لبه با گام زاویه‌ای یکنواخت
  const nb=Math.max(3,Math.ceil(Math.PI/4*r/STEP));
  const axis=a=>{ const n=Math.max(1,Math.ceil(2*I[a]/STEP)), o=[];
    for(let k=nb;k>=1;k--) o.push(k===nb?-H[a]:-I[a]-r*Math.tan(Math.PI/4*k/nb));
    for(let k=0;k<=n;k++) o.push(-I[a]+2*I[a]*k/n);
    for(let k=1;k<=nb;k++) o.push(k===nb?H[a]:I[a]+r*Math.tan(Math.PI/4*k/nb)); return o; };
  const AX=[axis(0),axis(1),axis(2)], sd=seed*17.3;
  const q=new THREE.Vector3(), n=new THREE.Vector3();
  const round=p=>{ const c=[0,1,2].map(a=>Math.max(-I[a],Math.min(I[a],p[a]))), v=[p[0]-c[0],p[1]-c[1],p[2]-c[2]], l=Math.hypot(...v)||1;
    n.set(v[0]/l,v[1]/l,v[2]/l); q.set(c[0]+r*n.x,c[1]+r*n.y,c[2]+r*n.z); };
  // جابه‌جایی در جهت نرمال: شکم + چین + گودی
  const disp=(q,n)=>{ const P=[q.x,q.y,q.z], N=[n.x,n.y,n.z], cn=P.map((v,a)=>Math.min(1,Math.abs(v)/H[a])), ip=N.map(v=>1-v*v);
    // همه وزن‌ها پیوسته در نرمال، تا روی درز بین وجه‌ها شکاف نیفتد
    let dd=0; for(let k=0;k<3;k++){ let b=N[k]*N[k]*(k===1&&N[1]<0?0.3:1); for(let a=0;a<3;a++) if(a!==k) b*=Math.max(0,1-cn[a]**4); dd+=bulge*b; }
    // چین: کشیده عمود بر نزدیک‌ترین لبه (خط چین رو به لبه)، قوی‌تر نزدیک لبه‌ها
    let we=0; const ws=[0,1,2].map(a=>cn[a]**6*ip[a]); for(let a=0;a<3;a++) we=Math.max(we,(Math.max(0,cn[a]-0.55)/0.45)**2*ip[a]);
    const sw=ws[0]+ws[1]+ws[2]+1e-6, f=a=>22+(4-22)*ws[a]/sw;
    const nz=vnoise(P[0]*f(0)+sd,P[1]*f(1)+sd*0.7,P[2]*f(2)-sd), nz2=vnoise(P[0]*55+sd,P[1]*55,P[2]*55);
    const ridge=1-Math.abs(nz); dd+=wr*(0.35+0.65*we)*(ridge*ridge*1.6-0.55+0.25*nz2);
    // گودی جای نشستن (فقط وجه بالا)
    if(N[1]>0) for(const t of dents){ const ex=(P[0]-t.x)/t.s, ez=(P[2]-t.z)/(t.sz||t.s); dd-=t.depth*N[1]*Math.exp(-(ex*ex+ez*ez)); }
    return dd; };
  const pos=[],uv=[],idx=[];
  for(let k=0;k<3;k++) for(const s of [-1,1]){ const a=(k+1)%3, b=(k+2)%3, A=AX[a], B=AX[b], base=pos.length/3;
    for(let i=0;i<A.length;i++) for(let j=0;j<B.length;j++){ const p=[0,0,0]; p[k]=s*H[k]; p[a]=A[i]; p[b]=B[j];
      round(p); const dd=disp(q,n); pos.push(q.x+n.x*dd,q.y+n.y*dd,q.z+n.z*dd);
      uv.push(k===1?p[0]:k===0?p[2]:p[0], k===1?p[2]:p[1]); }
    const W=B.length;
    for(let i=0;i<A.length-1;i++) for(let j=0;j<W-1;j++){ const p0=base+i*W+j, p1=p0+1, p2=p0+W, p3=p2+1;
      s>0?idx.push(p0,p2,p1,p1,p2,p3):idx.push(p0,p1,p2,p1,p3,p2); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx);
  smoothNormals(g);
  const out={body:g,spec};
  if(pipe){ // قیطان روی خط ۴۵ درجه لبه بالا/پایین؛ همان جابه‌جایی رویه را می‌گیرد تا دقیقاً روی درز بنشیند
    const ring=[], M=Math.round(4*(I[0]+I[2])/0.008);
    const per=4*(I[0]+I[2]); for(let m=0;m<M;m++){ // دور مستطیل داخلی
      let t=per*m/M, x,z,dx,dz; const L=[2*I[0],2*I[2],2*I[0],2*I[2]];
      if(t<L[0]){ x=-I[0]+t; z=I[2]; dx=0; dz=1; } else if((t-=L[0])<L[1]){ x=I[0]; z=I[2]-t; dx=1; dz=0; }
      else if((t-=L[1])<L[2]){ x=I[0]-t; z=-I[2]; dx=0; dz=-1; } else { t-=L[2]; x=-I[0]; z=-I[2]+t; dx=-1; dz=0; }
      ring.push([x,z,dx,dz]); }
    // گوشه‌ها: قوس بین دو وجه
    const pts=[]; for(let m=0;m<ring.length;m++){ const [x,z,dx,dz]=ring[m]; pts.push([x,z,dx,dz]);
      const nx=ring[(m+1)%ring.length]; if(nx[2]!==dx||nx[3]!==dz){ const a0=Math.atan2(dz,dx), a1=Math.atan2(nx[3],nx[2]); let da=a1-a0; if(da>Math.PI) da-=2*Math.PI; if(da<-Math.PI) da+=2*Math.PI;
        for(let c=1;c<8;c++){ const a=a0+da*c/8; pts.push([nx[0],nx[1],Math.cos(a),Math.sin(a)]); } } }
    const mk=sy=>sweep(pts.map(([x,z,dx,dz])=>{ const p=[x+dx*r,sy*(I[1]+r),z+dz*r]; round(p); const dd=disp(q,n);
      return V3(q.x+n.x*(dd-0.0015),q.y+n.y*(dd-0.0015),q.z+n.z*(dd-0.0015)); }),[pr],{closed:true,seg:pts.length,radial:7});
    out.pipe=mk(1); out.lo=mk(-1); }
  return out; })(); }
/* نرمال نرم با جمع نرمال وجه‌ها روی رأس‌های هم‌مکان (درز بین وجه‌های جعبه دیده نشود) */
function smoothNormals(g){ const p=g.attributes.position.array, ix=g.index.array, n=new Float32Array(p.length), key=new Map(), id=new Int32Array(p.length/3);
  for(let i=0;i<p.length/3;i++){ const k=Math.round(p[i*3]*2e4)+','+Math.round(p[i*3+1]*2e4)+','+Math.round(p[i*3+2]*2e4); let v=key.get(k); if(v===undefined){ v=i; key.set(k,i); } id[i]=v; }
  for(let t=0;t<ix.length;t+=3){ const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    for(const v of [ix[t],ix[t+1],ix[t+2]]){ const o=id[v]*3; n[o]+=nx; n[o+1]+=ny; n[o+2]+=nz; } }
  for(let i=0;i<p.length/3;i++){ const o=id[i]*3, l=Math.hypot(n[o],n[o+1],n[o+2])||1; n[i*3]=n[o]/l; n[i*3+1]=n[o+1]/l; n[i*3+2]=n[o+2]/l; }
  g.setAttribute('normal',new THREE.BufferAttribute(n,3)); g.computeBoundingSphere(); }

/* هر قطعه رویه‌دار یک برخوردگیر (جعبه گرد با همان شکم و گودی) هم ثبت می‌کند تا کوسن‌های تزئینی واقعاً رویش بنشینند و در آن فرو نروند */
let COL=[];
function part(G0,mat,x,y,z,rx=0){ const g=new THREE.Group(); if(G0.spec) COL.push({...G0.spec,x,y,z,rx}); g.add(new THREE.Mesh(G0.body,mat));
  if(G0.pipe){ g.add(new THREE.Mesh(G0.pipe,slot.welt)); g.add(new THREE.Mesh(G0.lo,slot.welt)); }
  g.position.set(x,y,z); g.rotation.x=rx; return g; }
/* سازگاری با صفحه‌های دیگر */
export function cushion(w,h,d,r,{crown=0.012,mat=slot.cushion}={}){ return part(upBox(w,h,d,{r,bulge:crown,wr:0.0012,pipe:true}),mat,0,0,0); }

/* پایه: عیناً پایه فایل اصلی (یک پایه از اسکن، در همه جای پایه‌ها) — با setLeg از صفحه داده می‌شود */
let LEG=null; export function setLeg(m){ LEG=m; }

/* ---------- ماژول‌ها (x0..x1 در طول مبل، رو به +z) ---------- */
let SEED=0;
function base(g,x0,x1,z0,z1,lx0=x0,lx1=x1){ const w=x1-x0, d=z1-z0, h=DIM.baseTop-DIM.legH;
  g.add(part(upBox(w+0.01,h,d,{r:0.03,bulge:0.006,wr:0.0012,seed:++SEED}),slot.fabric,(x0+x1)/2,DIM.legH+h/2,(z0+z1)/2));
  for(const [x,z] of [[lx0+0.06,z0+0.06],[lx1-0.06,z0+0.06],[lx0+0.06,z1-0.06],[lx1-0.06,z1-0.06]]){ const l=LEG.clone(); l.traverse(o=>{ o.userData.leg=1; }); l.position.x+=x; l.position.z+=z; g.add(l); } }
function backPanel(g,x0,x1){ const h=DIM.backTop-DIM.baseTop+0.02, d=DIM.backD;
  g.add(part(upBox(x1-x0,h,d,{r:0.045,bulge:0.008,wr:0.0015,seed:++SEED}),slot.fabric,(x0+x1)/2,DIM.baseTop-0.02+h/2,DIM.zBack+d/2)); }
function arm(g,x0,x1,z1){ const h=DIM.armTop-DIM.legH, d=z1-DIM.zBack;
  g.add(part(upBox(x1-x0,h,d,{r:0.05,bulge:0.01,wr:0.0018,seed:++SEED}),slot.fabric,(x0+x1)/2,DIM.legH+h/2,DIM.zBack+d/2)); }
/* تشک یکسره هر ماژول (مثل فایل) با قیطان؛ جای هر نشیمن کمی گود (مبل استفاده‌شده نه کارخانه‌ای) */
function seat(g,x0,x1,z1,places){ const zb=DIM.zBack+DIM.backD, d=z1-zb, h=DIM.seatTop-DIM.baseTop, cx=(x0+x1)/2, cz=zb+d/2;
  const dents=places.map(([x,z,len])=>({x:x-cx,z:z-cz,s:0.22,sz:len||0.24,depth:0.02}));
  g.add(part(upBox(x1-x0-0.004,h,d,{r:0.04,bulge:0.014,wr:0.0038,dents,seed:++SEED,pipe:true}),slot.cushion,cx,DIM.baseTop+h/2,cz)); }
/* کوسن پشتی جدا (مثل فایل: جعبه‌ای پف‌دار با لبه‌های خیلی گرد، کمی خوابیده روی پشتی) */
function backCushion(g,x0,x1){ const w=x1-x0+0.01, h=0.47, t=0.22;
  g.add(part(upBox(w,h,t,{r:0.085,bulge:0.028,wr:0.004,seed:++SEED}),slot.cushion,(x0+x1)/2,DIM.seatTop+h/2-0.03,DIM.zBack+DIM.backD+t/2-0.005,-0.2)); }

/* ---------- سایه تماس (AO) پخته در رنگ رأس ----------
   همه قطعه‌ها در یک شبکه وکسلی ریخته می‌شوند و از هر رأس چند پرتو در نیم‌کره بیرون فرستاده می‌شود. کف هم مانع است. */
function bakeAO(g){
  g.updateMatrixWorld(true); const meshes=[], legs=[]; g.traverse(o=>{ if(!o.isMesh) return; if(o.userData.leg) legs.push(o); else { o.geometry=o.geometry.clone(); meshes.push(o); } });
  const box=new THREE.Box3().setFromObject(g).expandByScalar(0.3), vs=MOBILE?0.022:0.015, sz=box.getSize(V3()),
    NX=Math.ceil(sz.x/vs), NY=Math.ceil(sz.y/vs), NZ=Math.ceil(sz.z/vs), occ=new Uint8Array(NX*NY*NZ);
  const cell=(x,y,z)=>{ const i=Math.floor((x-box.min.x)/vs), j=Math.floor((y-box.min.y)/vs), k=Math.floor((z-box.min.z)/vs);
    return i<0||j<0||k<0||i>=NX||j>=NY||k>=NZ?-1:(k*NY+j)*NX+i; };
  const W=meshes.map(m=>{ const p=m.geometry.attributes.position, n=m.geometry.attributes.normal, P=new Float32Array(p.count*3), N=new Float32Array(p.count*3), v=V3(), nm=new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld); P.set([v.x,v.y,v.z],i*3); v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize(); N.set([v.x,v.y,v.z],i*3); }
    // پر کردن: رأس‌ها + وسط ضلع‌های مثلث‌ها
    const ix=m.geometry.index?.array; const mark=(x,y,z)=>{ const c=cell(x,y,z); if(c>=0) occ[c]=1; };
    for(let i=0;i<p.count;i++) mark(P[i*3],P[i*3+1],P[i*3+2]);
    if(ix) for(let t=0;t<ix.length;t+=3){ const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
      mark((P[a]+P[b]+P[c])/3,(P[a+1]+P[b+1]+P[c+1])/3,(P[a+2]+P[b+2]+P[c+2])/3); }
    return {P,N}; });
  for(const l of legs){ const bb=new THREE.Box3().setFromObject(l); for(let x=bb.min.x;x<=bb.max.x;x+=vs/2) for(let y=bb.min.y;y<=bb.max.y;y+=vs/2) for(let z=bb.min.z;z<=bb.max.z;z+=vs/2){ const c=cell(x,y,z); if(c>=0) occ[c]=1; } }
  // جهت‌های نیم‌کره (فیبوناچی)
  const DIR=[]; const ND=MOBILE?9:13; for(let i=0;i<ND;i++){ const y=1-(i+0.5)/ND*0.95, r=Math.sqrt(1-y*y), a=i*2.39996; DIR.push([r*Math.cos(a),y,r*Math.sin(a)]); }
  const MAXD=0.22, t=V3(), b=V3(), nn=V3();
  meshes.forEach((m,mi)=>{ const {P,N}=W[mi], cnt=P.length/3, ao=new Float32Array(cnt);
    for(let i=0;i<cnt;i++){ nn.set(N[i*3],N[i*3+1],N[i*3+2]); t.set(Math.abs(nn.y)<0.9?0:1,Math.abs(nn.y)<0.9?1:0,0).cross(nn).normalize(); b.crossVectors(nn,t);
      let occl=0, tot=0; const ox=P[i*3]+nn.x*vs*1.6, oy=P[i*3+1]+nn.y*vs*1.6, oz=P[i*3+2]+nn.z*vs*1.6;
      for(const [dx,dy,dz] of DIR){ const rx=t.x*dx+nn.x*dy+b.x*dz, ry=t.y*dx+nn.y*dy+b.y*dz, rz=t.z*dx+nn.z*dy+b.z*dz, wgt=dy; tot+=wgt;
        for(let s=vs;s<=MAXD;s+=vs*(0.8+s/0.05)){ const x=ox+rx*s, y=oy+ry*s, z=oz+rz*s;
          if(y<0||occ[cell(x,y,z)]===1){ occl+=wgt*(1-s/MAXD)**0.7; break; } } }
      ao[i]=1-occl/tot; }
    // نرم‌کردن روی همسایه‌های مثلث
    const ix=m.geometry.index?.array; if(ix) for(let it=0;it<2;it++){ const s=new Float32Array(cnt), c=new Uint16Array(cnt);
      for(let k=0;k<ix.length;k+=3) for(let e=0;e<3;e++){ const a=ix[k+e], q=ix[k+(e+1)%3]; s[a]+=ao[q]; c[a]++; s[q]+=ao[a]; c[q]++; }
      for(let i=0;i<cnt;i++) if(c[i]) ao[i]=(ao[i]*2+s[i]/c[i])/3; }
    const old=m.geometry.attributes.color, col=new Uint8Array(cnt*3);
    for(let i=0;i<cnt;i++){ const a=0.22+0.78*Math.pow(Math.min(1,ao[i]*1.12),1.3);
      for(let c=0;c<3;c++) col[i*3+c]=Math.round((old?old.getX(i)*255:204)*a); }
    m.geometry.setAttribute('color',new THREE.BufferAttribute(col,3,true)); });
}

/* layout: {chaise:true|false, seats:2|3}. شزلون/دسته چپ در x منفی؛ آینه برای راست. */
export function layoutWidth(L){ return 2*DIM.armW+(L.chaise?DIM.chaiseW-DIM.armW:DIM.seatW)+L.seats*DIM.seatW; }
export function buildSectional(L){
  SEED=0; COL=[]; const g=new THREE.Group(), W=layoutWidth(L); let x=-W/2;
  const zs=DIM.zBack+DIM.backD+0.32;   // جای نشستن (فاصله از پشتی)
  // ماژول اول: شزلون (یا نشیمن) با دسته بیرونی
  const m1=L.chaise?DIM.chaiseW:DIM.armW+DIM.seatW, zEnd=L.chaise?DIM.zChaise:DIM.zFront;
  if(L.chaise){ base(g,x+DIM.armW,x+m1,DIM.zBack,DIM.zFront+0.004,x,x+m1);   // زیر دسته
    base(g,x,x+m1,DIM.zFront,zEnd); }                                          // جلوی دسته تا سر شزلون
  else base(g,x+DIM.armW,x+m1,DIM.zBack,zEnd,x,x+m1);
  arm(g,x,x+DIM.armW,DIM.zFront); backPanel(g,x+DIM.armW,x+m1);
  const c1=x+DIM.armW+(m1-DIM.armW)/2;
  seat(g,L.chaise?x:x+DIM.armW,x+m1,zEnd,L.chaise?[[c1+0.04,zs+0.25,0.55]]:[[c1,zs]]); backCushion(g,x+DIM.armW,x+m1); x+=m1;   // تشک شزلون سرتاسری، زیر دسته
  // نشیمن‌های میانی بی‌دسته + آخرین با دسته
  const xs=x, xe=W/2;
  base(g,xs,xe-DIM.armW,DIM.zBack,DIM.zFront,xs,xe); backPanel(g,xs,xe-DIM.armW); arm(g,xe-DIM.armW,xe,DIM.zFront);
  seat(g,xs,xe-DIM.armW,DIM.zFront,Array.from({length:L.seats},(_,i)=>[xs+(i+0.5)*DIM.seatW,zs]));
  for(let i=0;i<L.seats;i++){ const a=xs+i*DIM.seatW, b=a+DIM.seatW; backCushion(g,a,b); }
  bakeAO(g);
  g.userData.colliders=COL;
  g.userData.dims=[W,DIM.zChaise-DIM.zBack,0.865];
  // لبه جلوی نشیمن برای خواباندن کوسن روی آن (روی شزلون جلوتر)
  const xc=-W/2+(L.chaise?DIM.chaiseW:0)-0.25; g.userData.seatFront=x=>L.chaise&&x<xc?DIM.zChaise-0.2:DIM.zFront;
  g.userData.pillowRange=[-W/2+DIM.armW+0.27,W/2-DIM.armW-0.27];
  return g;
}
