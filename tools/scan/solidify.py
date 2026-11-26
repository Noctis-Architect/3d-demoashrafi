# solidify: give a scanned single-sheet slot (e.g. the wood frame) real thickness so it looks solid from every side.
# Runs inside Blender:  blender -b --python solidify.py -- <s2-prefix> <slot> <thickness_m>
# Rewrites that slot of <s2-prefix>.{json,bin} in place (other slots untouched). Inner shell + rims, offset inward.
import bpy, bmesh, sys, json, numpy as np
from mathutils import kdtree
argv = sys.argv[sys.argv.index('--') + 1:]
pref, slot, th = argv[0], argv[1], float(argv[2])
m = json.load(open(pref + '.json')); b = open(pref + '.bin', 'rb').read(); o = 0
slots = []
for s in m['slots']:
    nv, ni = s['nv'], s['ni']; d = {}
    for k, dt, n in (('pos', np.float32, nv * 3), ('nor', np.float32, nv * 3), ('uv', np.float32, nv * 2), ('shade', np.uint8, nv), ('idx', np.uint32, ni)):
        d[k] = np.frombuffer(b, dt, n, o).copy(); o += d[k].nbytes
    d['pos'] = d['pos'].reshape(-1, 3); d['nor'] = d['nor'].reshape(-1, 3); d['uv'] = d['uv'].reshape(-1, 2); d['idx'] = d['idx'].reshape(-1, 3)
    slots.append((s, d))
for s, d in slots:
    if s['slot'] != slot: continue
    me = bpy.data.meshes.new('w'); me.from_pydata(d['pos'].tolist(), [], d['idx'].tolist()); me.validate(); me.update()
    ob = bpy.data.objects.new('w', me); bpy.context.scene.collection.objects.link(ob); bpy.context.view_layer.objects.active = ob
    # weld exact duplicates so rims follow real open edges only
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    # keep the scan's outward orientation: compare with the stored normals
    me.update(); kd = kdtree.KDTree(len(d['pos']))
    for i, p in enumerate(d['pos']): kd.insert(p, i)
    kd.balance()
    agree = sum(1 if v.normal.dot(d['nor'][kd.find(v.co)[1]].tolist()) > 0 else -1 for v in me.vertices)
    if agree < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    md = ob.modifiers.new('s', 'SOLIDIFY'); md.thickness = th; md.offset = -1; md.use_rim = True; md.use_even_offset = False; md.use_quality_normals = False; md.thickness_clamp = 1.0; md.use_thickness_angle_clamp = True
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg); me2 = bpy.data.meshes.new_from_object(ev)
    bm = bmesh.new(); bm.from_mesh(me2); bmesh.ops.triangulate(bm, faces=bm.faces); bm.normal_update()
    P = np.array([v.co[:] for v in bm.verts], np.float32); N = np.array([v.normal[:] for v in bm.verts], np.float32)
    bm.verts.index_update(); I = np.array([[v.index for v in f.verts] for f in bm.faces], np.uint32); bm.free()
    # uv/shade from the nearest original vertex; outer verts keep the scan's normals
    near = [kd.find(p) for p in P]; j = np.array([n[1] for n in near]); dd = np.array([n[2] for n in near])
    N = np.where((dd < 1e-6)[:, None], d['nor'][j], N).astype(np.float32)
    d.update(pos=P, nor=N, uv=d['uv'][j], shade=d['shade'][j], idx=I); s.update(nv=len(P), ni=I.size)
    print(slot, 'solid: verts', len(P), 'tris', len(I))
with open(pref + '.bin', 'wb') as f:
    for s, d in slots:
        for k in ('pos', 'nor', 'uv', 'shade', 'idx'): f.write(np.ascontiguousarray(d[k]).tobytes())
json.dump(dict(m, slots=[s for s, _ in slots]), open(pref + '.json', 'w'))
