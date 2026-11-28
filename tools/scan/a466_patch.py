# a466_patch: sofa-A466 (L sofa). The scanned throw pillows were cut out (label 2) and left holes in the seat and back
# cushions of the two outer bays. The bays are identical modules, so the holes are filled with the clean MIDDLE bay
# of the same scan (exact scan geometry, no Poisson blur), cut with exact planes inside the gaps between cushions:
#   - left bay  (x -1.15..-0.40): whole bay = middle bay, stretched in x to the bay width
#   - chaise bay back cushion (z < -0.44, above the seat) = middle bay back cushion
#   - chaise seat behind z=0.10 (under the pillows) = the chaise's own clean seat 0.50 m further forward
# plus: the left arm's unscanned inner face is repeated from its clean front stretch, and the right arm (inner face
# missing, pillow edge over the outer face) is the repaired left arm mirrored (both arms have the same size).
# reads /tmp/scan-work/s2/a466.{json,bin} (stage2), writes /tmp/scan-work/s2/a466_np.{json,bin} (fabric + frame).
import sys, json, numpy as np
sys.path.insert(0, '/tmp/scan-work')
S = '/tmp/scan-work/s2/'
m = json.load(open(S + 'a466.json')); b = open(S + 'a466.bin', 'rb').read(); o = 0; D = {}
for s in m['slots']:
    d = {}
    for k, dt, n in (('pos', np.float32, s['nv'] * 3), ('nor', np.float32, s['nv'] * 3), ('uv', np.float32, s['nv'] * 2), ('shade', np.uint8, s['nv']), ('idx', np.uint32, s['ni'])):
        d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
    D[s['slot']] = dict(meta=s, P=d['pos'].reshape(-1, 3).astype(np.float64), N=d['nor'].reshape(-1, 3).astype(np.float64),
                        UV=d['uv'].reshape(-1, 2).astype(np.float64), SH=d['shade'].astype(np.float64), I=d['idx'].reshape(-1, 3).astype(np.int64))

def mesh(P, N, UV, SH, I): return dict(P=P, N=N, UV=UV, SH=SH, I=I)
def clip(M, f):
    """keep the part with f(P) <= 0, cutting crossing triangles exactly on f = 0."""
    d = f(M['P']); I = M['I']; s = d[I] <= 0; k = s.all(1); mix = s.any(1) & ~k
    P, N, UV, SH = [M['P']], [M['N']], [M['UV']], [M['SH']]; n = len(M['P']); cache = {}; out = [I[k]]
    def cut(a, c):
        key = (min(a, c), max(a, c))
        if key not in cache:
            nonlocal n
            t = d[a] / (d[a] - d[c])
            P.append((M['P'][a] + t * (M['P'][c] - M['P'][a]))[None]); N.append((M['N'][a] + t * (M['N'][c] - M['N'][a]))[None])
            UV.append((M['UV'][a] + t * (M['UV'][c] - M['UV'][a]))[None]); SH.append(np.array([M['SH'][a] + t * (M['SH'][c] - M['SH'][a])]))
            cache[key] = n; n += 1
        return cache[key]
    extra = []
    for tri, ss in zip(I[mix], s[mix]):
        # rotate so the odd vertex is first
        odd = int(np.where(ss)[0][0]) if ss.sum() == 1 else int(np.where(~ss)[0][0])
        a, b_, c = tri[odd], tri[(odd + 1) % 3], tri[(odd + 2) % 3]
        ab, ac = cut(a, b_), cut(a, c)
        if ss.sum() == 1: extra.append([a, ab, ac])                       # only the odd vertex is kept
        else: extra += [[ab, b_, c], [ab, c, ac]]                          # odd vertex dropped: quad remains
    out.append(np.array(extra, np.int64).reshape(-1, 3))
    R = mesh(np.vstack(P), np.vstack(N), np.vstack(UV), np.concatenate(SH), np.vstack(out))
    return compact(R)
def compact(M):
    used, inv = np.unique(M['I'].ravel(), return_inverse=True)
    return mesh(M['P'][used], M['N'][used], M['UV'][used], M['SH'][used], inv.reshape(-1, 3))
def merge(*Ms):
    o = 0; parts = []
    for M in Ms: parts.append(M['I'] + o); o += len(M['P'])
    return mesh(*(np.concatenate([M[k] for M in Ms]) for k in ('P', 'N', 'UV', 'SH')), np.vstack(parts))
# half-space helpers: axis value; lo/hi = keep coordinate below/above
AX = {'x': 0, 'y': 1, 'z': 2}
def below(ax, v): return lambda P: P[:, AX[ax]] - v
def above(ax, v): return lambda P: v - P[:, AX[ax]]
def box(M, planes):
    """split M into (inside all planes, outside)."""
    outs = []; rest = M
    for f in planes:
        outs.append(clip(rest, lambda P, f=f: -f(P))); rest = clip(rest, f)
    return rest, merge(*outs)
def xmap(M, a0, a1, b0, b1):
    """stretch the x range [a0,a1] onto [b0,b1]"""
    k = (b1 - b0) / (a1 - a0); P = M['P'].copy(); P[:, 0] = b0 + (P[:, 0] - a0) * k
    N = M['N'].copy(); N[:, 0] /= k; N /= np.linalg.norm(N, axis=1, keepdims=True)
    return dict(M, P=P, N=N)
def zshift(M, dz): P = M['P'].copy(); P[:, 2] += dz; return dict(M, P=P)
from scipy.spatial import cKDTree
def bedges(M):
    E = np.sort(np.r_[M['I'][:, [0, 1]], M['I'][:, [1, 2]], M['I'][:, [2, 0]]], 1); u, c = np.unique(E, axis=0, return_counts=True); return u[c == 1]
def put(T, piece, planes, tol=0.015):
    """merge a transplanted piece into T and zip the seams: the piece's vertices lying on each cut plane are snapped
    onto T's open boundary on that plane (and vice versa), so no slit opens where the two scans differ by a few mm."""
    for ax, v in planes:
        k = AX[ax]
        for A, B in ((T, piece), (piece, T)):
            be = bedges(A); on = (np.abs(A['P'][be[:, 0], k] - v) < 1e-6) & (np.abs(A['P'][be[:, 1], k] - v) < 1e-6); be = be[on]
            if not len(be): continue
            a, b_ = A['P'][be[:, 0]], A['P'][be[:, 1]]; L = np.linalg.norm(b_ - a, axis=1); n = np.maximum(1, np.ceil(L / 0.001)).astype(int)
            pts = np.vstack([a[i] + (b_[i] - a[i]) * np.linspace(0, 1, n[i] + 1)[:, None] for i in range(len(be))])
            bv = np.unique(bedges(B).ravel()); bv = bv[np.abs(B['P'][bv, k] - v) < 1e-6]
            if not len(bv): continue
            d, j = cKDTree(pts).query(B['P'][bv]); sn = d < tol; B['P'][bv[sn]] = pts[j[sn]]
    return merge(T, piece)

F0 = D['fabric']; T = mesh(F0['P'], F0['N'], F0['UV'], F0['SH'], F0['I'])
print('fabric tris', len(T['I']))

SEAM_L, SEAM_R, ARM_L, ARM_R = -0.40, 0.37, -1.15, 1.145   # gaps between seat cushions, inner faces of the arms
BACK = -0.725                                              # gap between the back cushions and the fixed back
def mirror(M):
    P = M['P'].copy(); P[:, 0] *= -1; N = M['N'].copy(); N[:, 0] *= -1
    return dict(M, P=P, N=N, I=M['I'][:, [0, 2, 1]])
# 1) left arm: a pillow scrap lay on its top and the inner face behind the pillows was never scanned (hole).
#    The scrap (anything above the arm's clean cross-section) is cut away, and a backing skin is laid 2 mm inside the
#    arm: the arm's own cross-section (sliced at the clean z=-0.15) swept along the depth. Where the scan surface
#    exists it hides the skin; where the scan has a hole, the skin shows (same shape) instead of the background.
P0 = T['P']; E = np.r_[T['I'][:, [0, 1]], T['I'][:, [1, 2]], T['I'][:, [2, 0]]]
za, zb = P0[E[:, 0], 2] + 0.15, P0[E[:, 1], 2] + 0.15; cr = (za * zb) < 0; E = E[cr]; t = (za[cr] / (za[cr] - zb[cr]))[:, None]
X = P0[E[:, 0]] + t * (P0[E[:, 1]] - P0[E[:, 0]]); X = X[(X[:, 0] < -1.15) & (X[:, 1] > 0.38)]   # slice of the arm at z=-0.15
CX, CY = -1.275, 0.40
ang = np.arctan2(X[:, 1] - CY, X[:, 0] - CX); rad = np.hypot(X[:, 0] - CX, X[:, 1] - CY)
A = np.linspace(np.percentile(ang, 0.5), np.percentile(ang, 99.5), 120)
# outer envelope of the slice per angle (the slice also cuts the welt and the seat gap) -> smooth profile
Rb = np.array([rad[(ang > a - 0.03) & (ang < a + 0.03)].max(initial=0) for a in A]); Rb[Rb == 0] = np.median(Rb[Rb > 0])
Rb = np.convolve(np.pad(Rb, 2, mode='edge'), np.ones(5) / 5, 'valid')
prof = np.c_[CX + Rb * np.cos(A), CY + Rb * np.sin(A)]
c = P0[T['I']].mean(1)
ca = np.arctan2(c[:, 1] - CY, c[:, 0] - CX); cr_ = np.hypot(c[:, 0] - CX, c[:, 1] - CY)
scrap = (c[:, 0] < -1.15) & (c[:, 0] > -1.30) & (c[:, 1] > 0.40) & (c[:, 2] > -0.66) & (c[:, 2] < -0.10) & (ca > A[0]) & (ca < A[-1]) & (cr_ > np.interp(ca, A, Rb) + 0.012)
# the scan's ragged lip around the unscanned patch on the inner face: the whole inner-face band goes, the skin takes over
lip = (c[:, 0] < -1.15) & (c[:, 0] > -1.215) & (c[:, 1] > 0.40) & (c[:, 1] < 0.62) & (c[:, 2] > -0.70) & (c[:, 2] < -0.12)
T = compact(dict(T, I=T['I'][~(scrap | lip)])); print('arm scrap/lip tris dropped', (scrap | lip).sum())
inset = prof - 0.0012 * np.c_[np.cos(A), np.sin(A)]
zs = np.linspace(-0.72, -0.08, 130); nA, nZ = len(A), len(zs)
SP = np.array([[px, py, z] for z in zs for px, py in inset]); SN = np.array([[np.cos(a), np.sin(a), 0] for z in zs for a in A])
q = np.arange(nA - 1)[None, :] + nA * np.arange(nZ - 1)[:, None]; q = q.ravel()
SI = np.r_[np.c_[q, q + nA, q + 1], np.c_[q + 1, q + nA, q + nA + 1]]
# orientation: normals point out of the arm
fn = np.cross(SP[SI[:, 1]] - SP[SI[:, 0]], SP[SI[:, 2]] - SP[SI[:, 0]])
if (np.einsum('ij,ij->i', fn, SN[SI[:, 0]]) < 0).mean() > 0.5: SI = SI[:, [0, 2, 1]]
_, j = cKDTree(T['P']).query(SP)
skin = mesh(SP, SN, T['UV'][j], T['SH'][j].astype(np.float64), SI.astype(np.int64))   # shade of the nearest scan point: no lighter band
T = merge(T, clip(clip(skin, below('x', -1.152)), above('x', -1.28)))   # inner face + inner half of the top only
# 1b) right arm: its inner face was hidden by the pillows (missing) and a pillow edge hung over its outer face.
#    Both arms have the same size and depth -> the right arm is the (repaired) left arm mirrored.
arm, _ = box(T, [below('x', -1.152), below('z', 0.03)])
_, T = box(T, [above('x', 1.152), below('z', 0.03)])
T = put(T, mirror(arm), [('x', 1.152), ('z', 0.03)])
src = T
# 2) left bay = middle bay
mid, _ = box(src, [above('x', SEAM_L), below('x', SEAM_R), above('z', BACK)])
_, T = box(T, [above('x', ARM_L), below('x', SEAM_L), above('z', BACK)])
T = put(T, xmap(mid, SEAM_L, SEAM_R, ARM_L, SEAM_L), [('x', ARM_L), ('x', SEAM_L), ('z', BACK)])
# 3) chaise seat under the pillows (and under the front of the back cushion) = the same seat 0.50 m further forward
DZ, Z0 = 0.50, -0.475
cs, _ = box(src, [above('x', SEAM_R), below('x', 1.152), above('z', Z0 + DZ), below('z', 0.10 + DZ), above('y', 0.30)])
_, T = box(T, [above('x', SEAM_R), below('x', 1.152), above('z', Z0), below('z', 0.10), above('y', 0.30)])
T = put(T, zshift(cs, -DZ), [('x', SEAM_R), ('x', 1.152), ('z', Z0), ('z', 0.10), ('y', 0.30)])
# 4) chaise bay back cushion = middle back cushion (its bottom tucks just into the slightly higher chaise seat)
cb, _ = box(src, [above('x', SEAM_L), below('x', SEAM_R), above('z', BACK), below('z', -0.44), above('y', 0.40)])
_, T = box(T, [above('x', SEAM_R), below('x', ARM_R), above('z', BACK), below('z', Z0), above('y', 0.30)])
_, T = box(T, [above('x', SEAM_R), below('x', ARM_R), above('z', BACK), below('z', -0.44), above('y', 0.413)])
T = put(T, xmap(cb, SEAM_L, SEAM_R, SEAM_R, ARM_R), [('x', SEAM_R), ('x', ARM_R), ('z', BACK)])
# weld the seams: open-border vertices of the two sides that the zipping brought within 2 mm get one position
be = bedges(T); bv = np.unique(be.ravel()); tr = cKDTree(T['P'][bv]); pr = tr.query_pairs(0.0006, output_type='ndarray')
if len(pr):   # pairs on the same side (sharing an edge) stay apart
    a, b_ = bv[pr[:, 0]], bv[pr[:, 1]]; E = set(map(tuple, np.sort(np.r_[T['I'][:, [0, 1]], T['I'][:, [1, 2]], T['I'][:, [2, 0]]], 1).tolist()))
    k = np.array([(min(x, y), max(x, y)) not in E for x, y in zip(a, b_)]); a, b_ = a[k], b_[k]; pr = pr[k]
    mid = (T['P'][a] + T['P'][b_]) / 2; T['P'][a] = mid; T['P'][b_] = mid
print('seam vertex pairs welded', len(pr))
print('patched fabric tris', len(T['I']))

out = [('fabric', T), ('frame', mesh(D['frame']['P'], D['frame']['N'], D['frame']['UV'], D['frame']['SH'], D['frame']['I']))]
metas = []
with open(S + 'a466_np.bin', 'wb') as f:
    for name, M in out:
        for a in (M['P'].astype(np.float32), M['N'].astype(np.float32), M['UV'].astype(np.float32), np.clip(M['SH'], 0, 255).astype(np.uint8), M['I'].astype(np.uint32).ravel()):
            f.write(a.tobytes())
        metas.append(dict(D[name]['meta'], nv=len(M['P']), ni=M['I'].size))
json.dump(dict(m, slots=metas), open(S + 'a466_np.json', 'w'))
print('done', [(x['slot'], x['nv'], x['ni'] // 3) for x in metas])
