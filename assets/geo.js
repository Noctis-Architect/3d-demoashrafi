/* ابزار مشترک هندسه و بافت چوب (برداشته‌شده از پیکربند مبل ناریا) برای صفحه‌های محصول دیگر */
import * as THREE from '../lib/three/three.module.js';
import { toCreasedNormals, mergeVertices } from '../lib/three/addons/utils/BufferGeometryUtils.js';
export const MOBILE=matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)<820;
/* ============ ابزار هندسه ============ */
const Cf=(w,m)=>{const c=Math.cos(w);return Math.sign(c)*Math.pow(Math.abs(c),m);};
const Sf=(w,m)=>{const s=Math.sin(w);return Math.sign(s)*Math.pow(Math.abs(s),m);};
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);

/* شبکه (rows × cols، ستون‌ها حلقوی) → هندسه با نرمال نرم و UV به متر */
function gridGeo(P,rows,cols){
  const W=cols+1, id=(i,j)=>i*W+((j%cols)+cols)%cols;
  const U=new Float32Array(P.length), V=new Float32Array(P.length);
  for(let i=0;i<=rows;i++){ const m=cols>>1; U[i*W+m]=0;
    for(let j=m+1;j<=cols;j++) U[i*W+j]=U[i*W+j-1]+P[i*W+j].distanceTo(P[i*W+j-1]);
    for(let j=m-1;j>=0;j--)   U[i*W+j]=U[i*W+j+1]-P[i*W+j].distanceTo(P[i*W+j+1]); }
  for(let j=0;j<=cols;j++){ const m=rows>>1; V[m*W+j]=0;
    for(let i=m+1;i<=rows;i++) V[i*W+j]=V[(i-1)*W+j]+P[i*W+j].distanceTo(P[(i-1)*W+j]);
    for(let i=m-1;i>=0;i--)   V[i*W+j]=V[(i+1)*W+j]-P[i*W+j].distanceTo(P[(i+1)*W+j]); }
  const pos=[],nor=[],uv=[],idx=[], t1=V3(), t2=V3(), n=V3();
  for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++){
    const p=P[i*W+j];
    t1.subVectors(P[id(Math.min(i+1,rows),j)],P[id(Math.max(i-1,0),j)]);
    t2.subVectors(P[id(i,j+1)],P[id(i,j-1)]);
    n.crossVectors(t1,t2); if(n.lengthSq()<1e-14) n.set(0,i===0?-1:1,0); n.normalize();
    pos.push(p.x,p.y,p.z); nor.push(n.x,n.y,n.z); uv.push(U[i*W+j],V[i*W+j]);
  }
  for(let i=0;i<rows;i++) for(let j=0;j<cols;j++){ const p=i*W+j,q=p+W; idx.push(p,q,p+1,p+1,q,q+1); }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); return g;
}
/* سوپربیضی‌گون: کوسن، تشک، پنل‌های رویه‌دار */
function SE(a,b,c,e1,e2,{nu=32,nv=20,mod=null}={}){
  const P=[];
  for(let i=0;i<=nv;i++){ const th=-Math.PI/2+Math.PI*i/nv;
    for(let j=0;j<=nu;j++){ const ph=-Math.PI+2*Math.PI*j/nu;
      let x=a*Cf(th,e1)*Cf(ph,e2), y=b*Sf(th,e1), z=c*Cf(th,e1)*Sf(ph,e2);
      if(mod) [x,y,z]=mod(x,y,z); P.push(V3(x,y,z)); } }
  return gridGeo(P,nv,nu);
}
/* خراطی: پروفایل [r,y] + تابع شیار (فلوت) */
function lathe(profile,{radial=40,flute=null}={}){
  const P=[];
  for(const [r,y] of profile) for(let j=0;j<=radial;j++){
    const a=2*Math.PI*j/radial, rr=flute?flute(r,y,a):r;
    P.push(V3(Math.cos(a)*rr,y,Math.sin(a)*rr)); }   // جهت چرخش → نرمال رو به بیرون
  return swapUV(gridGeo(P,profile.length-1,radial));   // رگه چوب در طول پایه، نه دورش
}
function swapUV(g){ const a=g.attributes.uv.array; for(let i=0;i<a.length;i+=2){ const t=a[i]; a[i]=a[i+1]; a[i+1]=t; } return g; }
/* لوله روی منحنی با مقطع گرد‌گوش و مهره‌کاری (حکاکی ساده‌شده) */
function sweep(pts,radii,{radial=14,seg=60,e=0.8,closed=false,bead=0,period=0.035,flat=1}={}){
  const curve=new THREE.CatmullRomCurve3(pts,closed,'centripetal');
  const L=curve.getLength(), fr=curve.computeFrenetFrames(seg,closed);
  const R=t=>{ if(radii.length===1) return radii[0]; const f=t*(radii.length-1),i=Math.min(Math.floor(f),radii.length-2),k=f-i; return radii[i]*(1-k)+radii[i+1]*k; };
  const P=[];
  for(let s=0;s<=seg;s++){ const t=s/seg, fi=closed?s%seg:s, p=curve.getPointAt(closed?(s%seg)/seg:t);
    const r=R(t)*(1+bead*Math.pow(Math.abs(Math.cos(Math.PI*t*L/period)),3));
    for(let k=0;k<=radial;k++){ const a=-2*Math.PI*k/radial;   // منفی: سطح رو به بیرون
      P.push(p.clone().addScaledVector(fr.normals[fi],Cf(a,e)*r).addScaledVector(fr.binormals[fi],Sf(a,e)*r*flat)); } }
  const g=swapUV(gridGeo(P,seg,radial));
  if(closed) return g;
  const pos=[...g.attributes.position.array], nor=[...g.attributes.normal.array], uv=[...g.attributes.uv.array], idx=[...g.index.array];
  const W=radial+1;
  for(const [s,sg] of [[0,-1],[seg,1]]){
    const T=curve.getTangentAt(s/seg).multiplyScalar(sg), c=curve.getPointAt(s/seg), base=pos.length/3;
    pos.push(c.x,c.y,c.z); nor.push(T.x,T.y,T.z); uv.push(0,0);
    for(let k=0;k<=radial;k++){ const o=(s*W+k)*3; pos.push(pos[o],pos[o+1],pos[o+2]); nor.push(T.x,T.y,T.z); uv.push(0,0); }
    for(let k=0;k<radial;k++) sg<0 ? idx.push(base,base+1+k,base+2+k) : idx.push(base,base+2+k,base+1+k);
  }
  const h=new THREE.BufferGeometry();
  h.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); h.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  h.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); h.setIndex(idx); return h;
}
function boxUV(g){
  const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){ const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
    let u,v; if(ax>=ay&&ax>=az){u=p.getZ(i);v=p.getY(i);} else if(ay>=az){u=p.getX(i);v=p.getZ(i);} else {u=p.getX(i);v=p.getY(i);}
    uv[i*2]=u; uv[i*2+1]=v; }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); return g;
}
function rrect(p,w,d,r){ const hw=w/2,hd=d/2;
  p.moveTo(-hw+r,-hd); p.lineTo(hw-r,-hd); p.absarc(hw-r,-hd+r,r,-Math.PI/2,0,false);
  p.lineTo(hw,hd-r); p.absarc(hw-r,hd-r,r,0,Math.PI/2,false);
  p.lineTo(-hw+r,hd); p.absarc(-hw+r,hd-r,r,Math.PI/2,Math.PI,false);
  p.lineTo(-hw,-hd+r); p.absarc(-hw+r,-hd+r,r,Math.PI,1.5*Math.PI,false); return p; }
/* شکل افقی (x,z) بین دو ارتفاع */
function slabY(shape,y0,y1,bevel){
  const depth=Math.max(0.001,y1-y0-2*bevel);
  // تعداد قطعه پخ متناسب با اندازه پخ (پخ ۴ میلی با ۳ قطعه و نرمال نرم کاملاً گرد دیده می‌شود)
  const bs=bevel<0.006?3:bevel<0.015?5:7;
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:bs,curveSegments:10});
  g.rotateX(Math.PI/2); g.translate(0,y1-bevel,0); return mergeVertices(boxUV(toCreasedNormals(g,0.6)));
}
/* شکل عمودی (x,y) با ضخامت در z (مرکز روی z=0) */
function slabZ(shape,t,bevel,segs=7,curve=72){
  const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(0.001,t-2*bevel),bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelOffset:-bevel,bevelSegments:segs,curveSegments:curve});
  g.translate(0,0,-(t-2*bevel)/2); return mergeVertices(boxUV(toCreasedNormals(g,0.6)));
}
const mesh=(g,m,x=0,y=0,z=0)=>{ const o=new THREE.Mesh(g,m); o.position.set(x,y,z); return o; };

const loader=new THREE.ImageLoader(); const imgCache={};
/* بارگذاری مطمئن روی اینترنت ناپایدار: اگر فایلی گیر کرد، بعد از مهلت دوباره درخواست می‌شود (تا ۴ بار) */
function loadOnce(url,ms){ return new Promise((res,rej)=>{ const im=new Image(); let done=false;
  const end=(f,v)=>{ if(done) return; done=true; clearTimeout(t); f(v); };
  const t=setTimeout(()=>{ im.src=''; end(rej,new Error('timeout')); },ms);
  im.onload=()=>end(res,im); im.onerror=()=>end(rej,new Error('error')); im.src=url; }); }
const loadImg=url=>imgCache[url]??=(async()=>{
  for(let i=0;i<4;i++){ try{ return await loadOnce(i?url+'?r='+Date.now():url,(MOBILE?25000:15000)+i*10000); }catch(_){ } }
  delete imgCache[url]; throw new Error('بارگذاری نشد (اینترنت): '+url); })();
function shrink(src,max=1024){ if(!MOBILE||src.width<=max) return src; const k=max/src.width, c=document.createElement('canvas');
  c.width=max; c.height=Math.round(src.height*k); c.getContext('2d').drawImage(src,0,0,c.width,c.height); return c; }
function tex(src,srgb,tileU=0.3,tileV=tileU){
  src=shrink(src);
  const t=src instanceof HTMLCanvasElement?new THREE.CanvasTexture(src):new THREE.Texture(src);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1/tileU,1/tileV); t.anisotropy=8; t.needsUpdate=true;
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace; t.userData.mimeType='image/jpeg'; return t;
}
const lum=(a,i)=>0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];
function ctx2d(img){ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0); return [c,x]; }
/* خاکستری با میانگین ثابت: هر رنگی روی همان بافت واقعی */
function neutral(img,mean=205,contrast=1){
  const [c,x]=ctx2d(img), d=x.getImageData(0,0,c.width,c.height), a=d.data; let s=0;
  for(let i=0;i<a.length;i+=4) s+=lum(a,i); const avg=s/(a.length/4);
  for(let i=0;i<a.length;i+=4){ const v=Math.max(0,Math.min(255,mean+(lum(a,i)-avg)*(mean/avg)*contrast)); a[i]=a[i+1]=a[i+2]=v; }
  x.putImageData(d,0,0); return c;
}
/* ژاکارد تمیز: ماسک نقش از اسکن واقعی ۲K
   ۱) حذف سایه‌روشن عکاسی  ۲) نرم‌کردن بافت ریز  ۳) آستانه اوتسو → لبه نقش تیز و یکدست
   بافت ریز تار و پود جدا نگه داشته می‌شود و کم‌رنگ برمی‌گردد؛ نرمال و زبری هم از همین ماسک */
let JQ=null;
function jacquardBase(img){
  if(JQ) return JQ;
  const k=MOBILE?0.6:1, w=Math.round(1350*k),h=Math.round(2048*k),N=w*h, c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,w,h);
  const a=x.getImageData(0,0,w,h).data, L=new Float32Array(N); for(let i=0;i<N;i++) L[i]=lum(a,i*4);
  const blur=(src,r)=>{ const t=new Float32Array(N), o=new Float32Array(N), k=2*r+1;
    for(let y=0;y<h;y++){ const R=y*w; let s=0; for(let d=-r;d<=r;d++) s+=src[R+((d%w)+w)%w];
      for(let q=0;q<w;q++){ t[R+q]=s/k; s+=src[R+(q+r+1)%w]-src[R+((q-r)%w+w)%w]; } }
    for(let q=0;q<w;q++){ let s=0; for(let d=-r;d<=r;d++) s+=t[(((d%h)+h)%h)*w+q];
      for(let y=0;y<h;y++){ o[y*w+q]=s/k; s+=t[((y+r+1)%h)*w+q]-t[(((y-r)%h)+h)%h*w+q]; } }
    return o; };
  let mean=0; for(let i=0;i<N;i++) mean+=L[i]; mean/=N;
  const low=blur(blur(L,Math.round(60*k)),Math.round(60*k)), F=new Float32Array(N); for(let i=0;i<N;i++) F[i]=L[i]-low[i]+mean;
  const B=MOBILE?blur(blur(F,1),1):blur(blur(blur(F,2),2),1);
  const hist=new Float64Array(256); for(let i=0;i<N;i++) hist[Math.max(0,Math.min(255,Math.round(B[i])))]++;
  let sAll=0; for(let v=0;v<256;v++) sAll+=v*hist[v];
  let w0=0,s0=0,best=-1,T=128; for(let v=0;v<256;v++){ w0+=hist[v]; s0+=v*hist[v]; const w1=N-w0; if(!w0||!w1) continue;
    const m0=s0/w0, m1=(sAll-s0)/w1, bv=w0*w1*(m0-m1)**2; if(bv>best){best=bv;T=v+0.5;} }
  let c0=0,n0=0,c1=0,n1=0; for(let i=0;i<N;i++){ if(B[i]<T){c0+=B[i];n0++;} else {c1+=B[i];n1++;} }
  const mu0=c0/n0, mu1=c1/n1, span=Math.max(4,(mu1-mu0)*0.35);
  // m: سهم نقش (لبه نرم ۲–۳ پیکسلی مثل لبه بافت واقعی)؛ ratio: روشنی واقعی هر پیکسل نسبت به میانگین ناحیه خودش
  const m=new Float32Array(N), ratio=new Float32Array(N);
  for(let i=0;i<N;i++){ let t=(B[i]-T)/span+0.5; t=t<0?0:t>1?1:t; t=t*t*(3-2*t); m[i]=t;
    const ref=mu0*(1-t)+mu1*t; ratio[i]=Math.max(0.55,Math.min(1.45,F[i]/ref)); }
  return JQ={w,h,m,ratio};
}
function duotone(img,bg,fg){
  const J=jacquardBase(img), c=document.createElement('canvas'); c.width=J.w; c.height=J.h;
  const x=c.getContext('2d'), d=x.createImageData(J.w,J.h), a=d.data;
  // ترکیب در فضای خطی (مثل نور واقعی) و برگرداندن روشنی واقعی اسکن
  const lin=v=>{ v/=255; return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4); }, srgb=v=>{ v=Math.max(0,Math.min(1,v)); return 255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055); };
  const rgb=h=>[1,3,5].map(k=>lin(parseInt(h.slice(k,k+2),16))), B=rgb(bg), F=rgb(fg);
  // جدول ۲۵۶×۲۵۶ (سهم نقش × روشنی) به‌جای pow برای هر پیکسل؛ شاخص‌ها یک بار ساخته می‌شوند
  if(!J.ix){ J.ix=new Uint16Array(J.m.length); for(let i=0;i<J.m.length;i++) J.ix[i]=(Math.round(J.m[i]*255)<<8)|Math.round((J.ratio[i]-0.55)/0.9*255); }
  const LUT=new Uint8ClampedArray(65536*3);
  for(let ti=0;ti<256;ti++){ const t=ti/255; for(let ri=0;ri<256;ri++){ const r=Math.pow(0.55+ri/255*0.9,1.6), q=((ti<<8)|ri)*3;
    for(let k=0;k<3;k++) LUT[q+k]=srgb((B[k]*(1-t)+F[k]*t)*r); } }
  const ix=J.ix; for(let i=0;i<ix.length;i++){ const q=ix[i]*3, o=i*4; a[o]=LUT[q]; a[o+1]=LUT[q+1]; a[o+2]=LUT[q+2]; a[o+3]=255; }
  x.putImageData(d,0,0); return c;
}
/* رنگ‌مایه روی چوب: روشنی هر پیکسل نسبت به میانگین اسکن (رگه، منافذ، اشعه‌های ریز راش) نگه داشته می‌شود.
   روی رنگ‌های خیلی تیره یک جزء افزایشی کوچک هم هست تا رگه زیر مشکی هم دیده شود (مثل راش آبنوسی‌شده) */
function stain(img,hex){
  const [c,x]=ctx2d(shrink(img)), d=x.getImageData(0,0,c.width,c.height), a=d.data, N=a.length/4, w=c.width, h=c.height;
  const L=new Float32Array(N); let mean=0; for(let i=0;i<N;i++){ L[i]=lum(a,i*4); mean+=L[i]; } mean/=N;
  const F=rayFlecks(w,h);
  const lin=v=>{ v/=255; return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4); }, srgb=v=>{ v=Math.max(0,Math.min(1,v)); return 255*(v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055); };
  const C=[1,3,5].map(k=>lin(parseInt(hex.slice(k,k+2),16))), Y=0.2126*C[0]+0.7152*C[1]+0.0722*C[2];
  const add=Math.max(0,0.022-Y), warm=[1.0,0.78,0.58];
  // نوارهای روشن/تیره طولی خود اسکن (۴ برابر پررنگ‌تر؛ اسکن خام فقط ±۳٪ تغییر روشنی دارد) × لکه‌های ریز اشعه راش
  // جدول آماده (۴۰۹۶ پله روشنی) به‌جای pow برای هر پیکسل → ده‌ها برابر سریع‌تر، بدون تفاوت دیدنی
  const NB=4096, R0=0.24, RS=(2-R0)/(NB-1), LUT=new Uint8ClampedArray(NB*3);
  for(let b=0;b<NB;b++){ const r=R0+b*RS, g=Math.pow(r,1.7), e=add*Math.pow(r,2.4); for(let k=0;k<3;k++) LUT[b*3+k]=srgb(C[k]*g+e*warm[k]); }
  for(let i=0;i<N;i++){ const r=Math.max(0.3,Math.min(2,1+(L[i]/mean-1)*4.2))*(1-0.17*F[i]), o=i*4, b=((r-R0)/RS+0.5)|0;
    a[o]=LUT[b*3]; a[o+1]=LUT[b*3+1]; a[o+2]=LUT[b*3+2]; }
  x.putImageData(d,0,0); return c;
}
/* لکه‌های ریز دوکی‌شکل در جهت رگه (اشعه‌های چوب راش)، تکرارشونده بدون درز */
let RF=null;
function rayFlecks(w,h){ if(RF&&RF.w===w) return RF.f;
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#000'; x.fillRect(0,0,w,h); x.fillStyle='#fff'; let sd=7; const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647); const k=w/1024;
  for(let n=0;n<3400;n++){ const px=rnd()*w, py=rnd()*h, l=(3+rnd()*6)*k, t=(0.7+rnd()*1.1)*k; x.globalAlpha=0.3+rnd()*0.4;
    for(const ox of [-w,0,w]) for(const oy of [-h,0,h]){ x.beginPath(); x.ellipse(px+ox,py+oy,l,t,0,0,2*Math.PI); x.fill(); } }
  const D=x.getImageData(0,0,w,h).data, f=new Float32Array(w*h); for(let i=0;i<f.length;i++) f[i]=D[i*4]/255;
  RF={w,f}; return f; }
export { Cf, Sf, V3, gridGeo, SE, lathe, swapUV, sweep, boxUV, rrect, slabY, slabZ, mesh, loadImg, shrink, tex, ctx2d, neutral, stain };
