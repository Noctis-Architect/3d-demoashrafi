/* کوسن‌های جدا و جابه‌جاشونده: روی پشتی تکیه داده می‌شوند و با کشیدن، در طول مبل جابه‌جا می‌شوند. */
import { THREE, slot } from './product.js';
import { V3, sweep, MOBILE } from './geo.js';
import { fastPick } from './pick.js';

const GEOS={};
/* کوسن مربعی پف‌دار با گوشه‌های کشیده و درز دور (دو رویه جلو/پشت) — ابعاد به متر */
export function pillowGeo(W=0.46,H=0.46,T=0.2,{ex=2.6,pw=0.42}={}){ const key=[W,H,T,ex,pw].join(); if(GEOS[key]) return GEOS[key];
  const N=36, pos=[], idx=[];
  const f=(u,v)=>{ const a=1-Math.pow(Math.abs(u),ex), b=1-Math.pow(Math.abs(v),ex); return Math.pow(Math.max(0,a*b),pw); };
  for(const side of [1,-1]){ const base=pos.length/3;
    for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){ const u=-1+2*i/N, v=-1+2*j/N;
      // گوشه‌ها کمی بیرون‌زده (گوش کوسن)، وسط لبه‌ها کمی تو رفته
      const x=W/2*u*(1-0.06*v*v), y=H/2*v*(1-0.06*u*u), z=side*T/2*f(u,v);
      pos.push(x,y,z); }
    for(let j=0;j<N;j++) for(let i=0;i<N;i++){ const a=base+j*(N+1)+i, b=a+1, c=a+N+1, d=c+1;
      if(side>0) idx.push(a,b,d,a,d,c); else idx.push(a,d,b,a,c,d); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx);
  g.setAttribute('uv',new THREE.Float32BufferAttribute(pos.flatMap((v,i)=>i%3===2?[]:[v]),2));
  g.computeVertexNormals();
  // رنگ رأس سفید (مواد اسکن vertexColors دارند)
  const col=new Uint8Array(pos.length).fill(204); g.setAttribute('color',new THREE.BufferAttribute(col,3,true));
  return GEOS[key]=g; }

/* کوسن تزئینی واقعی (مثل عکس محصول): دو رویه دوخته با قیطان دور درز، گوشه‌های کشیده و کم‌پشت، چین ریز گوشه‌ها، UV متری */
const PG={};
/* shape 'square': مثل کوسن‌های چستر در عکس و فایل سه‌بعدی — دور مربعی با گوشه‌های نوک‌تیز، وسط پف‌دار و لبه‌ها تا درز نازک (نه مکعبی) */
export function pillowMesh(w=0.45,h=0.45,t=0.17,shape='soft',mat='pillows'){ const key=[w,h,t,shape].join(); const SQ=shape==='square';
  const G=PG[key]??=(()=>{ const n=44, ex=SQ?11:7;
    const rho=f=>Math.pow(Math.pow(Math.abs(Math.cos(f)),ex)+Math.pow(Math.abs(Math.sin(f)),ex),-1/ex);
    const outline=(f,r)=>{ const c=Math.cos(f), s_=Math.sin(f), q=r*rho(f), pinch=(SQ?0.06:0.05)*r*r*(1-Math.pow(Math.abs(c*s_)*2,0.5));
      return [q*c*w/2*(1-pinch), q*s_*h/2*(1-pinch)]; };
    const pos=[],uv=[],idx=[];
    for(const sd of [1,-1]){ const base=pos.length/3;
      for(let i=0;i<=n;i++) for(let j=0;j<=n;j++){ const u=-1+2*j/n, v=-1+2*i/n, r=Math.max(Math.abs(u),Math.abs(v)), f=Math.atan2(v,u);
        const [x,y]=outline(f,r), cs=Math.abs(Math.cos(f)*Math.sin(f))*2;
        let th=SQ?Math.pow(Math.max(0,1-Math.pow(r,2.6)),0.55)*(1-0.22*cs*cs*r*r):Math.pow(Math.max(0,1-Math.pow(r,3.2)),0.62)*(1-0.32*cs*cs*r*r);
        th*=1+0.07*(-y/(h/2)); if(!SQ) th+=0.025*cs*cs*Math.pow(r,4)*Math.sin(22*(Math.abs(u)-Math.abs(v)))*(1-r);
        pos.push(x,y,sd*t/2*th*(sd>0?1:0.9)); uv.push(x+0.5,y+0.5); }
      for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const p=base+i*(n+1)+j,q=p+n+1; sd>0?idx.push(p,p+1,q,p+1,q+1,q):idx.push(p,q,p+1,p+1,q,q+1); } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    const ring=[]; for(let k=0;k<96;k++){ const [x,y]=outline(2*Math.PI*k/96,1); ring.push(V3(x,y,0)); }
    return {body:g,pipe:sweep(ring,[0.005],{closed:true,seg:192,radial:8})}; })();
  const o=new THREE.Group(); o.add(new THREE.Mesh(G.body,slot[mat])); o.add(new THREE.Mesh(G.pipe,slot[mat])); return o; }

export const PILLOW_COUNTS=[{v:'4',label:'۴ کوسن'},{v:'2',label:'۲ کوسن'},{v:'6',label:'۶ کوسن'},{v:'0',label:'بدون کوسن'}];
/* xmin..xmax: محدوده جابه‌جایی در طول پشتی؛ back: z جلوی پشتی (عدد، یا تابع x برای پشتی قوس‌دار)؛ seat: ارتفاع نشیمن.
   xs: جای پیش‌فرض کوسن‌ها (اختیاری). کوسن‌ها با کشیدن جابه‌جا می‌شوند و روی قوس پشتی می‌مانند. */
/* off: فاصله مرکز کوسن از جلوی پشتی؛ inner: جلوتر آمدن کوسن‌های وسط نسبت به کوسن‌های دو سر.
   seatFront (اختیاری، عدد یا تابع x): z لبه جلوی نشیمن → کوسن آزادانه روی نشیمن هم کشیده می‌شود و هرچه جلوتر بیاید خوابیده‌تر می‌شود. */
/* solids (اختیاری): {back:[مش‌ها], seat:[مش‌ها]} — سطح واقعی مبل (اسکن). یک بار با پرتو اندازه گرفته می‌شود و در جدول می‌ماند:
   کوسن روی بالای تشک می‌نشیند، به خود پشتی تکیه می‌دهد و از دسته‌ها رد نمی‌شود (بدون کندی هنگام کشیدن). */
/* kinds (اختیاری): {تعداد: [{mat, w, h, front}]} — هر کوسن جنس/طرح (جایگاه ماده)، اندازه و جلوآمدگی خودش را دارد
   (مثل عکس محصول: کوسن مربعی ساده، راه‌راه و کوسن کمری جلوی آن‌ها). */
export function addPillows(g,count,{xmin=-0.9,xmax=0.9,back=-0.62,seat=0.47,size=0.46,h=null,xs=null,lean=0.42,off=0.09,inner=0.07,seatFront=null,shape='soft',solids=null,kinds=null}={}){
  const H=h||size, H0=H, size0=size;
  const n=+count; if(!n) return;
  const B=typeof back==='function'?back:()=>back;
  xs=xs?.[n]||{2:[xmin,xmax],4:[xmin,xmin+0.4,xmax-0.4,xmax],6:[xmin,xmin+0.4,-0.22,0.22,xmax-0.4,xmax]}[n];
  const SF=seatFront==null?null:typeof seatFront==='function'?seatFront:()=>seatFront, T=H*0.42;
  const zBack=p=>B(p.position.x)+off+p.userData.front, zFront=p=>SF(p.position.x)-H/2-0.02;
  const TH=H*(shape==='square'?0.34:0.42), TH0=TH;
  let S2=null;
  if(solids){ g.updateMatrixWorld(true); const rc=new THREE.Raycaster(), o=new THREE.Vector3(), dv=new THREE.Vector3();
    new Set([...solids.back,...solids.seat]).forEach(m=>fastPick(m));   // شبکه پرتو: چند هزار پرتو روی اسکن پرمثلث بدون کندی
    const cast=(ox,oy,oz,dx,dy,dz,list)=>{ g.localToWorld(o.set(ox,oy,oz)); dv.set(dx,dy,dz).transformDirection(g.matrixWorld); rc.set(o,dv); rc.far=3; const hh=rc.intersectObjects(list,false)[0]; return hh?g.worldToLocal(hh.point.clone()):null; };
    const NXt=111, X0=-1.1, DX=0.02, NZt=26, Z0=-0.45, DZ=0.04, yP=seat+0.2;
    const bk=new Float32Array(NXt), st=new Float32Array(NXt*NZt);
    for(let i=0;i<NXt;i++){ const x=X0+i*DX, hb=cast(x,yP,1.6,0,0,-1,solids.back); bk[i]=hb?hb.z:back;
      for(let j=0;j<NZt;j++){ const hs=cast(x,1.5,Z0+j*DZ,0,-1,0,solids.seat); st[i*NZt+j]=hs?hs.y:seat; } }
    const armR=cast(0,seat+0.12,-0.05,1,0,0,solids.back), armL=cast(0,seat+0.12,-0.05,-1,0,0,solids.back);
    const lin=(A,u)=>{ const i=Math.max(0,Math.min(A.length-2,Math.floor(u))), f=Math.max(0,Math.min(1,u-i)); return A[i]+(A[i+1]-A[i])*f; };
    S2={ back:x=>lin(bk,(x-X0)/DX), seat:(x,z)=>{ const u=Math.max(0,Math.min(NXt-1.001,(x-X0)/DX)), w=Math.max(0,Math.min(NZt-1.001,(z-Z0)/DZ)), i=u|0, j=w|0, a=u-i, b=w-j;
        const v=(ii,jj)=>st[ii*NZt+jj]; return (v(i,j)*(1-a)+v(i+1,j)*a)*(1-b)+(v(i,j+1)*(1-a)+v(i+1,j+1)*a)*b; },
      armL:armL?armL.x:-9, armR:armR?armR.x:9 }; }
  const place=(p)=>{ const u=p.userData, t=u.t||0, e=t*t*(3-2*t), H=u.H||H0, TH=u.TH||TH0, size=u.W||size0;
    if(S2){ // روی سطح واقعی: تکیه به پشتی، نشسته روی تشک، داخل دسته‌ها
      for(let it=0;it<2;it++){ const x=p.position.x, yaw=-Math.atan((S2.back(x+0.02)-S2.back(x-0.02))/0.04)+u.yaw*(1-e);
        const half=0.5*(size*Math.abs(Math.cos(yaw))+TH*Math.abs(Math.sin(yaw)))+0.01;
        p.position.x=Math.max(S2.armL+half,Math.min(S2.armR-half,x)); }
      const x=p.position.x, yaw=-Math.atan((S2.back(x+0.02)-S2.back(x-0.02))/0.04), lb=lean+(1.5-lean)*e;
      const zUp=S2.back(x)+TH*0.5*Math.cos(lb)+H*0.5*Math.sin(lb)*0.55-0.012+u.front;
      const zc=SF?zUp+(SF(x)-H/2-0.03-zUp)*t:zUp, ys=S2.seat(x,zc);
      p.position.z=zc; p.position.y=ys+(H*0.5*Math.cos(lb)+TH*0.5*Math.sin(lb))-0.015;
      p.rotation.set(-lb,yaw+u.yaw*(1-e),u.roll*(1-e),'YXZ'); return; }
    const x=p.position.x, d=(B(x+0.01)-B(x-0.01))/0.02, yaw=-Math.atan(d);
    p.position.z=SF?zBack(p)+(zFront(p)-zBack(p))*t:B(x)+off+u.front;
    p.position.y=seat+(H/2-0.02)*(1-e)+(T/2+0.04)*e;
    p.rotation.set(-(lean+(1.5-lean)*e),yaw+u.yaw*(1-e),u.roll*(1-e),'YXZ'); };
  // جلو/عقب: t=0 تکیه به پشتی، t=1 خوابیده لبه جلوی نشیمن
  const depth=p=>p.position.z, setDepth=(p,z)=>{ const a=S2?S2.back(p.position.x)+TH*0.5:zBack(p), b=zFront(p); p.userData.t=Math.max(0,Math.min(1,(z-a)/Math.max(0.01,b-a))); };
  // کوسن‌ها از هم رد نمی‌شوند: کوسن کشیده‌شده کنار کوسن دیگر می‌ایستد (روی پشتی کمی هم‌پوشانی مثل عکس مجاز است)
  const GX=size*0.66, GZ=0.22, lo=xmin-0.03, hi=xmax+0.03;
  const hits=p=>(p.parent?.children||[]).filter(o=>o!==p&&o.name==='pillow'&&Math.abs(o.position.x-p.position.x)<GX&&Math.abs(o.position.z-p.position.z)<GZ);
  const follow=p=>{ const u=p.userData; place(p);
    for(let k=0;k<3;k++){ const h=hits(p); if(!h.length) break; const o=h[0], sgn=Math.sign(p.position.x-o.position.x)||1;
      let nx=o.position.x+sgn*GX; if(nx<lo||nx>hi) nx=o.position.x-sgn*GX; p.position.x=Math.max(lo,Math.min(hi,nx)); place(p); }
    if(hits(p).length&&u.lastX!=null){ p.position.x=u.lastX; u.t=u.lastT; place(p); }
    u.lastX=p.position.x; u.lastT=u.t; };
  const KD=kinds?.[n];
  xs.forEach((x,i)=>{ const kd=KD?.[i]||{}; const p=pillowMesh(kd.w||size,kd.h||H,(kd.h||H)*(shape==='square'?0.34:0.42),shape,kd.mat||'pillows'); p.name='pillow';
    if(kd.h){ p.userData.H=kd.h; p.userData.TH=kd.h*(shape==='square'?0.34:0.42); } if(kd.w) p.userData.W=kd.w;
    const end=Math.abs(x)>Math.max(Math.abs(xmin),Math.abs(xmax))-0.05;
    p.userData.front=(end?0:inner)+(kd.front||0); p.userData.yaw=end?-Math.sign(x)*(S2?0.55:0.35):Math.sign(x)*0.12; p.userData.roll=end?Math.sign(x)*0.06:-Math.sign(x)*0.04;
    p.position.x=x; place(p);
    p.userData.drag=SF?{axis:'xz',min:lo,max:hi,follow,depth,setDepth}:{axis:'x',min:lo,max:hi,follow};
    g.add(p); });
}

/* ================= کوسن نرم با برخورد واقعی =================
   برای مبل‌هایی که برخوردگیر دارند (g.userData.colliders: جعبه‌های گرد با شکم و گودی، همان شکل رویه).
   ۱) فرم کوسن: دو رویه دوخته با درز تیز (بدون قیطان کارتونی)، وسط لبه‌ها کمی تو رفته، گوشه‌ها نازک و کشیده،
      پر شدن نامنظم الیاف، پایین کمی پرتر (وزن)، چین‌های شعاعی از گوشه‌ها و موج ریز روی درز.
   ۲) جا افتادن: کوسن پایین می‌آید تا روی نشیمن بنشیند و عقب می‌رود تا به پشتی (یا کوسن پشتی‌اش) تکیه کند.
   ۳) فشرده شدن: هر جای کوسن که به سطحی برسد صاف می‌شود (فرو نمی‌رود)، فرورفتگی نرم به اطراف پخش می‌شود و
      حجم ازدست‌رفته کمی به بقیه کوسن پف می‌دهد. سایه تماس (AO) نزدیک سطح‌ها در رنگ رأس ریخته می‌شود. */
const _h=(i,j,k)=>{ let h=(i*374761393+j*668265263+k*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
const _f=t=>t*t*(3-2*t);
function noise3(x,y,z){ const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z), u=_f(x-i),v=_f(y-j),w=_f(z-k), L=(a,b,t)=>a+(b-a)*t, c=(a,b,cc)=>_h(i+a,j+b,k+cc);
  return 2*L(L(L(c(0,0,0),c(1,0,0),u),L(c(0,1,0),c(1,1,0),u),v),L(L(c(0,0,1),c(1,0,1),u),L(c(0,1,1),c(1,1,1),u),v),w)-1; }
const sstep=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

/* فاصله علامت‌دار تا یک برخوردگیر (منفی = داخل) — همان شکم و گودی upBox */
function sdCol(c,px,py,pz){   // بدون ساختن آرایه (در هر جابه‌جایی صدها هزار بار صدا زده می‌شود)
  const dx=px-c.x, dy=py-c.y, dz=pz-c.z, lx=dx, ly=dy*c.cr+dz*c.sr, lz=-dy*c.sr+dz*c.cr, hx=c.H[0], hy=c.H[1], hz=c.H[2], r=c.r;
  const ax=Math.abs(lx), ay=Math.abs(ly), az=Math.abs(lz), qx=ax-hx+r, qy=ay-hy+r, qz=az-hz+r;
  const ox=qx>0?qx:0, oy=qy>0?qy:0, oz=qz>0?qz:0, ol=Math.sqrt(ox*ox+oy*oy+oz*oz), qm=Math.max(qx,qy,qz);
  let d=ol+(qm<0?qm:0)-r;
  if(c.bulge){ let Nx,Ny,Nz;
    if(ol>1e-9){ Nx=ox/ol; Ny=oy/ol*(ly<0?-1:1); Nz=oz/ol; } else { Nx=qm===qx?1:0; Ny=qm===qy&&!Nx?(ly<0?-1:1):0; Nz=!Nx&&!Ny?1:0; }
    const cx=Math.min(1,ax/hx)**4, cy=Math.min(1,ay/hy)**4, cz=Math.min(1,az/hz)**4, fx=Math.max(0,1-cx), fy=Math.max(0,1-cy), fz=Math.max(0,1-cz);
    let dd=c.bulge*(Nx*Nx*fy*fz+Ny*Ny*(Ny<0?0.3:1)*fx*fz+Nz*Nz*fx*fy);
    if(Ny>0) for(const t of c.dents){ const ex=(lx-t.x)/t.s, ez=(lz-t.z)/(t.sz||t.s); dd-=t.depth*Ny*Math.exp(-(ex*ex+ez*ez)); }
    d-=dd; }
  return d; }
/* برخوردگیر کوسن دیگر: جعبه بسیار گرد در قاب همان کوسن */
function sdPil(c,px,py,pz){ const e=c.m.elements, dx=px-e[12], dy=py-e[13], dz=pz-e[14], H=c.H, r=c.r;
  const qx=Math.abs(dx*e[0]+dy*e[1]+dz*e[2])-H[0]+r, qy=Math.abs(dx*e[4]+dy*e[5]+dz*e[6])-H[1]+r, qz=Math.abs(dx*e[8]+dy*e[9]+dz*e[10])-H[2]+r;
  const ox=qx>0?qx:0, oy=qy>0?qy:0, oz=qz>0?qz:0, qm=Math.max(qx,qy,qz); return Math.sqrt(ox*ox+oy*oy+oz*oz)+(qm<0?qm:0)-r; }
function prepCols(list){ return list.map(c=>({...c,H:[c.w/2,c.h/2,c.d/2],cr:Math.cos(c.rx||0),sr:Math.sin(c.rx||0),bulge:c.bulge||0,dents:c.dents||[],
  R:Math.hypot(c.w,c.h,c.d)/2+(c.bulge||0)})); }

/* فرم استراحت کوسن (قاب محلی: پهنا x، ارتفاع y، ضخامت z) */
function restPillow(w,h,t,seed,n){
  const N1=n+1, cnt=2*N1*N1, P=new Float32Array(cnt*3), PR=new Float32Array(cnt), sd=seed*13.7+3.1, pin=0.045;
  const corners=[[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let f=0;f<2;f++){ const sg=f?-1:1;
    for(let i=0;i<=n;i++) for(let j=0;j<=n;j++){ const k=f*N1*N1+i*N1+j;
      // نمونه‌برداری متراکم‌تر نزدیک درز تا لبه تیز و نرم بماند
      const u=Math.sin(Math.PI/2*(-1+2*j/n)), v=Math.sin(Math.PI/2*(-1+2*i/n)), au=Math.abs(u), av=Math.abs(v), e=Math.max(au,av);
      const x=w/2*u*(1-pin*(1-v*v)), y=h/2*v*(1-pin*(1-u*u));
      const prof=Math.pow(Math.max(0,1-Math.pow(au,2.2)),0.68)*Math.pow(Math.max(0,1-Math.pow(av,2.2)),0.68);   // گنبدی نه تخت
      let th=prof*(1+0.07*noise3(u*1.4+sd,v*1.4-sd,f*4))*(1+0.07*(-v))*(f?0.9:1);
      // چین‌های شعاعی از گوشه‌ها (پارچه آن‌جا جمع می‌شود)
      let wr=0; for(const [cu,cv] of corners){ const du=u-cu, dv=v-cv, dist=Math.hypot(du,dv), a=Math.atan2(dv,du);
        wr+=0.0085*Math.exp(-dist/0.45)*sstep(0.03,0.22,dist)*Math.cos(a*8+2.6*noise3(dist*3+sd,a*1.5,f+cu*2+cv));
      }
      // چروک ریز و موج کنار درز
      wr+=0.002*noise3(u*5+sd,v*5,f*2+1)+0.003*Math.pow(sstep(0.62,1,e),2)*noise3((au>av?v:u)*8+sd,f*5,au>av?1:2);
      // فرورفتگی ملایم بالای وسط (جای دست هنگام مرتب‌کردن) — هر کوسن کمی متفاوت
      wr-=(0.006+0.006*_h(seed,1,2))*Math.exp(-((u/0.16)**2))*sstep(0.15,0.95,v)*(f?0.5:1);
      wr*=1-Math.pow(e,10);
      // موج خود درز (هر دو رویه با هم، تا درز باز نشود)
      const seam=0.005*Math.pow(e,6)*noise3((au>av?v*Math.sign(u):u*Math.sign(v)+3)*2.2+sd,7,0);
      P[k*3]=x; P[k*3+1]=y; P[k*3+2]=sg*(t/2*th+wr)+seam; PR[k]=prof; } }
  // UV به متر، با طول کمان روی سطح (پارچه روی برجستگی کش نمی‌آید)
  const UV=new Float32Array(cnt*2), m=n>>1, D=(a,b)=>Math.hypot(P[a*3]-P[b*3],P[a*3+1]-P[b*3+1],P[a*3+2]-P[b*3+2]);
  for(let f=0;f<2;f++){ const B=f*N1*N1, id=(i,j)=>B+i*N1+j;
    for(let i=0;i<=n;i++){ UV[id(i,m)*2]=P[id(i,m)*3]; for(let j=m+1;j<=n;j++) UV[id(i,j)*2]=UV[id(i,j-1)*2]+D(id(i,j),id(i,j-1)); for(let j=m-1;j>=0;j--) UV[id(i,j)*2]=UV[id(i,j+1)*2]-D(id(i,j),id(i,j+1)); }
    for(let j=0;j<=n;j++){ UV[id(m,j)*2+1]=P[id(m,j)*3+1]; for(let i=m+1;i<=n;i++) UV[id(i,j)*2+1]=UV[id(i-1,j)*2+1]+D(id(i,j),id(i-1,j)); for(let i=m-1;i>=0;i--) UV[id(i,j)*2+1]=UV[id(i+1,j)*2+1]-D(id(i,j),id(i+1,j)); } }
  for(let k=0;k<cnt;k++){ UV[k*2]+=0.5; UV[k*2+1]+=0.5; }
  const idx=[]; for(let f=0;f<2;f++){ const B=f*N1*N1; for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const p=B+i*N1+j, q=p+N1; f?idx.push(p,q,p+1,p+1,q,q+1):idx.push(p,p+1,q,p+1,q+1,q); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P.slice(),3)); g.setAttribute('uv',new THREE.BufferAttribute(UV,2)); g.setIndex(idx);
  g.computeVertexNormals(); const NR=g.attributes.normal.array.slice();
  g.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(cnt*3).fill(204),3,true));
  // جفت رأس‌های درز (روی دو رویه) و نمونه‌های کم برای جاانداختن
  const pair=new Int32Array(cnt).fill(-1), S=[]; const st=Math.max(2,Math.round(n/12));
  for(let i=0;i<=n;i++) for(let j=0;j<=n;j++){ const a=i*N1+j; if(i===0||j===0||i===n||j===n){ pair[a]=a+N1*N1; pair[a+N1*N1]=a; }
    if((i%st===0||i===n)&&(j%st===0||j===n)){ S.push(a,a+N1*N1); } }
  return {g,P,NR,PR,pair,S,n,N1,cnt}; }

/* xmin..xmax: محدوده در طول پشتی؛ back: z جلوی پشتی (حدسی، فقط برای شروع)؛ seat: ارتفاع نشیمن؛ colliders از g.userData */
export function addSoftPillows(g,count,{xmin=-0.9,xmax=0.9,seat=0.47,back=-0.65,size=0.46,h=null,thick=0.17,lean=0.3,sinkSeat=0.012,sinkBack=0.022,xs=null,tilt=true,seatFront=null}={}){
  // tilt: کوسن‌های کناری کمی چرخیده و کج (طبیعی) یا صاف و مرتب. seatFront(x): z لبه جلوی نشیمن → با کشیدن به جلو، کوسن روی نشیمن می‌خوابد
  const SF=typeof seatFront==='function'?seatFront:seatFront==null?null:()=>seatFront;
  const n0=+count; if(!n0) return; const H=h||size, W=size;
  const COLS=prepCols(g.userData.colliders||[]);
  xs=xs?.[n0]||{2:[xmin,xmax],4:[xmin,xmin+0.4,xmax-0.4,xmax],6:[xmin,xmin+0.4,-0.21,0.21,xmax-0.4,xmax]}[n0];
  const NG=MOBILE?40:60;
  const pills=[], ST=new Map();   // داده سنگین هر کوسن بیرون از userData (خروجی GLB سبک بماند)
  const tmpM=new THREE.Matrix4(), v=new THREE.Vector3();
  // میدان فاصله صحنه برای یک کوسن: برخوردگیرهای نزدیک + کوسن‌های لایه پشت‌تر
  // میدان فاصله مبل: یک بار روی شبکه ۱٫۵ سانتی در ناحیه کوسن‌ها حساب می‌شود، بعد فقط درون‌یابی سه‌خطی
  const fs=(x,y,z)=>{ let d=1e9; for(const o of COLS){ const dx=o.x-x, dy=o.y-y, dz=o.z-z; if(dx*dx+dy*dy+dz*dz>(d+o.R)*(d+o.R)) continue; const v=sdCol(o,x,y,z); if(v<d) d=v; } return d; };
  let SG=null;
  function grid(){ if(SG) return SG; const vs=0.015, x0=xmin-W/2-0.15, y0=seat-0.15, z0=back-0.4, NX=Math.ceil((xmax-xmin+W+0.3)/vs)+1, NY=Math.ceil((H+0.45)/vs)+1, NZ=Math.ceil(1.3/vs)+1;
    const A=new Float32Array(NX*NY*NZ); let i=0; for(let k=0;k<NZ;k++) for(let j=0;j<NY;j++) for(let l=0;l<NX;l++) A[i++]=fs(x0+l*vs,y0+j*vs,z0+k*vs);
    return SG={A,vs,x0,y0,z0,NX,NY,NZ}; }
  const fg=(x,y,z)=>{ const G=SG, u=(x-G.x0)/G.vs, v=(y-G.y0)/G.vs, w=(z-G.z0)/G.vs;
    if(!(u>=0&&v>=0&&w>=0&&u<G.NX-1&&v<G.NY-1&&w<G.NZ-1)) return fs(x,y,z);
    const i=u|0, j=v|0, k=w|0, a=u-i, b=v-j, c=w-k, A=G.A, NX=G.NX, S=NX*G.NY, o=(k*G.NY+j)*NX+i;
    const c00=A[o]+(A[o+1]-A[o])*a, c10=A[o+NX]+(A[o+NX+1]-A[o+NX])*a, c01=A[o+S]+(A[o+S+1]-A[o+S])*a, c11=A[o+S+NX]+(A[o+S+NX+1]-A[o+S+NX])*a;
    const c0=c00+(c10-c00)*b, c1=c01+(c11-c01)*b; return c0+(c1-c0)*c; };
  // میدان فاصله صحنه برای یک کوسن: مبل + کوسن‌های لایه پشت‌تر
  function field(p){ grid(); const c=p.position;
    const pc=pills.filter(q=>q!==p&&rank(q)<rank(p)&&Math.abs(q.position.x-c.x)<W*1.05&&Math.abs(q.position.z-c.z)<0.45).map(q=>{ q.updateMatrix(); const m=q.matrix.clone();
      return {m, H:[W/2*0.92,H/2*0.92,thick/2*0.82], r:thick/2*0.8}; });
    const f=pc.length?(x,y,z)=>{ let d=fg(x,y,z); for(const o of pc){ const s=sdPil(o,x,y,z); if(s<d) d=s; } return d; }:fg;
    const grad=(x,y,z,out)=>{ const e=0.004; out[0]=f(x+e,y,z)-f(x-e,y,z); out[1]=f(x,y+e,z)-f(x,y-e,z); out[2]=f(x,y,z+e)-f(x,y,z-e);
      const l=Math.hypot(out[0],out[1],out[2])||1; out[0]/=l; out[1]/=l; out[2]/=l; return out; };
    return {f,grad}; }
  // فرو رفتن در نشیمن (سطح رو به بالا) و در پشتی (سطح رو به جلو)
  function pen(p,F){ p.updateMatrix(); const R=ST.get(p).R, e=p.matrix.elements, gr=[0,0,0]; let ps=0, pb=0;
    for(const k of R.S){ const x=R.P[k*3],y=R.P[k*3+1],z=R.P[k*3+2];
      const wx=e[0]*x+e[4]*y+e[8]*z+e[12], wy=e[1]*x+e[5]*y+e[9]*z+e[13], wz=e[2]*x+e[6]*y+e[10]*z+e[14];
      const d=F.f(wx,wy,wz); if(d>=0) continue; F.grad(wx,wy,wz,gr);
      if(gr[1]>0.6) ps=Math.max(ps,-d); else if(gr[2]>0.35) pb=Math.max(pb,-d); }
    return [ps,pb]; }
  // جابه‌جایی در جهت منفی محور تا فرورفتگی برابر هدف شود: گام ۲ سانتی (از سطح نازک رد نمی‌شود) و بعد دونیم‌سازی
  function sink(p,F,ax,which,target,span){ const o=p.position[ax], P=m=>{ p.position[ax]=o-m; return pen(p,F)[which]>target; };
    if(P(0)){ let m=0; while(m>-0.25&&P(m)) m-=0.03; let lo=m, hi=m+0.03; for(let k=0;k<7;k++){ const c=(lo+hi)/2; if(P(c)) hi=c; else lo=c; } p.position[ax]=o-lo; return; }
    let m=0; while(m<span&&!P(m+0.03)) m+=0.03; let lo=m, hi=Math.min(span,m+0.03); for(let k=0;k<7;k++){ const c=(lo+hi)/2; if(P(c)) hi=c; else lo=c; } p.position[ax]=o-lo; }
  // t=0 تکیه به پشتی، t=1 خوابیده روی نشیمن
  const ease=t=>t*t*(3-2*t), rank=q=>(q.userData.t>0.3?2:0)+q.userData.layer;
  function orient(p){ const u=p.userData, e=ease(u.t||0), k=u.straight?0:1; p.rotation.set(-(lean+(1.47-lean)*e),u.yaw*k*(1-e),u.roll*k*(1-e),'YXZ'); }
  const zFrontOf=p=>SF?SF(p.position.x)-H/2-0.03:back+0.2;
  function settle(p){ const u=p.userData, t=u.t||0; orient(p); p.position.y=seat+H/2+0.08; p.position.z=back+0.3;
    const zT=t>0&&u.z0!=null?u.z0+(zFrontOf(p)-u.z0)*t:-1e9; p.position.z=Math.max(back+0.3,zT); const F=field(p);
    sink(p,F,'y',0,sinkSeat,0.45);
    for(let it=0;it<2;it++){ const y=p.position.y; sink(p,F,'z',1,sinkBack,0.6); if(p.position.z<zT){ p.position.z=zT; } p.position.y=y+0.04; sink(p,F,'y',0,sinkSeat,0.2); }
    if(!t) u.z0=p.position.z;
    deform(p,F); }
  // تغییر شکل نرم: رأس‌های فرورفته روی سطح صاف می‌شوند، اثرش پخش می‌شود، حجم به بقیه کوسن برمی‌گردد
  function deform(p,F){ const R=ST.get(p).R, {P,NR,PR,pair,N1,n,cnt}=R; p.updateMatrix(); const e=p.matrix.elements;
    const Dx=new Float32Array(cnt*3), pen0=new Float32Array(cnt), G=new Float32Array(cnt*3), dist=new Float32Array(cnt), gr=[0,0,0];
    for(let k=0;k<cnt;k++){ const x=P[k*3],y=P[k*3+1],z=P[k*3+2];
      const wx=e[0]*x+e[4]*y+e[8]*z+e[12], wy=e[1]*x+e[5]*y+e[9]*z+e[13], wz=e[2]*x+e[6]*y+e[10]*z+e[14];
      const d=F.f(wx,wy,wz); dist[k]=d; if(d>=0) continue; F.grad(wx,wy,wz,gr);
      // جهت به قاب محلی کوسن (فقط چرخش)
      G[k*3]=e[0]*gr[0]+e[1]*gr[1]+e[2]*gr[2]; G[k*3+1]=e[4]*gr[0]+e[5]*gr[1]+e[6]*gr[2]; G[k*3+2]=e[8]*gr[0]+e[9]*gr[1]+e[10]*gr[2];
      pen0[k]=-d; for(let a=0;a<3;a++) Dx[k*3+a]=G[k*3+a]*pen0[k]; }
    const T=new Float32Array(cnt*3);
    for(let it=0;it<12;it++){
      for(let f=0;f<2;f++){ const B=f*N1*N1; for(let i=0;i<=n;i++) for(let j=0;j<=n;j++){ const k=B+i*N1+j; let sx=0,sy=0,sz=0,c=0;
        const nb=[i>0?k-N1:-1,i<n?k+N1:-1,j>0?k-1:-1,j<n?k+1:-1]; for(const q of nb) if(q>=0){ sx+=Dx[q*3]; sy+=Dx[q*3+1]; sz+=Dx[q*3+2]; c++; }
        T[k*3]=(Dx[k*3]+sx/c)/2; T[k*3+1]=(Dx[k*3+1]+sy/c)/2; T[k*3+2]=(Dx[k*3+2]+sz/c)/2; } }
      for(let k=0;k<cnt;k++){ const q=pair[k]; if(q>k) for(let a=0;a<3;a++){ const m=(T[k*3+a]+T[q*3+a])/2; T[k*3+a]=T[q*3+a]=m; } }
      for(let k=0;k<cnt;k++){ if(pen0[k]>0){ const s=T[k*3]*G[k*3]+T[k*3+1]*G[k*3+1]+T[k*3+2]*G[k*3+2]; if(s<pen0[k]){ const a=pen0[k]-s; T[k*3]+=G[k*3]*a; T[k*3+1]+=G[k*3+1]*a; T[k*3+2]+=G[k*3+2]*a; } } }
      Dx.set(T); }
    // حجم: فرورفتگی به سمت داخل → پف ملایم بقیه رویه‌ها
    let lost=0, ws=0; for(let k=0;k<cnt;k++){ const s=-(Dx[k*3]*NR[k*3]+Dx[k*3+1]*NR[k*3+1]+Dx[k*3+2]*NR[k*3+2]); if(s>0) lost+=s; }
    const wv=new Float32Array(cnt); for(let k=0;k<cnt;k++){ const m=Math.hypot(Dx[k*3],Dx[k*3+1],Dx[k*3+2]); wv[k]=PR[k]*Math.exp(-m/0.006); ws+=wv[k]; }
    const kk=ws>0?0.55*lost/ws:0;
    const pos=ST.get(p).mesh.geometry.attributes.position.array;
    for(let k=0;k<cnt;k++){ const b=kk*wv[k]; for(let a=0;a<3;a++) pos[k*3+a]=P[k*3+a]+Dx[k*3+a]+NR[k*3+a]*b; }
    const geo=ST.get(p).mesh.geometry; geo.attributes.position.needsUpdate=true; geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox();
    // سایه تماس: نزدیک سطح‌های دیگر تیره‌تر، و کمی در شیار درز
    const col=geo.attributes.color.array;
    for(let k=0;k<cnt;k++){ let d=dist[k];
      if(d<0.09){ const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2]; d=F.f(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]); }
      const a=(0.5+0.5*Math.pow(sstep(-0.004,0.08,d),0.8))*(0.86+0.14*Math.min(1,PR[k]*4));
      col[k*3]=col[k*3+1]=col[k*3+2]=Math.round(204*a); }
    geo.attributes.color.needsUpdate=true; }
  // جابه‌جایی: کوسن‌های هم‌لایه از هم رد نمی‌شوند؛ کوسن جلویی روی کوسن پشتی تکیه می‌کند
  const lo=xmin-0.03, hi=xmax+0.03;
  const lying=q=>(q.userData.t||0)>0.3;
  const gap=(a,b)=>a.userData.layer===b.userData.layer||lying(a)?W*0.9:W*0.45;
  const hits=p=>pills.filter(o=>o!==p&&lying(o)===lying(p)&&Math.abs(o.position.x-p.position.x)<gap(o,p)-1e-4);
  const follow=p=>{ const u=p.userData;
    for(let k=0;k<3;k++){ const h=hits(p); if(!h.length) break; const o=h[0], sgn=Math.sign(p.position.x-o.position.x)||1;
      let nx=o.position.x+sgn*gap(o,p); if(nx<lo||nx>hi) nx=o.position.x-sgn*gap(o,p); p.position.x=Math.max(lo,Math.min(hi,nx)); }
    if(hits(p).length&&u.lastX!=null) p.position.x=u.lastX;
    u.lastX=p.position.x;
    settle(p);
    // کوسن‌های لایه جلوتر که به این کوسن تکیه دارند دوباره جا می‌افتند
    for(const q of [...pills].sort((a,b)=>rank(a)-rank(b))) if(q!==p&&rank(q)>rank(p)&&Math.abs(q.position.x-p.position.x)<W*1.1) settle(q); };
  const depth=p=>p.position.z, setDepth=(p,z)=>{ const u=p.userData, a=u.z0??back+0.15, b=zFrontOf(p); u.t=Math.max(0,Math.min(1,(z-a)/Math.max(0.01,b-a))); };
  const outer=Math.max(Math.abs(xmin),Math.abs(xmax))-0.05;
  xs.forEach((x,i)=>{ const end=Math.abs(x)>outer;
    const R=restPillow(W,H,thick,i+1,NG), mesh=new THREE.Mesh(R.g,slot.pillows), p=new THREE.Group(); p.add(mesh); p.name='pillow';
    ST.set(p,{R,mesh}); Object.assign(p.userData,{t:0,straight:!tilt,layer:end?0:1,yaw:end?-Math.sign(x)*0.3:Math.sign(x)*0.1,roll:end?Math.sign(x)*0.05:-Math.sign(x)*0.035});
    p.position.x=x; p.userData.lastX=x; p.userData.drag=SF?{axis:'xz',min:lo,max:hi,follow,depth,setDepth}:{axis:'x',min:lo,max:hi,follow};
    pills.push(p); g.add(p); });
  // اول لایه پشت، بعد لایه جلو (روی آن‌ها تکیه می‌کند)
  for(const p of [...pills].sort((a,b)=>a.userData.layer-b.userData.layer)) settle(p);
  // بررسی محلی: بیشترین فرورفتگی رأس‌های کوسن در مبل/کوسن دیگر (متر)
  if(location.hostname==='localhost') window.__pilCheck=()=>pills.map(p=>{ const F=field(p), pos=ST.get(p).mesh.geometry.attributes.position.array, e=(p.updateMatrix(),p.matrix.elements); let m=1;
    for(let k=0;k<pos.length;k+=3){ const x=pos[k],y=pos[k+1],z=pos[k+2]; m=Math.min(m,F.f(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14])); }
    return +m.toFixed(4); });
}
