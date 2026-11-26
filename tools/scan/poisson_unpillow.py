# poisson_unpillow: turn a scanned upholstered piece into a clean, light body for code pillows.
#  - drops the scanned throw pillows and rebuilds the upholstery under them (screened Poisson, needs pymeshlab + scipy)
#  - optional: rebuild from the cleaner half mirrored (symmetric products)
#  - irons scan wrinkles (global Taubin + harder in chosen regions) and blurs the scan's baked shading
#  - wood/fabric seams without gaps: the fabric is NOT cut at the wood; near the wood it is pushed slightly inward,
#    so the wood always shows in front and there is fabric (a dark crevice) behind every seam, never the background.
#    Wood above the rail line is mislabeled fabric skin and is dropped, except at the arm-front posts.
#
#   python poisson_unpillow.py <id> --depth 10 --tris 160000 --smooth 300 --mirror left \
#          --iron "(x>-0.2)&&(x<0.2)&&(y>0.5)&&(z<-0.12)" --iron "..." --rail 0.25 --post 0.94,0.42
# reads /tmp/scan-work/s2/<id>.{json,bin}; writes /tmp/scan-work/s2/<id>_np.{json,bin} (slots without 'pillows').
import sys, json, argparse, numpy as np, pymeshlab as ml
from scipy.spatial import cKDTree
import scipy.sparse as sp
ap = argparse.ArgumentParser()
ap.add_argument('name'); ap.add_argument('--depth', type=int, default=10); ap.add_argument('--tris', type=int, default=160000)
ap.add_argument('--smooth', type=int, default=0); ap.add_argument('--mirror', default='')
ap.add_argument('--iron', action='append', default=[]); ap.add_argument('--iron-steps', type=int, default=300)
ap.add_argument('--rail', type=float, default=0); ap.add_argument('--post-in', type=float, default=0); ap.add_argument('--cushion', default=''); ap.add_argument('--cushion-top', default='0.456,0.06'); ap.add_argument('--erode', type=int, default=0); ap.add_argument('--erode-post', type=int, default=0); ap.add_argument('--wood-holes', type=int, default=80); ap.add_argument('--post-top', type=float, default=0.56); ap.add_argument('--post', default='9,9')
ap.add_argument('--pw', type=float, default=4); ap.add_argument('--chan', type=float, default=0); ap.add_argument('--iso', type=float, default=0.08); ap.add_argument('--sharp', type=float, default=4); ap.add_argument('--relief', type=float, default=0); ap.add_argument('--relief-len', type=float, default=0.05); ap.add_argument('--flat', type=float, default=0); ap.add_argument('--center', default='0,0.15'); ap.add_argument('--push', type=float, default=0.012); ap.add_argument('--shade-blur', type=int, default=60)
A = ap.parse_args(); name = A.name; POSTX, POSTZ = (float(v) for v in A.post.split(','))
S = '/tmp/scan-work/s2/'; RAD = 0.02; KEEP = 0.02; ZONE = 0.12
m = json.load(open(S + name + '.json')); b = open(S + name + '.bin', 'rb').read(); o = 0
def take(dt, n):
    global o; a = np.frombuffer(b, dt, n, o).copy(); o += a.nbytes; return a
slots = []
for s in m['slots']:
    nv, ni = s['nv'], s['ni']
    slots.append(dict(meta=s, pos=take(np.float32, nv * 3).reshape(-1, 3), nor=take(np.float32, nv * 3).reshape(-1, 3),
                      uv=take(np.float32, nv * 2).reshape(-1, 2), shade=take(np.uint8, nv), idx=take(np.uint32, ni).reshape(-1, 3)))
by = {s['meta']['slot']: s for s in slots}

def mirror_pts(d, side):
    k = d['pos'][:, 0] <= 0 if side == 'left' else d['pos'][:, 0] >= 0
    p, n = d['pos'][k], d['nor'][k]
    return dict(d, pos=np.r_[p, p * [-1, 1, 1]].astype(np.float32), nor=np.r_[n, n * [-1, 1, 1]].astype(np.float32),
                uv=np.r_[d['uv'][k], d['uv'][k]], shade=np.r_[d['shade'][k], d['shade'][k]])
def mirror_mesh(d, side):   # faces on the chosen side (centroid) + their mirror image (winding flipped)
    c = d['pos'][d['idx']].mean(1)[:, 0]; I = d['idx'][(c <= 0.002) if side == 'left' else (c >= -0.002)]
    used, inv = np.unique(I.ravel(), return_inverse=True); I = inv.reshape(-1, 3).astype(np.uint32); n = len(used)
    p, nr = d['pos'][used], d['nor'][used]
    return dict(meta=dict(d['meta'], nv=2 * n, ni=I.size * 2), pos=np.r_[p, p * [-1, 1, 1]].astype(np.float32), nor=np.r_[nr, nr * [-1, 1, 1]].astype(np.float32),
                uv=np.r_[d['uv'][used], d['uv'][used]], shade=np.r_[d['shade'][used], d['shade'][used]], idx=np.r_[I, I[:, [0, 2, 1]] + n].astype(np.uint32))
def submesh(d, I):
    used, inv = np.unique(I.ravel(), return_inverse=True)
    return dict(meta=dict(d['meta'], nv=len(used), ni=I.size), pos=d['pos'][used], nor=d['nor'][used], uv=d['uv'][used], shade=d['shade'][used], idx=inv.reshape(-1, 3).astype(np.uint32))
def islands(I, n, minf):
    par = np.arange(n)
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for t in I:
        a = find(t[0]); par[find(t[1])] = a; par[find(t[2])] = a
    root = np.array([find(t[0]) for t in I]); u, cnt = np.unique(root, return_counts=True); big = set(u[cnt >= minf])
    return I[np.array([r in big for r in root])]
def vnormals(V, Fi):
    fn = np.cross(V[Fi[:, 1]] - V[Fi[:, 0]], V[Fi[:, 2]] - V[Fi[:, 0]]); N = np.zeros_like(V)
    for k in range(3): np.add.at(N, Fi[:, k], fn)
    return (N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)).astype(np.float32)
def smooth_attr(x, Fi, n, it):
    r = np.r_[Fi[:, 0], Fi[:, 1], Fi[:, 2], Fi[:, 1], Fi[:, 2], Fi[:, 0]]; c = np.r_[Fi[:, 1], Fi[:, 2], Fi[:, 0], Fi[:, 0], Fi[:, 1], Fi[:, 2]]
    Adj = sp.csr_matrix((np.ones(len(r), np.float32), (r, c)), shape=(n, n)); Adj.data[:] = 1; Adj = Adj + sp.identity(n, format='csr')
    W = sp.diags(1 / np.asarray(Adj.sum(1)).ravel()) @ Adj
    for _ in range(it): x = W @ x
    return x

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

F, Pl = by['fabric'], by['pillows']
if A.mirror: F, Pl = mirror_pts(F, A.mirror), mirror_pts(Pl, A.mirror)

# ---------- wood: rail band + arm-front posts only; no specks ----------
Wd = mirror_mesh(by['frame'], A.mirror) if A.mirror else by['frame']
cw = Wd['pos'][Wd['idx']].mean(1)
postw = (np.abs(cw[:, 0]) > POSTX) & (cw[:, 2] > POSTZ)
if A.rail:
    sh_ = Wd['shade'].astype(np.float64)[:, None]
    Pw, Iw0, (nw, uvw, shw) = clip(Wd['pos'], Wd['idx'], [Wd['nor'], Wd['uv'], sh_], A.rail - 0.003, True, skip=postw)
    Wd = dict(meta=Wd['meta'], pos=Pw, nor=nw.astype(np.float32), uv=uvw.astype(np.float32), shade=np.clip(shw[:, 0], 0, 255).astype(np.uint8), idx=Iw0)
    cw = Wd['pos'][Wd['idx']].mean(1); postw = (np.abs(cw[:, 0]) > POSTX) & (cw[:, 2] > POSTZ)
    # inner edge of the posts between rail and scroll: straight vertical cut (no flaps onto the seat front)
    if A.post_in:
        for sgn in (1, -1):
            cw = Wd['pos'][Wd['idx']].mean(1)
            band = (cw[:, 1] > A.rail + 0.05) & (cw[:, 1] < A.post_top) & (cw[:, 2] > POSTZ - 0.05) & (np.sign(cw[:, 0]) == sgn)
            Pw, Iw0, (nw, uvw, shw) = clip(Wd['pos'], Wd['idx'], [Wd['nor'], Wd['uv'], Wd['shade'].astype(np.float64)[:, None]], sgn * A.post_in, sgn < 0, skip=~band, axis=0)
            Wd = dict(meta=Wd['meta'], pos=Pw, nor=nw.astype(np.float32), uv=uvw.astype(np.float32), shade=np.clip(shw[:, 0], 0, 255).astype(np.uint8), idx=Iw0)
        cw = Wd['pos'][Wd['idx']].mean(1); postw = (np.abs(cw[:, 0]) > POSTX) & (cw[:, 2] > POSTZ)
kw = np.ones(len(cw), bool)
WOOD_KW = kw

# ---------- fabric: Poisson without the pillows ----------
tp = cKDTree(Pl['pos']); keep = tp.query(F['pos'])[0] > RAD
pts_all = F['pos'][keep].astype(np.float64)
# scan fabric points sitting on the wood (above the rail) would make the rebuild grow over the carving: leave them out
wv = Wd['pos'][np.unique(Wd['idx'][WOOD_KW].ravel())] if 'WOOD_KW' in dir() else Wd['pos']
onwood = (cKDTree(wv).query(F['pos'])[0] < 0.012) & (F['pos'][:, 1] > A.rail)
keep &= ~onwood; print('fabric points on wood dropped', onwood.sum())
pts = F['pos'][keep].astype(np.float64); nrm = F['nor'][keep].astype(np.float64); nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
ms = ml.MeshSet(); ms.add_mesh(ml.Mesh(vertex_matrix=pts, v_normals_matrix=nrm))
ms.generate_surface_reconstruction_screened_poisson(depth=A.depth, preclean=True, pointweight=A.pw, samplespernode=1.5)
P = ms.current_mesh(); V = P.vertex_matrix(); Fc = P.face_matrix(); c = V[Fc].mean(1)
d_scan = cKDTree(pts_all).query(c)[0]; d_pil = tp.query(c)[0]
ok = (d_scan < KEEP) | ((d_pil < ZONE) & (d_scan < 0.2))
if A.rail: ok &= c[:, 1] > A.rail - 0.04          # rough cut; exact plane clip after decimation
tw = cKDTree(Wd['pos'][np.unique(Wd['idx'][WOOD_KW].ravel())])
ms2 = ml.MeshSet(); ms2.add_mesh(ml.Mesh(vertex_matrix=V, face_matrix=Fc[ok]))
ms2.meshing_remove_unreferenced_vertices()
ms2.meshing_remove_connected_component_by_face_number(mincomponentsize=3000)
ms2.meshing_repair_non_manifold_edges(); ms2.meshing_close_holes(maxholesize=2000, newfaceselected=False)
if A.smooth: ms2.apply_coord_taubin_smoothing(lambda_=0.5, mu=-0.53, stepsmoothnum=A.smooth)
for cond in A.iron:
    ms2.compute_selection_by_condition_per_vertex(condselect=cond)
    ms2.apply_coord_taubin_smoothing(lambda_=0.5, mu=-0.53, stepsmoothnum=A.iron_steps, selected=True)
ms2.set_selection_none()
# wood flaps lying on the fabric surface (mislabeled skin, thin fringe at the posts / rail top) go
Vd = ms2.current_mesh().vertex_matrix().astype(np.float32); Nd = vnormals(Vd, ms2.current_mesh().face_matrix().astype(np.uint32))
dfw, jf = cKDTree(Vd).query(cw)
wn = np.cross(Wd['pos'][Wd['idx'][:, 1]] - Wd['pos'][Wd['idx'][:, 0]], Wd['pos'][Wd['idx'][:, 2]] - Wd['pos'][Wd['idx'][:, 0]])
wn /= np.maximum(np.linalg.norm(wn, axis=1, keepdims=True), 1e-12)
lying = np.abs(np.einsum('ij,ij->i', wn, Nd[jf])) > 0.75          # parallel to the fabric right under it = a skin flap, not a side of the carving
flap = lying & (dfw < 0.006) & ~postw   # the posts are kept exactly as scanned
kw = WOOD_KW & (~flap | (cw[:, 1] < A.rail - 0.001))   # the rail band itself is always wood
Iw = Wd['idx'][kw]
def erode_teeth(I, P, rounds, ymin, post_rounds=0):
    # remove edge 'teeth' (triangles with 2+ free edges) above ymin, a few rounds: the edge straightens, the carving stays
    for r_ in range(max(rounds, post_rounds)):
        E = np.sort(np.r_[I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]], 1); key = E[:, 0].astype(np.int64) * (len(P) + 1) + E[:, 1]
        u_, inv_, cnt = np.unique(key, return_inverse=True, return_counts=True); free = (cnt[inv_] == 1).reshape(3, -1).T.sum(1)
        cI = P[I].mean(1); inpost = (np.abs(cI[:, 0]) > POSTX) & (cI[:, 2] > POSTZ); drop = (free >= 2) & (cI[:, 1] > ymin) & np.where(inpost, r_ < post_rounds, r_ < rounds)
        if not drop.any(): break
        I = I[~drop]
    return I
Iw = erode_teeth(Iw, Wd['pos'], A.erode, A.rail - 0.002 if A.rail else -1, A.erode_post)
Iw = islands(Iw, len(Wd['pos']), 60)
# small holes in the scanned wood (dark notches where the fabric shows through): fill, without moving any vertex
mw = ml.MeshSet(); mw.add_mesh(ml.Mesh(vertex_matrix=Wd['pos'].astype(np.float64), face_matrix=Iw.astype(np.int32)))
try:
    mw.meshing_repair_non_manifold_edges(method='Remove Faces'); mw.meshing_repair_non_manifold_vertices()
    mw.meshing_close_holes(maxholesize=A.wood_holes, newfaceselected=False, selfintersection=False)
except Exception as ex: print('wood hole fill skipped:', ex)
Vm = mw.current_mesh().vertex_matrix(); dm, jm = cKDTree(Wd['pos']).query(Vm)   # repaired mesh may split verts: map back by position
if dm.max() < 1e-6: Iw2 = jm[mw.current_mesh().face_matrix()].astype(np.uint32); print('wood holes filled, tris', len(Iw), '->', len(Iw2)); Iw = Iw2
else: print('wood hole fill skipped: moved verts', dm.max())
Wd = submesh(Wd, Iw); print('wood tris', len(Iw))
tw = cKDTree(Wd['pos'])
ms2.meshing_decimation_quadric_edge_collapse(targetfacenum=A.tris, preservenormal=True, preserveboundary=True, optimalplacement=True, planarquadric=True)
R = ms2.current_mesh(); V2 = R.vertex_matrix().astype(np.float32); F2 = R.face_matrix().astype(np.uint32)
if A.rail: V2, F2, _ = clip(V2, F2, [], A.rail - 0.04, False)   # hem: straight edge just under the rail top
N2 = vnormals(V2, F2)
_, j = cKDTree(F['pos']).query(V2)
if (np.einsum('ij,ij->i', N2, F['nor'][j]) < 0).mean() > 0.5: F2 = F2[:, [0, 2, 1]].copy(); N2 = -N2

# ---------- upholstery ironing ----------
# channel zone (back + arm rolls): smooth only ALONG the channels (perpendicular to the U-shaped rim) -> lumps go, ribs stay.
# flat zone (seat cushion, outer panels): strong isotropic smoothing. Volume kept with Taubin (lambda/mu) steps.
ISO = A.iso
def iron(V, Fi, chan_it, flat_it):
    n = len(V); E = np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]]; E = np.unique(np.sort(E, 1), axis=0)
    I = np.r_[E[:, 0], E[:, 1]]; J = np.r_[E[:, 1], E[:, 0]]
    bnd = np.zeros(n, bool)   # open-boundary verts stay fixed
    Ef = np.sort(np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]], 1); u_, cnt = np.unique(Ef, axis=0, return_counts=True); bnd[u_[cnt == 1].ravel()] = True
    cx, cz = (float(v) for v in A.center.split(','))
    def zones(V, N):
        h = V[:, [0, 2]] - [cx, cz]; h /= np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
        out = np.einsum('ij,ij->i', N[:, [0, 2]], h)
        seat = (np.abs(V[:, 0]) < 0.9) & (V[:, 1] < 0.52) & (V[:, 2] > -0.2)
        outer = (out > 0.6) & (V[:, 1] < 0.62)
        flat = seat | outer
        t = np.c_[-h[:, 1], np.zeros(n), h[:, 0]]                 # horizontal rim tangent
        u = np.cross(N, t); u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)   # channel direction
        return flat, u
    def step(V, lam, W):
        S = sp.csr_matrix((W, (I, J)), shape=(n, n)); d = np.asarray(S.sum(1)).ravel()
        L = (S @ V) / np.maximum(d, 1e-12)[:, None] - V; L[(d < 1e-9) | bnd] = 0
        return V + lam * L
    V = V.astype(np.float64)
    for it in range(max(chan_it, flat_it)):
        if it % 20 == 0:
            N = vnormals(V.astype(np.float32), Fi).astype(np.float64); flat, u = zones(V, N)
        e = V[J] - V[I]; el = np.maximum(np.linalg.norm(e, axis=1), 1e-12)
        a = np.abs(np.einsum('ij,ij->i', e, u[I])) / el
        w = np.where(flat[I], 1.0 if it < flat_it else 0.0, (a ** 4 + ISO) if it < chan_it else 0.0)
        V = step(V, 0.5, w); V = step(V, -0.53, w)
    return V.astype(np.float32)
# implicit (one-solve, unconditionally stable) version: (M + L) x = M x0, L built from edge weights t_e / len^2.
# chan/flat are smoothing lengths in metres (features much smaller than that disappear, larger ones stay).
from scipy.sparse.linalg import spsolve
def iron_implicit(V, Fi, lchan, lflat):
    n = len(V); E = np.unique(np.sort(np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]], 1), axis=0)
    Ef = np.sort(np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]], 1); u_, cnt = np.unique(Ef, axis=0, return_counts=True)
    bnd = np.zeros(n, bool); bnd[u_[cnt == 1].ravel()] = True
    N = vnormals(V, Fi).astype(np.float64); cx, cz = (float(v) for v in A.center.split(','))
    h = V[:, [0, 2]].astype(np.float64) - [cx, cz]; h /= np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
    out = np.einsum('ij,ij->i', N[:, [0, 2]], h)
    flat = ((np.abs(V[:, 0]) < 0.9) & (V[:, 1] < 0.52) & (V[:, 2] > -0.2)) | ((out > 0.6) & (V[:, 1] < 0.62))
    t = np.c_[-h[:, 1], np.zeros(n), h[:, 0]]; u = np.cross(N, t); u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
    i, j = E[:, 0], E[:, 1]; e = (V[j] - V[i]).astype(np.float64); l2 = np.maximum((e * e).sum(1), 1e-10); el = np.sqrt(l2)
    a = 0.5 * (np.abs((e * u[i]).sum(1)) + np.abs((e * u[j]).sum(1))) / el
    fz = 0.5 * (flat[i].astype(float) + flat[j])
    w = (fz * lflat ** 2 + (1 - fz) * lchan ** 2 * (a ** A.sharp + ISO)) / l2
    W = sp.csr_matrix((np.r_[w, w], (np.r_[i, j], np.r_[j, i])), shape=(n, n))
    L = sp.diags(np.asarray(W.sum(1)).ravel()) - W
    Mv = np.ones(n); Mv[bnd] = 1e6; M = sp.diags(Mv)
    X = spsolve((M + L).tocsc(), M @ V.astype(np.float64))
    if A.relief:
        # rib relief: detail above a coarse isotropic version, boosted in the channel zone only (back + arm rolls)
        wi = (A.relief_len ** 2) / l2; Wi = sp.csr_matrix((np.r_[wi, wi], (np.r_[i, j], np.r_[j, i])), shape=(n, n))
        Li = sp.diags(np.asarray(Wi.sum(1)).ravel()) - Wi
        Xs = spsolve((M + Li).tocsc(), M @ X)
        cz_ = smooth_attr((~flat).astype(np.float64), Fi, n, 15)[:, None]
        X = X + A.relief * cz_ * (X - Xs)
    return X.astype(np.float32)
def iron_relief(V, Fi, lchan, lflat, lbase, gain):
    # base form (very smooth) + normal-only relief: the relief is smoothed ALONG the channels (lumps go, ribs stay) and boosted.
    # working on a scalar height avoids the sideways vertex drift that faceted the surface.
    n = len(V); E = np.unique(np.sort(np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]], 1), axis=0)
    Ef = np.sort(np.r_[Fi[:, [0, 1]], Fi[:, [1, 2]], Fi[:, [2, 0]]], 1); u_, cnt = np.unique(Ef, axis=0, return_counts=True)
    bnd = np.zeros(n, bool); bnd[u_[cnt == 1].ravel()] = True
    i, j = E[:, 0], E[:, 1]; V = V.astype(np.float64)
    def solve(w, rhs):
        W = sp.csr_matrix((np.r_[w, w], (np.r_[i, j], np.r_[j, i])), shape=(n, n)); L = sp.diags(np.asarray(W.sum(1)).ravel()) - W
        Mv = np.ones(n); Mv[bnd] = 1e6; return spsolve((sp.diags(Mv) + L).tocsc(), Mv[:, None] * rhs if rhs.ndim > 1 else Mv * rhs)
    l2 = np.maximum(((V[j] - V[i]) ** 2).sum(1), 1e-10)
    Vb = solve(lbase ** 2 / l2, V)
    Nb = vnormals(Vb.astype(np.float32), Fi).astype(np.float64)
    d = ((V - Vb) * Nb).sum(1)
    cx, cz = (float(v) for v in A.center.split(','))
    h = Vb[:, [0, 2]] - [cx, cz]; h /= np.maximum(np.linalg.norm(h, axis=1, keepdims=True), 1e-9)
    out = np.einsum('ij,ij->i', Nb[:, [0, 2]], h)
    flat = ((np.abs(Vb[:, 0]) < 0.9) & (Vb[:, 1] < 0.52) & (Vb[:, 2] > -0.2)) | ((out > 0.6) & (Vb[:, 1] < 0.62))
    t = np.c_[-h[:, 1], np.zeros(n), h[:, 0]]; u = np.cross(Nb, t); u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
    e = Vb[j] - Vb[i]; el = np.sqrt(np.maximum((e * e).sum(1), 1e-12))
    a = 0.5 * (np.abs((e * u[i]).sum(1)) + np.abs((e * u[j]).sum(1))) / el
    fz = 0.5 * (flat[i].astype(float) + flat[j])
    w = (fz * lflat ** 2 + (1 - fz) * lchan ** 2 * (a ** A.sharp + ISO)) / l2
    df = solve(w, d)
    g = 1 + (gain - 1) * smooth_attr((~flat).astype(np.float64), Fi, n, 15)
    return (Vb + (g * df)[:, None] * Nb).astype(np.float32)
if A.chan or A.flat:
    V2 = iron_relief(V2, F2, A.chan, A.flat, A.relief_len, 1 + A.relief); N2 = vnormals(V2, F2)

# ---------- seat cushion as its own piece (fixed on the deck) ----------
# straight cuts: bottom seam (y = yb, the groove in the scan) and the arm faces (|x| = xin); the back edge hides in the crease.
pieces = [('fabric', V2, F2)]
if A.cushion:
    yb, xin = (float(v) for v in A.cushion.split(','))
    fcn = vnormals(V2, F2); c = V2[F2].mean(1)
    fnz = np.cross(V2[F2[:, 1]] - V2[F2[:, 0]], V2[F2[:, 2]] - V2[F2[:, 0]]); fnz /= np.maximum(np.linalg.norm(fnz, axis=1, keepdims=True), 1e-12)
    bins = np.arange(0, xin + 0.05, 0.05); zbk = []
    for bx in bins:   # front face of the back at cushion-top height
        q = (np.abs(np.abs(c[:, 0]) - bx) < 0.03) & (c[:, 1] > 0.50) & (c[:, 1] < 0.54) & (c[:, 2] < 0.1)
        zbk.append(c[q, 2].max() if q.any() else zbk[-1] if zbk else -0.22)
    zb = lambda x: np.interp(np.abs(x), bins, zbk)
    reg = (np.abs(c[:, 0]) < xin + 0.04) & (c[:, 1] > yb - 0.04) & (c[:, 1] < 0.55) & (c[:, 2] > zb(c[:, 0]) - 0.06)
    Fa, Fb = F2[reg], F2[~reg]
    up_P, up_I, _ = clip(V2, Fa, [], yb, False); lo_P, lo_I, _ = clip(V2, Fa, [], yb, True)
    parts_body = [(lo_P, lo_I)]
    ct, cs = (float(v) for v in A.cushion_top.split(','))          # top: slanted plane ~1 cm above the cushion top (sits in the back crease)
    topfn = lambda P: P[:, 1] - cs * (P[:, 2] + 0.22)
    P_, I_, _ = clip(up_P, up_I, [], ct, True, fn=topfn)
    tp_P, tp_I, _ = clip(up_P, up_I, [], ct, False, fn=topfn); parts_body.append((tp_P, tp_I))
    for sgn in (1, -1):   # keep |x| < xin
        cin_P, cin_I, _ = clip(P_, I_, [], sgn * xin, sgn > 0, axis=0); cout_P, cout_I, _ = clip(P_, I_, [], sgn * xin, sgn < 0, axis=0)
        parts_body.append((cout_P, cout_I)); P_, I_ = cin_P, cin_I
    cus_P, cus_I = P_, I_
    def merge(parts):
        Ps, Is, off = [], [], 0
        for P0, I0 in parts:
            if len(I0): Ps.append(P0); Is.append(I0 + off); off += len(P0)
        Pm = np.vstack(Ps); Im = np.vstack(Is)
        _, wi, wv = np.unique(np.round(Pm / 1e-6).astype(np.int64), axis=0, return_index=True, return_inverse=True)   # weld duplicate seam verts
        Pm = Pm[wi]; Im = wv.ravel()[Im]; Im = Im[(Im[:, 0] != Im[:, 1]) & (Im[:, 1] != Im[:, 2]) & (Im[:, 0] != Im[:, 2])]
        used, inv = np.unique(Im.ravel(), return_inverse=True); return Pm[used].astype(np.float32), inv.reshape(-1, 3).astype(np.uint32)
    body_P, body_I = merge([(V2, Fb)] + parts_body)
    body_I = islands(body_I, len(body_P), 500); body_P, body_I = merge([(body_P, body_I)])
    cus_P, cus_I = merge([(cus_P, cus_I)])
    cus_I = islands(cus_I, len(cus_P), 500); cus_P, cus_I = merge([(cus_P, cus_I)])
    pieces = [('fabric', body_P, body_I), ('cushion', cus_P, cus_I)]
    print('cushion tris', len(cus_I), 'body tris', len(body_I))
    # seam groove: the cushion edge rolls under, the body tucks in next to it
    def bverts(I, n):
        E = np.sort(np.r_[I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]], 1); u_, cnt = np.unique(E, axis=0, return_counts=True)
        b_ = np.zeros(n, bool); b_[u_[cnt == 1].ravel()] = True; return b_
    cb = bverts(cus_I, len(cus_P)); tcb = cKDTree(cus_P[cb])
    SEAM = [(cus_P, cus_I, cKDTree(cus_P[cb]).query(cus_P)[0], 0.02, 0.009), (body_P, body_I, tcb.query(body_P)[0], 0.015, 0.006)]
    for k_, (P0, I0, d0, rad, depth) in enumerate(SEAM):
        t_ = np.clip(d0 / rad, 0, 1); f_ = np.sin(np.pi * t_) ** 2 * (1 - t_) + (t_ < 0.5) * 0 ; f_ = np.sin(np.pi * t_) * (1 - t_) * 1.5
        N0 = smooth_attr(vnormals(P0, I0).astype(np.float64), I0, len(P0), 6); N0 /= np.maximum(np.linalg.norm(N0, axis=1, keepdims=True), 1e-9)
        P0 -= (N0 * (depth * f_)[:, None]).astype(np.float32)   # smoothed normals: tiny cut slivers can't spike
    SEAMF = {'fabric': lambda P: np.clip(1 - tcb.query(P)[0] / 0.02, 0, 1), 'cushion': lambda P: np.clip(1 - cKDTree(cus_P[cb]).query(P)[0] / 0.025, 0, 1)}

# ---------- seams: push the fabric in next to the wood; shading ----------
fabs = []
for slot_name, V2, F2 in pieces:
    N2 = vnormals(V2, F2)
    dw = tw.query(V2)[0]
    wgt = np.clip(1 - dw / 0.03, 0, 1); wgt = wgt * wgt * (3 - 2 * wgt)
    hem = np.clip((A.rail + 0.005 - V2[:, 1]) / 0.015, 0, 1) * (dw < 0.06) if A.rail else 0 * wgt   # hem hangs just behind the rail
    postv = (np.abs(V2[:, 0]) > POSTX - 0.04) & (V2[:, 2] > POSTZ - 0.06) & (V2[:, 1] > A.rail)   # fabric right beside the carved posts sits fully behind them
    pz = np.clip(1 - np.maximum(POSTX - 0.04 - np.abs(V2[:, 0]), 0) / 0.06, 0, 1) * (V2[:, 2] > POSTZ - 0.1) * (V2[:, 1] > A.rail)   # no pushback at the posts: flush, never see-through
    V2 = (V2 - N2 * (A.push * wgt * (1 - hem) * (1 - pz) + 0.007 * hem)[:, None]).astype(np.float32)
    N2 = vnormals(V2, F2)
    # blurred scan AO (no wrinkle streaks) + soft crevices at the wood and the cushion seam
    _, j = cKDTree(F['pos']).query(V2)
    shade = F['shade'][j].astype(np.float32)
    shade[tp.query(V2)[0] < ZONE] = np.median(F['shade'][keep])   # under the pillows the scan colour was pillow-shadowed
    shade = smooth_attr(shade, F2, len(V2), A.shade_blur)
    shade = shade * (1 - 0.2 * smooth_attr(wgt.astype(np.float32), F2, len(V2), 10))
    if A.cushion: shade = shade * (1 - 0.3 * smooth_attr(SEAMF[slot_name](V2).astype(np.float32), F2, len(V2), 4))
    fabs.append(dict(meta=dict(F['meta'], slot=slot_name, nv=len(V2), ni=F2.size), pos=V2, nor=N2, uv=F['uv'][j], shade=np.clip(shade, 0, 255).astype(np.uint8), idx=F2))
    print(slot_name, 'tris', len(F2))

# wood shading: the scan texture bled fabric colour onto the wood edges (dark blotches) -> floor + light blur
wsh = Wd['shade'].astype(np.float32); med = np.median(wsh)
wsh = smooth_attr(np.maximum(wsh, 0.85 * med), Wd['idx'], len(wsh), 4)
Wd = dict(Wd, shade=np.clip(wsh, 0, 255).astype(np.uint8))
out = fabs + [Wd]
with open(S + name + '_np.bin', 'wb') as f:
    for s in out:
        for a in (s['pos'].astype(np.float32), s['nor'].astype(np.float32), s['uv'].astype(np.float32), s['shade'].astype(np.uint8), s['idx'].astype(np.uint32).ravel()):
            f.write(a.tobytes())
json.dump(dict(m, slots=[s['meta'] for s in out]), open(S + name + '_np.json', 'w'))
print('done', [(s['meta']['slot'], s['meta']['nv'], s['meta']['ni'] // 3) for s in out])
