# stage2: labels -> per-slot submeshes in final metric space (front = +Z, floor at y=0), plus shade (scan luminance ratio)
import numpy as np, json, sys
from load import load
S = '/tmp/scan-work/'
CFG = {
  # front: direction in source space that becomes +Z ; length: real length of the long side (m)
  'sectional': dict(front='+x', length=2.60, slots=['fabric', 'legs', 'pillows']),
  'chester':   dict(front='+x', length=2.24, slots=['fabric', 'frame', 'pillows']),
  'chaise':    dict(front='+x', length=1.60, slots=['wood', 'seat']),
  'console':   dict(front='+x', length=1.38, slots=['paint']),
}
name = sys.argv[1]; C = CFG[name]
pos, nor, uv, idx, col = load(S + 's1/' + name)
lab = np.load(S + 's1/' + name + '_lab.npy')

# drop degenerate scan slivers spanning the whole model
p = pos[idx]; e = np.max(np.linalg.norm(p - p[:, [1, 2, 0]], axis=2), 1)
keep = e < 0.2; print('dropped tris', (~keep).sum()); idx = idx[keep]

# rotate about Y so that `front` -> +Z
if C['front'] == '+x':   R = lambda v: np.c_[-v[:, 2], v[:, 1], v[:, 0]]
elif C['front'] == '-x': R = lambda v: np.c_[v[:, 2], v[:, 1], -v[:, 0]]
else: R = lambda v: v
pos = R(pos.astype(np.float64)); nor = R(nor.astype(np.float64))
ext = pos.max(0) - pos.min(0); s = C['length'] / ext[0]
pos = (pos - [(pos[:, 0].max() + pos[:, 0].min()) / 2, pos[:, 1].min(), (pos[:, 2].max() + pos[:, 2].min()) / 2]) * s
print(name, 'dims m', np.round(pos.max(0) - pos.min(0), 3))

# shade: linear luminance of scan colour relative to slot median
lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
L = lin(col / 255.0) @ [0.2126, 0.7152, 0.0722]
shade = np.zeros(len(pos))
base = []
for k in range(len(C['slots'])):
    m = lab == k
    med = np.median(L[m]); shade[m] = L[m] / max(med, 1e-4)
    # default colour of the slot = median-ish scan colour (sRGB)
    c = np.median(col[m], 0).astype(int); base.append('#%02x%02x%02x' % tuple(c))
shade = np.clip(shade, 0, 1.4)

# triangle slot = majority of vertex labels
tl = lab[idx]; tri = np.where(tl[:, 1] == tl[:, 2], tl[:, 1], tl[:, 0])
out = dict(name=name, dims=np.round(pos.max(0) - pos.min(0), 4).tolist(), slots=[])
blobs = []
for k, sl in enumerate(C['slots']):
    I = idx[tri == k]
    used, inv = np.unique(I.ravel(), return_inverse=True)
    sub = dict(slot=sl, color=base[k], nv=len(used), ni=I.size)
    out['slots'].append(sub)
    blobs += [pos[used].astype(np.float32), nor[used].astype(np.float32), uv[used].astype(np.float32),
              np.round(shade[used] / 2 * 255).astype(np.uint8), inv.astype(np.uint32)]
    print(' ', sl, base[k], 'verts', len(used), 'tris', I.size // 3)
with open(S + 's2/' + name + '.bin', 'wb') as f:
    for b in blobs: f.write(b.tobytes())
json.dump(out, open(S + 's2/' + name + '.json', 'w'))
