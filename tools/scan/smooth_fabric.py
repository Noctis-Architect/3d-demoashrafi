# smooth_fabric: Tripo baked the fabric's weave into the geometry (mm-scale bumps) and into the scan colour (dark flecks
# in the shade). Our own fabric texture goes on top, so both are ironed out while the shape stays:
#   - Taubin smoothing of the positions (volume-preserving, no shrink), open borders pinned
#   - the baked shade is blurred over the surface (keeps the soft AO of folds and seams, drops the flecks)
# usage: python3 smooth_fabric.py <in-prefix> <out-prefix> <slot> [--taubin N] [--shade-blur K]
import sys, json, argparse, numpy as np, scipy.sparse as sp
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('slot')
ap.add_argument('--taubin', type=int, default=20); ap.add_argument('--shade-blur', type=int, default=40)
A = ap.parse_args()
m = json.load(open(A.src + '.json')); b = open(A.src + '.bin', 'rb').read(); o = 0; parts = []
for s in m['slots']:
    d = {}
    for k, dt, n in (('pos', np.float32, s['nv'] * 3), ('nor', np.float32, s['nv'] * 3), ('uv', np.float32, s['nv'] * 2), ('shade', np.uint8, s['nv']), ('idx', np.uint32, s['ni'])):
        d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
    parts.append((s, d))
for s, d in parts:
    if s['slot'] != A.slot: continue
    P = d['pos'].reshape(-1, 3).astype(np.float64); I = d['idx'].reshape(-1, 3)
    _, w = np.unique(np.round(P, 6), axis=0, return_inverse=True); w = w.ravel(); T = w[I]; n = w.max() + 1
    Q = np.zeros((n, 3)); np.add.at(Q, w, P); Q /= np.bincount(w, minlength=n)[:, None]
    r = np.r_[T[:, 0], T[:, 1], T[:, 2], T[:, 1], T[:, 2], T[:, 0]]; c = np.r_[T[:, 1], T[:, 2], T[:, 0], T[:, 0], T[:, 1], T[:, 2]]
    Adj = sp.csr_matrix((np.ones(len(r)), (r, c)), shape=(n, n)); Adj.data[:] = 1
    W = sp.diags(1 / np.maximum(np.asarray(Adj.sum(1)).ravel(), 1)) @ Adj
    E = np.sort(np.c_[r, c], 1); u, cnt = np.unique(E, axis=0, return_counts=True); border = np.zeros(n, bool); border[u[cnt == 2].ravel()] = True   # each undirected edge appears twice per face side
    free = ~border
    for _ in range(A.taubin):
        for lam in (0.5, -0.53):
            Q[free] += lam * ((W @ Q)[free] - Q[free])
    sh = np.zeros(n); np.add.at(sh, w, d['shade'].astype(np.float64)); sh /= np.bincount(w, minlength=n)
    for _ in range(A.shade_blur): sh = W @ sh
    d['pos'] = Q[w].astype(np.float32).ravel(); d['shade'] = np.clip(sh[w], 0, 255).astype(np.uint8)
    print(A.slot, 'smoothed', n, 'verts, border pinned', border.sum())
with open(A.dst + '.bin', 'wb') as f:
    for s, d in parts:
        for k in ('pos', 'nor', 'uv', 'shade', 'idx'): f.write(d[k].tobytes())
json.dump(m, open(A.dst + '.json', 'w'))
