#!/usr/bin/env python3
"""عکس صحنه (PNG شفاف از __shot یا __view) ← کارت محصول ۱۴۰۰×۹۰۰ webp با حاشیه و پس‌زمینهٔ شفاف، مثل کارت‌های فعلی.
اجرا: python3 .claude/skills/new-product/scripts/card.py /tmp/scan-work/shots/<id>-card.png assets/<id>.webp"""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H = 1400, 900
im = Image.open(src).convert('RGBA'); bb = im.getbbox()
if not bb: sys.exit('عکس خالی است (صحنه رندر نشده؟)')
x0, y0, x1, y1 = bb; w, h = x1 - x0, y1 - y0; k = min(W * 0.92 / w, H * 0.9 / h)
c = im.crop(bb).resize((round(w * k), round(h * k)), Image.LANCZOS)
card = Image.new('RGBA', (W, H), (0, 0, 0, 0)); card.paste(c, ((W - c.width) // 2, (H - c.height) // 2), c)
card.save(out, quality=86, method=6)
print('→', out, card.size)
