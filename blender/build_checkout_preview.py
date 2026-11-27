"""Build the editable checkout storyboard and render its key poses in Blender 5.3."""

import argparse
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
BEATS = ((12, "01-present"), (42, "02-scan"), (79, "03-receipt"))
PAD_HEIGHT = 1.171
SCAN_POSITION = (-0.58, -0.17, PAD_HEIGHT)
PRESENT_POSITION = (-1.42, -0.44, 1.39)
BAG_POSITION = (0.13, -0.17, 1.045)
WRIST_OFFSET = (-0.359, 0.079, 0.243)


def material(name, color, roughness=0.42, metallic=0.0, glow=0.0, texture=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = glow
    if texture:
        scale, stretch, depth = texture
        coordinates = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeVectorMath")
        mapping.operation = "MULTIPLY"
        mapping.inputs[1].default_value = stretch
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = 2.4
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.12
        ramp.color_ramp.elements[0].color = (*(value * 0.45 for value in color), 1)
        ramp.color_ramp.elements[1].position = 0.87
        ramp.color_ramp.elements[1].color = (*(min(value * 1.24, 1) for value in color), 1)
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.22
        bump.inputs["Distance"].default_value = depth
        links.new(coordinates.outputs["Object"], mapping.inputs[0])
        links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def box(name, location, size, mat, edge=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent, obj.location = parent, location
    obj.data.materials.append(mat)
    if edge:
        bevel = obj.modifiers.new("Rounded edges", "BEVEL")
        bevel.width, bevel.segments = edge, 2
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def sphere(name, location, size, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10)
    obj = bpy.context.object
    obj.name = name
    obj.parent, obj.location, obj.scale = parent, location, size
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def cylinder(name, location, radius, length, mat, parent=None, vertices=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length)
    obj = bpy.context.object
    obj.name = name
    obj.parent, obj.location = parent, location
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Rolled edge", "BEVEL")
    bevel.width, bevel.segments = min(0.012, radius * 0.22), 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def link(name, start, end, radius, mat, parent=None):
    a, b = Vector(start), Vector(end)
    obj = cylinder(name, (a + b) / 2, radius, (b - a).length, mat, parent)
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def anchor(name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_size, obj.location = 0.12, location
    return obj


def lettering(name, value, location, size, mat, font=None, parent=None, horizontal=False):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.size, curve.align_x, curve.align_y = value, size, "CENTER", "CENTER"
    if font:
        curve.font = font
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent, obj.location = parent, location
    obj.rotation_euler.x = 0 if horizontal else math.pi / 2
    curve.materials.append(mat)
    return obj


def area(name, position, point, color, power, size, size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.color, data.energy, data.size = color, power, size
    if size_y:
        data.shape, data.size_y = "RECTANGLE", size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return data


def customer_side_wall(mats, font):
    plaster, paint, oak = mats["plaster"], mats["petrol"], mats["wood"]
    box("Plaster back wall", (0, 3.07, 1.78), (10.2, 0.18, 3.56), plaster)
    box("Teal tile band", (0, 2.96, 0.49), (10.15, 0.046, 0.97), paint)
    box("Left room wall", (-4.94, 0.8, 1.78), (0.17, 4.5, 3.56), plaster)
    box("Floor", (0.0, 0.4, -0.10), (10.5, 9.8, 0.2), mats["floor"])
    box("Thai grocery storefront sign", (0.15, 2.87, 2.61), (1.66, 0.125, 0.57), paint, 0.035)
    box("Thai sign gold rule", (0.15, 2.798, 2.35), (1.48, 0.012, 0.016), mats["gold"], 0.003)
    lettering("Thai shop name", "ร้านชำ", (0.15, 2.797, 2.657), 0.282, mats["paper"], font)
    lettering("Small checkout room signature", "CORNER STORE", (0.15, 2.795, 2.46), 0.087, mats["gold"])
    for x in (-2.24, 2.61):
        box("Shelf frame", (x, 2.54, 1.28), (1.97, 0.22, 2.05), mats["dark_wood"], 0.028)
        for z in (0.47, 0.92, 1.37, 1.82):
            box("Oak shelf", (x, 2.25, z), (1.97, 0.62, 0.072), oak, 0.020)
            box("Shelf lip", (x, 1.935, z), (1.99, 0.040, 0.072), paint, 0.011)
    rng = random.Random(27)
    options = [mats[key] for key in ("gold", "ocher", "melon", "sea", "petrol", "paper")]
    for x in (-2.24, 2.61):
        for row, z in enumerate((0.51, 0.96, 1.41, 1.86)):
            for col in range(6):
                package_x = x - 0.765 + col * 0.306
                y = 2.14 + rng.uniform(-0.03, 0.03)
                h = rng.uniform(0.21, 0.35)
                color = options[(row * 5 + col // 2 + (x > 0)) % len(options)]
                if row in (0, 2):
                    cylinder("Shelf bottle", (package_x, y, z + h * 0.47), 0.091, h * 0.94, color, vertices=12)
                    cylinder("Shelf bottle cap", (package_x, y, z + h), 0.046, 0.045, mats["paper"], vertices=12)
                else:
                    box("Shelf carton", (package_x, y, z + h / 2), (0.215, 0.19, h), color, 0.016)
                    box("Shelf carton label", (package_x, y - 0.097, z + h * 0.6), (0.151, 0.006, 0.051), mats["paper"], 0.005)

    box("Cooler", (3.91, 1.95, 1.14), (0.95, 0.88, 2.25), mats["petrol"], 0.035)
    box("Cooler door inner", (3.91, 1.498, 1.19), (0.79, 0.035, 1.89), mats["sea"], 0.022)
    for z in (0.68, 1.08, 1.48, 1.88):
        box("Cooler reflection", (3.91, 1.477, z), (0.694, 0.008, 0.025), mats["blue"], 0.005)
    box("Cooler pull", (3.62, 1.447, 1.16), (0.033, 0.083, 0.33), mats["metal"], 0.012)
    for x in (-2.42, 2.68):
        cylinder("Pendants cord", (x, 0.32, 3.29), 0.018, 0.62, mats["charcoal"])
        cylinder("Pendants shade", (x, 0.32, 3.04), 0.23, 0.12, paint)
        cylinder("Pendants light diffuser", (x, 0.32, 2.976), 0.196, 0.013, mats["milk_glow"])


def checkout(mats, font):
    box("Counter shell", (0, -0.20, 0.51), (4.28, 1.53, 1.02), mats["petrol"], 0.075)
    box("Terrazzo counter", (0, -0.20, 0.996), (4.44, 1.66, 0.098), mats["counter"], 0.042)
    box("Toe kick", (0, -0.20, 0.108), (4.20, 1.49, 0.18), mats["charcoal"], 0.023)
    for x in range(-16, 17):
        box("Oak counter slat", (x * 0.120, -0.989, 0.559), (0.080, 0.058, 0.701), mats["wood"], 0.016)
    box("Front counter name panel", (0.66, -1.038, 0.54), (1.63, 0.067, 0.43), mats["petrol"], 0.042)
    lettering("Front counter name", "คิดเงิน", (0.66, -1.075, 0.56), 0.207, mats["paper"], font)

    box("Scanner base", (-0.58, -0.17, 1.095), (0.79, 0.67, 0.10), mats["charcoal"], 0.038)
    box("Scanner rubber grip", (-0.58, -0.17, 1.147), (0.64, 0.54, 0.042), mats["rubber"], 0.024)
    box("Scanner window", (-0.58, -0.17, 1.167), (0.36, 0.34, 0.008), mats["blue"], 0.015)
    for x in (-0.859, -0.301):
        box("Scanner side marker", (x, -0.17, 1.174), (0.026, 0.44, 0.010), mats["scan"], 0.004)
    for x in (-0.72, -0.44):
        box("Scanner aperture emitters", (x, -0.17, 1.172), (0.010, 0.27, 0.003), mats["scan"], 0.001)
    for x in (-0.74, -0.42):
        box("Scanner glass graduated stripe", (x, -0.34, 1.171), (0.028, 0.008, 0.004), mats["metal"], 0.001)
    lettering("Scanner label", "SCAN", (-0.58, -0.424, 1.171), 0.046, mats["paper"], horizontal=True)

    box("Register foot", (1.64, 0.15, 1.089), (0.53, 0.53, 0.089), mats["charcoal"], 0.025)
    box("Register neck", (1.64, 0.15, 1.278), (0.175, 0.18, 0.34), mats["metal"], 0.026)
    panel = anchor("Customer price display", (1.64, 0.11, 1.55))
    panel.rotation_euler.z = 0.26
    box("Register housing", (0, 0, 0), (0.86, 0.13, 0.48), mats["charcoal"], 0.041, panel)
    box("LCD backing", (0, -0.071, 0), (0.74, 0.012, 0.36), mats["petrol"], 0.023, panel)
    lettering("Total header", "TOTAL / THB", (0, -0.082, 0.102), 0.061, mats["light_text"], parent=panel)
    initial = lettering("Before total", "0.00", (0, -0.083, -0.044), 0.163, mats["light_text"], parent=panel)
    paid = lettering("Updated total", "12.00", (0, -0.083, -0.044), 0.163, mats["light_text"], parent=panel)
    box("Receipt printer foot", (0.975, -0.187, 1.105), (0.49, 0.427, 0.12), mats["charcoal"], 0.024)
    box("Receipt printer shell", (0.975, -0.166, 1.205), (0.43, 0.398, 0.16), mats["light_body"], 0.040)
    box("Printer receipt slot", (0.975, -0.241, 1.289), (0.292, 0.041, 0.010), mats["charcoal"], 0.005)
    cylinder("Printer on LED", (1.136, -0.247, 1.288), 0.013, 0.010, mats["light_text"], vertices=12)
    return initial, paid


def merchandise(mats):
    product = anchor("Water bottle • motion control")
    body = mats["blue"]
    cylinder("Bottle lower", (0, 0, 0.192), 0.137, 0.384, body, product)
    sphere("Bottle shoulder", (0, 0, 0.366), (0.135, 0.135, 0.107), body, product)
    cylinder("Bottle neck", (0, 0, 0.441), 0.066, 0.116, body, product)
    cylinder("Ribbed cap", (0, 0, 0.514), 0.076, 0.075, mats["gold"], product, 14)
    cylinder("Bottle collar", (0, 0, 0.473), 0.077, 0.022, mats["paper"], product)
    cylinder("Wrap label", (0, 0, 0.216), 0.139, 0.176, mats["paper"], product)
    for z in (0.137, 0.296):
        cylinder("Label teal stripe", (0, 0, z), 0.140, 0.014, mats["sea"], product)
    box("Label front", (0, -0.137, 0.218), (0.226, 0.018, 0.119), mats["paper"], 0.008, product)
    lettering("Bottle WATER", "WATER", (0, -0.149, 0.242), 0.054, mats["petrol"], parent=product)
    lettering("Bottle quantity", "600 mL", (0, -0.149, 0.188), 0.043, mats["petrol"], parent=product)
    return product


def arm(mats):
    hand = anchor("Hand grip • motion control")
    skin = mats["skin"]
    glove_position = (-0.184, 0.008, 0.24)
    link("Rolled cuff", (-0.399, 0.087, 0.249), (-0.307, 0.068, 0.237), 0.102, mats["petrol"], hand)
    link("Wrist exposed", (-0.348, 0.073, 0.24), glove_position, 0.075, skin, hand)
    sphere("Palm", glove_position, (0.096, 0.081, 0.116), skin, hand)
    for i, z in enumerate((0.143, 0.185, 0.232, 0.275)):
        start = (-0.179, 0.027, z)
        bend = (-0.133, -0.083, z + 0.005)
        tip = (-0.072 + (0.014 if i in (1, 2) else 0), -0.123, z + 0.018)
        link("Finger proximal phalanx", start, bend, 0.024, skin, hand)
        sphere("Finger knuckle", bend, (0.024, 0.024, 0.024), skin, hand)
        link("Finger distal phalanx", bend, tip, 0.023, skin, hand)
        sphere("Fingertip", tip, (0.023, 0.023, 0.023), skin, hand)
    thumb_joint = (-0.143, -0.053, 0.332)
    thumb_tip = (-0.079, -0.124, 0.355)
    link("Thumb proximal", (-0.201, 0.004, 0.304), thumb_joint, 0.028, skin, hand)
    sphere("Thumb knuckle", thumb_joint, (0.028, 0.028, 0.028), skin, hand)
    link("Thumb distal", thumb_joint, thumb_tip, 0.027, skin, hand)
    sphere("Thumb tip", thumb_tip, (0.027, 0.027, 0.027), skin, hand)
    return hand


def follow_segment(name, origin, destination, radius, mat):
    obj = cylinder(name, (0, 0, 0), radius, 1.0, mat)
    obj.rotation_euler.x = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    for vertex in obj.data.vertices:
        vertex.co.y += 0.5
    obj.parent = origin
    constraint = obj.constraints.new("STRETCH_TO")
    constraint.target = destination
    constraint.rest_length = 1
    constraint.volume = "NO_VOLUME"
    return obj


def clerk(mats, hand):
    body = anchor("Clerk body • motion control", (-2.20, 0.31, 0))
    skin, shirt, hair = mats["skin"], mats["ocher"], mats["charcoal"]
    box("Clerk trousers", (0, 0, 0.61), (0.52, 0.43, 1.225), mats["petrol"], 0.13, body)
    sphere("Clerk shirt", (0, 0, 1.44), (0.374, 0.240, 0.483), shirt, body)
    box("Shopkeeper apron", (0, -0.20, 1.329), (0.54, 0.119, 0.71), mats["petrol"], 0.085, body)
    box("Apron pocket", (-0.104, -0.265, 1.187), (0.238, 0.032, 0.163), mats["sea"], 0.031, body)
    for x in (-0.151, 0.151):
        link("Apron strap", (x, -0.093, 1.824), (x, -0.22, 1.534), 0.026, mats["petrol"], body)
    cylinder("Clerk neck", (0.018, 0.002, 1.835), 0.108, 0.185, skin, body)
    head = anchor("Clerk expression", (0.033, -0.022, 2.038))
    head.parent = body
    head.rotation_euler = (0.23, 0, 0.26)
    sphere("Clerk face", (0, 0, 0), (0.207, 0.179, 0.242), skin, head)
    sphere("Clerk hair crown", (0.017, 0.026, 0.136), (0.204, 0.176, 0.139), hair, head)
    sphere("Short sidepart", (0.128, -0.042, 0.123), (0.092, 0.124, 0.118), hair, head)
    for x in (-0.20, 0.20):
        sphere("Clerk ear", (x, -0.002, 0.001), (0.041, 0.047, 0.068), skin, head)
    for x in (-0.071, 0.071):
        sphere("Clerk focused eye", (x, -0.169, 0.029), (0.027, 0.015, 0.021), hair, head)
        link("Clerk eyebrow", (x - 0.026, -0.164, 0.070), (x + 0.028, -0.164, 0.077), 0.009, hair, head)
    sphere("Clerk nose", (0.009, -0.173, -0.019), (0.032, 0.041, 0.045), skin, head)
    sphere("Clerk smile", (0.003, -0.166, -0.113), (0.046, 0.012, 0.009), mats["ocher"], head)
    shoulder = anchor("Clerk shoulder")
    shoulder.parent, shoulder.location = body, (0.294, 0.008, 1.610)
    elbow = anchor("Clerk elbow • motion control")
    wrist = anchor("Wrist reference")
    wrist.parent, wrist.location = hand, WRIST_OFFSET
    sphere("Sleeve shoulder joint", (0, 0, 0), (0.139, 0.139, 0.139), shirt, shoulder)
    sphere("Sleeve bent elbow", (0, 0, 0), (0.100, 0.100, 0.100), shirt, elbow)
    follow_segment("Clerk upper sleeve", shoulder, elbow, 0.124, shirt)
    follow_segment("Clerk forearm sleeve", elbow, wrist, 0.097, shirt)
    return body, elbow


def receipt_assembly(mats):
    receipt = anchor("Receipt • motion control", (0.975, -0.245, 1.29))
    profile = [(0, 0, 0.142), (-0.045, 0.075, 0.144), (-0.112, 0.170, 0.150),
               (-0.213, 0.229, 0.157), (-0.329, 0.215, 0.162), (-0.455, 0.153, 0.166),
               (-0.555, 0.058, 0.166), (-0.595, 0.012, 0.165)]
    points = [(x, y, z) for y, z, width in profile for x in (-width, width)]
    faces = [(i, i + 2, i + 3, i + 1) for i in range(0, len(points) - 2, 2)]
    mesh = bpy.data.meshes.new("Receipt paper curl profile")
    mesh.from_pydata(points, [], faces)
    paper = bpy.data.objects.new("Curled thermal receipt", mesh)
    bpy.context.collection.objects.link(paper)
    paper.parent = receipt
    mesh.materials.append(mats["paper"])
    for face in mesh.polygons:
        face.use_smooth = True
    solidify = paper.modifiers.new("Paper thickness", "SOLIDIFY")
    solidify.thickness = 0.006

    shop_line = lettering("Receipt shop line", "CORNER STORE", (0, -0.355, 0.209),
                         0.026, mats["charcoal"], parent=receipt, horizontal=True)
    shop_line.rotation_euler.x = 0.46
    total_line = lettering("Receipt total line", "TOTAL  12.00", (0, -0.421, 0.178),
                          0.036, mats["charcoal"], parent=receipt, horizontal=True)
    total_line.rotation_euler.x = 0.46
    for index, x in enumerate(range(-10, 11)):
        line = box("Receipt barcode stripe", (x * 0.010, -0.516, 0.102), (0.003 + (index % 3) * 0.0007, 0.030, 0.002),
                   mats["charcoal"], parent=receipt)
        line.rotation_euler.x = 0.76
    return receipt


def key(object_or_data, property_name, points):
    for frame, value in points:
        setattr(object_or_data, property_name, value)
        object_or_data.keyframe_insert(data_path=property_name, frame=frame)


def animate(scene, product, hand, body, elbow, receipt, initial, paid, mats, scan_light):
    motion = [(1, (-1.54, -0.46, 1.43)), (12, PRESENT_POSITION), (24, (-1.07, -0.18, 1.43)),
              (36, SCAN_POSITION), (45, SCAN_POSITION), (56, (-0.28, -0.15, 1.36)),
              (63, BAG_POSITION), (96, BAG_POSITION)]
    key(product, "location", motion)
    key(product, "rotation_euler", [(1, (0.14, -0.10, 0.19)), (12, (0.12, -0.12, 0.17)),
                                    (36, (0, 0, 0)), (45, (0, 0, 0)), (63, (0, 0, 0.27))])
    key(hand, "location", motion[:7] + [(71, (-0.39, 0.17, 1.38)), (79, (-1.28, -0.04, 1.23)),
                                      (96, (-1.79, -0.10, 1.20))])
    key(hand, "rotation_euler", [(1, (0.14, -0.10, 0.19)), (12, (0.12, -0.12, 0.17)),
                                 (36, (0, 0, 0)), (45, (0, 0, 0)), (63, (0, 0, 0.27)),
                                 (79, (0.09, 0.1, -0.13)), (96, (0.18, 0.08, -0.34))])
    key(body, "location", [(1, (-2.30, 0.41, 0)), (12, (-2.29, 0.41, 0)),
                            (36, (-1.96, 0.42, 0)), (45, (-1.96, 0.42, 0)),
                            (63, (-1.56, 0.42, 0)), (79, (-2.03, 0.41, 0)), (96, (-2.25, 0.40, 0))])
    key(elbow, "location", [(1, (-2.015, 0.05, 1.35)), (12, (-1.96, 0.023, 1.43)),
                             (24, (-1.67, 0.11, 1.43)), (36, (-1.30, 0.11, 1.36)),
                             (45, (-1.30, 0.11, 1.36)), (56, (-1.00, 0.135, 1.44)),
                             (63, (-0.765, 0.055, 1.26)), (71, (-1.00, 0.12, 1.38)),
                             (79, (-1.74, 0.105, 1.307)), (96, (-2.12, 0.11, 1.25))])
    key(initial, "hide_render", [(1, False), (38, False), (39, True)])
    key(paid, "hide_render", [(1, True), (38, True), (39, False)])
    key(receipt, "scale", [(1, (0.001,) * 3), (61, (0.001,) * 3), (74, (1, 1, 1)), (96, (1, 1, 1))])
    emission = mats["scan"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"]
    key(emission, "default_value", [(1, 0.10), (35, 0.10), (39, 5.4), (42, 7.5), (46, 1.6), (50, 0.10)])
    key(scan_light, "energy", [(1, 0), (36, 0), (42, 8), (46, 2), (48, 0)])
    for frame, name in BEATS:
        scene.timeline_markers.new(name.title(), frame=frame)
    scene.timeline_markers.new("Scan accepted", frame=39)
    scene.timeline_markers.new("Grip Release", frame=63)
    scene.timeline_markers.new("Receipt Printer Starts", frame=61)
    scene.frame_set(42)
    assert (product.location - hand.location).length < 0.0001
    assert abs(product.location.z - PAD_HEIGHT) < 0.0001
    assert not paid.hide_render and initial.hide_render
    scene.frame_set(79)
    assert receipt.scale.x > 0.99 and (hand.location - product.location).length > 0.75


def compositor(scene):
    tree = bpy.data.node_groups.new("Pixel highlights • checkout", "CompositorNodeTree")
    scene.compositing_node_group = tree
    tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    render = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    output = tree.nodes.new("NodeGroupOutput")
    render.location, glare.location, output.location = (-270, 0), (0, 0), (270, 0)
    glare.label = "Controlled highlight bloom"
    glare.inputs["Type"].default_value = "Fog Glow"
    glare.inputs["Quality"].default_value = "High"
    glare.inputs["Threshold"].default_value = 2.65
    glare.inputs["Strength"].default_value = 0.43
    glare.inputs["Size"].default_value = 0.28
    tree.links.new(render.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], output.inputs["Image"])


def make_scene(width, samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Corner store | Checkout rehearsal"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 5
    scene.render.resolution_x, scene.render.resolution_y = width, round(width * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.fps, scene.frame_start, scene.frame_end = 24, 1, 96
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("Neutral overhead bounce")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.41, 0.49, 0.63, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24
    scene.world = world

    mats = {
        "petrol": material("Deep teal painted timber", (0.023, 0.165, 0.151), texture=(2, (3, 3, 3), 0.009)),
        "plaster": material("Warm lime plaster", (0.48, 0.41, 0.29), 0.87),
        "floor": material("Satin cement floor", (0.24, 0.197, 0.155), 0.73, texture=(4.5, (1, 1, 1), 0.015)),
        "wood": material("Honey oak grain", (0.46, 0.220, 0.079), 0.48, texture=(4.2, (7, 7, 0.1), 0.008)),
        "dark_wood": material("Oiled wood shelf backing", (0.187, 0.080, 0.035), 0.54),
        "counter": material("Light mineral countertop", (0.57, 0.493, 0.398), 0.40,
                            texture=(24.0, (3.6, 3.6, 3.6), 0.004)),
        "ocher": material("Clerk twill copper sleeve", (0.47, 0.117, 0.037), 0.78, texture=(14, (2, 2, 2), 0.008)),
        "skin": material("Warm medium skin", (0.44, 0.205, 0.120), 0.58),
        "sea": material("Aqua shop accent", (0.048, 0.31, 0.27)),
        "charcoal": material("Graphite POS hardware", (0.022, 0.029, 0.035), 0.42),
        "rubber": material("Scanner nonslip rubber", (0.037, 0.041, 0.039), 0.66),
        "light_body": material("Printer case", (0.61, 0.64, 0.58), 0.43),
        "metal": material("Brushed aluminium", (0.46, 0.54, 0.57), 0.26, metallic=0.78),
        "blue": material("Blue recycled water bottle plastic", (0.053, 0.33, 0.56), 0.19),
        "gold": material("Warm amber accent", (0.94, 0.52, 0.083), 0.36),
        "melon": material("Red-orange packaging", (0.65, 0.13, 0.086), 0.38),
        "paper": material("Cream label paper", (0.87, 0.79, 0.62), 0.70),
        "scan": material("Scanner LED, keyed during contact", (1, 0.046, 0.033), 0.36, glow=0.10),
        "milk_glow": material("Frosted pendant glass", (1, 0.75, 0.48), 0.28, glow=2.0),
        "light_text": material("Readable POS LCD digits", (0.38, 1, 0.62), 0.36, glow=1.1),
    }
    font = bpy.data.fonts.load(str(ROOT / "game" / "assets" / "fonts" / "kanit" / "Kanit-SemiBold.ttf"))
    font.pack()
    customer_side_wall(mats, font)
    initial, paid = checkout(mats, font)
    product, hand, receipt = merchandise(mats), arm(mats), receipt_assembly(mats)
    body, elbow = clerk(mats, hand)

    camera_params = bpy.data.cameras.new("Checkout camera")
    camera = bpy.data.objects.new("Checkout camera", camera_params)
    bpy.context.collection.objects.link(camera)
    camera.location = (3.15, -7.12, 3.52)
    camera.rotation_euler = (Vector((-0.12, 0.08, 1.46)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_params.lens = 49
    scene.camera = camera

    daylight = area("Large warm storefront key", (-3.8, -2.3, 3.65), (-0.48, -0.15, 1.07),
                    (1.0, 0.82, 0.65), 850, 3.65, 2.45)
    area("Cool display fill", (3.6, -1.5, 3.35), (0.10, -0.25, 1.15),
         (0.60, 0.76, 1.0), 365, 3.1)
    area("Warm overhead shelf spill", (-1.2, 1.55, 3.28), (-0.2, 0.17, 0.90),
         (1.0, 0.60, 0.38), 435, 2.8)
    area("Soft spot over shop sign", (0.9, 0.72, 3.48), (0.15, 2.8, 2.68),
         (1, 0.78, 0.55), 160, 1.9)
    scan_light = area("Keyed scanner contact light", (-0.58, -0.35, 1.19), (-0.58, -0.13, 1.36),
                      (1, 0.028, 0.018), 0, 0.27, 0.052)
    animate(scene, product, hand, body, elbow, receipt, initial, paid, mats, scan_light)
    compositor(scene)
    bpy.context.view_layer.objects.active = camera
    for screen in bpy.data.screens:
        for space in (area.spaces.active for area in screen.areas if area.type == "VIEW_3D"):
            space.region_3d.view_perspective = "CAMERA"
    return scene, daylight


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "blender-checkout")
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--frames", choices=("hero", "receipt", "beats", "none"), default="beats")
    parser.add_argument("--evening", action="store_true")
    parser.add_argument("--motion", action="store_true", help="Render frames 1, 3, …, 95 at 12 fps for video encoding")
    parser.add_argument("--motion-from", type=int, default=1, help="Resume motion at an odd Blender timeline frame")
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if options.width < 320 or options.samples < 4:
        parser.error("Use a width of at least 320 pixels and at least 4 samples")
    if not 1 <= options.motion_from <= 95 or options.motion_from % 2 != 1:
        parser.error("Use an odd motion start between frame 1 and 95")
    out = options.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    scene, daylight = make_scene(options.width, options.samples)
    scene.frame_set(42)
    scene.render.filepath = "//frames/checkout-"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "checkout.blend"))
    frames = {"hero": BEATS[1:2], "receipt": BEATS[2:], "beats": BEATS, "none": ()}[options.frames]
    for frame, name in frames:
        scene.frame_set(frame)
        scene.render.filepath = str(out / f"{name}.png")
        bpy.ops.render.render(write_still=True)
    if options.evening:
        original_power = daylight.energy
        original_color = tuple(daylight.color)
        daylight.energy = 215
        daylight.color = (0.51, 0.63, 1)
        scene.frame_set(42)
        scene.render.filepath = str(out / "04-evening.png")
        bpy.ops.render.render(write_still=True)
        daylight.energy, daylight.color = original_power, original_color
    if options.motion:
        frames_dir = out / "motion"
        frames_dir.mkdir(exist_ok=True)
        motion_width = min(options.width, 640)
        scene.render.resolution_x = motion_width
        scene.render.resolution_y = round(motion_width * 9 / 16)
        scene.cycles.samples = 8
        for frame in range(options.motion_from, 96, 2):
            scene.frame_set(frame)
            index = (frame + 1) // 2
            scene.render.filepath = str(frames_dir / f"frame-{index:03d}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
