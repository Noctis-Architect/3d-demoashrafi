# تبدیل GLB اسکن‌شده به کد (assets/models/*.js)

پوشه کاری: `/tmp/scan-work` (زیرپوشه‌های `raw`, `s1`, `s2`). اجرا از داخل همین پوشه `tools/scan`.

1. باز کردن فشرده‌سازی: `gltf-transform dequantize 3d/<file>.glb /tmp/scan-work/raw/<name>.glb`
2. ساده‌سازی دقیق (خطای ۰٫۰۰۰۲ شعاع، نرمال‌های اصلی حفظ می‌شود):
   `node --max-old-space-size=14000 stage1.mjs /tmp/scan-work/raw/<name>.glb /tmp/scan-work/s1/<id> 0.0002 1`
3. جداکردن بخش‌ها (چوب/پارچه/کوسن…): قانون هر مدل در `seg.py` → `python3 seg.py <id> 3`
   (برای دیدن نتیجه: `blender -b --python render.py -- /tmp/scan-work/s1/<id>_lab.glb out VERTEX`)
3b. (بهتر، برای مبل‌های چوب‌دار) جداسازی دقیق چوب/پارچه به ازای هر مثلث: `python3 seg2.py <id>`
   (رنگ اسکن + محدوده مجاز چوب: ریل و ستون‌های جلوی دسته + هموارسازی که مرز را روی شیار واقعی می‌نشاند). stage2 خودکار از `_flab.npy` استفاده می‌کند.
4. جهت جلو، طول واقعی و نام بخش‌ها در `stage2.py` (CFG) → `python3 stage2.py <id>`
4b. (مبل‌هایی که کوسن جابه‌جاشونده با کد دارند) برداشتن کوسن‌های اسکن و بازسازی پارچه زیرشان با Poisson، به‌علاوه صاف‌کردن و قرینه‌کردن نیمه تمیزتر (نیاز به pymeshlab و scipy):
   `python poisson_unpillow.py chester --depth 10 --smooth 30 --chan 0.05 --flat 0.035 --iso 0.03 --mirror left --rail 0.25 --post 0.957,0.42 --erode 12 --wood-holes 400 --push 0.015`
   → خروجی `s2/<id>_np` (برای مرحله ۵ همین را بدهید). سپس سبک‌سازی: `lite.mjs` با frame=0.65 fabric=0.75.
   --chan/--flat: صاف‌کردن در جهت کانال‌های کاپیتونی / سطوح تخت (متر). --rail: ارتفاع لبه بالای ریل چوبی (درز صاف).
   --post: محدوده ستون‌های کنده‌کاری جلوی دسته (|x|,z) که دست‌نخورده می‌مانند. بررسی: رندر با پس‌زمینه سرخابی و حذف پشت‌رو (هر سوراخ دیده می‌شود).
4c. کلاف دقیقاً از خود فایل (فقط نیمه چپ قرینه، برش صاف روی خط ریل): `python3 frame_from_scan.py /tmp/scan-work/s2/<id>_np /tmp/scan-work/s2/<id>_newlab left 0.249 0.94,0.40`
   چستر: پارچه از برچسب‌های قدیمی + چوب برچسب جدید: `poisson_unpillow.py chester --wood-from /tmp/scan-work/s2/chester_newlab ... --crease 30 --box 0.05 --box-k 0.35 --tuck 0.025 --rail 0.25 --hem 0.012 --hem-push 0.006 --push 0.004`،
   سپس `frame_from_scan.py ... left 0.249 0.94,0.40` و encode با `RN=fabric,cushion`.
5. ساخت کد: `node encode.mjs /tmp/scan-work/s2/<id> ../../assets/models/<id>.js <id> tex/scan/<id>_normal.webp`
   و نرمال‌مپ: `/tmp/scan-work/s1/<id>_normal.png` → `tex/scan/<id>_normal.webp` (۲۰۴۸، webp کیفیت ۹۲)
6. صفحه محصول: مثل `chaise.html` با `scanPage` از `assets/scan.js`.

### نیمکت (chaise): اصلاح‌های موضعی روی خود فایل مدل
- برآمدگی نوک‌تیز وسط تاج (از قرینه‌سازی): `node tools/scan/flatten_crest.mjs assets/models/chaise.js wood 0.022 0.80 0.5`
- نوار پشت زیر نشیمن ساده و صاف مثل عکس: `node tools/scan/flatten_back_apron.mjs assets/models/chaise.js wood 0.6 0.41 0.455 -0.2945`
  (هر دو فقط رأس‌های همان ناحیه را جابه‌جا می‌کنند؛ بقیه مدل و تقارن چپ/راست دست نمی‌خورد)

### مبل ال آوا (a466) و تک‌نفره آوا (a466-chair) — sofa-A466
منبع: `3d/a466.glb` و `3d/a466-chair.glb` (Tripo)، عکس‌ها و شرح مو به مو در `refs/sofa-a466/`.
```bash
gltf-transform dequantize ../../3d/a466.glb /tmp/scan-work/raw/a466.glb          # و همین برای a466-chair
node --max-old-space-size=9000 stage1.mjs /tmp/scan-work/raw/a466.glb /tmp/scan-work/s1/a466 0.0002 1
python3 components.py a466        # اجزای جدا → s1/a466_vc.npy (گیاه و پایه‌اش پشت گوشه، جزء ۱ و ۲)
python3 seg.py a466 2 && python3 seg.py a466-chair 3   # ۰ پارچه، ۱ پایه، ۲ کوسن اسکن، ۳ گیاه
python3 stage2.py a466 && python3 stage2.py a466-chair  # مقیاس از بخش‌های نگه‌داشته (drop در CFG)
python3 a466_patch.py                    # فقط مبل ال؛ نیاز به scipy (pymeshlab لازم نیست)
python3 s2keep.py /tmp/scan-work/s2/a466_np /tmp/scan-work/s2/a466_fab fabric          # پایه‌های اسکن کنار می‌روند
python3 s2keep.py /tmp/scan-work/s2/a466-chair /tmp/scan-work/s2/a466-chair_np fabric
python3 smooth_fabric.py /tmp/scan-work/s2/a466_fab /tmp/scan-work/s2/a466_sm fabric --taubin 30 --shade-blur 80
python3 smooth_fabric.py /tmp/scan-work/s2/a466-chair_np /tmp/scan-work/s2/a466-chair_sm fabric --taubin 40 --shade-blur 60
RN=fabric node encode.mjs /tmp/scan-work/s2/a466_sm ../../assets/models/a466.js a466 ""
RN=fabric node encode.mjs /tmp/scan-work/s2/a466-chair_sm ../../assets/models/a466-chair.js a466-chair ""
node lite.mjs ../../assets/models/a466.js ../../assets/models/a466.js fabric=0.6
node lite.mjs ../../assets/models/a466-chair.js ../../assets/models/a466-chair.js fabric=0.35
```
- `a466_patch.py`: کوسن‌های اسکن برداشته شدند؛ نشیمن و پشتی چپ = ماژول سالم وسط (کش‌آمده به عرض همان خانه)، پشتی شزلون = پشتی وسط،
  نشیمن شزلون زیر کوسن‌ها = خود شزلون ۵۰ سانت جلوتر، دستهٔ چپ: تکهٔ کوسن روی آن بریده و پوستهٔ ۱ میلی‌متر داخل‌تر (مقطع خود دسته) پشت سوراخ،
  دستهٔ راست = قرینهٔ دستهٔ چپ. برش‌ها درست در شکاف بین کوسن‌ها و درزها به هم دوخته (`put`).
- `smooth_fabric.py`: Tripo بافت پارچه را در هندسه (برآمدگی میلی‌متری) و رنگ (لک تیره) پخته بود؛ صاف می‌شود، فرم می‌ماند.
- پایه‌ها با کد (`assets/legs.js`): مخروط صاف؛ جا، زاویه، طول و شعاع از پایه‌های سالم فایل اندازه‌گیری شده (`LEGS` در صفحه).
- `lite.mjs`: باگ خراب‌شدن رأس صفر (سوزن‌های بلند روی مدل) درست شد؛ مثلث‌های بلندتر از `MAXE` (۰٫۳ متر) هم حذف می‌شوند.

### ست سلطنتی رز (royal, royal-chair)
```bash
gltf-transform dequantize ../../3d/royal.glb /tmp/scan-work/raw/royal.glb             # و همین برای royal-chair
node --max-old-space-size=9000 stage1.mjs /tmp/scan-work/raw/royal.glb /tmp/scan-work/s1/royal 0.0002 1
python3 seg.py royal 6 && python3 seg.py royal-chair 6      # ۰ پارچه، ۱ کلاف، ۲ کوسن (کاناپه)؛ جزیره‌های کوچک برگردانده می‌شوند
python3 stage2.py royal && python3 stage2.py royal-chair
python3 smooth_fabric.py /tmp/scan-work/s2/royal /tmp/scan-work/s2/royal_sm fabric --taubin 25 --shade-blur 30
python3 smooth_fabric.py /tmp/scan-work/s2/royal_sm /tmp/scan-work/s2/royal_sm pillows --taubin 15 --shade-blur 20
python3 split_panel.py /tmp/scan-work/s2/royal_sm /tmp/scan-work/s2/royal_pn fabric panel "(np.abs(cx)<1.12)&(cy>0.43)&(cy<0.5)&(cz>-0.215)&(cz<0.43)&(ny>0.6)"
python3 smooth_fabric.py /tmp/scan-work/s2/royal-chair /tmp/scan-work/s2/royal-chair_sm fabric --taubin 25 --shade-blur 30
python3 split_panel.py /tmp/scan-work/s2/royal-chair_sm /tmp/scan-work/s2/royal-chair_pn fabric panel "(np.abs(cx)<0.25)&(cy>0.475)&(cy<0.99)&(cz<-0.14)&(nz>0.2)"
# نرمال‌مپ: s1/<id>_normal.png → tex/scan/<id>_normal.webp (۲۰۴۸، کیفیت ۹۲)
RN=fabric,panel,pillows node encode.mjs /tmp/scan-work/s2/royal_pn ../../assets/models/royal.js royal tex/scan/royal_normal.webp
node lite.mjs ../../assets/models/royal.js ../../assets/models/royal.js fabric=0.35 panel=0.35 pillows=0.4 frame=0.85
RN=fabric,panel node encode.mjs /tmp/scan-work/s2/royal-chair_pn ../../assets/models/royal-chair.js royal-chair tex/scan/royal-chair_normal.webp
node lite.mjs ../../assets/models/royal-chair.js ../../assets/models/royal-chair.js fabric=0.35 panel=0.35 frame=0.5
```
کلاف فقط تا خطای اسکن خود stage1 (حدود ۰٫۲ میلی‌متر) ساده می‌شود تا کیفیت کنده‌کاری پایین نیاید.
