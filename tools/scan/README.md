# تبدیل GLB اسکن‌شده به کد (assets/models/*.js)

پوشه کاری: `/tmp/scan-work` (زیرپوشه‌های `raw`, `s1`, `s2`). اجرا از داخل همین پوشه `tools/scan`.

1. باز کردن فشرده‌سازی: `gltf-transform dequantize 3d/<file>.glb /tmp/scan-work/raw/<name>.glb`
2. ساده‌سازی دقیق (خطای ۰٫۰۰۰۲ شعاع، نرمال‌های اصلی حفظ می‌شود):
   `node --max-old-space-size=14000 stage1.mjs /tmp/scan-work/raw/<name>.glb /tmp/scan-work/s1/<id> 0.0002 1`
3. جداکردن بخش‌ها (چوب/پارچه/کوسن…): قانون هر مدل در `seg.py` → `python3 seg.py <id> 3`
   (برای دیدن نتیجه: `blender -b --python render.py -- /tmp/scan-work/s1/<id>_lab.glb out VERTEX`)
4. جهت جلو، طول واقعی و نام بخش‌ها در `stage2.py` (CFG) → `python3 stage2.py <id>`
5. ساخت کد: `node encode.mjs /tmp/scan-work/s2/<id> ../../assets/models/<id>.js <id> tex/scan/<id>_normal.webp`
   و نرمال‌مپ: `/tmp/scan-work/s1/<id>_normal.png` → `tex/scan/<id>_normal.webp` (۲۰۴۸، webp کیفیت ۹۲)
6. صفحه محصول: مثل `chaise.html` با `scanPage` از `assets/scan.js`.
