#!/usr/bin/env python3
"""خروجی یک مرحلهٔ کارخانه را به GLB رنگی تبدیل می‌کند تا با Blender یا هر نمایشگری دیده شود.
  s2 (stage2، poisson_unpillow، frame_from_scan): هر slot یک رنگ ثابت
  s1 (stage1): رنگ خود اسکن؛ اگر <prefix>_lab.npy یا _flab.npy باشد، رنگ برچسب
اجرا: python3 .claude/skills/new-product/scripts/s2viz.py /tmp/scan-work/s2/<id>_np /tmp/scan-work/look/<id>.glb [--shade]
--shade: رنگ slot × سایهٔ اسکن (برای دیدن سایهٔ پخته)."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../tools/scan')))
from vizglb import write

PAL = np.array([[200, 200, 200], [220, 40, 40], [40, 90, 220], [40, 180, 60], [230, 190, 40], [160, 60, 200], [40, 200, 200]])
pref, out = sys.argv[1], sys.argv[2]; shade_on = '--shade' in sys.argv
m = json.load(open(pref + '.json')); b = open(pref + '.bin', 'rb').read(); o = 0
def take(dt, n):
    global o; a = np.frombuffer(b, dt, n, o).copy(); o += a.nbytes; return a

if 'slots' in m:
    P, N, I, C = [], [], [], []; base = 0
    for k, s in enumerate(m['slots']):
        nv, ni = s['nv'], s['ni']
        pos = take(np.float32, nv * 3).reshape(-1, 3); nor = take(np.float32, nv * 3).reshape(-1, 3)
        take(np.float32, nv * 2); sh = take(np.uint8, nv); idx = take(np.uint32, ni)
        rgb = np.tile(PAL[k % len(PAL)], (nv, 1)).astype(np.float64)
        if shade_on: rgb *= np.clip(sh / 127.5, 0, 1.4)[:, None] / 1.4
        P.append(pos); N.append(nor); I.append(idx + base); C.append(rgb); base += nv
        print(f"{k}: {s['slot']:<10} {nv:>8} verts {ni // 3:>8} tris  colour {PAL[k % len(PAL)].tolist()}")
    pos, nor, idx, rgb = np.concatenate(P), np.concatenate(N), np.concatenate(I), np.concatenate(C)
else:
    nv, ni = m['nv'], m['ni']
    pos = take(np.float32, nv * 3).reshape(-1, 3); nor = take(np.float32, nv * 3).reshape(-1, 3)
    take(np.float32, nv * 2); idx = take(np.uint32, ni); rgb = take(np.uint8, nv * 3).reshape(-1, 3).astype(np.float64)
    if os.path.exists(pref + '_flab.npy'):
        # برچسب هر مثلث: مثلث‌ها جدا می‌شوند تا هر کدام رنگ خودش را بگیرد
        fl = np.load(pref + '_flab.npy'); T = idx.reshape(-1, 3)
        pos, nor = pos[T].reshape(-1, 3), nor[T].reshape(-1, 3); idx = np.arange(len(pos), dtype=np.uint32)
        rgb = np.repeat(PAL[fl % len(PAL)], 3, axis=0); print('face labels', np.bincount(fl))
    elif os.path.exists(pref + '_lab.npy'):
        lab = np.load(pref + '_lab.npy'); rgb = PAL[lab % len(PAL)]; print('vertex labels', np.bincount(lab))
    print(f'{nv} verts {ni // 3} tris')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
write(out, pos, nor, idx, np.clip(rgb, 0, 255).astype(np.uint8))
print('→', out)
