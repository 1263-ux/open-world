import bpy
import math
import os
from mathutils import Vector

# Invented display dimensions, not factual measurements of the photographed gate.
OUTPUT_DIR = os.environ.get("MODEL_OUTPUT_DIR", os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUTPUT_DIR, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for block in list(datablocks):
        if block.users == 0:
            datablocks.remove(block)

scene = bpy.context.scene


def material(name, color, roughness=0.8, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


arch_front = material("Arch - muted gray", (0.43, 0.46, 0.46))
arch_back = material("Arch - reverse gray", (0.39, 0.42, 0.42))
arch_edge = material("Arch - edges", (0.49, 0.51, 0.50))
arch_under = material("Arch - underside", (0.34, 0.37, 0.37))
concrete = material("End wings - concrete", (0.49, 0.50, 0.48))
plaque_mat = material("Plaque - dark red brown", (0.22, 0.075, 0.058))
letter_mat = material("Lettering - warm ivory", (0.83, 0.75, 0.57))
rib_mat = material("Structural ribs", (0.35, 0.38, 0.37), metallic=0.1)


def add_box(name, location, dimensions, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def arch_top(x):
    return 9.0 - 8.0 * (x / 16.0) ** 2


# Four vertices per station: front top, front bottom, back top, back bottom.
segments = 96
verts = []
for i in range(segments + 1):
    x = -16.0 + 32.0 * i / segments
    top = arch_top(x)
    bottom = max(0.2, top - 1.3)
    verts.extend([
        (x, 0.7, top),
        (x, 0.7, bottom),
        (x, -0.7, top),
        (x, -0.7, bottom),
    ])

faces = []
material_indices = []
for i in range(segments):
    a = 4 * i
    b = a + 4
    faces.extend([
        (a, a + 1, b + 1, b),
        (a + 2, b + 2, b + 3, a + 3),
        (a, b, b + 2, a + 2),
        (a + 1, a + 3, b + 3, b + 1),
    ])
    material_indices.extend([0, 1, 2, 3])
faces.extend([
    (0, 2, 3, 1),
    (4 * segments, 4 * segments + 1, 4 * segments + 3, 4 * segments + 2),
])
material_indices.extend([2, 2])

mesh = bpy.data.meshes.new("Continuous arch mesh")
mesh.from_pydata(verts, [], faces)
mesh.materials.clear()
for mat in (arch_front, arch_back, arch_edge, arch_under):
    mesh.materials.append(mat)
mesh.update()
arch = bpy.data.objects.new("Continuous shallow arch", mesh)
scene.collection.objects.link(arch)
for polygon, index in zip(mesh.polygons, material_indices):
    polygon.material_index = index

# Low stylized supports remain within the 32 m width and 2 m depth.
for side in (-1, 1):
    add_box(
        "Concrete wing",
        (side * 15.1, 0.0, 0.35),
        (1.8, 2.0, 0.7),
        concrete,
    )
    add_box(
        "Concrete end support",
        (side * 15.4, 0.0, 0.75),
        (1.2, 1.65, 1.5),
        concrete,
    )

plaque_width = 17.4
plaque_bottom = 4.8
plaque_top = 6.0
plaque_center_z = (plaque_bottom + plaque_top) / 2.0
add_box(
    "Suspended rectangular plaque",
    (0.0, 0.0, plaque_center_z),
    (plaque_width, 0.5, plaque_top - plaque_bottom),
    plaque_mat,
)

# Vertical structural ribs meet the plaque and the underside of the arch.
for x in (-7.5, -5.0, -2.5, 0.0, 2.5, 5.0, 7.5):
    upper = arch_top(x) - 1.3
    lower = plaque_top - 0.02
    add_box(
        "Vertical structural rib",
        (x, 0.0, (upper + lower) / 2.0),
        (0.36, 0.32, upper - lower),
        rib_mat,
    )

# Blender text lies in local XY. This rotation makes its front face point +Y
# and makes its reading direction correct when viewed from +Y.
font_curve = bpy.data.curves.new("Chinese plaque text", type="FONT")
font_curve.body = "太原理工大学"
font_curve.align_x = "CENTER"
font_curve.align_y = "CENTER"
font_curve.size = 1.0
font_curve.resolution_u = 2
font_curve.extrude = 0.001
font_curve.bevel_depth = 0.0

font_paths = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/arphic/uming.ttc",
]
font_loaded = False
for path in font_paths:
    if os.path.isfile(path):
        try:
            font_curve.font = bpy.data.fonts.load(path)
            font_loaded = True
            break
        except Exception:
            pass

text_obj = bpy.data.objects.new("University name", font_curve)
scene.collection.objects.link(text_obj)
text_obj.rotation_euler = (math.pi / 2.0, 0.0, math.pi)
text_obj.data.materials.append(letter_mat)
bpy.context.view_layer.objects.active = text_obj
text_obj.select_set(True)
bpy.ops.object.convert(target="MESH")
text_obj = bpy.context.object
if not font_loaded:
    # Never ship missing-glyph boxes if a CJK font is unavailable.
    text_obj.data.clear_geometry()

# Center the actual glyph outlines and fit them within the sign.
if text_obj.data.vertices:
    xs = [v.co.x for v in text_obj.data.vertices]
    ys = [v.co.y for v in text_obj.data.vertices]
    center_x = (min(xs) + max(xs)) / 2.0
    center_y = (min(ys) + max(ys)) / 2.0
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    for vertex in text_obj.data.vertices:
        vertex.co.x -= center_x
        vertex.co.y -= center_y
    if width > 0.0 and height > 0.0:
        scale_y = 0.78 / height
        # A modest horizontal expansion gives the name a sign-like presence.
        scale_x = min(scale_y * 1.35, 13.5 / width)
        text_obj.scale = (scale_x, scale_y, 1.0)
text_obj.location = (0.0, 0.257, plaque_center_z)
bpy.context.view_layer.objects.active = text_obj
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Limit unusually complex font outlines while preserving the rest of the model.
def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


model_objects = [obj for obj in scene.objects if obj.type == "MESH"]
other_triangles = sum(triangle_count(obj) for obj in model_objects if obj != text_obj)
text_triangles = triangle_count(text_obj)
budget = max(100, 9700 - other_triangles)
if text_triangles > budget:
    modifier = text_obj.modifiers.new("Font mesh optimization", "DECIMATE")
    modifier.ratio = min(1.0, budget / text_triangles * 0.95)
    bpy.context.view_layer.objects.active = text_obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)

# Export only the model, before adding the presentation environment.
bpy.ops.object.select_all(action="DESELECT")
for obj in model_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = arch
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUTPUT_DIR, "model.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_materials="EXPORT",
    export_texcoords=False,
    export_normals=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)

# Presentation objects are intentionally excluded from the GLB.
ground_mat = material("Presentation ground", (0.68, 0.69, 0.67))
add_box("Presentation ground", (0.0, 0.0, -0.12), (200.0, 200.0, 0.2), ground_mat)

world = bpy.data.worlds.new("Presentation world") if not bpy.data.worlds else bpy.data.worlds[0]
scene.world = world
world.color = (0.82, 0.83, 0.82)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, target):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


add_area_light("Key light", (4.0, 18.0, 22.0), 1800.0, 12.0, (0.0, 0.0, 4.5))
add_area_light("Fill light", (-16.0, -8.0, 13.0), 900.0, 10.0, (0.0, 0.0, 4.5))


def add_camera(name, location, target, ortho_scale):
    data = bpy.data.cameras.new(name)
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    data.clip_end = 500.0
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


target = (0.0, 0.0, 4.5)
cameras = [
    ("front.png", add_camera("Front camera", (0.0, 55.0, 4.5), target, 37.0)),
    ("oblique.png", add_camera("Oblique camera", (34.0, 48.0, 23.0), target, 37.0)),
    ("top.png", add_camera("Top camera", (0.0, 0.0, 55.0), target, 37.0)),
]

scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.background_type = "WORLD"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = "BOTH"
scene.render.resolution_x = 1000
scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False

for filename, camera in cameras:
    scene.camera = camera
    scene.render.filepath = os.path.join(OUTPUT_DIR, filename)
    bpy.ops.render.render(write_still=True)