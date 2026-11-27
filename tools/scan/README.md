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
4c. کلاف دقیقاً از خود فایل (فقط نیمه چپ قرینه): `python3 frame_from_scan.py /tmp/scan-work/s2/<id>_np /tmp/scan-work/s2/<id>_newlab left`
   چستر: پارچه با `poisson_unpillow.py ... --rail 0.25 --hem 0.012 --hem-push 0.006 --push 0.004`، سپس encode با `RN=fabric,cushion`.
5. ساخت کد: `node encode.mjs /tmp/scan-work/s2/<id> ../../assets/models/<id>.js <id> tex/scan/<id>_normal.webp`
   و نرمال‌مپ: `/tmp/scan-work/s1/<id>_normal.png` → `tex/scan/<id>_normal.webp` (۲۰۴۸، webp کیفیت ۹۲)
6. صفحه محصول: مثل `chaise.html` با `scanPage` از `assets/scan.js`.
