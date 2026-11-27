# seg2: clean wood / fabric split of a scanned upholstered piece, per TRIANGLE (exact scan geometry kept).
#  data term : 2-class Gaussian classifier on the scan colour (value, saturation, blue tint), trained on the confident
#              interior of the first rough labels (seg.py)
#  location  : wood only in the rail band / legs and in the arm-front posts (the rest is upholstery)
#  smoothness: mean-field over the triangle adjacency; weights drop across creases, so the boundary snaps to the
#              real crease where the carved wood meets the fabric
#  cleanup   : islands of either class smaller than MIN faces are flipped
#   python3 seg2.py chester
# reads /tmp/scan-work/s1/<id>{.bin,.json,_lab.npy}; writes /tmp/scan-work/s1/<id>_flab.npy (face labels: 0 fabric, 1 wood, 2 pillows)
import sys, numpy as np, scipy.sparse as sp
from load import load
from vizglb import write
name = sys.argv[1]; S = '/tmp/scan-work/s1/'
pos, nor, uv, idx, col = load(S + name); lab = np.load(S + name + '_lab.npy')
CFG = {'chester': dict(length=2.24, rail=0.249, post=(0.94, 0.40), beta=1.2, mn=400)}[name]
nf = len(idx)
# final metric frame (as stage2: front +x -> +z, floor y=0, length scaled)
P = np.c_[-pos[:, 2], pos[:, 1], pos[:, 0]].astype(np.float64); s_ = CFG['length'] / (P[:, 0].max() - P[:, 0].min())
P = (P - [(P[:, 0].max() + P[:, 0].min()) / 2, P[:, 1].min(), (P[:, 2].max() + P[:, 2].min()) / 2]) * s_
c = col.astype(np.float64) / 255; v = c.max(1); sat = (c.max(1) - c.min(1)) / (v + 1e-6); bl = c[:, 2] - c[:, 0]
X = np.c_[v, sat, bl][idx].mean(1)                     # per-face features
fc = P[idx].mean(1)
flab0 = np.array([np.bincount(r, minlength=3).argmax() for r in lab[idx]])
pil = flab0 == 2
# location prior: where wood can be at all
rail, (px, pz) = CFG['rail'], CFG['post']
woodzone = (fc[:, 1] < rail) | ((np.abs(fc[:, 0]) > px) & (fc[:, 2] > pz))
# classifier trained on confident faces of the rough labels
def gauss(m):
    mu = X[m].mean(0); C = np.cov(X[m].T) + np.eye(3) * 1e-5; Ci = np.linalg.inv(C)
    return lambda Z: -0.5 * np.einsum('ij,jk,ik->i', Z - mu, Ci, Z - mu) - 0.5 * np.log(np.linalg.det(C))
gw = gauss((flab0 == 1) & woodzone); gf = gauss((flab0 == 0) & ~woodzone)
d = np.clip(gw(X) - gf(X), -12, 12)
d[~woodzone] = -12                                    # no wood outside the rail band / posts
d[fc[:, 1] < rail - 0.004] += 9                       # below the rail top it is the wooden rail (texture bled fabric colour onto it)
# face adjacency with crease-aware weights
E = np.r_[idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]]; F_ = np.r_[np.arange(nf), np.arange(nf), np.arange(nf)]
E = np.sort(E, 1); key = E[:, 0].astype(np.int64) * (len(pos) + 1) + E[:, 1]
o = np.argsort(key); key, F_ = key[o], F_[o]; same = key[1:] == key[:-1]
a, b = F_[:-1][same], F_[1:][same]
fn = np.cross(P[idx[:, 1]] - P[idx[:, 0]], P[idx[:, 2]] - P[idx[:, 0]]); fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
cosd = np.clip(np.einsum('ij,ij->i', fn[a], fn[b]), -1, 1)
w = np.exp(-(1 - cosd) / 0.08)                        # creases (wood/fabric seams) barely couple
W = sp.csr_matrix((np.r_[w, w], (np.r_[a, b], np.r_[b, a])), shape=(nf, nf))
deg = np.asarray(W.sum(1)).ravel() + 1e-9
q = 1 / (1 + np.exp(-d))
for _ in range(40):                                   # mean-field
    m_ = (W @ (2 * q - 1)) / deg
    q = 1 / (1 + np.exp(-(d + CFG['beta'] * 4 * m_)))
f = (q > 0.5).astype(int)
# islands: flip small components of either label
def comps(mask):
    sel = mask[a] & mask[b]
    G = sp.csr_matrix((np.ones(sel.sum()), (a[sel], b[sel])), shape=(nf, nf))
    from scipy.sparse.csgraph import connected_components
    n, l = connected_components(G, directed=False); return l
for it in range(2):
    for k in (1, 0):
        l = comps(f == k); cnt = np.bincount(l[f == k], minlength=l.max() + 1)
        small = (f == k) & (cnt[l] < CFG['mn']); f[small] = 1 - k
f[~woodzone] = 0                                     # islands can't create wood on the upholstery
f[fc[:, 1] < rail] = 1                               # the whole rail band is wood: straight top line, no fabric gaps on it
# post edges: a few rounds of neighbour majority (straightens the triangle-level zigzag)
post = (np.abs(fc[:, 0]) > px) & (fc[:, 2] > pz) & (fc[:, 1] >= rail)
Au = sp.csr_matrix((np.ones(2 * len(a)), (np.r_[a, b], np.r_[b, a])), shape=(nf, nf))
for _ in range(6):
    votes = Au @ (f == 1).astype(float); tot = np.asarray(Au.sum(1)).ravel()
    f = np.where(post, np.where(votes > tot / 2, 1, np.where(votes < tot / 2, 0, f)), f)
f[pil] = 2
np.save(S + name + '_flab.npy', f)
print(name, 'faces wood %.3f fabric %.3f pillows %.3f' % ((f == 1).mean(), (f == 0).mean(), (f == 2).mean()))
# visual check: per-face colours (duplicated verts)
PAL = np.array([[200, 200, 200], [220, 40, 40], [40, 90, 220]])
vp = pos[idx].reshape(-1, 3); vn = np.repeat(fn.astype(np.float32), 3, 0)
vn = np.c_[vn[:, 2], vn[:, 1], -vn[:, 0]]   # back to raw axes for the viewer (raw = rotate back)
vn = nor[idx].reshape(-1, 3)
write(S + name + '_flab.glb', vp, vn, np.arange(len(vp)).reshape(-1, 3), np.repeat(PAL[f], 3, 0))
