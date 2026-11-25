/* کاناپه کلاسیک «اشرافی» (سبک لویی پانزدهم): قاب گردویی براق با کنده‌کاری برجسته، مخمل خردلی، تشک دمسک.
   کنده‌کاری‌ها نقش برجسته واقعی‌اند: روی بوم نقشه ارتفاع کشیده می‌شوند (صدف، برگ کنگری، طومار، گل) و
   شبکه ریز روی سطح قاب با همان ارتفاع جابه‌جا می‌شود؛ گودی‌ها با رنگ رأسی تیره‌تر (مثل پتینه لای کنده‌کاری). */
import { THREE, slot } from './product.js';
import { V3, sweep, SE, mesh, MOBILE, rrect, slabY, tex, loadImg, neutral } from './geo.js';

/* ================= ابعاد (متر) ================= */
export const DIM={ W:2.2, D:0.9, H:1.08 };
const SEAT_Y=0.275;          // بالای تیر چوبی نشیمن
const DECK_Y=0.335;          // کف نشیمن زیر تشک
const ZB=-0.40;              // خط قاب پشتی

/* ================= ابزار سطح ================= */
/* شبکه از ردیف‌های نقطه (rows[i][j]) با UV به متر و نرمال نرم */
function sheet(rows,{closed=false,flip=false}={}){
  const R=rows.length, C0=rows[0].length, C=C0+(closed?1:0), pos=new Float32Array(R*C*3), uv=new Float32Array(R*C*2), idx=[];
  const at=(i,j)=>rows[i][j%C0];
  for(let i=0;i<R;i++){ let u=0; for(let j=0;j<C;j++){ const p=at(i,j); if(j) u+=p.distanceTo(at(i,j-1)); const k=i*C+j; pos.set([p.x,p.y,p.z],k*3); uv[k*2]=u; } }
  for(let j=0;j<C;j++){ let v=0; for(let i=0;i<R;i++){ if(i) v+=at(i,j).distanceTo(at(i-1,j)); uv[(i*C+j)*2+1]=v; } }
  for(let i=0;i<R-1;i++) for(let j=0;j<C-1;j++){ const p=i*C+j, q=p+C; flip?idx.push(p,p+1,q,p+1,q+1,q):idx.push(p,q,p+1,p+1,q,q+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  if(closed){ const n=g.attributes.normal; for(let i=0;i<R;i++){ const a=i*C, b=i*C+C-1, v=V3(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize(); n.setXYZ(a,v.x,v.y,v.z); n.setXYZ(b,v.x,v.y,v.z); } }
  return g; }

/* قاب‌های حرکت روی منحنی: T مماس، F رو به جلو/داخل (افقی)، U = F×T (رو به بالا) */
function frames(pts,N,{outward=false}={}){
  const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal'), P=curve.getSpacedPoints(N), L=curve.getLength(), out=[];
  for(let i=0;i<=N;i++){ const T=P[Math.min(N,i+1)].clone().sub(P[Math.max(0,i-1)]).normalize();
    let F=V3(-T.z,0,T.x); if(outward) F.negate(); F.addScaledVector(T,-F.dot(T)).normalize();
    out.push({P:P[i],T,F,U:F.clone().cross(T).normalize(),s:i*L/N}); }
  out.L=L; out.N=N;
  out.at=s=>{ const f=Math.max(0,Math.min(N,s/L*N)), i=Math.min(N-1,Math.floor(f)), k=f-i, a=out[i], b=out[i+1], m=(x,y)=>x.clone().lerp(y,k);
    return {P:m(a.P,b.P),T:m(a.T,b.T).normalize(),F:m(a.F,b.F).normalize(),U:m(a.U,b.U).normalize()}; };
  return out; }
/* پروفیل بسته (f رو به جلو، u رو به بالا؛ پادساعت‌گرد) در طول منحنی */
function railGeo(fr,prof,from=0,to=fr.N){
  const rows=[]; for(let i=from;i<=to;i++){ const {P,F,U}=fr[i]; rows.push(prof.map(([f,u])=>P.clone().addScaledVector(F,f).addScaledVector(U,u))); }
  return sheet(rows,{closed:true}); }
/* جلوترین f پروفیل در ارتفاع u (کنده‌کاری روی همین سطح می‌نشیند) */
function frontOf(prof,top,below,above){ const ch=prof.slice(0,top+1).filter(p=>p[0]>-0.005);
  return u=>{ if(u<=ch[0][1]) return below; if(u>=ch[ch.length-1][1]) return above;
    let best=-1; for(let i=0;i<ch.length-1;i++){ const [f0,u0]=ch[i], [f1,u1]=ch[i+1]; if((u-u0)*(u-u1)<=0&&u1!==u0) best=Math.max(best,f0+(f1-f0)*(u-u0)/(u1-u0)); } return best; }; }

/* ================= نقش برجسته روی بوم ================= */
const DOME=[[0,1],[0.25,0.968],[0.45,0.893],[0.6,0.8],[0.72,0.694],[0.82,0.572],[0.9,0.436],[0.96,0.28],[1,0]];
class Carve{
  constructor(x0,x1,y0,y1,ppm=MOBILE?1500:2400){ Object.assign(this,{x0,x1,y0,y1,ppm});
    const c=this.c=document.createElement('canvas'); c.width=Math.ceil((x1-x0)*ppm); c.height=Math.ceil((y1-y0)*ppm);
    const x=this.x=c.getContext('2d',{willReadFrequently:true}); x.fillStyle='#000'; x.fillRect(0,0,c.width,c.height); x.globalCompositeOperation='lighten'; }
  px(X,Y){ return [(X-this.x0)*this.ppm,(this.y1-Y)*this.ppm]; }
  dome(X,Y,r,h){ const [a,b]=this.px(X,Y), R=r*this.ppm; if(R<0.6||h<=0) return; const g=this.x.createRadialGradient(a,b,0,a,b,R);
    for(const [t,v] of DOME){ const c=Math.round(255*Math.min(1,h)*v); g.addColorStop(t,`rgb(${c},${c},${c})`); }
    this.x.fillStyle=g; this.x.beginPath(); this.x.arc(a,b,R,0,6.2832); this.x.fill(); }
  /* لوله برجسته روی خط (نقاط [X,Y])؛ r و h عدد یا تابع t∈[0,1] */
  tube(pts,r,h){ const P=smooth(pts), L=[0]; for(let i=1;i<P.length;i++) L.push(L[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    const tot=L[L.length-1], R=typeof r==='function'?r:()=>r, H=typeof h==='function'?h:()=>h; let k=0;
    for(let d=0;d<=tot;){ while(k<P.length-2&&L[k+1]<d) k++; const f=(d-L[k])/Math.max(1e-9,L[k+1]-L[k]), t=d/tot;
      const X=P[k][0]+(P[k+1][0]-P[k][0])*f, Y=P[k][1]+(P[k+1][1]-P[k][1])*f, rr=R(t);
      this.dome(X,Y,rr,H(t)); d+=Math.max(0.25/this.ppm,rr*0.22); } }
  /* شیار (رگبرگ، لای پره‌های صدف): ارتفاع زیرش ضرب در k می‌شود */
  groove(pts,w,k=0.6){ const x=this.x; x.save(); x.globalCompositeOperation='multiply'; const c=Math.round(255*k); x.strokeStyle=`rgb(${c},${c},${c})`;
    x.lineWidth=Math.max(1,w*this.ppm); x.lineCap='round'; x.lineJoin='round'; x.beginPath(); smooth(pts).forEach(([X,Y],i)=>{ const [a,b]=this.px(X,Y); i?x.lineTo(a,b):x.moveTo(a,b); }); x.stroke(); x.restore(); }
  /* ارتفاع نرم‌شده + میانگین پهن‌تر (برای تیره‌کردن گودی‌ها) */
  done(){ const {c}=this, w=c.width, h=c.height, b=(r)=>{ const t=document.createElement('canvas'); t.width=w; t.height=h; const x=t.getContext('2d',{willReadFrequently:true}); x.filter=`blur(${r}px)`; x.drawImage(c,0,0); return x.getImageData(0,0,w,h).data; };
    const s=b(Math.max(0.6,this.ppm/2400)), l=b(this.ppm*0.0028), H=new Float32Array(w*h), A=new Float32Array(w*h);
    for(let i=0;i<w*h;i++){ H[i]=s[i*4]/255; A[i]=l[i*4]/255; } this.H=H; this.A=A; this.w=w; this.h=h; return this; }
  sample(arr,X,Y){ const fx=(X-this.x0)*this.ppm-0.5, fy=(this.y1-Y)*this.ppm-0.5, w=this.w, h=this.h;
    const i=Math.max(0,Math.min(w-2,Math.floor(fx))), j=Math.max(0,Math.min(h-2,Math.floor(fy))), a=Math.max(0,Math.min(1,fx-i)), b=Math.max(0,Math.min(1,fy-j));
    if(fx<-1||fy<-1||fx>w||fy>h) return 0;
    return (arr[j*w+i]*(1-a)+arr[j*w+i+1]*a)*(1-b)+(arr[(j+1)*w+i]*(1-a)+arr[(j+1)*w+i+1]*a)*b; }
}
const smooth=pts=>{ if(pts.length<3) return pts; const c=new THREE.CatmullRomCurve3(pts.map(([x,y])=>V3(x,y,0)),false,'centripetal');
  return c.getSpacedPoints(Math.max(8,Math.ceil(c.getLength()/0.0008))).map(p=>[p.x,p.y]); };
const spiral=(cx,cy,r0,r1,a0,a1,n=40)=>Array.from({length:n+1},(_,i)=>{ const t=i/n, a=a0+(a1-a0)*t, r=r0+(r1-r0)*t; return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; });
const mir=(pts,s)=>pts.map(([x,y])=>[x*s,y]);
const leafR=(w,b=0.6)=>t=>w*Math.pow(Math.sin(Math.PI*Math.min(1,t)),b)+w*0.08;

/* نقش برجسته → مش. map(X,Y) نقطه و نرمال سطح زیرین را می‌دهد. back: پشت تخت برای قطعه‌های آویزان */
function reliefGeo(C,depth,map,{step=MOBILE?0.0026:0.0016,back=false,mirror=false,eps=0.0004}={}){
  const nx=Math.ceil((C.x1-C.x0)/step), ny=Math.ceil((C.y1-C.y0)/step), W=nx+1, hv=new Float32Array(W*(ny+1)), av=new Float32Array(W*(ny+1));
  for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){ const X=C.x0+i*(C.x1-C.x0)/nx, Y=C.y0+j*(C.y1-C.y0)/ny; hv[j*W+i]=C.sample(C.H,X,Y); av[j*W+i]=C.sample(C.A,X,Y); }
  const id=new Int32Array(W*(ny+1)).fill(-1), pos=[], col=[], uv=[], ix=[], base=[], nrm=[];
  const vert=(i,j)=>{ const k=j*W+i; if(id[k]>=0) return id[k]; const X=C.x0+i*(C.x1-C.x0)/nx, Y=C.y0+j*(C.y1-C.y0)/ny, h=hv[k], {p,n}=map(mirror?-X:X,Y);
    const q=p.clone().addScaledVector(n,eps+h*depth); pos.push(q.x,q.y,q.z); uv.push(X,Y); base.push(p.x+n.x*eps*0.5,p.y+n.y*eps*0.5,p.z+n.z*eps*0.5); nrm.push(-n.x,-n.y,-n.z);
    // پتینه: لای کنده‌کاری و پای برجستگی تیره، سر برجستگی کمی روشن (ساییده)
    const cav=Math.max(0,Math.min(1,(av[k]-h)*5)), c=Math.min(1,(1-0.62*cav)*(0.8+0.3*Math.min(1,h*1.6)));
    col.push(c,c*0.97,c*0.95); return id[k]=pos.length/3-1; };
  const cells=[];
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const k=j*W+i; if(Math.max(hv[k],hv[k+1],hv[k+W],hv[k+W+1])<0.012) continue;
    const a=vert(i,j), b=vert(i+1,j), c=vert(i,j+1), d=vert(i+1,j+1); mirror?ix.push(a,c,b,b,c,d):ix.push(a,b,c,c,b,d); cells.push(a,b,c,d); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(ix); g.computeVertexNormals();
  if(!back) return g;
  // پشت تخت (فقط زیر قسمت‌های برجسته) با نرمال رو به عقب
  const n0=pos.length/3, P2=[...pos,...base], N2=[...g.attributes.normal.array,...nrm], C2=[...col,...col.map(()=>0.55)], U2=[...uv,...uv], I2=[...ix];
  for(let q=0;q<cells.length;q+=4){ const [a,b,c,d]=cells.slice(q,q+4).map(v=>v+n0); mirror?I2.push(a,b,c,c,b,d):I2.push(a,c,b,b,c,d); }
  const h=new THREE.BufferGeometry(); h.setAttribute('position',new THREE.Float32BufferAttribute(P2,3)); h.setAttribute('normal',new THREE.Float32BufferAttribute(N2,3));
  h.setAttribute('color',new THREE.Float32BufferAttribute(C2,3)); h.setAttribute('uv',new THREE.Float32BufferAttribute(U2,2)); h.setIndex(I2); return h; }

/* ================= نقش‌ها ================= */
/* صدف بادبزنی: پایه (cx,cy)، dir=1 رو به بالا، -1 رو به پایین */
function shell(C,cx,cy,size,{dir=1,n=9,spread=2.5,h=0.95,lip=true,fat=1}={}){
  const lobe=[];
  for(let k=0;k<n;k++){ const t=k/(n-1)-0.5, a=t*spread, L=size*(1-0.42*Math.pow(Math.abs(2*t),1.6)), dx=Math.sin(a), dy=Math.cos(a)*dir;
    const p0=[cx+dx*size*0.14,cy+dy*size*0.14], p1=[cx+dx*L*0.6+dx*0.002,cy+dy*L*0.6], p2=[cx+dx*L,cy+dy*L];
    lobe.push([dx,dy,L]);
    C.tube([p0,p1,p2],t2=>size*0.085*fat*(0.35+0.75*Math.pow(t2,0.7))*(t2>0.86?Math.sqrt(Math.max(0,1-Math.pow((t2-0.86)/0.14,2))):1),t2=>h*(0.62+0.38*t2)); }
  // شیار میان پره‌ها و لبه کنگره‌ای
  for(let k=0;k<n-1;k++){ const t=(k+0.5)/(n-1)-0.5, a=t*spread, L=size*(1-0.42*Math.pow(Math.abs(2*t),1.6))*0.92, dx=Math.sin(a), dy=Math.cos(a)*dir;
    C.groove([[cx+dx*size*0.2,cy+dy*size*0.2],[cx+dx*L*0.55,cy+dy*L*0.55],[cx+dx*L,cy+dy*L]],size*0.022,0.55); }
  for(const [dx,dy,L] of lobe) C.groove([[cx+dx*L*0.35,cy+dy*L*0.35],[cx+dx*L*0.8,cy+dy*L*0.8]],size*0.01,0.82);
  if(lip) C.tube(spiral(cx,cy,size*0.2,size*0.2,dir>0?Math.PI*1.08:Math.PI*0.08,dir>0?-0.08:-Math.PI*1.08+Math.PI*2.16,30),size*0.05,h*0.7);
  C.dome(cx,cy,size*0.16,h*0.78); }
/* برگ کنگری (آکانتوس) روی ستون فقرات pts با لبه کنگره‌دار و رگبرگ */
function acanthus(C,pts,w,h,{lobes=4,curl=0}={}){
  const P=smooth(pts); C.tube(pts,leafR(w,0.45),t=>h*(0.75+0.25*Math.sin(Math.PI*t)));
  for(let k=1;k<=lobes;k++){ const t=k/(lobes+1), i=Math.floor(t*(P.length-1)), [x0,y0]=P[Math.max(0,i-2)], [x1,y1]=P[Math.min(P.length-1,i+2)], l=Math.hypot(x1-x0,y1-y0)||1, nx=-(y1-y0)/l, ny=(x1-x0)/l, r=w*Math.pow(Math.sin(Math.PI*t),0.45);
    for(const s of [-1,1]) C.dome(P[i][0]+nx*s*r*0.85+(x1-x0)/l*w*0.25,P[i][1]+ny*s*r*0.85+(y1-y0)/l*w*0.25,r*0.5,h*0.7); }
  C.groove(P.slice(Math.floor(P.length*0.08),Math.floor(P.length*0.9)),w*0.16,0.68);
  if(curl){ const [x,y]=P[P.length-1], [xa,ya]=P[P.length-6]||P[0], a=Math.atan2(y-ya,x-xa); const cx=x+Math.cos(a+curl*Math.PI/2)*w*0.9, cy=y+Math.sin(a+curl*Math.PI/2)*w*0.9;
    C.tube(spiral(cx,cy,w*0.9,w*0.25,a-curl*Math.PI/2,a-curl*Math.PI/2+curl*Math.PI*1.6,24),t=>w*0.55*(1-0.5*t),h*0.9); } }
/* برگ ساده بادامی با رگبرگ */
function leaf(C,x,y,ang,len,w,h){ const p=[[x,y],[x+Math.cos(ang)*len*0.5,y+Math.sin(ang)*len*0.5+w*0.25],[x+Math.cos(ang)*len,y+Math.sin(ang)*len]];
  C.tube(p,leafR(w,0.7),t=>h*(0.6+0.4*Math.sin(Math.PI*t))); C.groove([p[0],p[1],[x+Math.cos(ang)*len*0.85,y+Math.sin(ang)*len*0.85]],w*0.18,0.7); }
/* شاخه مواج با برگ‌های یک‌درمیان و غنچه لاله‌ای در انتها (دو طرف تاج) */
function spray(C,s,x0,x1,y,amp,{h=0.55,stem=0.0028,leafLen=0.024,leafW=leafLen*0.24,bud=true}={}){
  const pts=[]; for(let i=0;i<=24;i++){ const t=i/24, x=x0+(x1-x0)*t; pts.push([s*x,y+amp*Math.sin(t*Math.PI*2.2+0.4)]); }
  C.tube(pts,t=>stem*(1-0.35*t),h);
  const n=Math.round(Math.abs(x1-x0)/(leafLen*1.05));
  for(let k=1;k<n;k++){ const t=k/n, x=x0+(x1-x0)*t, yy=y+amp*Math.sin(t*Math.PI*2.2+0.4), up=k%2?1:-1;
    leaf(C,s*x,yy,(s>0?0:Math.PI)+s*up*0.75,leafLen*(1-0.25*t),leafW*(1-0.2*t),h*1.15); }
  if(bud){ const x=s*x1, yy=y+amp*Math.sin(Math.PI*2.2+0.4), d=s;
    const B=leafLen/0.024; for(const a of [-0.55,0,0.55]) C.tube([[x,yy],[x+d*0.012*B*Math.cos(a),yy+0.012*B*Math.sin(a)],[x+d*0.022*B*Math.cos(a),yy+0.02*B*Math.sin(a)]],leafR(0.0048*B,0.5),h*1.2);
    C.dome(x,yy,0.005*B,h*1.1); } }
/* گل شش‌پر با دکمه وسط */
function flower(C,x,y,R,h,{n=6,rot=0.3}={}){
  for(let k=0;k<n;k++){ const a=rot+k*2*Math.PI/n; C.tube([[x+Math.cos(a)*R*0.2,y+Math.sin(a)*R*0.2],[x+Math.cos(a)*R*0.62,y+Math.sin(a)*R*0.62],[x+Math.cos(a)*R,y+Math.sin(a)*R]],t=>R*0.32*Math.pow(Math.sin(Math.PI*(0.15+0.8*t)),0.6),h*0.82);
    C.groove([[x+Math.cos(a)*R*0.3,y+Math.sin(a)*R*0.3],[x+Math.cos(a)*R*0.85,y+Math.sin(a)*R*0.85]],R*0.06,0.75); }
  C.dome(x,y,R*0.3,h); C.groove(spiral(x,y,R*0.16,R*0.16,0,6.28,16),R*0.05,0.8); }
/* طومار C شکل با چشم */
function cscroll(C,cx,cy,r,a0,turn,w,h){ C.tube(spiral(cx,cy,r,r*0.3,a0,a0+turn,36),t=>w*(1-0.45*t),h); C.dome(...spiral(cx,cy,r,r*0.3,a0,a0+turn,1)[1],w*0.75,h*1.05); }

/* ---- ترکیب‌ها (مطابق عکس‌ها) ---- */
/* تاج وسط پشتی (عکس اول): صدف بادبزنی پهن بالای قاب، برگ‌های کنگری درشت دو طرف پای صدف،
   دو طومار پشت‌به‌پشت زیر صدف، شاخه‌های برگ‌دار پرپشت تا دو طرف با غنچه لاله‌ای */
function crestArt(){ const C=new Carve(-0.47,0.47,-0.034,0.1);
  shell(C,0,-0.012,0.108,{n:11,spread:2.8,h:1,fat:1.75});
  for(const s of [-1,1]){
    cscroll(C,s*0.017,-0.025,0.009,s>0?Math.PI*1.1:-0.1,s*-4.4,0.0052,1);                       // دو طومار زیر صدف
    acanthus(C,[[s*0.014,-0.004],[s*0.045,0.0],[s*0.072,0.012],[s*0.086,0.03]],0.0145,1,{lobes:5,curl:s>0?1:-1});   // برگ بالا رو به بیرون و بالا
    acanthus(C,[[s*0.02,-0.02],[s*0.055,-0.024],[s*0.092,-0.018],[s*0.125,-0.006]],0.0115,0.95,{lobes:5,curl:s>0?-1:1}); // برگ پایین رو به بیرون
    acanthus(C,[[s*0.1,0.006],[s*0.12,0.012],[s*0.142,0.006],[s*0.15,-0.006]],0.007,0.85,{lobes:3});
    cscroll(C,s*0.156,-0.012,0.0095,s>0?Math.PI*0.6:Math.PI*0.4,s>0?-4.4:4.4,0.0048,0.9);
    spray(C,s,0.17,0.44,-0.006,0.007,{h:0.75,stem:0.0042,leafLen:0.034,leafW:0.0095});
  }
  return C.done(); }
/* نقش کناری پشتی (عکس سوم): برگ طوماری، روبان ضربدری، گل شش‌پر، برگ دنباله‌دار */
function sideArt(){ const C=new Carve(-0.15,0.15,-0.031,0.018);
  acanthus(C,[[-0.14,-0.014],[-0.11,-0.002],[-0.075,-0.008],[-0.045,-0.002]],0.0095,0.95,{lobes:4,curl:-1});
  C.tube([[-0.056,-0.022],[-0.04,-0.005],[-0.022,0.01]],0.0058,1); C.tube([[-0.056,0.01],[-0.04,-0.005],[-0.02,-0.021]],0.0058,0.9);   // روبان X
  acanthus(C,[[-0.026,-0.016],[0.0,-0.014],[0.02,-0.006]],0.0075,0.85,{lobes:3});
  flower(C,0.04,-0.006,0.0165,1.05);
  acanthus(C,[[0.058,-0.004],[0.085,0.0],[0.115,0.004],[0.145,0.0]],0.008,0.9,{lobes:4});
  leaf(C,0.06,-0.016,-0.2,0.04,0.0085,0.85);
  return C.done(); }
/* گل کوچک کنار گوشه پشتی */
function cornerArt(){ const C=new Carve(-0.085,0.085,-0.031,0.018);
  flower(C,0,-0.006,0.0145,1.05,{n:5});
  for(const s of [-1,1]){ leaf(C,s*0.014,-0.004,s>0?0.2:Math.PI-0.2,0.045,0.0085,0.9); leaf(C,s*0.012,-0.016,s>0?-0.3:Math.PI+0.3,0.038,0.007,0.8); C.tube(mir([[0.05,-0.006],[0.064,0.003],[0.08,-0.004]],s),0.0035,0.65); }
  return C.done(); }
/* تیر نشیمن: صدف آویزان با برگ‌ها و شاخه دو طرف */
function apronShellArt(){ const C=new Carve(-0.22,0.22,-0.085,0.026);
  shell(C,0,-0.002,0.07,{dir:-1,n:9,spread:2.3,h:1,fat:1.65});
  for(const s of [-1,1]){
    acanthus(C,[[s*0.014,0.006],[s*0.045,0.01],[s*0.07,0.002],[s*0.08,-0.016]],0.01,1,{lobes:5,curl:s>0?-1:1});
    cscroll(C,s*0.036,-0.034,0.01,Math.PI*0.5,s>0?-4:4,0.0048,0.9);
    spray(C,s,0.095,0.21,0.0,0.005,{h:0.75,leafLen:0.028,leafW:0.008,stem:0.0034});
  }
  return C.done(); }
/* وسط تیر نشیمن (روی پایه وسط): کارتوش با صدف کوچک */
function apronCenterArt(){ const C=new Carve(-0.12,0.12,-0.075,0.026);
  shell(C,0,0.008,0.05,{dir:-1,n:7,spread:2.2,h:0.95,fat:1.6});
  for(const s of [-1,1]){ cscroll(C,s*0.028,0.01,0.011,s>0?Math.PI:0,s>0?-4.2:4.2,0.0052,0.95);
    acanthus(C,[[s*0.036,-0.004],[s*0.065,0.004],[s*0.092,0.0],[s*0.11,0.007]],0.0075,0.85,{lobes:3}); }
  return C.done(); }
/* زانوی پایه: برگ کنگری آویزان + رگه وسط تا مچ */
function kneeArt(){ const C=new Carve(-0.032,0.032,0.03,0.27, MOBILE?1500:2400);
  acanthus(C,[[0,0.262],[0,0.235],[0.0,0.2],[0,0.175]],0.012,1,{lobes:4});
  for(const s of [-1,1]) acanthus(C,[[s*0.004,0.255],[s*0.016,0.232],[s*0.02,0.205]],0.006,0.8,{lobes:2,curl:s>0?1:-1});
  C.tube([[0,0.175],[0,0.13],[0,0.08],[0,0.05]],t=>0.0032*(1-0.4*t),0.55);
  leaf(C,0,0.05,-Math.PI/2,0.022,0.0055,0.8);
  return C.done(); }

/* ================= پایه کابریول ================= */
/* مقطع افقی گردگوشه با تیزی جلو؛ A رو به بیرون پایه */
const LEG=[[0.275,0,0.026],[0.235,0.01,0.028],[0.2,0.026,0.027],[0.16,0.021,0.021],[0.12,0.005,0.0165],[0.08,-0.008,0.014],[0.05,-0.012,0.0135],[0.03,-0.004,0.015],[0.016,0.008,0.018],[0.006,0.012,0.019],[0,0.012,0.016]];
const legCurve=new THREE.CatmullRomCurve3(LEG.map(([y,a,r])=>V3(a,y,r)),false,'centripetal');
function legAt(y){ // a (جابجایی رو به جلو) و r در ارتفاع y
  let lo=0,hi=1; for(let k=0;k<30;k++){ const m=(lo+hi)/2; legCurve.getPoint(m).y>y?lo=m:hi=m; } const p=legCurve.getPoint((lo+hi)/2); return [p.x,p.z]; }
const legR=(y,th)=>{ const [,r]=legAt(y), e=0.62, c=Math.abs(Math.cos(th)), s=Math.abs(Math.sin(th)); return r/Math.pow(Math.pow(c,2/e)+Math.pow(s,2/e),e/2)*(1+0.1*Math.exp(-th*th/0.06)); };
function legGeo(){ const rows=[], NY=48, NA=40;
  for(let i=0;i<=NY;i++){ const y=0.275*i/NY, [a]=legAt(y), row=[];
    for(let j=0;j<NA;j++){ const th=2*Math.PI*j/NA, r=legR(y,th); row.push(V3(-Math.sin(th)*r,y,a+Math.cos(th)*r)); }   // A=+z، B=A×Y=−x
    rows.push(row); }
  return sheet(rows,{closed:true}); }
/* نقطه سطح پایه برای نقش زانو (مختصات محلی پایه: جلو +z) */
const legMap=(X,Y)=>{ const [a]=legAt(Y), r0=legAt(Y)[1], th=-X/r0, r=legR(Y,th), n=V3(-Math.sin(th),0,Math.cos(th)); return {p:V3(-Math.sin(th)*r,Y,a+Math.cos(th)*r),n}; };
/* پنجه طوماری جلوی پا */
function footScroll(){ const pts=[], c=V3(0,0.026,0.026); for(let i=0;i<=30;i++){ const t=i/30, a=Math.PI*0.5+t*Math.PI*1.7, r=0.016*(1-0.6*t); pts.push(V3(0,c.y+Math.sin(a)*r,c.z-Math.cos(a)*r*-1)); }
  return sweep(pts,[0.012,0.009,0.006],{seg:50,radial:14,e:0.7,flat:0.9}); }

/* ================= ساخت مدل ================= */
const GEO={};
/* کنده‌کاری‌های لوله‌ای رنگ رأسی ندارند؛ سفید (بدون پتینه) تا با ماده carve سیاه نشوند */
const white=g=>{ const n=g.attributes.position.count, c=new Float32Array(n*3).fill(0.92); g.setAttribute('color',new THREE.BufferAttribute(c,3)); return g; };
export function buildLouis(){ if(GEO.g) return GEO.g.clone();
  const g=new THREE.Group(), add=(geo,m,x=0,y=0,z=0)=>{ const o=mesh(geo,m,x,y,z); g.add(o); return o; };

  /* ---- قاب بالا: از سر دسته چپ تا سر دسته راست، یکپارچه ---- */
  const L=[[-1.062,0.588,0.352],[-1.052,0.625,0.26],[-1.035,0.70,0.11],[-1.015,0.795,-0.06],[-0.998,0.87,-0.215],[-0.978,0.912,-0.32],[-0.93,0.932,-0.378],
    [-0.84,0.94,ZB],[-0.72,0.952,ZB],[-0.6,0.958,ZB],[-0.48,0.952,ZB],[-0.38,0.958,ZB],[-0.27,0.982,ZB],[-0.14,1.012,ZB],[0,1.026,ZB]];
  const topPts=[...L,...L.slice(0,-1).reverse().map(([x,y,z])=>[-x,y,z])].map(p=>V3(...p));
  const TF=frames(topPts,MOBILE?520:820);
  const TP=[[-0.022,-0.032],[0.012,-0.032],[0.018,-0.0305],[0.021,-0.027],[0.0205,-0.023],[0.019,-0.021],[0.019,0.009],[0.0172,0.0125],[0.0188,0.0158],
    [0.0228,0.0188],[0.0258,0.0228],[0.0256,0.0278],[0.0215,0.0318],[0.014,0.035],[0.004,0.0364],[-0.008,0.0352],[-0.017,0.0312],[-0.0222,0.025],[-0.0242,0.016],[-0.0242,-0.028]];
  add(railGeo(TF,TP),slot.wood);
  const tfront=frontOf(TP,14,0.012,0.006);
  const topMap=(sc,mir)=>(X,Y)=>{ const f=TF.at(sc+X); return {p:f.P.clone().addScaledVector(f.U,Y).addScaledVector(f.F,tfront(Y)),n:f.F}; };
  const mid=TF.L/2, sAt=x=>{ let best=0,bd=9; for(const f of TF){ const d=Math.abs(f.P.x-x)+(f.P.z>ZB+0.01?1:0); if(d<bd){bd=d;best=f.s;} } return best; };
  GEO.crest??=crestArt(); GEO.side??=sideArt(); GEO.corner??=cornerArt();
  add(reliefGeo(GEO.crest,0.014,topMap(mid),{back:true}),slot.carve);
  for(const s of [-1,1]){ const sc=sAt(s*0.55), sk=sAt(s*0.84);
    add(reliefGeo(GEO.side,0.008,topMap(sc),{mirror:s<0}),slot.carve);
    add(reliefGeo(GEO.corner,0.008,topMap(sk),{mirror:s<0}),slot.carve); }

  /* ---- سر دسته: طومار بزرگ + برگ‌های آویزان؛ ستون دسته تا تیر نشیمن ---- */
  for(const s of [-1,1]){ const e=s<0?TF[0]:TF[TF.N], fw=e.T.clone().multiplyScalar(s<0?-1:1).setY(0).normalize(), up=V3(0,1,0), side=V3(s,0,0);
    const c=e.P.clone().addScaledVector(fw,0.016).addScaledVector(up,-0.018), vol=[];
    for(let i=0;i<=44;i++){ const t=i/44, a=Math.PI*0.62-t*Math.PI*2.4, r=0.038*(1-0.64*t); vol.push(c.clone().addScaledVector(fw,Math.cos(a)*r).addScaledVector(up,Math.sin(a)*r).addScaledVector(side,0.008*t)); }
    add(white(sweep(vol,[0.03,0.026,0.02,0.014,0.009],{seg:80,radial:20,e:0.75,flat:0.9})),slot.carve);
    // برگ‌های کنگری پرپشت روی سر دسته که رو به پایین و بیرون می‌ریزند (مثل عکس)
    for(const [dx,len,w,out] of [[-0.022,0.075,0.012,0.6],[0,0.1,0.015,0.2],[0.022,0.08,0.012,-0.2],[-0.012,0.05,0.01,1],[0.014,0.055,0.01,-0.8]]){
      const p0=c.clone().addScaledVector(fw,0.034).addScaledVector(side,dx).addScaledVector(up,0.018), lp=[];
      for(let i=0;i<=12;i++){ const t=i/12; lp.push(p0.clone().addScaledVector(fw,0.016*Math.sin(Math.PI*t)+0.002-0.01*t).addScaledVector(up,-len*t).addScaledVector(side,(dx*0.5-out*0.01)*t*s)); }
      add(white(sweep(lp,[w*0.4,w,w*0.9,w*0.35],{seg:36,radial:12,e:0.7,flat:0.5,bead:0.3,period:0.011})),slot.carve); }
    // ستون جلوی دسته: تقریباً عمودی زیر سر دسته تا گوشه تیر نشیمن (لبه جلوی بال)
    const post=[c.clone().addScaledVector(up,-0.03),V3(s*1.06,0.5,0.364),V3(s*1.05,0.42,0.372),V3(s*1.04,0.34,0.378),V3(s*1.032,0.262,0.382)];
    add(sweep(post,[0.026,0.022,0.021,0.023,0.027],{seg:60,radial:20,e:0.7}),slot.wood);
    const PC=new THREE.CatmullRomCurve3(post), trail=[]; for(let i=0;i<=10;i++){ const t=i/10, p=PC.getPoint(0.12+0.72*t), tg=PC.getTangent(0.12+0.72*t), n=V3(0,0,1).addScaledVector(tg,-tg.z).normalize(); trail.push(p.addScaledVector(n,0.022)); }
    add(white(sweep(trail,[0.0045,0.0075,0.0065,0.005,0.0035],{seg:70,radial:10,bead:0.6,period:0.017,flat:0.65})),slot.carve); }

  /* ---- رویه داخل پشتی و دسته‌ها (یکپارچه، کمی پف‌دار) + قیطان زیر قاب ---- */
  const NV=26, inRows=[], outRows=[], weltIn=[], weltOut=[];
  for(let i=0;i<=TF.N;i+=2){ const {P,F,U,s:si}=TF[i], tp=Math.min(1,Math.min(si,TF.L-si)/0.22), tk=tp*tp*(3-2*tp), top=P.clone().addScaledVector(U,-0.03).addScaledVector(F,0.008), wing=Math.abs(F.z)<0.7;
    const bot=V3(top.x,DECK_Y-0.02,top.z).addScaledVector(F,wing?0.012+0.025*tk:0.075), row=[];
    for(let k=0;k<=NV;k++){ const v=k/NV, q=top.clone().lerp(bot,v); q.addScaledVector(F,(0.006+0.034*tk)*Math.pow(Math.sin(Math.PI*Math.min(1,v*1.15)),0.7)+0.012*Math.sin(Math.PI*Math.min(1,v*8))); row.push(q); }
    inRows.push(row); weltIn.push(top.clone().addScaledVector(F,0.006).addScaledVector(U,0.002));
    const ot=P.clone().addScaledVector(U,-0.03).addScaledVector(F,-0.018), ob=V3(Math.max(-1.032,Math.min(1.032,ot.x)),SEAT_Y-0.004,Math.max(ZB-0.012,ot.z)), orow=[];
    for(let k=0;k<=NV;k++){ const v=k/NV, q=ot.clone().lerp(ob,v); q.addScaledVector(F,-0.008*Math.sin(Math.PI*v)); orow.push(q); }
    outRows.push(orow); weltOut.push(ot.clone().addScaledVector(F,-0.004)); }
  add(sheet(inRows,{flip:true}),slot.velvet); add(sheet(outRows),slot.velvet);
  add(sweep(weltIn,[0.0045],{seg:600,radial:8,bead:0.35,period:0.006}),slot.welt);
  add(sweep(weltOut,[0.004],{seg:600,radial:8}),slot.welt);
  for(const [a,b] of [[0,inRows.length-1]]){ for(const i of [a,b]) add(sheet([inRows[i],outRows[i]],{flip:i===a}),slot.velvet); }   // بستن جلوی دسته

  /* ---- تیر نشیمن (جلو و دو بغل) با کنده‌کاری ---- */
  const SP=[[-1.03,SEAT_Y-0.025,-0.33],[-1.032,SEAT_Y-0.025,0.1],[-1.03,SEAT_Y-0.025,0.33],[-1.015,SEAT_Y-0.025,0.39],[-0.975,SEAT_Y-0.025,0.414],[-0.9,SEAT_Y-0.025,0.42],[-0.5,SEAT_Y-0.025,0.424],[0,SEAT_Y-0.025,0.426]];
  const SF=frames([...SP,...SP.slice(0,-1).reverse().map(([x,y,z])=>[-x,y,z])].map(p=>V3(...p)),MOBILE?360:560);
  const RP=[[-0.034,-0.025],[0.004,-0.025],[0.0095,-0.0235],[0.0128,-0.0195],[0.0122,-0.0155],[0.0102,-0.0128],[0.0102,0.0105],[0.0126,0.0138],[0.0138,0.0185],[0.0112,0.0238],[0.005,0.0262],[-0.034,0.0262]];
  add(railGeo(SF,RP),slot.wood);
  const sfront=frontOf(RP,10,0.004,0.004);
  const seatMap=sc=>(X,Y)=>{ const f=SF.at(sc+X); return {p:f.P.clone().addScaledVector(f.U,Y).addScaledVector(f.F,sfront(Y)),n:f.F}; };
  const sAtS=x=>{ let best=0,bd=9; for(const f of SF){ const d=Math.abs(f.P.x-x)+(f.P.z<0.3?1:0); if(d<bd){bd=d;best=f.s;} } return best; };
  GEO.ash??=apronShellArt(); GEO.acn??=apronCenterArt();
  add(reliefGeo(GEO.acn,0.008,seatMap(sAtS(0)),{back:true}),slot.carve);
  for(const s of [-1,1]) add(reliefGeo(GEO.ash,0.008,seatMap(sAtS(s*0.5)),{back:true,mirror:s<0}),slot.carve);
  for(const s of [-1,1]) add(reliefGeo(GEO.corner,0.006,seatMap(sAtS(s*0.84)),{mirror:s<0}),slot.carve);
  // تیر پشت نشیمن (ساده)
  add(slabY(rrect(new THREE.Shape(),2.04,0.05,0.008),SEAT_Y-0.05,SEAT_Y,0.004),slot.wood,0,0,ZB+0.008);
  // کف پارچه‌ای زیر (گردگیر)
  add(slabY(rrect(new THREE.Shape(),2.06,0.82,0.05),SEAT_Y-0.04,SEAT_Y-0.036,0.001),slot.dust,0,0,0.012);

  /* ---- لبه پف‌دار مخمل روی تیر نشیمن + قیطان پایینش ---- */
  const roll=[]; for(let k=0;k<20;k++){ const a=-Math.PI/2+2*Math.PI*k/20; roll.push([-0.04+0.046*Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),0.7),0.058+0.033*Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),0.8)]); }
  add(railGeo(SF,roll),slot.velvet);
  add(sweep(SF.filter((_,i)=>i%3===0).map(f=>f.P.clone().addScaledVector(f.U,0.029).addScaledVector(f.F,0.004)),[0.0042],{seg:500,radial:8,bead:0.35,period:0.006}),slot.welt);
  add(slabY(rrect(new THREE.Shape(),2.0,0.78,0.06),DECK_Y-0.02,DECK_Y,0.008),slot.velvet,0,0,0.0);

  /* ---- تشک یکپارچه دمسک با قیطان بالا و پایین ---- */
  const ca=1.0, cb=0.09, cc=0.368, cz=0.062, cy=DECK_Y+cb-0.004;
  const cush=SE(ca,cb,cc,0.22,0.1,{nu:MOBILE?96:140,nv:MOBILE?28:40,mod:(x,y,z)=>{ const zz=(z/cc+1)/2, taper=1-0.075*(1-zz);
    return [x*taper,y+(y>0?0.014:0.004)*(1-Math.pow(x/ca,4))*(1-Math.pow(z/cc,4)),z]; }});
  // تشک جعبه‌ای واقعی: رویه بالا و پایین جدا از نوار دور (UV صاف روی رویه تا نقش کشیده نشود)؛ درزها زیر قیطان
  { const nu=MOBILE?96:140, nv=MOBILE?28:40, pa=cush.attributes.position, row=i=>Array.from({length:nu+1},(_,j)=>V3(pa.getX(i*(nu+1)+j),pa.getY(i*(nu+1)+j),pa.getZ(i*(nu+1)+j)));
    const R=Array.from({length:nv+1},(_,i)=>row(i)), thr=cb*0.93; let i0=0,i1=nv; while(R[i0+1][0].y<-thr) i0++; while(R[i1-1][0].y>thr) i1--;
    const planar=g=>{ const p=g.attributes.position, u=g.attributes.uv; for(let k=0;k<p.count;k++) u.setXY(k,p.getX(k),-p.getZ(k)); return g; };
    add(sheet(R.slice(i0,i1+1)),slot.damask,0,cy,cz); add(planar(sheet(R.slice(i1))),slot.damask,0,cy,cz); add(planar(sheet(R.slice(0,i0+1))),slot.damask,0,cy,cz); }
  for(const yy of [-1,1]){ const pts=[]; for(let i=0;i<120;i++){ const ph=-Math.PI+2*Math.PI*i/120, c=Math.cos(ph), sn=Math.sin(ph), cf=Math.sign(c)*Math.pow(Math.abs(c),0.1), sf=Math.sign(sn)*Math.pow(Math.abs(sn),0.1);
      const z=cc*sf*0.985, zz=(z/cc+1)/2, x=ca*cf*0.985*(1-0.075*(1-zz)); pts.push(V3(x,cy+yy*(cb*0.93)+(yy>0?0.004:0),cz+z)); }
    add(sweep(pts,[0.0055],{closed:true,seg:360,radial:10}),slot.pipe); }

  /* ---- پایه‌ها: سه جلو (گوشه‌ها مورب) و سه عقب ---- */
  GEO.leg??=legGeo(); GEO.knee??=kneeArt(); GEO.kneeG??=reliefGeo(GEO.knee,0.006,legMap); GEO.foot??=white(footScroll());
  GEO.pad??=new THREE.CylinderGeometry(0.017,0.019,0.006,28).translate(0,0.003,0.012);
  const legs=[[-0.985,0.392,-Math.PI/4,1],[0.985,0.392,Math.PI/4,1],[0,0.408,0,1],[-0.985,-0.37,-Math.PI*0.78,0],[0.985,-0.37,Math.PI*0.78,0],[0,-0.385,Math.PI,0]];
  for(const [x,z,ry,front] of legs){ const L=new THREE.Group(); L.position.set(x,0,z); L.rotation.y=ry;
    L.add(mesh(GEO.leg,slot.wood)); L.add(mesh(GEO.pad,slot.wood)); L.add(mesh(GEO.foot,slot.carve));
    if(front) L.add(mesh(GEO.kneeG,slot.carve)); g.add(L); }

  GEO.g=g; return g.clone(); }

/* ================= پارچه دمسک (ساخته‌شده با کد، مطابق عکس تشک) ================= */
export const SEATS=[
  {v:'red',  label:'دمسک قرمز و سبز (عکس محصول)', ground:'#7a1c13', ground2:'#a33a28', floral:'#86814a', floralHi:'#b9b177', floralLo:'#3f3f1c', gold:'#c9a54e', goldLo:'#7a5a22', lat:'#e6b83a'},
  {v:'navy', label:'دمسک سرمه‌ای و طلایی', ground:'#1e2b45', ground2:'#34466a', floral:'#a68b4a', floralHi:'#d6bd7a', floralLo:'#5b4822', gold:'#d0ad5a', goldLo:'#6e5524', lat:'#e3c060'},
  {v:'cream',label:'دمسک کرم و طلایی', ground:'#d9cdb0', ground2:'#ece2c8', floral:'#a88d55', floralHi:'#cdb780', floralLo:'#6a5530', gold:'#b8934a', goldLo:'#6a5226', lat:'#d8b052'},
  {v:'wine', label:'دمسک زرشکی و طلایی', ground:'#4a1018', ground2:'#6c2330', floral:'#9a7a3e', floralHi:'#c9a865', floralLo:'#553e1c', gold:'#cfa654', goldLo:'#6a4c20', lat:'#e0b448'},
];
export const DAMASK_TILE=[0.27,0.2];
const DMS={};
export function damaskTex(cfg){ if(DMS[cfg.v]) return DMS[cfg.v];
  const k=MOBILE?0.55:1, W=Math.round(780*k), H=Math.round(W*DAMASK_TILE[1]/DAMASK_TILE[0]), ppm=W/DAMASK_TILE[0];
  const cv=(w=W,h=H)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return [c,c.getContext('2d',{willReadFrequently:true})]; };
  let sd=11; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647);
  // ماسک گل‌وبوته (کات‌مخمل): صدها برگ ریز درهم در قالب یک بوته متقارن روی لبه‌های کاشی؛ هر برگ تُن خودش را دارد
  const [mc,mx]=cv(), [tc,tx]=cv(); for(const x of [mx,tx]){ x.fillStyle='#000'; x.fillRect(0,0,W,H); }
  const ell=(x,y,rx,ry,a,tone)=>{ for(const ox of [-W,0,W]) for(const oy of [-H,0,H]){ const px=x*ppm+ox, py=y*ppm+oy;
      mx.fillStyle='#fff'; mx.beginPath(); mx.ellipse(px,py,rx*ppm,ry*ppm,a,0,6.2832); mx.fill();
      const t=Math.round(tone*255); tx.fillStyle=`rgb(${t},${t},${t})`; tx.beginPath(); tx.ellipse(px,py,rx*ppm*0.86,ry*ppm*0.8,a,0,6.2832); tx.fill(); } };
  const HT=DAMASK_TILE[1], hw=v=>0.016+0.056*Math.pow(Math.sin(Math.PI*(0.08+0.84*v)),0.8)*(1-0.25*Math.exp(-Math.pow((v-0.62)/0.08,2)));
  for(let n=0;n<380;n++){ const v=rnd(), y=HT*(0.04+0.92*v), w=hw(1-v), u=Math.pow(rnd(),0.8)*w, sgn=rnd()<0.5?-1:1;
    const a=sgn*(0.4+1.0*rnd())*(u/w)+Math.PI/2*(rnd()-0.5)*0.4, L=0.005+0.008*rnd()*(0.6+0.6*u/w);
    for(const ss of [-1,1]) ell(ss*sgn*u,y,L,L*(0.38+0.2*rnd()),ss*a+Math.PI/2*0,0.35+0.65*rnd()); }
  ell(0,HT*0.5,0.006,HT*0.44,0,0.5);                                                   // ساقه وسط
  const md=mx.getImageData(0,0,W,H).data, td=tx.getImageData(0,0,W,H).data;
  const [bc,bx]=cv(); bx.filter=`blur(${Math.max(1,2.2*k)}px)`; bx.drawImage(mc,0,0); const bd=bx.getImageData(0,0,W,H).data;
  // نقش طلایی: قوس طوماری پهن، برگ‌های طلایی و مربع شبکه‌ای زرد
  const [gc,gx]=cv(); gx.lineCap='round'; gx.lineJoin='round';
  const arch=(col,w)=>{ gx.strokeStyle=col; gx.fillStyle=col; gx.lineWidth=w*k; const c=W/2;
    for(const s of [-1,1]){ gx.beginPath(); gx.moveTo(c+s*0.048*ppm,H*1.0); gx.bezierCurveTo(c+s*0.078*ppm,H*0.82,c+s*0.074*ppm,H*0.42,c+s*0.036*ppm,H*0.24); gx.quadraticCurveTo(c+s*0.01*ppm,H*0.16,c,H*0.1); gx.stroke();
      gx.beginPath(); gx.arc(c+s*0.062*ppm,H*0.93,0.012*ppm,s>0?Math.PI:0,s>0?Math.PI*2.6:-Math.PI*1.6,s<0); gx.stroke();
      gx.beginPath(); gx.moveTo(c+s*0.058*ppm,H*0.6); gx.quadraticCurveTo(c+s*0.03*ppm,H*0.56,c+s*0.028*ppm,H*0.45); gx.stroke();
      gx.beginPath(); gx.moveTo(c+s*0.07*ppm,H*0.7); gx.bezierCurveTo(c+s*0.105*ppm,H*0.66,c+s*0.115*ppm,H*0.48,c+s*0.098*ppm,H*0.34); gx.stroke();
      for(let i=0;i<5;i++){ const t=i/4, y=H*(0.3+0.5*t), x=c+s*(0.058+0.018*Math.sin(t*3))*ppm; gx.beginPath(); gx.ellipse(x+s*0.008*ppm,y,0.009*ppm+w*k*0.3,0.0035*ppm+w*k*0.3,s*(0.6-0.4*t),0,6.2832); gx.fill(); } }
    gx.beginPath(); gx.moveTo(c,H*0.1); gx.lineTo(c,H*0.02); gx.stroke(); gx.beginPath(); gx.ellipse(c,H*0.035,0.004*ppm+w*k*0.3,0.012*ppm+w*k*0.3,0,0,6.2832); gx.fill(); };
  arch('#000',13); arch('#fff',8);
  const gd=gx.getImageData(0,0,W,H).data;
  const sq=0.04*ppm, sx=W/2-sq/2, sy=H*0.68-sq/2;
  // نقش تن‌به‌تن قرمز تیره در زمینه ساتن (دمسک داخل قرمز)
  const [dc,dx]=cv(); dx.fillStyle='#000'; dx.fillRect(0,0,W,H); dx.strokeStyle='#fff'; dx.lineWidth=2.2*k; dx.lineCap='round';
  for(const ox of [-W,0,W]) for(const s of [-1,1]){ const c=W*0.25+ox; dx.beginPath(); dx.moveTo(c,H*0.15); dx.bezierCurveTo(c+s*0.03*ppm,H*0.3,c+s*0.03*ppm,H*0.7,c,H*0.85); dx.stroke();
    const c2=W*0.75+ox; dx.beginPath(); dx.moveTo(c2,H*0.15); dx.bezierCurveTo(c2+s*0.03*ppm,H*0.3,c2+s*0.03*ppm,H*0.7,c2,H*0.85); dx.stroke(); }
  const dd=dx.getImageData(0,0,W,H).data;
  // رنگ‌آمیزی
  const [oc,ox]=cv(), o=ox.createImageData(W,H), a=o.data, hx=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
  const G0=hx(cfg.ground), G1=hx(cfg.ground2), F0=hx(cfg.floral), F1=hx(cfg.floralHi), F2=hx(cfg.floralLo), A0=hx(cfg.gold), A1=hx(cfg.goldLo), Y0=hx(cfg.lat);
  const [hc,hxx]=cv(), hd=hxx.createImageData(W,H), h=hd.data, [rc,rx]=cv(), rd=rx.createImageData(W,H), r=rd.data;
  const nz=new Float32Array(W*H); for(let i=0;i<nz.length;i++) nz[i]=rnd();
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x, q=i*4;
    // ساتن: خط‌های ریز عمودی پود براق
    const sat=0.5+0.5*Math.sin(x*2.1+Math.sin(y*0.05)*2)*0.6+(nz[i]-0.5)*0.35, stripe=((x+(y>>3))%4===0)?0.12:0;
    let c=G0.map((v,j)=>(v+(G1[j]-v)*Math.max(0,Math.min(1,sat*0.45+stripe)))*(1-0.22*dd[q]/255)), ht=0.05, ro=0.42;
    const m=md[q]/255, e=bd[q]/255;
    if(m>0.02){ const tone=td[q]/255, pile=0.75+0.25*nz[(i*7)%nz.length], inner=Math.max(0,Math.min(1,(e-0.4)/0.5)), f=F0.map((v,j)=>{ const lo=F2[j], hi=F1[j]; const base=lo+(v-lo)*Math.min(1,0.25+0.9*tone*inner); return (base+(hi-base)*Math.max(0,tone-0.6)*1.6)*pile; });
      c=c.map((v,j)=>v+(f[j]-v)*m); ht=0.05+0.95*m*(0.75+0.25*inner); ro=0.42+0.58*m; }
    const gk=gd[q+3]?gd[q]/255:0, go=gd[q+3]/255;
    if(go>0){ const gg=A1.map((v,j)=>v+(A0[j]-v)*gk); c=c.map((v,j)=>v+(gg[j]-v)*go); ht=Math.max(ht,0.35*go+0.2*gk); ro=ro*(1-go)+0.6*go; }
    if(x>=sx&&x<sx+sq&&y>=sy&&y<sy+sq){ const gx2=(x-sx)%(sq/6), gy2=(y-sy)%(sq/6), line=gx2<1.6*k||gy2<1.6*k, edge=x<sx+2*k||x>sx+sq-2*k||y<sy+2*k||y>sy+sq-2*k;
      c=edge?A1:line?Y0.map(v=>v*0.62):Y0.map(v=>v*(0.92+0.12*nz[i])); ht=0.3; ro=0.55; }
    a[q]=c[0]; a[q+1]=c[1]; a[q+2]=c[2]; a[q+3]=255; h[q]=h[q+1]=h[q+2]=ht*255; h[q+3]=255; r[q]=r[q+1]=r[q+2]=ro*255; r[q+3]=255; }
  ox.putImageData(o,0,0); hxx.putImageData(hd,0,0); rx.putImageData(rd,0,0);
  for(const [c,x] of [[oc,ox],[hc,hxx],[rc,rx]]){ const t=document.createElement('canvas'); t.width=W; t.height=H; t.getContext('2d').drawImage(c,0,0); x.save(); x.setTransform(1,0,0,-1,0,H); x.drawImage(t,0,0); x.restore(); }
  // نرمال از ارتفاع
  const [nc,nx]=cv(); const t2=cv(); t2[1].filter=`blur(${Math.max(0.7,1.2*k)}px)`; t2[1].drawImage(hc,0,0); const hh=t2[1].getImageData(0,0,W,H).data, nd=nx.createImageData(W,H), n=nd.data;
  const HH=(x,y)=>hh[(((y+H)%H)*W+((x+W)%W))*4]/255;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const dx=(HH(x+1,y)-HH(x-1,y))*3.2, dy=(HH(x,y+1)-HH(x,y-1))*3.2, l=Math.hypot(dx,dy,1), q=(y*W+x)*4;
    n[q]=(-dx/l*0.5+0.5)*255; n[q+1]=(dy/l*0.5+0.5)*255; n[q+2]=(1/l*0.5+0.5)*255; n[q+3]=255; }
  nx.putImageData(nd,0,0);
  return DMS[cfg.v]={map:tex(oc,true,...DAMASK_TILE),normal:tex(nc,false,...DAMASK_TILE),rough:tex(rc,false,...DAMASK_TILE)}; }

/* مخمل: اسکن واقعی velour خاکستری‌شده × رنگ */
let VEL=null;
export async function velvetTex(){ if(VEL) return VEL; const [d,n]=await Promise.all(['diff','nor_gl'].map(k=>loadImg(`tex/velour_velvet_${k}_1k.jpg`)));
  return VEL={map:tex(neutral(d,192,0.85),true,0.3),normal:tex(n,false,0.3)}; }
