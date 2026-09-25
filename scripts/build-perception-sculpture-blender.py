"""Build the reviewable Yuanbai perception mark in an isolated Blender process.

Only SCULPTURE is exported.  The reference is a concept rather than measured
architecture.  The sculpture lives in Blender XY, thickness along Z.  The glTF
export converts that to XZ, thickness along Y; see the manifest for its camera.
Photo-derived PBR maps are artistic estimates, not photogrammetric scans.
"""

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
MODELS = ROOT / "public" / "models"
TEXTURES = MODELS / "textures" / "yuanbai-site"
RNG = random.Random(240924)
PART_FOOTPRINTS = []
CAMERA_LOCATION = (0.15, -7.4, 11.8)
CAMERA_TARGET = (0.15, -.04, 0)
for directory in (ARTIFACTS, MODELS):
    directory.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def basic_material(name, color, roughness=.8, metallic=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return material


def photo_material(name, photo, normal_strength, metallic=0, albedo_name=None):
    """Use exportable standard glTF texture nodes, no render-only shader tricks."""
    material = basic_material(name, (.3, .3, .3), .9, metallic)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    uv = nodes.new("ShaderNodeTexCoord")
    uv.location = (-750, 0)
    for index, (suffix, socket) in enumerate((("albedo.jpg", "Base Color"), ("roughness.png", "Roughness"))):
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = f"Site_photo_{photo}_{suffix}"
        filename = albedo_name if suffix == "albedo.jpg" and albedo_name else f"{photo}-{suffix}"
        texture.image = bpy.data.images.load(str(TEXTURES / filename), check_existing=True)
        texture.image.colorspace_settings.name = "sRGB" if socket == "Base Color" else "Non-Color"
        texture.location = (-500, 180 - index * 280)
        links.new(uv.outputs["UV"], texture.inputs["Vector"])
        links.new(texture.outputs["Color"], shader.inputs[socket])
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(TEXTURES / f"{photo}-normal.jpg"), check_existing=True)
    texture.image.colorspace_settings.name = "Non-Color"
    texture.location = (-500, -380)
    links.new(uv.outputs["UV"], texture.inputs["Vector"])
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = normal_strength
    normal.location = (-180, -260)
    links.new(texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    return material


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def planar_face_uv(obj, tile_span=1.15, seed=0):
    """Size UVs from actual face dimensions, with non-repeating face offsets.

    Cube-generated UVs stretched a single texture into every beam; each face now
    keeps physical texture density.  Brick courses stay straight along edges.
    """
    rng = random.Random(seed)
    mesh = obj.data
    uv = mesh.uv_layers.new(name="SiteMaterialUV")
    for face in mesh.polygons:
        n = face.normal
        v0 = mesh.vertices[face.vertices[0]].co
        v1 = mesh.vertices[face.vertices[1]].co
        # First edge becomes U, and its perpendicular in the face becomes V.
        u_axis = (v1 - v0).normalized()
        v_axis = n.cross(u_axis).normalized()
        offset_u, offset_v = rng.uniform(.05, .8), rng.uniform(.05, .8)
        for loop_index in face.loop_indices:
            point = mesh.vertices[mesh.loops[loop_index].vertex_index].co - v0
            uv.data[loop_index].uv = (point.dot(u_axis) / tile_span + offset_u,
                                      point.dot(v_axis) / tile_span + offset_v)


def extrude_quad(name, footprint, bottom, top, material, collection, bevel=.016, tile_span=1.15):
    """Extrude a CCW convex footprint; clean mitered footprints prevent overlaps."""
    PART_FOOTPRINTS.append((name, [Vector(p) for p in footprint], 0))
    vertices = [(x, y, bottom) for x, y in footprint] + [(x, y, top) for x, y in footprint]
    count = len(footprint)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    planar_face_uv(obj, tile_span, seed=sum(map(ord, name)))
    if bevel:
        modifier = obj.modifiers.new("Small construction arris", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.affect = "EDGES"
    return obj


def block(name, center, dimensions, rotation, material, collection, tile_span=1.15):
    x, y, z = center
    width, depth, height = dimensions
    corners = [(-width / 2, -depth / 2), (width / 2, -depth / 2), (width / 2, depth / 2), (-width / 2, depth / 2)]
    # Sub-percent plan irregularity gives sharp cast blocks a less machine-cut edge.
    angle = math.radians(rotation)
    footprint = []
    for a, b in corners:
        a += RNG.uniform(-.006, .006)
        b += RNG.uniform(-.006, .006)
        footprint.append((x + a * math.cos(angle) - b * math.sin(angle),
                          y + a * math.sin(angle) + b * math.cos(angle)))
    return extrude_quad(name, footprint, z - height / 2, z + height / 2,
                        material, collection, tile_span=tile_span)


def rod(name, start, end, radius, material, collection):
    start, end = Vector(start), Vector(end)
    delta = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=delta.length,
                                       location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    # Metal map UVs already exist on cylinders and need only realistic density.
    for loop in obj.data.uv_layers.active.data:
        loop.uv.y *= max(.3, delta.length)
    bevel = obj.modifiers.new("Rounded steel rod ends", "BEVEL")
    bevel.width = radius * .25
    bevel.segments = 1
    return obj


def cage_from_quad(name, footprint, bottom, top, material, collection, stirrups=1):
    """Cage bounds exactly match their footprint; no rods go through neighbours."""
    PART_FOOTPRINTS.append((name, [Vector(p) for p in footprint], .024))
    corners = [(*p, bottom) for p in footprint] + [(*p, top) for p in footprint]
    edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4),
             (0, 4), (1, 5), (2, 6), (3, 7)]
    for i, (a, b) in enumerate(edges):
        rod(f"{name}_bar_{i:02}", corners[a], corners[b], .024, material, collection)
    # Additional rings brace the frame, retaining a large open negative space.
    for ring_index in range(1, stirrups + 1):
        t = ring_index / (stirrups + 1)
        p = Vector(footprint[0]).lerp(Vector(footprint[3]), t)
        q = Vector(footprint[1]).lerp(Vector(footprint[2]), t)
        ring = [(*p, bottom), (*q, bottom), (*q, top), (*p, top)]
        for i in range(4):
            rod(f"{name}_tie_{ring_index}_{i}", ring[i], ring[(i + 1) % 4], .017, material, collection)


def square_cage(name, center, size, angle_degrees, material, collection):
    x, y, z = center
    width, depth, height = size
    angle = math.radians(angle_degrees)
    footprint = [(x + a * math.cos(angle) - b * math.sin(angle),
                  y + a * math.sin(angle) + b * math.cos(angle))
                 for a, b in [(-width / 2, -depth / 2), (width / 2, -depth / 2),
                              (width / 2, depth / 2), (-width / 2, depth / 2)]]
    cage_from_quad(name, footprint, z - height / 2, z + height / 2, material, collection)


def open_mitered_frame(collection, materials):
    """The open diamond is one ribbon split into disjoint material segments.

    Every adjacent segment shares the same angle bisector, inset 0.025 units at
    the joint.  Its bricks, concrete, and cage therefore cannot bury one another.
    """
    path = [Vector(p) for p in [(.73, .79), (1.72, 1.78), (2.65, .83),
                              (3.5, -.04), (2.69, -.89), (1.72, -1.88), (.70, -.87)]]
    width, height = .64, .61
    tangents = [(b - a).normalized() for a, b in zip(path[:-1], path[1:])]
    normals = [Vector((-v.y, v.x)) for v in tangents]
    left, right = [], []
    for i, p in enumerate(path):
        if i == 0:
            offset = normals[0] * width / 2
        elif i == len(path) - 1:
            offset = normals[-1] * width / 2
        else:
            bisector = (normals[i - 1] + normals[i]).normalized()
            offset = bisector * width / (2 * bisector.dot(normals[i]))
        left.append(p + offset)
        right.append(p - offset)
    kinds = ["concrete", "concrete", "brick", "brick", "concrete", "steel"]
    for i, kind in enumerate(kinds):
        # Interpolation retains miter angles, unlike shortening rectangular beams.
        gap_fraction = .025 / (path[i + 1] - path[i]).length
        start_t = 0 if i == 0 else gap_fraction
        end_t = 1 if i == len(kinds) - 1 else 1 - gap_fraction
        a = left[i].lerp(left[i + 1], start_t)
        b = right[i].lerp(right[i + 1], start_t)
        c = right[i].lerp(right[i + 1], end_t)
        d = left[i].lerp(left[i + 1], end_t)
        footprint = [a, b, c, d]
        name = f"frame_{i:02}_{kind}"
        if kind == "steel":
            cage_from_quad(name, footprint, -height / 2, height / 2, materials[kind], collection, stirrups=2)
        else:
            extrude_quad(name, footprint, -height / 2, height / 2, materials[kind], collection,
                         bevel=.015, tile_span=2.65 if kind == "brick" else 1.15)


def build_model():
    materials = {
        "concrete": photo_material("YB_Site_Cast_Concrete", "concrete", .44),
        "brick": photo_material("YB_Site_Red_Brick", "brick", .75),
        "steel": photo_material("YB_Dark_Steel_With_Paint_Wear", "painted-steel", .28, .74,
                                albedo_name="steel-muted-albedo.jpg"),
    }
    collection = bpy.data.collections.new("SCULPTURE")
    bpy.context.scene.collection.children.link(collection)
    # Cube placement is intentionally a little irregular, with clear negative space.
    # All clearances are physical; individual pieces share a single animation root.
    items = [
        ("north", (-1.58, 1.43, .03), (.78, .78, .64), 45, "concrete"),
        ("northwest", (-2.65, .90, .00), (.76, .76, .59), 19, "brick"),
        ("northeast", (-.44, 1.03, .02), (.72, .72, .58), 34, "steel"),
        ("west", (-3.14, -.30, -.01), (.72, .74, .59), 43, "concrete"),
        ("east", (-.06, -.16, .035), (.77, .77, .61), 43, "brick"),
        ("southeast", (-1.04, -.99, -.015), (.81, .78, .62), 23, "concrete"),
        ("south", (-2.19, -1.86, .0), (.78, .78, .61), 42, "concrete"),
        ("southwest", (-2.88, -1.13, .025), (.61, .64, .51), 43, "steel"),
    ]
    for name, center, size, angle, kind in items:
        if kind == "steel":
            square_cage(f"ring_{name}_steel", center, size, angle, materials[kind], collection)
        else:
            block(f"ring_{name}_{kind}", center, size, angle, materials[kind], collection,
                  tile_span=2.65 if kind == "brick" else 1.15)
    open_mitered_frame(collection, materials)
    root = bpy.data.objects.new("YB_Perception_Mark_Root", None)
    collection.objects.link(root)
    for obj in list(collection.objects):
        if obj != root:
            obj.parent = root
    root["role"] = "yuanbai_perception_mark"
    root["materials"] = "Yuanbai photo-derived concrete and brick; subdued painted steel"
    root["pbr_maps"] = "Artist estimated normals and roughness, not measured photogrammetry"
    return collection, root


def aim_at(obj, target=CAMERA_TARGET):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area_light(name, location, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    aim_at(obj)


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.025, .028, .032, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .35
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.2
    camera_data = bpy.data.cameras.new("Review_Camera")
    camera = bpy.data.objects.new("Review_Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = CAMERA_LOCATION
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.15
    aim_at(camera)
    scene.camera = camera
    # Neutral material proof lighting: the browser adds its atmospheric beam.
    area_light("Top_Neutral_Key", (-1.1, 1.6, 7.5), 800, (1.0, .94, .86), 4.0)
    area_light("Front_Soft_Fill", (0, -4.6, 4.2), 210, (.81, .86, 1.0), 4.5)
    area_light("Steel_Edge_Rim", (5, 1.4, 3.5), 470, (.94, .85, .75), 3.0)
    return scene


def clearance_audit():
    """Separating-axis proof for every distinct planar volume/cage envelope.

    Rebar rod radius expands the cage bounds for this check. Internal rod joins
    within a cage are deliberate structural connections and are not crossings.
    """
    collisions, minimum_clearance = [], float("inf")
    for index, (name_a, a, radius_a) in enumerate(PART_FOOTPRINTS):
        for name_b, b, radius_b in PART_FOOTPRINTS[index + 1:]:
            axes = []
            for polygon in (a, b):
                for edge in range(len(polygon)):
                    direction = polygon[(edge + 1) % len(polygon)] - polygon[edge]
                    axes.append(Vector((-direction.y, direction.x)).normalized())
            gaps = []
            for axis in axes:
                projection_a = [point.dot(axis) for point in a]
                projection_b = [point.dot(axis) for point in b]
                gaps.append(max(min(projection_a) - max(projection_b),
                                min(projection_b) - max(projection_a)) - radius_a - radius_b)
            clearance = max(gaps)
            minimum_clearance = min(clearance, minimum_clearance)
            if clearance <= 0:
                collisions.append([name_a, name_b, clearance])
    if collisions:
        raise RuntimeError(f"Unexpected inter-part penetration: {collisions}")
    return {"distinct_parts": len(PART_FOOTPRINTS), "overlapping_pairs": collisions,
            "minimum_separating_axis_clearance": round(minimum_clearance, 5)}


def main():
    clear_scene()
    collection, root = build_model()
    clearance = clearance_audit()
    scene = setup_scene()
    # No stage or lights in the GLB.  A clean transparent render also serves as
    # the low-resolution browser projection source without duplicating WebGL.
    scene.render.film_transparent = True
    scene.render.filepath = str(ARTIFACTS / "yuanbai-perception-sculpture-transparent.png")
    bpy.ops.render.render(write_still=True)

    scene.render.film_transparent = False
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.002, .002, .002, 1)
    scene.render.filepath = str(ARTIFACTS / "yuanbai-perception-sculpture-review.png")
    bpy.ops.render.render(write_still=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ARTIFACTS / "yuanbai-perception-sculpture.blend"))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODELS / "yuanbai-perception-sculpture.glb"),
                              export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_materials="EXPORT", export_cameras=False,
                              export_lights=False)
    points = [obj.matrix_world @ Vector(p) for obj in collection.objects if obj.type == "MESH" for p in obj.bound_box]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    manifest = {
        "root": root.name, "blender_axes": "XY plan; Z thickness",
        "gltf_axes": "XZ plan; Y thickness; Blender +Y becomes glTF -Z",
        "blender_camera": list(CAMERA_LOCATION), "blender_target": list(CAMERA_TARGET),
        "gltf_camera": [CAMERA_LOCATION[0], CAMERA_LOCATION[2], -CAMERA_LOCATION[1]],
        "gltf_target": [CAMERA_TARGET[0], CAMERA_TARGET[2], -CAMERA_TARGET[1]],
        "orthographic_width": scene.camera.data.ortho_scale,
        "blender_bounds_min": lo, "blender_bounds_max": hi,
        "gltf_bounds_min": [lo[0], lo[2], -hi[1]], "gltf_bounds_max": [hi[0], hi[2], -lo[1]],
        "mesh_count": sum(obj.type == "MESH" for obj in collection.objects),
        "clearance_audit": clearance,
        "material_note": "Derived from user photos with AI-cleaned tiles; normal and roughness artist estimated"
    }
    (ARTIFACTS / "yuanbai-perception-sculpture-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("BLENDER_BUILD_COMPLETE")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
