# split_panel: move part of one slot into a new slot by a condition on triangle centre (cx,cy,cz) and face normal
# (nx,ny,nz), e.g. the embroidered inner back of a chair or the embroidered seat tops of a sofa, so they get their own
# fabric. The geometry is untouched (same vertices on both sides of the cut -> no seam opens).
# usage: python3 split_panel.py <in-prefix> <out-prefix> <from-slot> <new-slot> "<numpy condition>"
import sys, json, numpy as np
src, dst, frm, new, cond = sys.argv[1:6]
m = json.load(open(src + '.json')); b = open(src + '.bin', 'rb').read(); o = 0; parts = []
for s in m['slots']:
    d = {}
    for k, dt, n in (('pos', np.float32, s['nv'] * 3), ('nor', np.float32, s['nv'] * 3), ('uv', np.float32, s['nv'] * 2), ('shade', np.uint8, s['nv']), ('idx', np.uint32, s['ni'])):
        d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
    parts.append((s, d))
out = []
for s, d in parts:
    if s['slot'] != frm: out.append((s, d)); continue
    P = d['pos'].reshape(-1, 3); I = d['idx'].reshape(-1, 3); c = P[I].mean(1)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    # face normals of a scan can point inwards: orient them like the stored vertex normals
    vn = d['nor'].reshape(-1, 3)[I].mean(1); fn *= np.sign(np.einsum('ij,ij->i', fn, vn) + 1e-12)[:, None]
    cx, cy, cz = c.T; nx, ny, nz = fn.T
    sel = eval(cond)
    for name, msk in ((frm, ~sel), (new, sel)):
        J = I[msk]; used, inv = np.unique(J.ravel(), return_inverse=True)
        dd = dict(pos=P[used].ravel(), nor=d['nor'].reshape(-1, 3)[used].ravel(), uv=d['uv'].reshape(-1, 2)[used].ravel(), shade=d['shade'][used], idx=inv.astype(np.uint32))
        out.append((dict(s, slot=name, nv=len(used), ni=J.size), dd))
    print(frm, '->', new, 'tris', int(sel.sum()), 'of', len(I))
with open(dst + '.bin', 'wb') as f:
    for s, d in out:
        for k in ('pos', 'nor', 'uv', 'shade', 'idx'): f.write(np.asarray(d[k]).astype({'pos': np.float32, 'nor': np.float32, 'uv': np.float32, 'shade': np.uint8, 'idx': np.uint32}[k]).tobytes())
json.dump(dict(m, slots=[s for s, _ in out]), open(dst + '.json', 'w'))
