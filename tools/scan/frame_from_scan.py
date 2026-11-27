# frame_from_scan: put the scanned frame back exactly as it is in the GLB (only its left half mirrored, so it fits the
# symmetric upholstery). Takes the other slots from <body-prefix>, the frame from <scan-prefix> (stage2 output).
#   python3 frame_from_scan.py /tmp/scan-work/s2/chester_np /tmp/scan-work/s2/chester left
import sys, json, numpy as np
body, scan, side = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else '')
def load(pref):
    m = json.load(open(pref + '.json')); b = open(pref + '.bin', 'rb').read(); o = 0; out = []
    for s in m['slots']:
        nv, ni = s['nv'], s['ni']; d = {}
        for k, dt, n in (('pos', np.float32, nv * 3), ('nor', np.float32, nv * 3), ('uv', np.float32, nv * 2), ('shade', np.uint8, nv), ('idx', np.uint32, ni)):
            d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
        d['pos'] = d['pos'].reshape(-1, 3); d['nor'] = d['nor'].reshape(-1, 3); d['uv'] = d['uv'].reshape(-1, 2); d['idx'] = d['idx'].reshape(-1, 3)
        out.append((s, d))
    return m, out
mb, B = load(body); ms, Sc = load(scan)
s, d = next((s, d) for s, d in Sc if s['slot'] == 'frame')
if side:
    c = d['pos'][d['idx']].mean(1)[:, 0]; I = d['idx'][(c <= 0.002) if side == 'left' else (c >= -0.002)]
    used, inv = np.unique(I.ravel(), return_inverse=True); I = inv.reshape(-1, 3).astype(np.uint32); n = len(used)
    p, nr = d['pos'][used], d['nor'][used]
    d = dict(pos=np.r_[p, p * [-1, 1, 1]].astype(np.float32), nor=np.r_[nr, nr * [-1, 1, 1]].astype(np.float32),
             uv=np.r_[d['uv'][used], d['uv'][used]], shade=np.r_[d['shade'][used], d['shade'][used]], idx=np.r_[I, I[:, [0, 2, 1]] + n].astype(np.uint32))
fr = (dict(s, nv=len(d['pos']), ni=d['idx'].size), d)
out = [(s_, d_) for s_, d_ in B if s_['slot'] != 'frame'] + [fr]
with open(body + '.bin', 'wb') as f:
    for _, d_ in out:
        for k in ('pos', 'nor', 'uv', 'shade', 'idx'): f.write(np.ascontiguousarray(d_[k]).tobytes())
json.dump(dict(mb, slots=[s_ for s_, _ in out]), open(body + '.json', 'w'))
print('frame from scan:', fr[0]['nv'], 'verts', fr[0]['ni'] // 3, 'tris')
