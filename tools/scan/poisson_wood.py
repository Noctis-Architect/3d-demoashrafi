# poisson_wood: rebuild a scanned wood slot as a closed, watertight solid (screened Poisson on its points + normals).
# Thin parts that were scanned only from the front (rails, the sides of the arm posts) get a real back and sides.
#   python poisson_wood.py <s2-prefix> <slot> [depth=11] [tris=140000] [keep=0.025]
# Faces farther than <keep> from the scan points (Poisson's closing blobs) are cut. Rewrites the slot in place.
import sys, json, numpy as np, pymeshlab as ml
from scipy.spatial import cKDTree
pref, slot = sys.argv[1], sys.argv[2]
DEPTH = int(sys.argv[3]) if len(sys.argv) > 3 else 11; TRIS = int(sys.argv[4]) if len(sys.argv) > 4 else 140000
KEEPD = float(sys.argv[5]) if len(sys.argv) > 5 else 0.025
m = json.load(open(pref + '.json')); b = open(pref + '.bin', 'rb').read(); o = 0; slots = []
for s in m['slots']:
    nv, ni = s['nv'], s['ni']; d = {}
    for k, dt, n in (('pos', np.float32, nv * 3), ('nor', np.float32, nv * 3), ('uv', np.float32, nv * 2), ('shade', np.uint8, nv), ('idx', np.uint32, ni)):
        d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
    d['pos'] = d['pos'].reshape(-1, 3); d['nor'] = d['nor'].reshape(-1, 3); d['uv'] = d['uv'].reshape(-1, 2); d['idx'] = d['idx'].reshape(-1, 3)
    slots.append((s, d))
RAIL = float(sys.argv[6]) if len(sys.argv) > 6 else 0; POSTX, POSTZ = (float(v) for v in (sys.argv[7].split(',') if len(sys.argv) > 7 else ('9', '9')))
def clip(P, I, attrs, y0, keep_below, skip=None, axis=1, fn=None):
    # cut triangles exactly at the plane y=y0 (straight edge, no triangle teeth). skip: faces left untouched.
    P = P.astype(np.float64); attrs = [a.astype(np.float64) for a in attrs]
    d = ((fn(P) if fn is not None else P[:, axis]) - y0) * (1 if keep_below else -1)            # keep side: d <= 0
    newP, newA, out = [P], [[a] for a in attrs], []
    cache = {}; n = [len(P)]
    def cut(a, b):
        k = (min(a, b), max(a, b))
        if k in cache: return cache[k]
        t = d[a] / (d[a] - d[b]); newP.append((P[a] + t * (P[b] - P[a]))[None])
        for q, A_ in enumerate(attrs): newA[q].append((A_[a] + t * (A_[b] - A_[a]))[None])
        cache[k] = n[0]; n[0] += 1; return cache[k]
    ins = d[I] <= 0
    for fi, (t, k) in enumerate(zip(I, ins)):
        if (skip is not None and skip[fi]) or k.all(): out.append(t); continue
        if not k.any(): continue
        poly = []
        for e in range(3):
            a, b = t[e], t[(e + 1) % 3]
            if d[a] <= 0: poly.append(a)
            if (d[a] <= 0) != (d[b] <= 0): poly.append(cut(a, b))
        for q in range(1, len(poly) - 1): out.append([poly[0], poly[q], poly[q + 1]])
    P2 = np.vstack(newP); A2 = [np.vstack(x) for x in newA]; I2 = np.array(out, np.int64)
    used, inv = np.unique(I2.ravel(), return_inverse=True)
    return P2[used].astype(np.float32), inv.reshape(-1, 3).astype(np.uint32), [a[used] for a in A2]

for s, d in slots:
    if s['slot'] != slot: continue
    P, I = d['pos'].astype(np.float64), d['idx']
    # dense oriented samples: vertices + face centres (face normals agree with the vertex normals' side)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]); fa = np.linalg.norm(fn, axis=1); fn /= np.maximum(fa, 1e-12)[:, None]
    vn = d['nor'].astype(np.float64); fn *= np.sign(np.einsum('ij,ij->i', fn, vn[I].sum(1)))[:, None]
    pts = np.r_[P, P[I].mean(1)]; nrm = np.r_[vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-9), fn]
    ms = ml.MeshSet(); ms.add_mesh(ml.Mesh(vertex_matrix=pts, v_normals_matrix=nrm))
    ms.generate_surface_reconstruction_screened_poisson(depth=DEPTH, preclean=True, pointweight=6, samplespernode=1.5)
    R = ms.current_mesh(); V = R.vertex_matrix(); F = R.face_matrix(); c = V[F].mean(1)
    ok = cKDTree(pts).query(c)[0] < KEEPD
    ms2 = ml.MeshSet(); ms2.add_mesh(ml.Mesh(vertex_matrix=V, face_matrix=F[ok]))
    ms2.meshing_remove_unreferenced_vertices(); ms2.meshing_remove_connected_component_by_face_number(mincomponentsize=200)
    ms2.meshing_decimation_quadric_edge_collapse(targetfacenum=TRIS, preservenormal=True, preserveboundary=True, optimalplacement=True)
    ms2.compute_normal_per_vertex(weightmode='By Angle')
    R2 = ms2.current_mesh(); V2 = R2.vertex_matrix().astype(np.float32); F2 = R2.face_matrix().astype(np.uint32)
    if RAIL:   # straight rail line again: above it only the arm-front posts
        cc = V2[F2].mean(1); post = (np.abs(cc[:, 0]) > POSTX) & (cc[:, 2] > POSTZ)
        V2, F2, _ = clip(V2, F2, [], RAIL, True, skip=post)
    for _ in range(12):   # sawtooth on trimmed edges: drop triangles with 2+ free edges (edge straightens, carving untouched)
        E = np.sort(np.r_[F2[:, [0, 1]], F2[:, [1, 2]], F2[:, [2, 0]]], 1); key = E[:, 0].astype(np.int64) * (len(V2) + 1) + E[:, 1]
        _, inv_, cnt = np.unique(key, return_inverse=True, return_counts=True); free = (cnt[inv_] == 1).reshape(3, -1).T.sum(1)
        if not (free >= 2).any(): break
        F2 = F2[free < 2]
    used, inv = np.unique(F2.ravel(), return_inverse=True); V2 = V2[used]; F2 = inv.reshape(-1, 3).astype(np.uint32)
    fn2 = np.cross(V2[F2[:, 1]] - V2[F2[:, 0]], V2[F2[:, 2]] - V2[F2[:, 0]]); N2 = np.zeros_like(V2)
    for k in range(3): np.add.at(N2, F2[:, k], fn2)
    N2 = (N2 / np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-12)).astype(np.float32)
    _, j = cKDTree(P).query(V2)
    if (np.einsum('ij,ij->i', N2, d['nor'][j]) < 0).mean() > 0.5: F2 = F2[:, [0, 2, 1]].copy(); N2 = -N2
    d.update(pos=V2, nor=N2, uv=d['uv'][j], shade=d['shade'][j], idx=F2); s.update(nv=len(V2), ni=F2.size)
    print(slot, 'poisson solid: verts', len(V2), 'tris', len(F2))
with open(pref + '.bin', 'wb') as f:
    for s, d in slots:
        for k in ('pos', 'nor', 'uv', 'shade', 'idx'): f.write(np.ascontiguousarray(d[k]).tobytes())
json.dump(dict(m, slots=[s for s, _ in slots]), open(pref + '.json', 'w'))
