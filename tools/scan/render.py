import bpy,sys,math,mathutils
argv=sys.argv[sys.argv.index('--')+1:]
src,out=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
bpy.context.view_layer.update()
bb=[obj.matrix_world@mathutils.Vector(c) for c in obj.bound_box]
mn=mathutils.Vector([min(v[i] for v in bb) for i in range(3)]); mx=mathutils.Vector([max(v[i] for v in bb) for i in range(3)])
print('BOUNDS',mn,mx)
c=(mn+mx)/2; r=(mx-mn).length/2
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.color_type=(sys.argv[-1] if sys.argv[-1] in ('VERTEX','TEXTURE') else 'TEXTURE'); sc.display.shading.light='STUDIO'
sc.render.resolution_x=900; sc.render.resolution_y=700
w=bpy.data.worlds.new('w'); sc.world=w
cam=bpy.data.cameras.new('c'); cam.lens=50; co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
views={'front':(0,-1,0.15),'angle':(-0.8,-1,0.35),'side':(-1,0,0.1),'top':(0,-0.2,1)}
for k,d in views.items():
  d=mathutils.Vector(d).normalized(); co.location=c+d*r*3.0
  co.rotation_euler=(c-co.location).to_track_quat('-Z','Y').to_euler()
  sc.render.filepath=f'{out}_{k}.png'; bpy.ops.render.render(write_still=True)
