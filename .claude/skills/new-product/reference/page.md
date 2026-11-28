# صفحهٔ محصول

هر محصول یه فایل `<id>.html` تو ریشهٔ پروژه‌ست. صفحه فقط **تعریف** می‌ده؛ صحنه، پنل، لینک طرح، AR و کش همه کار `productPage` در `assets/product.js` ـه.

## الگو

`chaise.html` رو کپی کن و این‌ها رو عوض کن: `<title>`، `description`، `modulepreload`، خط مسیر (crumbs)، متن‌های `section.info`، و اسکریپت ماژول آخر صفحه.

```html
<script type="module">
import M from './assets/models/<id>.js';
import { scanPage, SURF, fabricItems } from './assets/scan.js';
scanPage(M,{
  name:'اسم فارسی محصول', code:'sofa-X123',
  sub:'یک جمله: چی هست و چه چیزهایی رو می‌شه انتخاب کرد.',
  hint:'بکشید تا بچرخد · …',                     // اختیاری
  parts:[                                         // هر بخش رنگ‌پذیر = یک slot؛ اولین item = رنگ اصلی خود محصول
    {slot:'wood', q:'w', label:'رنگ چوب',
     items:[{v:'#141414',label:'مشکی براق (رنگ اصلی)'}, …],
     surf:(h,S,M)=>h==='#c9a45c'?SURF.metal(h):SURF.wood(h,M,{grain:1,finish:S.fin})},
    {slot:'seat', also:['cushion'], q:'s', label:'رنگ تشک', items:[…],
     surf:(h,S,M)=>SURF.upholstery(h,M,S.mat)},
  ],
  extra:[                                         // گزینه‌های غیررنگی
    {key:'mat', q:'m', label:'جنس تشک', type:'seg', items:fabricItems(['velvet','leather','chenille','linen','boucle'])},
    {key:'fin', q:'g', label:'سطح چوب', type:'seg', items:[{v:'satin',label:'نیمه‌مات'},{v:'gloss',label:'براق'},{v:'matte',label:'مات'}]},
  ],
  // geoKey:S=>S.pc,                              // فقط اگه گزینه‌ای شکل رو عوض می‌کنه (تعداد کوسن، نوع کشو)
  // post:(g,S,M)=>{ … },                         // بعد از ساخت شکل: کوسن، بدنهٔ کدی، قطعهٔ جدا
  // dims:S=>[W,D,H],                             // فقط اگه ابعاد با گزینه‌ها عوض می‌شه
});
</script>
```

## فیلدها

| فیلد | توضیح |
|---|---|
| `parts[].slot` | اسم slot در فایل مدل. باید دقیقاً همون اسم `stage2.py` باشه. |
| `parts[].also` | slot های دیگه که همین رنگ رو می‌گیرن. |
| `parts[].q` | اسم کوتاه پارامتر URL. لینک طرح مشتری از این ساخته می‌شه؛ بعد از انتشار **عوضش نکن**، وگرنه لینک‌های قدیمی خراب می‌شن. |
| `parts[].items[0]` | رنگ اصلی محصول (مثل عکس). برچسبش «(رنگ اصلی)» یا «(مثل عکس)» داره. |
| `parts[].surf(hex,S,M,sl)` | ماده رو برمی‌گردونه. از `SURF.*` استفاده کن (materials.md). |
| `extra[]` | `{key, q, label, type:'seg'|'swatch', items, reframe?}`. `reframe:true` یعنی بعد از تغییر، دوربین دوباره قاب بگیره. |
| `geoKey(S)` | کلید کش شکل. فقط گزینه‌هایی که شکل رو عوض می‌کنن؛ رنگ‌ها نه. |
| `post(g,S,M)` | بعد از `buildScan`؛ قطعه‌های کدی این‌جا اضافه می‌شن. |
| `build(S)` | فقط برای محصولی که کل بدنه‌ش کدیه (مثل ساحل). |
| `quickMore`، `moreMats` | ماده برای slot هایی که part نیستن (`trim`، `inner`، `cavity`). |
| `exposure` | پیش‌فرض ۰٫۶. |

## نمونه‌های واقعی

- **فقط اسکن:** `chaise.html`
- **اسکن + کوسن کدی روی سطح واقعی:** `chester.html`. ببین `addPillows` با `solids:{back:[…fabric], seat:[…cushion]}` چطور صدا زده شده: کوسن روی تشک می‌شینه، به پشتی تکیه می‌ده و از دسته‌ها رد نمی‌شه. `back` (تابع z پشتی بر حسب x) و `seatFront` از خود فایل اندازه‌گیری شدن.
- **بدنهٔ کدی + یک قطعهٔ اسکن:** `sectional.html` (`setLeg(buildScan(LegM).children[0])`، `build`، `addSoftPillows`، قرینه با `o.scale.x=-1`).
- **اسکن + بدنه و کشوی کدی + قطعهٔ اسکن جدا:** `console.html` (`buildConsoleBody`، `trimCarve`، `gildAttr`، گل منبت از `models/console-medallion.js`).

## اندازه‌گیری از روی فایل برای قطعه‌های کدی

قطعهٔ کدی باید دقیقاً جای سطح اسکن بشینه. عدد حدس نزن؛ از فایل اندازه بگیر:
- با یه اسکریپت node یا پایتون، رأس‌های slot رو باز کن (مثل `lite.mjs`) و برای هر `x` با فاصلهٔ ثابت، بیشترین `z` یا کمترین `y` رو در یه نوار پیدا کن.
- نتیجه رو به شکل جدول نمونه تو کد بنویس (مثل `BK` در `chester.html` یا `APR_Z` در `console.js`) و با درون‌یابی (`lerpTab`) استفاده کن.
- یا از پرتو استفاده کن، مثل `addPillows({solids})` که سطح واقعی رو یک بار اندازه می‌گیره و تو جدول نگه می‌داره.

## کاتالوگ و کارت

تو `assets/layout.js` به آرایهٔ `CATALOG`:
```js
{ id:'<id>', cat:'sofa', url:'<id>.html', img:'assets/<id>.webp', code:'sofa-X123', name:'…',
  desc:'یک جمله.', tags:['…','…','…'], dots:['#…','#…','#…','#…'] },
```
`cat` یکی از کلیدهای `CATS` ـه (`sofa`، `table`). برای دستهٔ تازه، اول به `CATS` اضافه کن. `dots` چهار رنگ از گزینه‌های رنگه.
