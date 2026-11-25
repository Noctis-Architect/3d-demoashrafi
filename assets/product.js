/* موتور مشترک صفحه محصول سه‌بعدی: صحنه، گزینه‌ها، کش هندسه و ماده، AR.
   هر محصول فقط تعریف خودش را می‌دهد (گزینه‌ها، ساخت مدل، مواد). */
import * as THREE from '../lib/three/three.module.js';
import { OrbitControls } from '../lib/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from '../lib/three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from '../lib/three/addons/exporters/GLTFExporter.js';
import { loadImg, tex, stain, neutral, MOBILE } from './geo.js';

export { THREE };
const fa=n=>Number(n).toLocaleString('fa-IR');
const $=id=>document.getElementById(id);

/* ---------- ابزار مواد (کش‌شده) ---------- */
const TEXC={};
export const kit={
  MOBILE,
  /* چوب رنگ‌شده روی اسکن واقعی گیلاس/راش */
  async wood(hex,{gloss=false}={}){ const k='wood'+hex+gloss; if(TEXC[k]) return TEXC[k];
    const [wd,wn,wr]=await Promise.all(['diff','nor_gl','rough'].map(x=>loadImg(`tex/cherry_veneer_${x}_1k.jpg`)));
    TEXC.wn??=tex(wn,false,0.35); TEXC.wr??=tex(wr,false,0.35);
    const dark=new THREE.Color(hex).getHSL({}).l<0.2;
    return TEXC[k]??=new THREE.MeshPhysicalMaterial({name:'lacquer',map:tex(stain(wd,hex),true,0.35),normalMap:TEXC.wn,normalScale:new THREE.Vector2(0.8,0.8),
      roughnessMap:TEXC.wr,metalness:0,specularIntensity:gloss?0.6:0.35,
      // مات: بدون لایه لاک، زبری بالا (فقط کمی برق نرم روی رگه‌ها)
      ...(gloss?{roughness:dark?0.7:0.75,clearcoat:1,clearcoatRoughness:0.05,clearcoatNormalMap:TEXC.wn,clearcoatNormalScale:new THREE.Vector2(0.15,0.15)}:{roughness:1})}); },
  metal(hex,rough=0.28){ const k='metal'+hex+rough; return TEXC[k]??=new THREE.MeshStandardMaterial({name:'metal',color:hex,metalness:1,roughness:rough}); },
  /* پارچه: اسکن واقعی خاکستری‌شده × رنگ دلخواه */
  async fabric(id,hex,{tile=0.25,sheen=0.8,rough=1}={}){ const k='fab'+id+hex; if(TEXC[k]) return TEXC[k];
    const [d,n]=await Promise.all(['diff','nor_gl'].map(x=>loadImg(`tex/${id}_${x}_1k.jpg`)));
    TEXC['fd'+id]??=tex(neutral(d,200,1.15),true,tile); TEXC['fn'+id]??=tex(n,false,tile);
    const c=new THREE.Color(hex);
    return TEXC[k]??=new THREE.MeshPhysicalMaterial({name:'fabric',color:c,map:TEXC['fd'+id],normalMap:TEXC['fn'+id],roughness:rough,
      sheen,sheenRoughness:0.4,sheenColor:c.clone().lerp(new THREE.Color('#fff'),0.35)}); },
  marble(kind){ const k='marble'+kind; if(TEXC[k]) return Promise.resolve(TEXC[k]);
    return marbleTex(kind).then(map=>TEXC[k]??=new THREE.MeshPhysicalMaterial({name:'marble',map,roughness:0.12,clearcoat:0.8,clearcoatRoughness:0.05})); },
  plain(hex,rough=0.5,extra={}){ return new THREE.MeshPhysicalMaterial({name:'plain',color:hex,roughness:rough,...extra}); },
};
/* مرمر رویه‌ای در پس‌زمینه (Web Worker) تا صفحه هیچ‌وقت قفل نشود */
const MARBLE_SRC=`onmessage=({data:{kind,size}})=>{
  const d=new Uint8ClampedArray(size*size*4), P=64, g=new Float32Array(P*P); let sd=kind==='nero'?11:5;
  const rnd=()=>((sd=(sd*16807)%2147483647)/2147483647); for(let i=0;i<g.length;i++) g[i]=rnd();
  const sm=t=>t*t*(3-2*t);
  const vn=(u,v,f)=>{ u*=f; v*=f; const i=Math.floor(u), j=Math.floor(v), fu=sm(u-i), fv=sm(v-j), m=f;
    const a=g[((j%m)*P+(i%m))%g.length], b=g[((j%m)*P+((i+1)%m))%g.length], c2=g[(((j+1)%m)*P+(i%m))%g.length], e=g[(((j+1)%m)*P+((i+1)%m))%g.length];
    return a+(b-a)*fu+(c2-a)*fv+(a-b-c2+e)*fu*fv; };
  const fbm=(u,v)=>{ let s=0,a=0.5,f=4; for(let o=0;o<6;o++){ s+=a*vn(u,v,f); a*=0.5; f*=2; } return s; };
  const base=kind==='nero'?[22,22,24]:[240,238,234], vein=kind==='nero'?[226,222,214]:[128,124,124], soft=kind==='nero'?[48,47,50]:[214,211,206];
  for(let y=0;y<size;y++) for(let xx=0;xx<size;xx++){ const u=xx/size, v=y/size, n=fbm(u,v), n2=fbm(u+0.37,v+0.71);
    const t=Math.abs(Math.sin((u*2+v*1)*Math.PI*2+n*7.5)), vv=Math.pow(1-t,kind==='nero'?36:22), t2=Math.abs(Math.sin((u*1-v*2)*Math.PI*2+n2*6)), v2=Math.pow(1-t2,60)*0.7;
    const cl=Math.pow(n2,1.5)*0.6, i=(y*size+xx)*4, k=Math.min(1,vv+v2);
    for(let ch=0;ch<3;ch++){ const b=base[ch]+(soft[ch]-base[ch])*cl; d[i+ch]=b+(vein[ch]-b)*k; } d[i+3]=255; }
  postMessage(d,[d.buffer]); };`;
const MARBLE={};
function marbleTex(kind){ return MARBLE[kind]??=new Promise((res,rej)=>{ const size=MOBILE?512:1024;
  const w=new Worker(URL.createObjectURL(new Blob([MARBLE_SRC],{type:'text/javascript'})));
  w.onmessage=e=>{ const c=document.createElement('canvas'); c.width=c.height=size; c.getContext('2d').putImageData(new ImageData(e.data,size,size),0,0); w.terminate(); res(tex(c,true,0.9,0.9)); };
  w.onerror=e=>{ w.terminate(); delete MARBLE[kind]; rej(e); }; w.postMessage({kind,size}); }); }

/* ---------- جای ماده در مدل: هر قطعه با نام جایگاهش ساخته می‌شود و ماده واقعی بعداً می‌نشیند ---------- */
const SLOTS={};
export const slot=new Proxy({},{get:(_,k)=>SLOTS[k]??=new THREE.MeshBasicMaterial({name:String(k)})});

/* ============ صفحه محصول ============ */
export function productPage(P){
  /* P: { id, name, code, sub, arTitle, options:[{key,q,label,type:'swatch'|'seg',items:[{v,label,color?,sub?}]}], defaults,
         geoKey(S), build(S), quick(S)->{slot:mat}, matKey(S), materials(S)->Promise<{slot:mat}>, dims(S)->[w,d,h] متر,
         summary(S), arDefault(S)->bool, arFile(S), arVariants:[partial S], prewarm() } */
  const QS=new URLSearchParams(location.search);
  const S={...P.defaults};
  for(const o of P.options){ const v=QS.get(o.q); if(v!=null){ const val=o.type==='swatch'&&!v.startsWith('#')&&o.items.some(i=>i.v==='#'+v)?'#'+v:v; if(o.items.some(i=>i.v===val)) S[o.key]=val; } }

  /* ---- ساخت HTML صحنه و پنل ---- */
  const host=$('pd'), icon=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  host.innerHTML=`
  <div class="stage" id="stage">
    <canvas id="cv" tabindex="0" aria-label="نمای سه‌بعدی ${P.name}؛ برای چرخاندن بکشید"></canvas>
    <model-viewer id="mv" loading="eager" environment-image="neutral" exposure="1" tone-mapping="neutral" shadow-intensity="1"
      ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor" alt="${P.name} در خانه شما"><span slot="ar-button" hidden></span></model-viewer>
    <div class="st-top"><span class="pill" id="dims"></span><span class="pill"><b>۳۶۰°</b></span></div>
    <div class="hint" id="hint">بکشید تا بچرخد · دو انگشت برای زوم</div>
    <div class="busy" id="busy">در حال آماده‌سازی…</div>
    <div class="st-bot">
      <button class="icon-btn" id="rotBtn" aria-pressed="true" aria-label="چرخش خودکار" title="چرخش خودکار">${icon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>')}</button>
      <button class="btn btn-dark ar-btn" id="arBtn" disabled>در حال آماده‌سازی…</button>
      <span class="no-ar" id="noAr" hidden>برای دیدن در خانه، صفحه را روی گوشی باز کنید · <a href="ar.html">راهنما</a></span>
      <button class="icon-btn" id="resetBtn" aria-label="نمای اول" title="نمای اول">${icon('<path d="M3 12h4M17 12h4M12 3v4M12 17v4"/><circle cx="12" cy="12" r="4"/>')}</button>
    </div>
  </div>
  <aside class="panel">
    <div class="code">${P.code}</div><h1>${P.name}</h1><p class="sub">${P.sub}</p>
    ${P.options.map(o=>`<div class="opt"><h2>${o.label} <span id="n_${o.key}"></span></h2>
      <div class="${o.type==='swatch'?'sw':'seg'}" id="o_${o.key}">${o.items.map(i=>o.type==='swatch'
        ?`<button data-v="${i.v}" title="${i.label}" aria-label="${i.label}" style="background:${i.color||i.v}"></button>`
        :`<button data-v="${i.v}">${i.label}${i.sub?`<small>${i.sub}</small>`:''}</button>`).join('')}</div></div>`).join('')}
    <div class="summary" id="summary"></div>
    <div class="actions">
      <a class="btn btn-dark" id="sendBtn" href="contact.html">ارسال این طرح برای استعلام قیمت</a>
      <button class="btn btn-light" id="copyBtn">کپی لینک همین طرح</button>
    </div>
  </aside>`;

  /* ---- صحنه ---- */
  THREE.ShaderChunk.tonemapping_pars_fragment=THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) { const float sc=0.76; const float ds=0.15; color*=toneMappingExposure;
    float x=min(color.r,min(color.g,color.b)); float off=x<0.08?x-6.25*x*x:0.04; color-=off;
    float pk=max(color.r,max(color.g,color.b)); if(pk<sc) return color; float d=1.-sc; float np=1.-d*d/(pk+d-sc);
    color*=np/pk; float g=1.-1./(ds*(pk-np)+1.); return mix(color,vec3(np),g); }`);
  const stage=$('stage'), cv=$('cv'), busy=$('busy');
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:QS.has('shot')});
  renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:2)); renderer.toneMapping=THREE.CustomToneMapping;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene(), pmrem=new THREE.PMREMGenerator(renderer);
  const HALF=renderer.capabilities.isWebGL2?(renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float')):renderer.extensions.has('OES_texture_half_float');
  if(HALF) scene.environment=pmrem.fromScene(new RoomEnvironment(renderer),0.04).texture;
  else { scene.add(new THREE.HemisphereLight(0xfffaf2,0x9a9086,2.6)); scene.add(new THREE.AmbientLight(0xffffff,0.9)); }
  const camera=new THREE.PerspectiveCamera(30,1,0.05,40);
  const controls=new OrbitControls(camera,cv); controls.enableDamping=true; controls.dampingFactor=0.08; controls.enablePan=false;
  controls.maxPolarAngle=1.5; controls.minDistance=0.6; controls.autoRotate=!QS.has('shot'); controls.autoRotateSpeed=0.7;
  const sun=new THREE.DirectionalLight(0xffffff,1.1); sun.position.set(1.2,3.2,2.0); sun.castShadow=true; sun.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);
  const sc=sun.shadow.camera; sc.left=sc.bottom=-1.8; sc.right=sc.top=1.8; sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.01; sun.shadow.radius=5; scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:0.2})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  const root=new THREE.Group(); scene.add(root);
  let dirty=true; const req=()=>{ dirty=true; };
  controls.addEventListener('change',req);
  let framed=false, touched=false;   // تا کاربر خودش نچرخانده، با هر تغییر اندازه صفحه دوباره قاب می‌گیرد
  cv.addEventListener('pointerdown',()=>{ touched=true; }); cv.addEventListener('wheel',()=>{ touched=true; },{passive:true});
  function frame(reset=true){ const [W,D,H]=P.dims(S), r=Math.hypot(W/2,H/2,D/2)*1.08, vf=camera.fov*Math.PI/360, hf=Math.atan(Math.tan(vf)*camera.aspect);
    const dist=r/Math.sin(Math.min(vf,hf)), ty=H*0.46; controls.target.set(0,ty,0); controls.maxDistance=dist*2.2;
    if(reset||!framed){ framed=true; const a=0.55, el=0.3; camera.position.set(Math.sin(a)*Math.cos(el)*dist,ty+Math.sin(el)*dist,Math.cos(a)*Math.cos(el)*dist); }
    controls.update(); }
  new ResizeObserver(()=>{ const w=stage.clientWidth,h=stage.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/Math.max(1,h); camera.updateProjectionMatrix(); frame(!touched); req(); }).observe(stage);
  /* درها و کشوها: هر قطعه با userData.open={type:'drawer',dist} یا {type:'door',angle} با کلیک باز/بسته می‌شود */
  const moving=new Set(), swinging=new Set(); let lastT=performance.now();
  const DUR=0.75, ease=p=>p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;   // شتاب نرم در شروع و ترمز نرم در پایان
  /* موقعیت/زاویه قطعه در پیشرفت p؛ ریل میانی کشو نصف مسیر را می‌آید */
  function pose(o){ const u=o.userData, e=ease(u.p);
    if(u.open.type==='drawer'){ o.position.z=u.base+e*u.open.dist; for(const f of u.followers||[]) f.position.z=f.userData.z0+f.userData.k*e*u.open.dist; }
    else o.rotation.y=e*u.open.angle; }
  /* شتاب قطعه در جهت عمود بر سطح جلو (برای تاب خوردن حلقه‌ها) */
  function frameAccel(o,dt){ const u=o.userData, q=u.open.type==='drawer'?o.position.z:o.rotation.y;
    const v=(q-(u.q??q))/dt, a=(v-(u.v??0))/dt; u.q=q; u.v=v; return {v,a}; }
  function swingStep(o,dt){ const u=o.userData, {v,a}=frameAccel(o,dt);
    o.traverse(c=>{ const sw=c.userData.swing; if(!sw) return;
      let an=0, ar=0;   // شتاب عمود بر صفحه (جلو/عقب) و در امتداد صفحه (بغل)
      if(u.open.type==='drawer') an=a;
      else { const r=Math.abs(c.getWorldPosition(new THREE.Vector3()).sub(o.getWorldPosition(new THREE.Vector3())).setY(0).length()); an=a*r*Math.sign(u.open.angle); ar=-v*v*r*Math.sign(u.open.angle); }
      const g=9.8, n=4, h=dt/n;
      for(let i=0;i<n;i++){ // آونگ میرا؛ حلقه نمی‌تواند داخل در/کشو برود
        sw.v+=(-(g/sw.L)*Math.sin(sw.phi)-(an/sw.L)*Math.cos(sw.phi)-1.6*sw.v)*h; sw.phi+=sw.v*h;
        if(sw.phi<sw.rest){ sw.phi=sw.rest; if(sw.v<0) sw.v*=-0.5; }
        sw.w+=(-(g/sw.L)*Math.sin(sw.psi)-(ar/sw.L)*Math.cos(sw.psi)-1.6*sw.w)*h; sw.psi+=sw.w*h; }
      c.rotation.x=-sw.phi; c.rotation.z=sw.psi;
      if(Math.abs(sw.v)>0.002||Math.abs(sw.w)>0.002||Math.abs(sw.psi)>0.002||sw.phi>sw.rest+0.002) swinging.add(o); });
  }
  function animParts(dt){
    const act=new Set([...moving,...swinging]); swinging.clear();
    for(const o of act){ const u=o.userData;
      if(moving.has(o)){ u.p=Math.max(0,Math.min(1,u.p+(u.target?1:-1)*dt/DUR)); pose(o); if(u.p===u.target) moving.delete(o); }
      swingStep(o,dt); }
    if(act.size){ renderer.shadowMap.needsUpdate=true; dirty=true; } }
  function toggle(o){ const u=o.userData; u.p??=0; u.base??=o.position.z; u.target=u.target?0:1; moving.add(o); }
  renderer.setAnimationLoop((time,xrFrame)=>{ const now=performance.now(), dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
    if(moving.size||swinging.size) animParts(dt);
    if(xrFrame&&xr){ xrTick(xrFrame); renderer.render(scene,camera); return; } if(controls.update()) dirty=true; if(dirty){ dirty=false; renderer.render(scene,camera); } });
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  function partAt(e){ const r=cv.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(ndc,camera); return partHit(); }
  function partHit(){
    for(const h of ray.intersectObjects(root.children,true)){ let o=h.object; while(o&&o!==root){ if(o.userData.open) return o; o=o.parent; } return null; } return null; }
  let down=null;
  /* نگه‌داشتن انگشت روی صحنه نباید منو یا انتخاب متن بیاورد */
  stage.addEventListener('contextmenu',e=>e.preventDefault()); stage.addEventListener('selectstart',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{ down={x:e.clientX,y:e.clientY,t:performance.now()}; });
  cv.addEventListener('pointerup',e=>{ if(!down) return; const d=down; down=null;
    if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6&&performance.now()-d.t<500){ const o=partAt(e); if(o){ toggle(o); controls.autoRotate=false; $('rotBtn').setAttribute('aria-pressed','false'); } } });
  cv.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse'||e.buttons) return; cv.style.cursor=partAt(e)?'pointer':''; });

  /* ---- مدل: هندسه هر حالت یک بار ساخته می‌شود؛ تغییر رنگ فقط ماده را عوض می‌کند ---- */
  const BUILT={}, MATS={}; let shown=null, cur={};
  function show(resetCam=false){ const key=P.geoKey(S);
    const g=BUILT[key]??=(()=>{ const g=P.build(S); g.traverse(o=>{ if(o.isMesh){ o.userData.slot=o.material.name; o.castShadow=o.receiveShadow=true; } }); return g; })();
    if(shown!==g){ if(shown) root.remove(shown); root.add(g); shown=g; }
    if(P.hint) $('hint').textContent=P.hint;
    g.traverse(o=>{ if(o.isMesh&&cur[o.userData.slot]) o.material=cur[o.userData.slot]; });
    renderer.shadowMap.needsUpdate=true; if(resetCam) frame(); req(); ui(); scheduleExport(); }
  let mjob=0;
  async function refresh(resetCam){ const my=++mjob, mk=P.matKey(S);
    if(!MATS[mk]){ cur=P.quick(S); show(resetCam); resetCam=false; }
    try{ const m=MATS[mk]??=await P.materials(S); if(my!==mjob) return; cur=m; show(resetCam); busy.classList.remove('on'); }
    catch(e){ console.error(e); busy.textContent='بافت‌ها بار نشدند (اینترنت). صفحه را تازه کنید.'; busy.classList.add('on'); } }

  /* ---- رابط ---- */
  function ui(){ const [W,D,H]=P.dims(S).map(v=>Math.round(v*100));
    $('dims').innerHTML=`<b>${fa(W)}</b> × ${fa(D)} × ${fa(H)} سانت`;
    document.querySelectorAll('[data-spec]').forEach(el=>{ el.textContent=fa({w:W,d:D,h:H}[el.dataset.spec])+' سانت'; });
    const u=new URL(location.href); u.search='';
    for(const o of P.options){ const it=o.items.find(i=>i.v===S[o.key]); $('n_'+o.key).textContent=o.type==='swatch'?it.label:'';
      $('o_'+o.key).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S[o.key]));
      u.searchParams.set(o.q,String(S[o.key]).replace('#','')); }
    $('summary').innerHTML='<b>طرح شما:</b> '+P.summary(S,(k)=>P.options.find(o=>o.key===k).items.find(i=>i.v===S[k]).label);
    history.replaceState(null,'',u);
    $('sendBtn').href='contact.html?design='+encodeURIComponent(location.href)+'&p='+encodeURIComponent(P.name); }
  for(const o of P.options) $('o_'+o.key).addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||S[o.key]===b.dataset.v) return;
    S[o.key]=b.dataset.v; refresh(!!o.reframe); });
  const hint=$('hint'), stopHint=()=>hint.classList.add('off');
  cv.addEventListener('pointerdown',()=>{ stopHint(); controls.autoRotate=false; $('rotBtn').setAttribute('aria-pressed','false'); });
  setTimeout(stopHint,5000);
  $('rotBtn').addEventListener('click',e=>{ controls.autoRotate=!controls.autoRotate; e.currentTarget.setAttribute('aria-pressed',controls.autoRotate); });
  $('resetBtn').addEventListener('click',()=>{ frame(); req(); });
  const toastEl=document.createElement('div'); toastEl.className='toast'; document.body.appendChild(toastEl);
  const toast=t=>{ toastEl.textContent=t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>toastEl.classList.remove('on'),2200); };
  $('copyBtn').addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(location.href); toast('لینک طرح کپی شد'); }catch(_){ prompt('لینک طرح:',location.href); } });

  /* ---- AR ---- */
  const mv=$('mv'), arBtn=$('arBtn'), exporter=new GLTFExporter();
  let expJob=0, arUrl=null, arState='stale';
  const IOS=document.createElement('a').relList?.supports?.('ar')||/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const ANDROID=/android/i.test(navigator.userAgent);
  function setAr(st){ arState=st; arBtn.disabled=st==='busy';
    arBtn.textContent=st==='ready'?'✓ آماده است — بزنید':st==='busy'?'در حال آماده‌سازی…':'📱 نمایش در خانه شما'; }
  function scheduleExport(){ expJob++; setAr('stale'); }
  async function exportGLB(max=1024){ const r=root.clone(); const s=new THREE.Scene(); s.add(r); return exporter.parseAsync(s,{binary:true,maxTextureSize:max}); }
  async function doExport(){ const my=++expJob; setAr('busy');
    try{ const glb=await exportGLB(); if(my!==expJob) return;
      const next=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
      mv.addEventListener('load',()=>{ if(my===expJob) setAr('ready'); },{once:true}); mv.src=next;
      if(arUrl){ const o=arUrl; setTimeout(()=>URL.revokeObjectURL(o),5000); } arUrl=next;
    }catch(e){ console.error(e); setAr('stale'); } }
  function sceneViewer(file){ const u=new URL(file,location.href).href, back=location.href.split('#')[0];
    location.href='intent://arvr.google.com/scene-viewer/1.0?file='+encodeURIComponent(u)+'&mode=ar_only&resizable=false&title='+encodeURIComponent(P.arTitle||P.name)+
      '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(back)+';end;'; }
  /* ---- AR داخل مرورگر (اندروید، WebXR): اندازه واقعی روی کف اتاق؛ در و کشو با لمس باز و بسته می‌شوند ---- */
  let xrOK=false; if(ANDROID&&navigator.xr) navigator.xr.isSessionSupported('immersive-ar').then(v=>{ xrOK=v; }).catch(()=>{});
  const xo=document.createElement('div'); xo.className='xr-ui'; xo.hidden=true;
  xo.innerHTML='<div class="xr-msg" id="xrMsg"></div><div class="xr-bar"><button data-x="l" aria-label="چرخش به چپ">⟲</button><button data-x="exit">✕ خروج</button><button data-x="r" aria-label="چرخش به راست">⟳</button></div>';
  document.body.appendChild(xo);
  xo.addEventListener('beforexrselect',e=>{ if(e.target.closest('button')) e.preventDefault(); });   // لمس دکمه‌ها به صحنه نرسد
  const xrMsg=t=>{ $('xrMsg').textContent=t; };
  const reticle=new THREE.Mesh(new THREE.RingGeometry(0.09,0.115,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.85,depthTest:false}));
  reticle.matrixAutoUpdate=false; reticle.visible=false; reticle.renderOrder=20; scene.add(reticle, sun.target);
  const SUN0=sun.position.clone();
  let xr=null;
  async function startXR(){
    xo.hidden=false; xrMsg('گوشی را آرام روی کف اتاق بچرخانید تا دایره سفید بیاید');
    const session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['dom-overlay'],domOverlay:{root:xo}});
    renderer.xr.enabled=true; renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session);
    const viewer=await session.requestReferenceSpace('viewer'), hit=await session.requestHitTestSource({space:viewer});
    xr={session,hit,placed:false}; root.visible=false; ground.visible=false; controls.enabled=false; controls.autoRotate=false;
    session.addEventListener('select',onXRSelect); session.addEventListener('end',endXR); }
  function xrTick(frame){ const ref=renderer.xr.getReferenceSpace(), r=frame.getHitTestResults(xr.hit);
    if(r.length){ const p=r[0].getPose(ref); reticle.matrix.fromArray(p.transform.matrix); reticle.visible=true;
      if(!xr.placed) xrMsg('روی دایره بزنید تا '+P.name+' با اندازه واقعی آن‌جا قرار بگیرد'); }
    else reticle.visible=false; }
  function place(){ const p=new THREE.Vector3().setFromMatrixPosition(reticle.matrix), c=new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
    root.position.copy(p); root.rotation.y=Math.atan2(c.x-p.x,c.z-p.z); root.visible=true;
    ground.position.copy(p); ground.visible=true; sun.position.copy(p).add(SUN0); sun.target.position.copy(p); renderer.shadowMap.needsUpdate=true;
    xr.placed=true; xrMsg('روی در یا کشو بزنید تا باز شود · جای خالی کف را بزنید تا جابجا شود'); }
  function onXRSelect(e){ const ref=renderer.xr.getReferenceSpace(), pose=e.frame.getPose(e.inputSource.targetRaySpace,ref);
    if(xr.placed&&pose){ const m=new THREE.Matrix4().fromArray(pose.transform.matrix);
      ray.ray.origin.setFromMatrixPosition(m); ray.ray.direction.set(0,0,-1).transformDirection(m);
      const o=partHit(); if(o){ toggle(o); return; }
      if(ray.intersectObjects(root.children,true).length) return; }
    if(reticle.visible) place(); }
  function endXR(){ xr=null; xo.hidden=true; reticle.visible=false; root.position.set(0,0,0); root.rotation.y=0; root.visible=true;
    ground.position.set(0,0,0); ground.visible=true; sun.position.copy(SUN0); sun.target.position.set(0,0,0); controls.enabled=true;
    const w=stage.clientWidth,h=stage.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/Math.max(1,h); camera.updateProjectionMatrix(); frame(); renderer.shadowMap.needsUpdate=true; req(); }
  xo.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||!xr) return;
    if(b.dataset.x==='exit') return xr.session.end();
    root.rotation.y+=(b.dataset.x==='l'?1:-1)*Math.PI/12; renderer.shadowMap.needsUpdate=true; });
  /* آیفون: برای طرح پیش‌فرض، فایل USDZ واقعی روی سایت → Quick Look با اندازه قفل‌شده (بزرگ و کوچک نمی‌شود) */
  function quickLook(file){ const a=document.createElement('a'); a.rel='ar'; a.href=new URL(file,location.href).href+'#allowsContentScaling=0'; a.appendChild(document.createElement('img')); a.click(); }
  arBtn.addEventListener('click',async()=>{
    if(ANDROID&&!window.isSecureContext) return alert('در اندروید، نمایش در خانه فقط روی https کار می‌کند.');
    if(ANDROID&&xrOK&&!xr){ try{ return await startXR(); }catch(err){ console.error(err); xo.hidden=true; } }
    if(IOS&&P.arDefault?.(S)) return quickLook(P.arFile(S).replace(/\.glb$/,'.usdz'));
    if(ANDROID&&arState!=='ready'&&P.arDefault?.(S)) return sceneViewer(P.arFile(S));
    if(arState==='ready'){ if(mv.canActivateAR) mv.activateAR(); else alert(ANDROID?'این گوشی AR را پشتیبانی نمی‌کند یا «Google Play Services for AR» نصب نیست.':'این دستگاه AR را پشتیبانی نمی‌کند.'); }
    else if(arState==='stale') doExport(); });
  customElements.whenDefined('model-viewer').then(()=>{
    mv.addEventListener('ar-status',e=>{ if(e.detail.status==='failed') alert('AR روی این دستگاه اجرا نشد. راهنما: ar.html'); });
    if(!(IOS||ANDROID)){ arBtn.hidden=true; $('noAr').hidden=false; } });

  /* فقط روی همین کامپیوتر: ساخت فایل‌های آماده AR اندروید (?genar) و عکس محصول (?shot) */
  if(QS.has('genar')&&location.hostname==='localhost') window.__genAR=async()=>{ const out=[];
    for(const v of P.arVariants||[]){ Object.assign(S,P.defaults,v); await refresh(true);
      const glb=await exportGLB(1024), f=P.arFile(S); const r=await fetch(f,{method:'PUT',body:glb}); out.push(f+': '+(glb.byteLength/1048576).toFixed(2)+'MB '+r.status);
      // USDZ برای Quick Look آیفون (با مبدل خود model-viewer)
      const u=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'})); await new Promise(res=>{ mv.addEventListener('load',res,{once:true}); mv.src=u; });
      const uz=await mv.prepareUSDZ(), buf=await (await fetch(uz)).arrayBuffer(), fz=f.replace(/\.glb$/,'.usdz');
      const r2=await fetch(fz,{method:'PUT',body:buf}); out.push(fz+': '+(buf.byteLength/1048576).toFixed(2)+'MB '+r2.status); }
    return out; };
  if(location.hostname==='localhost') window.__openAll=(p=1)=>{ shown.traverse(o=>{ if(o.userData.open){ const u=o.userData; u.base??=o.position.z; u.p=p; u.target=p?1:0; pose(o); } }); renderer.shadowMap.needsUpdate=true; dirty=true; };
  if(location.hostname==='localhost') window.__ringProbe=()=>{ const r=[]; shown.traverse(o=>{ if(o.userData.swing) r.push(+o.userData.swing.phi.toFixed(3)); }); return r.slice(0,2); };
  if(location.hostname==='localhost') window.__toggleAll=()=>{ let n=0; shown.traverse(o=>{ if(o.userData.open){ toggle(o); n++; } }); return n; };
  if(location.hostname==='localhost') window.__view=(pos,tgt,w=1600,h=1000,fov=30)=>{ renderer.setPixelRatio(1); renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov=fov; camera.updateProjectionMatrix();
    camera.position.set(...pos); controls.target.set(...tgt); controls.update(); renderer.shadowMap.needsUpdate=true; renderer.render(scene,camera); return cv.toDataURL('image/png'); };
  window.__shot=(w=1800,h=1160,az)=>{ renderer.setPixelRatio(1); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); frame();
    if(az){ const d=camera.position.clone().sub(controls.target); d.setFromSphericalCoords(d.length(),az[0],az[1]); camera.position.copy(controls.target).add(d); controls.update(); }
    renderer.shadowMap.needsUpdate=true; renderer.render(scene,camera); return cv.toDataURL('image/png'); };

  busy.classList.add('on'); ui();
  refresh(true).then(()=>{ const idle=window.requestIdleCallback||(f=>setTimeout(f,800)); if(P.prewarm) idle(()=>P.prewarm(kit)); });
}
