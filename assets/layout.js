/* هدر، فوتر و فهرست محصولات مشترک همه صفحه‌ها.
   در <body data-page="..."> بلافاصله بعد از تگ body صدا زده می‌شود تا هدر بدون پرش صفحه ساخته شود. */
(function(){
var CATALOG=window.CATALOG=[
  { id:'naria', cat:'sofa', url:'naria.html', img:'assets/naria.webp', code:'sofa-A603', name:'مبل کلاسیک ناریا',
    desc:'کلاف خراطی‌شده براق، مدالیون حصیری و نشیمن ژاکارد. چیدمان دلخواه از مبل تک تا ست ۳+۲+۱+۱.',
    tags:['چیدمان آزاد','۶ رنگ چوب','۵ پارچه ژاکارد'], dots:['#0c0c0d','#9a6038','#e8e0c9','#2b2e35'] },
  { id:'milan', cat:'sofa', url:'milan.html', img:'assets/milan.webp', code:'sofa-M120', name:'مبل راحتی میلان',
    desc:'مبل راحتی مدرن با کوسن‌های پُر، دسته گرد و پایه‌های باریک. مخمل، بوکله یا کتان.',
    tags:['دو و سه‌نفره','۳ جنس پارچه','۸ رنگ'], dots:['#5f6b52','#c9b9a3','#2f3b4c','#8a4b3a'] },
  { id:'console', cat:'table', url:'console.html', img:'assets/console.webp', code:'console-C210', name:'کنسول ورونا',
    desc:'کنسول کلاسیک با پایه‌های خراطی شیاردار، دو کشو و یراق طلایی. رویه چوبی یا سنگ مرمر.',
    tags:['۳ اندازه','رویه مرمر','یراق طلایی'], dots:['#0c0c0d','#3a2417','#efe9df','#d4ab62'] },
  { id:'tv', cat:'table', url:'tv.html', img:'assets/tv.webp', code:'tv-T180', name:'میز تلویزیون ورونا',
    desc:'هم‌خانواده کنسول ورونا: دو در با قاب برجسته، طبقه باز وسط و کشوهای پایین با یراق طلایی.',
    tags:['۳ اندازه','رویه مرمر','در و کشو'], dots:['#0c0c0d','#9a6038','#efe9df','#d4ab62'] }
];
var CATS=window.CATS={ sofa:'مبل', table:'کنسول و میز' };

var page=document.body.getAttribute('data-page')||'';
var logo='<span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><path d="M5 18v2M19 18v2"/></svg></span>';
var ext='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
var nav=[['home','./','خانه'],['products','products.html','محصولات'],['ar','ar.html','نمایش در خانه (AR)'],['contact','contact.html','سفارش و تماس']];
var navHtml=nav.map(function(n){ return '<a href="'+n[1]+'"'+(n[0]===page?' class="on" aria-current="page"':'')+'>'+n[2]+'</a>'; }).join('');

document.write('<header class="hdr" id="hdr"><div class="wrap">'+
  '<a class="logo" href="./" aria-label="استودیو سه‌بعدی مبل اشرافی">'+logo+'<span><b>مبل اشرافی</b><small>استودیو سه‌بعدی</small></span></a>'+
  '<nav class="nav" id="nav">'+navHtml+'</nav>'+
  '<a class="btn btn-light btn-sm hdr-cta" href="https://moblashrafi.com" target="_blank" rel="noopener">سایت اصلی '+ext+'</a>'+
  '<button class="menu-btn" id="menuBtn" aria-label="منو" aria-expanded="false"><span></span></button>'+
  '</div></header>');

window.siteFooter=function(){
  var prods=CATALOG.map(function(p){ return '<li><a href="'+p.url+'">'+p.name+'</a></li>'; }).join('');
  document.write('<footer class="ftr"><div class="wrap">'+
    '<div><a class="logo" href="./">'+logo+'<span><b style="color:var(--ink)">مبل اشرافی</b><small>استودیو سه‌بعدی</small></span></a>'+
    '<p style="margin:14px 0 0;max-width:340px">نمایش سه‌بعدی و واقعیت افزوده محصولات مبل اشرافی؛ قبل از خرید، در خانه خودتان ببینید.</p></div>'+
    '<div><h4>محصولات</h4><ul>'+prods+'</ul></div>'+
    '<div><h4>راهنما</h4><ul><li><a href="products.html">همه محصولات</a></li><li><a href="ar.html">راهنمای نمایش در خانه</a></li><li><a href="contact.html">سفارش و تماس</a></li><li><a href="https://moblashrafi.com" target="_blank" rel="noopener">سایت اصلی</a></li></ul></div>'+
    '<div class="copy"><span>© ۱۴۰۵ مبل اشرافی</span><span>نسخه نمایشی · <span class="ltr">3d.moblashrafi.com</span></span></div>'+
    '</div></footer>');
};

/* کارت محصول (صفحه اصلی و صفحه محصولات) */
var arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
var cube='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>';
window.productCard=function(p){
  return '<a class="p-card reveal" href="'+p.url+'" data-cat="'+p.cat+'">'+
    '<div class="p-img"><span class="badge3d">'+cube+'سه‌بعدی + AR</span><img src="'+p.img+'" alt="'+p.name+'" loading="lazy" width="1400" height="900"></div>'+
    '<div class="p-body"><span class="code">'+p.code+'</span><h3>'+p.name+'</h3><p>'+p.desc+'</p>'+
    '<div class="tags">'+p.tags.map(function(t){ return '<span>'+t+'</span>'; }).join('')+'</div>'+
    '<div class="p-foot"><div class="dots" aria-hidden="true">'+p.dots.map(function(c){ return '<span style="background:'+c+'"></span>'; }).join('')+'</div>'+
    '<span class="go">طراحی کنید<i>'+arrow+'</i></span></div></div></a>';
};

document.addEventListener('DOMContentLoaded',function(){
  var h=document.getElementById('hdr'), b=document.getElementById('menuBtn');
  b.addEventListener('click',function(){ var o=h.classList.toggle('open'); b.setAttribute('aria-expanded',o); });
  document.getElementById('nav').addEventListener('click',function(e){ if(e.target.closest('a')){ h.classList.remove('open'); b.setAttribute('aria-expanded',false); } });
  var on=function(){ h.classList.toggle('scrolled',scrollY>8); }; on(); addEventListener('scroll',on,{passive:true});
  var els=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(el){ io.observe(el); });
  } else els.forEach(function(el){ el.classList.add('in'); });
});
})();
