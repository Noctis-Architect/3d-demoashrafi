/* کوسن‌های جدا و جابه‌جاشونده: روی پشتی تکیه داده می‌شوند و با کشیدن، در طول مبل جابه‌جا می‌شوند. */
import { THREE, slot } from './product.js';
import { V3, sweep } from './geo.js';

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
export function pillowMesh(w=0.45,h=0.45,t=0.17){ const key=[w,h,t].join();
  const G=PG[key]??=(()=>{ const n=44, ex=7;
    const rho=f=>Math.pow(Math.pow(Math.abs(Math.cos(f)),ex)+Math.pow(Math.abs(Math.sin(f)),ex),-1/ex);
    const outline=(f,r)=>{ const c=Math.cos(f), s_=Math.sin(f), q=r*rho(f), pinch=0.05*r*r*(1-Math.pow(Math.abs(c*s_)*2,0.5));
      return [q*c*w/2*(1-pinch), q*s_*h/2*(1-pinch)]; };
    const pos=[],uv=[],idx=[];
    for(const sd of [1,-1]){ const base=pos.length/3;
      for(let i=0;i<=n;i++) for(let j=0;j<=n;j++){ const u=-1+2*j/n, v=-1+2*i/n, r=Math.max(Math.abs(u),Math.abs(v)), f=Math.atan2(v,u);
        const [x,y]=outline(f,r), cs=Math.abs(Math.cos(f)*Math.sin(f))*2;
        let th=Math.pow(Math.max(0,1-Math.pow(r,3.2)),0.62)*(1-0.32*cs*cs*r*r);
        th*=1+0.07*(-y/(h/2)); th+=0.025*cs*cs*Math.pow(r,4)*Math.sin(22*(Math.abs(u)-Math.abs(v)))*(1-r);
        pos.push(x,y,sd*t/2*th*(sd>0?1:0.9)); uv.push(x+0.5,y+0.5); }
      for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const p=base+i*(n+1)+j,q=p+n+1; sd>0?idx.push(p,p+1,q,p+1,q+1,q):idx.push(p,q,p+1,p+1,q,q+1); } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    const ring=[]; for(let k=0;k<96;k++){ const [x,y]=outline(2*Math.PI*k/96,1); ring.push(V3(x,y,0)); }
    return {body:g,pipe:sweep(ring,[0.005],{closed:true,seg:192,radial:8})}; })();
  const o=new THREE.Group(); o.add(new THREE.Mesh(G.body,slot.pillows)); o.add(new THREE.Mesh(G.pipe,slot.pillows)); return o; }

export const PILLOW_COUNTS=[{v:'4',label:'۴ کوسن'},{v:'2',label:'۲ کوسن'},{v:'6',label:'۶ کوسن'},{v:'0',label:'بدون کوسن'}];
/* xmin..xmax: محدوده جابه‌جایی در طول پشتی؛ back: z جلوی پشتی (عدد، یا تابع x برای پشتی قوس‌دار)؛ seat: ارتفاع نشیمن.
   xs: جای پیش‌فرض کوسن‌ها (اختیاری). کوسن‌ها با کشیدن جابه‌جا می‌شوند و روی قوس پشتی می‌مانند. */
/* off: فاصله مرکز کوسن از جلوی پشتی؛ inner: جلوتر آمدن کوسن‌های وسط نسبت به کوسن‌های دو سر.
   seatFront (اختیاری، عدد یا تابع x): z لبه جلوی نشیمن → کوسن آزادانه روی نشیمن هم کشیده می‌شود و هرچه جلوتر بیاید خوابیده‌تر می‌شود. */
export function addPillows(g,count,{xmin=-0.9,xmax=0.9,back=-0.62,seat=0.47,size=0.46,h=null,xs=null,lean=0.42,off=0.09,inner=0.07,seatFront=null}={}){
  const H=h||size;
  const n=+count; if(!n) return;
  const B=typeof back==='function'?back:()=>back;
  xs=xs?.[n]||{2:[xmin,xmax],4:[xmin,xmin+0.4,xmax-0.4,xmax],6:[xmin,xmin+0.4,-0.22,0.22,xmax-0.4,xmax]}[n];
  const SF=seatFront==null?null:typeof seatFront==='function'?seatFront:()=>seatFront, T=H*0.42;
  const zBack=p=>B(p.position.x)+off+p.userData.front, zFront=p=>SF(p.position.x)-H/2-0.02;
  const place=(p)=>{ const x=p.position.x, d=(B(x+0.01)-B(x-0.01))/0.02, yaw=-Math.atan(d), u=p.userData, t=u.t||0, e=t*t*(3-2*t);
    p.position.z=SF?zBack(p)+(zFront(p)-zBack(p))*t:B(x)+off+u.front;
    p.position.y=seat+(H/2-0.02)*(1-e)+(T/2+0.04)*e;
    p.rotation.set(-(lean+(1.5-lean)*e),yaw+u.yaw*(1-e),u.roll*(1-e),'YXZ'); };
  // جلو/عقب: t=0 تکیه به پشتی، t=1 خوابیده لبه جلوی نشیمن
  const depth=p=>p.position.z, setDepth=(p,z)=>{ const a=zBack(p), b=zFront(p); p.userData.t=Math.max(0,Math.min(1,(z-a)/Math.max(0.01,b-a))); };
  // کوسن‌ها از هم رد نمی‌شوند: کوسن کشیده‌شده کنار کوسن دیگر می‌ایستد (روی پشتی کمی هم‌پوشانی مثل عکس مجاز است)
  const GX=size*0.66, GZ=0.22, lo=xmin-0.03, hi=xmax+0.03;
  const hits=p=>(p.parent?.children||[]).filter(o=>o!==p&&o.name==='pillow'&&Math.abs(o.position.x-p.position.x)<GX&&Math.abs(o.position.z-p.position.z)<GZ);
  const follow=p=>{ const u=p.userData; place(p);
    for(let k=0;k<3;k++){ const h=hits(p); if(!h.length) break; const o=h[0], sgn=Math.sign(p.position.x-o.position.x)||1;
      let nx=o.position.x+sgn*GX; if(nx<lo||nx>hi) nx=o.position.x-sgn*GX; p.position.x=Math.max(lo,Math.min(hi,nx)); place(p); }
    if(hits(p).length&&u.lastX!=null){ p.position.x=u.lastX; u.t=u.lastT; place(p); }
    u.lastX=p.position.x; u.lastT=u.t; };
  xs.forEach(x=>{ const p=pillowMesh(size,H,H*0.42); p.name='pillow';
    const end=Math.abs(x)>Math.max(Math.abs(xmin),Math.abs(xmax))-0.05;
    p.userData.front=end?0:inner; p.userData.yaw=end?-Math.sign(x)*0.35:Math.sign(x)*0.12; p.userData.roll=end?Math.sign(x)*0.06:-Math.sign(x)*0.04;
    p.position.x=x; place(p);
    p.userData.drag=SF?{axis:'xz',min:lo,max:hi,follow,depth,setDepth}:{axis:'x',min:lo,max:hi,follow};
    g.add(p); });
}
