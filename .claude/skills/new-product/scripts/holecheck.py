# تست سوراخ مثل سایت: پشت سطح‌ها حذف، پس‌زمینهٔ سرخابی. هر لکهٔ سرخابی روی مدل = سوراخ یا درز باز.
# اجرا: blender -b --python .claude/skills/new-product/scripts/holecheck.py -- <in.glb> <out-prefix> [VERTEX|TEXTURE]
# خروجی: <out-prefix>_{front,angle,side,back,top,under}.png
import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]; mode = argv[2] if len(argv) > 2 else 'VERTEX'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.update()
pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
c = (mn + mx) / 2; r = (mx - mn).length / 2
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.color_type = mode; sh.light = 'STUDIO'; sh.show_backface_culling = True; sh.show_cavity = False
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (1, 0, 1)
sh.background_type = 'WORLD'
sc.render.resolution_x = 1100; sc.render.resolution_y = 800
cam = bpy.data.cameras.new('c'); cam.lens = 50; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
# glTF: y بالا، جلو +z  →  در Blender: z بالا، جلو -y
views = {'front': (0, -1, 0.15), 'angle': (-0.8, -1, 0.4), 'side': (-1, 0, 0.1), 'back': (0.3, 1, 0.25), 'top': (0, -0.2, 1), 'under': (0.2, -0.6, -0.8)}
for k, d in views.items():
    d = mathutils.Vector(d).normalized(); co.location = c + d * r * 3.0
    co.rotation_euler = (c - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{out}_{k}.png'; bpy.ops.render.render(write_still=True)
print('BOUNDS', tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
