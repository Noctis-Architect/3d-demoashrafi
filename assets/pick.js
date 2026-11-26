/* انتخاب سریع با موس/لمس روی مدل‌های پرمثلث (اسکن).
   raycast معمولی three همه مثلث‌ها را یکی‌یکی امتحان می‌کند (۳۰۰ تا ۵۰۰ هزار → ده‌ها میلی‌ثانیه برای هر حرکت موس).
   این‌جا مثلث‌ها یک بار در یک شبکه سه‌بعدی دسته‌بندی می‌شوند و پرتو فقط خانه‌های سر راهش را امتحان می‌کند (کمتر از ۱ میلی‌ثانیه). */
import * as THREE from '../lib/three/three.module.js';

const MIN_TRIS=20000;
const _inv=new THREE.Matrix4(), _ray=new THREE.Ray(), _a=new THREE.Vector3(), _b=new THREE.Vector3(), _c=new THREE.Vector3(), _p=new THREE.Vector3(), _hit=new THREE.Vector3();

function buildGrid(geo){
  const pos=geo.attributes.position, I=geo.index?geo.index.array:null, nT=(I?I.length:pos.count)/3;
  geo.computeBoundingBox(); const bb=geo.boundingBox.clone(), sz=bb.getSize(new THREE.Vector3());
  const pad=Math.max(sz.x,sz.y,sz.z)*1e-4; bb.expandByScalar(pad); bb.getSize(sz);
  // حدود ۸ مثلث در هر خانه، با سقف ۶۴ خانه در هر جهت
  const k=Math.cbrt(nT/8/(sz.x*sz.y*sz.z)), N=[sz.x,sz.y,sz.z].map(s=>Math.max(1,Math.min(64,Math.round(s*k))));
  const cs=[sz.x/N[0],sz.y/N[1],sz.z/N[2]], NC=N[0]*N[1]*N[2];
  const X=new Float32Array(pos.count*3); for(let i=0;i<pos.count;i++){ X[i*3]=pos.getX(i); X[i*3+1]=pos.getY(i); X[i*3+2]=pos.getZ(i); }
  const vi=t=>I?I[t]:t, cl=(v,d)=>Math.max(0,Math.min(N[d]-1,Math.floor((v-bb.min.getComponent(d))/cs[d])));
  const rng=new Int32Array(nT*6);
  const cnt=new Uint32Array(NC+1);
  for(let t=0;t<nT;t++){ const a=vi(t*3)*3,b=vi(t*3+1)*3,c=vi(t*3+2)*3;
    for(let d=0;d<3;d++){ rng[t*6+d]=cl(Math.min(X[a+d],X[b+d],X[c+d]),d); rng[t*6+3+d]=cl(Math.max(X[a+d],X[b+d],X[c+d]),d); }
    for(let z=rng[t*6+2];z<=rng[t*6+5];z++) for(let y=rng[t*6+1];y<=rng[t*6+4];y++) for(let x=rng[t*6];x<=rng[t*6+3];x++) cnt[(z*N[1]+y)*N[0]+x+1]++; }
  for(let i=0;i<NC;i++) cnt[i+1]+=cnt[i];
  const list=new Uint32Array(cnt[NC]), fill=cnt.slice(0,NC);
  for(let t=0;t<nT;t++) for(let z=rng[t*6+2];z<=rng[t*6+5];z++) for(let y=rng[t*6+1];y<=rng[t*6+4];y++) for(let x=rng[t*6];x<=rng[t*6+3];x++) list[fill[(z*N[1]+y)*N[0]+x]++]=t;
  return {bb,N,cs,start:cnt,list,X,I,stamp:new Uint32Array(nT),gen:0};
}

/* جایگزین mesh.raycast: همان خروجی three (نزدیک‌ترین برخورد این mesh) */
function gridRaycast(raycaster,out){
  const geo=this.geometry, G=geo.userData.pickGrid??=buildGrid(geo), side=this.material.side;
  _inv.copy(this.matrixWorld).invert(); _ray.copy(raycaster.ray).applyMatrix4(_inv);
  const o=_ray.origin, d=_ray.direction;
  // ورود و خروج پرتو از جعبه
  let t0=0,t1=Infinity; for(let k=0;k<3;k++){ const od=o.getComponent(k), dd=d.getComponent(k), lo=G.bb.min.getComponent(k), hi=G.bb.max.getComponent(k);
    if(Math.abs(dd)<1e-12){ if(od<lo||od>hi) return; continue; }
    let a=(lo-od)/dd, b=(hi-od)/dd; if(a>b){ const s=a; a=b; b=s; } t0=Math.max(t0,a); t1=Math.min(t1,b); if(t0>t1) return; }
  const gen=++G.gen; if(gen===0xffffffff){ G.stamp.fill(0); G.gen=1; }
  const cell=[0,0,0], step=[0,0,0], tMax=[0,0,0], tDelta=[0,0,0];
  for(let k=0;k<3;k++){ const p=o.getComponent(k)+d.getComponent(k)*t0, lo=G.bb.min.getComponent(k), dd=d.getComponent(k);
    cell[k]=Math.max(0,Math.min(G.N[k]-1,Math.floor((p-lo)/G.cs[k])));
    if(dd>0){ step[k]=1; tMax[k]=t0+((lo+(cell[k]+1)*G.cs[k])-p)/dd; tDelta[k]=G.cs[k]/dd; }
    else if(dd<0){ step[k]=-1; tMax[k]=t0+((lo+cell[k]*G.cs[k])-p)/dd; tDelta[k]=-G.cs[k]/dd; }
    else { step[k]=0; tMax[k]=Infinity; tDelta[k]=Infinity; } }
  const X=G.X, I=G.I, back=side!==THREE.FrontSide, front=side!==THREE.BackSide;
  let best=Infinity, bestT=-1;
  for(;;){ const ci=(cell[2]*G.N[1]+cell[1])*G.N[0]+cell[0];
    for(let j=G.start[ci];j<G.start[ci+1];j++){ const t=G.list[j]; if(G.stamp[t]===gen) continue; G.stamp[t]=gen;
      const a=(I?I[t*3]:t*3)*3, b=(I?I[t*3+1]:t*3+1)*3, c=(I?I[t*3+2]:t*3+2)*3;
      _a.set(X[a],X[a+1],X[a+2]); _b.set(X[b],X[b+1],X[b+2]); _c.set(X[c],X[c+1],X[c+2]);
      let h=null; if(front) h=_ray.intersectTriangle(_a,_b,_c,true,_p); if(!h&&back) h=_ray.intersectTriangle(_c,_b,_a,true,_p);
      if(h){ const dist=_p.distanceTo(o); if(dist<best){ best=dist; bestT=t; _hit.copy(_p); } } }
    // نزدیک‌ترین برخورد اگر قبل از مرز این خانه باشد قطعی است
    const exit=Math.min(tMax[0],tMax[1],tMax[2]);
    if(bestT>=0&&best<=exit*d.length()) break;
    const k=tMax[0]<tMax[1]?(tMax[0]<tMax[2]?0:2):(tMax[1]<tMax[2]?1:2);
    if(tMax[k]>t1) break; cell[k]+=step[k]; if(cell[k]<0||cell[k]>=G.N[k]) break; tMax[k]+=tDelta[k]; }
  if(bestT<0) return;
  const point=_hit.clone().applyMatrix4(this.matrixWorld), distance=raycaster.ray.origin.distanceTo(point);
  if(distance<raycaster.near||distance>raycaster.far) return;
  out.push({distance,point,object:this,faceIndex:bestT});
}

/* روی همه mesh‌های پرمثلث گروه فعال می‌شود؛ شبکه در زمان بیکاری مرورگر ساخته می‌شود */
export function fastPick(group){
  const geos=[];
  group.traverse(o=>{ if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh) return; const g=o.geometry, n=(g.index?g.index.count:g.attributes.position.count)/3;
    if(n<MIN_TRIS||g.morphAttributes.position) return; o.raycast=gridRaycast; geos.push(g); });
  const idle=window.requestIdleCallback||(f=>setTimeout(f,200));
  const next=()=>{ const g=geos.shift(); if(!g) return; g.userData.pickGrid??=buildGrid(g); idle(next); };
  idle(next);
}
