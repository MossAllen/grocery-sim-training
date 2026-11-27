"""
generate_stud_sprites.py — ภาพสไปรต์ร้านชำแบบ stud (บล็อกลบมุม เฉดสี 3–4 ขั้น ปุ่ม stud สี่เหลี่ยมห่าง ๆ เงาฐาน)
ตามสกิล stud-model-style ใช้ตัวช่วย blender/stud_kit.py · รอบแรก 13 ภาพ: ชั้นวาง เคาน์เตอร์ สินค้า 6 และลูกค้ายืน 5

วิธีรัน (จากโฟลเดอร์ marketing-training-lab):
    blender -b -P blender/generate_stud_sprites.py -- --out dist/stud-preview
    blender -b -P blender/generate_stud_sprites.py -- --out game/assets/sprites      # เขียนทับภาพในเกม (คีย์เดิม)

คีย์ ขนาด และกรอบกล้องเหมือน generate_store_assets.py จึงสลับใช้แทนกันได้โดยไม่แก้โค้ดเกม
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
import stud_kit  # noqa: E402
from stud_kit import Kit, PALETTE  # noqa: E402

SIZES = {"shelf": (260, 180), "counter": (320, 160), "customer": (88, 132), "customer_pose": (176, 264), "item": (48, 56)}

# สีของเกมนี้: 3–4 เฉดต่อวัสดุ (สว่างด้านบน · กลาง · มืดด้านข้าง · มืดสุดที่ฐาน)
PALETTE.update({
    "SKIN_L": "f8d9b8", "SKIN": "f1c29a", "SKIN_D": "d39a72",
    "HAIR": "4a2f22", "HAIR_D": "2e1c14",
    "WATER_L": "bfe6f7", "WATER": "8fd0ee", "WATER_D": "5aa9cf",
    "CAP_G": "2f9e55", "CAP_B": "2467c9",
    "SNACK_O": "f39a2a", "SNACK_O_D": "c46f14", "SNACK_R": "e2363f", "SNACK_R_D": "a8202a",
    "PAPER_L": "ffffff", "PAPER": "f2f0ea", "PAPER_D": "d6d1c4",
    "TEAL_L": "5cc7b5", "TEAL": "2a9d8f", "TEAL_D": "1d6f66",
    "CORAL": "e76f51", "CORAL_D": "b8513a", "SAND": "e9c46a", "SAND_D": "c19f45",
    "SLATE": "577590", "SLATE_D": "3e566c", "ROSE": "b5838d", "ROSE_D": "8c6169",
    "NAVY": "1d2f5c", "NAVY_D": "131f3d", "DENIM": "3a4a66", "DENIM_D": "283447",
    "BAG": "3a302a", "BASKET": "c8402f", "BASKET_D": "8e2a1f", "PACK": "3271d1", "PACK_D": "234f94",
})
SHIRTS = [("CORAL", "CORAL_D"), ("TEAL", "TEAL_D"), ("PAPER_L", "PAPER_D"), ("SLATE", "SLATE_D"), ("ROSE", "ROSE_D")]


# ---------- ฉากและการเรนเดอร์ ----------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scn.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"
    scn.view_settings.view_transform = "Standard"
    try:
        scn.view_settings.look = "Medium High Contrast"
    except TypeError:
        pass
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    scn.world = world
    return scn


def vertex_colour_material():
    m = bpy.data.materials.new("StudVC")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    return m


def finish(kits):
    mat = vertex_colour_material()
    for k in kits:
        ob = k.build()
        ob.data.materials.append(mat)


def camera_and_light(scn, target_h, size_key, obj_w):
    """กรอบเดียวกับ generate_store_assets.py: กล้อง ortho เงยลง 12° เล็งกลางวัตถุ"""
    wp, hp = SIZES[size_key]
    scn.render.resolution_x, scn.render.resolution_y = wp, hp
    tilt, dist, pad = math.radians(12), 10.0, 1.18
    cz = target_h / 2
    bpy.ops.object.camera_add(location=(0, -dist * math.cos(tilt), cz + dist * math.sin(tilt)), rotation=(math.pi / 2 - tilt, 0, 0))
    cam = bpy.context.active_object
    cam.data.type = "ORTHO"
    need_w, need_h = obj_w * pad, target_h * pad
    cam.data.ortho_scale = max(need_w, need_h * wp / hp) if wp >= hp else max(need_h, need_w * hp / wp)
    scn.camera = cam
    # แดด 42° จากพื้น เฉียงซ้าย (สูตรภาพตัวอย่างของสกิล)
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(90 - 42), 0, math.radians(-50)))
    sun = bpy.context.active_object.data
    sun.energy = 3.2
    sun.angle = math.radians(14)


def render(scn, out_dir, key):
    path = os.path.join(out_dir, f"{key}.png")
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("rendered", path)


# ---------- โมเดล ----------
def build_shelf():
    k = Kit("Shelf", ao_floor=0.6, ao_height=1.2)
    k.box((0, 0.22, 1.0), (3.1, 0.18, 2.0), "WOOD_DD")                     # แผ่นหลัง
    for x in (-1.5, 1.5):
        k.box((x, 0, 1.0), (0.2, 0.62, 2.0), "WOOD_D")                       # เสาข้าง
    for i, z in enumerate((0.08, 0.72, 1.36, 1.96)):
        k.box((0, -0.02, z), (3.0, 0.6, 0.12), "WOOD_L" if i == 3 else "WOOD_M")
        if i < 3:
            k.flat((0, -0.33, z + 0.02), (2.8, 0.03, 0.06), "WOOD_DD")        # ร่องเงาขอบชั้น
    k.box((0, 0, 0.0), (3.2, 0.66, 0.08), "WOOD_DD", segs=1)                # ฐาน
    # ของบนชั้นเป็นบล็อกสีเรียงกัน (ซ้ำแต่เปลี่ยนเฉดทุก 3 ชิ้น)
    stock = [("WATER", "WATER_D"), ("SNACK_O", "SNACK_O_D"), ("PAPER", "PAPER_D")]
    for row, z in enumerate((0.14, 0.78, 1.42)):
        for i in range(6):
            body, dark = stock[(row + i // 2) % 3]
            x = -1.15 + i * 0.46
            k.box((x, -0.06, z + 0.22), (0.34, 0.36, 0.44), dark if i % 3 == 2 else body)
            k.flat((x, -0.25, z + 0.24), (0.26, 0.02, 0.1), "CREAM_L")       # ป้ายหน้าแพ็ก
    studs = k.studs((0, -0.02, 2.02), 5, 1, "WOOD_L", pitch=0.6, size=0.32, height=0.08)
    return [k, studs], 2.1


def build_counter():
    k = Kit("Counter", ao_floor=0.55, ao_height=0.9)
    k.box((0, 0, 0.5), (4.0, 1.0, 1.0), "WOOD_M")                           # ตัวเคาน์เตอร์
    for i in range(7):
        x = -1.71 + i * 0.57
        k.box((x, -0.53, 0.55), (0.46, 0.08, 0.78), "WOOD_D" if i % 3 == 1 else "WOOD_M")   # แผงไม้มีร่อง
    k.box((0, -0.5, 0.06), (4.1, 0.14, 0.12), "WOOD_DD", segs=1)            # บัวฐาน
    k.box((0, 0, 1.06), (4.25, 1.15, 0.12), "CREAM")                        # ท็อปสีครีม
    k.flat((0, -0.58, 1.0), (4.2, 0.04, 0.05), "CREAM_D")
    k.box((0, -0.56, 0.62), (1.3, 0.06, 0.4), "RED")                        # ป้ายคิดเงิน
    k.flat((0, -0.6, 0.62), (1.0, 0.02, 0.1), "GOLD_L")
    # เครื่องคิดเงิน: ฐานเหล็ก จอเอียง แท่นสแกน
    k.box((1.25, 0.05, 1.27), (0.8, 0.6, 0.3), "IRON")
    k.box((1.25, 0.1, 1.62), (0.7, 0.12, 0.42), "IRON_D")
    k.flat((1.25, 0.03, 1.63), (0.58, 0.02, 0.3), "WATER_L", glow=True)
    k.box((-1.1, -0.05, 1.15), (0.7, 0.5, 0.06), "IRON_D")
    k.flat((-1.1, -0.05, 1.19), (0.5, 0.32, 0.02), "RED_L", glow=True)
    studs = k.studs((-0.2, 0.2, 1.12), 3, 1, "CREAM_L", pitch=0.7, size=0.36, height=0.08)
    return [k, studs], 1.85


def build_item(product, size):
    big = size == "big"
    k = Kit(f"Item_{product}_{size}", ao_floor=0.62, ao_height=0.5)
    if product == "water":
        h, r = (1.4, 0.28) if big else (0.9, 0.2)
        k.cyl((0, 0, h / 2), r, h, "WATER", sides=12, bev=0.05)
        k.cyl((0, 0, h * 0.55), r + 0.015, h * 0.32, "PAPER_L", sides=12, bev=0.02)
        k.flat((0, -r - 0.02, h * 0.55), (r * 1.1, 0.02, h * 0.1), "CAP_B" if big else "CAP_G")
        k.cyl((0, 0, h + 0.05), r * 0.55, 0.1, "WATER_D", sides=10, bev=0.02)
        k.cyl((0, 0, h + 0.15), 0.1, 0.14, "CAP_B" if big else "CAP_G", sides=10, bev=0.03)
        top = h + 0.22
    elif product == "snack":
        w, hh = (0.9, 1.2) if big else (0.64, 0.9)
        body, dark = ("SNACK_O", "SNACK_O_D") if big else ("SNACK_R", "SNACK_R_D")
        k.box((0, 0, hh / 2), (w, 0.26, hh), body)
        k.box((0, 0, hh + 0.04), (w * 0.96, 0.18, 0.1), dark)                # รอยซีล
        k.box((0, -0.14, hh * 0.5), (w * 0.62, 0.04, hh * 0.34), "CREAM_L")  # ป้ายหน้าถุง
        k.flat((0, -0.17, hh * 0.5), (w * 0.4, 0.02, 0.06), dark)
        top = hh + 0.1
    else:
        if big:
            for x in (-0.25, 0.25):
                for z in (0.28, 0.84):
                    k.cyl((x, 0, z), 0.24, 0.54, "PAPER", sides=12, bev=0.04)
            k.box((0, -0.02, 0.56), (1.02, 0.5, 0.16), "TEAL")                 # แถบห่อ
            top = 1.12
        else:
            k.cyl((0, 0, 0.32), 0.28, 0.62, "PAPER", sides=12, bev=0.05)
            k.cyl((0, 0, 0.32), 0.09, 0.64, "WOOD_D", sides=8, bev=0.0)
            top = 0.64
    return [k], top


# ท่ากระทำ W1R2 (ART_SPEC): ของถืออยู่หน้าลำตัวเพราะกล้อง ortho ไม่เห็นแขนที่ยื่นเข้าหากล้อง
POSES = [(0, "pick"), (3, "look"), (1, "look"), (2, "pay"), (4, "pay")]


def held_arm(k, x, s, hand_x, hand_z, colour):
    """แขนงอยกมือมาหน้าอก: ต้นแขนตั้ง + ปลายแขนเฉียงขึ้นถึงมือ"""
    k.box((x, 0, 1.3 * s), (0.16, 0.24, 0.36 * s), colour)
    mid_x, mid_z = (x + hand_x) / 2, (1.12 * s + hand_z) / 2
    k.box((mid_x, -0.14, mid_z), (abs(hand_x - x) + 0.15, 0.2, abs(hand_z - 1.12 * s) + 0.15), colour)
    k.box((hand_x, -0.24, hand_z), (0.15, 0.16, 0.14), "SKIN")


def pack(k, x, z, w, h, body, label="CREAM_L"):
    k.box((x, -0.34, z), (w, 0.14, h), body)
    k.flat((x, -0.42, z - h * 0.12), (w * 0.7, 0.02, h * 0.22), label)


def build_customer(i, mode=None):
    """mode: None = ยืน · 'walk' = ก้าว (เกมสลับซ้ายขวาเอง) · 'pick' 'look' 'pay' = ท่ากระทำ"""
    k = Kit(f"Customer_{i + 1}_{mode or 'stand'}", ao_floor=0.6, ao_height=0.7)
    shirt, shirt_d = SHIRTS[i]
    s = 0.88 if i == 2 else 1.0
    wide = 1.18 if i == 1 else 1.0
    pants, pants_d = ("NAVY", "NAVY_D") if i == 2 else ("DENIM", "DENIM_D")
    # ขาและรองเท้า: บล็อกลบมุม 2 ข้าง (ไม่ใช่ทรงกระบอกเดียว)
    for side, x in ((-1, -0.13), (1, 0.13)):
        # ท่าก้าว: ขาซ้ายก้าวหน้ายกเท้า ขาขวาถีบหลัง
        dy = -0.32 * side if mode == "walk" else 0.0
        lift = 0.16 if mode == "walk" and side < 0 else 0.0
        k.box((x * wide, dy, 0.47 * s + lift), (0.24 * wide, 0.3, 0.86 * s - lift), pants)
        k.flat((x * wide, dy, 0.84 * s), (0.25 * wide, 0.31, 0.04), pants_d)
        k.box((x * wide, dy - 0.04, 0.05 + lift), (0.27 * wide, 0.38, 0.1), "INK", segs=1)
    # ลำตัว: บล็อกใหญ่ + ปกเสื้อเฉดมืด + เข็มขัด
    k.box((0, 0, 1.2 * s), (0.62 * wide, 0.36, 0.7 * s), shirt)
    k.flat((0, -0.19, 0.9 * s), (0.6 * wide, 0.02, 0.06), shirt_d)
    k.box((0, -0.02, 1.53 * s), (0.36, 0.3, 0.08), shirt_d)
    # แขน (ท่ายืนและท่าก้าว แกว่งสวนขา) · ท่ากระทำวาดแขนเองด้านล่าง
    if mode in (None, "walk"):
        for side, x in ((-1, -0.38), (1, 0.38)):
            dy = 0.26 * side if mode == "walk" else 0.0
            up = 0.08 if mode == "walk" and side > 0 else 0.0   # แขนที่แกว่งไปหน้ายกขึ้นเล็กน้อย
            k.box((x * wide, dy, 1.17 * s + up), (0.16, 0.24, 0.62 * s), shirt_d)
            k.box((x * wide, dy - 0.01, 0.82 * s + up), (0.15, 0.2, 0.12), "SKIN")
    # หัว: บล็อกลบมุมใหญ่ ผม 2 ชั้น ตาเป็นบล็อกเข้มเล็ก
    k.box((0, 0, 1.86 * s), (0.5, 0.44, 0.5), "SKIN", bev=0.08, segs=2)
    k.box((0, 0.04, 2.13 * s), (0.54, 0.48, 0.14), "HAIR", bev=0.05)
    k.box((0, 0.2, 1.98 * s), (0.54, 0.1, 0.36), "HAIR_D")
    for x in (-0.11, 0.11):
        k.flat((x, -0.225, 1.88 * s), (0.07, 0.02, 0.09), "INK")
    k.flat((0, -0.225, 1.74 * s), (0.14, 0.02, 0.03), "SKIN_D")
    # ของประจำกลุ่ม (GDD §5): 1 กระเป๋าสะพาย · 2 ตะกร้า · 3 เป้ · 4 แว่น+ถือสินค้า · 5 ทั่วไป
    if mode in ("pick", "look", "pay"):
        build_pose(k, i, mode, s, wide, shirt_d)
    elif i == 0:
        k.box((0.45, -0.02, 0.98), (0.2, 0.3, 0.34), "BAG")
        k.flat((0.08, -0.2, 1.3), (0.7, 0.02, 0.05), "BAG")
    elif i == 1:
        k.box((0, -0.42, 0.98), (0.66, 0.36, 0.3), "BASKET")
        k.flat((0, -0.6, 0.98), (0.6, 0.02, 0.06), "BASKET_D")
        k.box((0, -0.42, 1.16), (0.58, 0.28, 0.06), "WATER")
    elif i == 2:
        k.box((0, 0.3, 1.25 * s), (0.5, 0.26, 0.56), "PACK")
        k.flat((0, 0.44, 1.18 * s), (0.36, 0.02, 0.2), "PACK_D")
    elif i == 3:
        for x in (-0.11, 0.11):
            k.flat((x, -0.235, 1.88), (0.16, 0.02, 0.13), "INK")
            k.flat((x, -0.245, 1.88), (0.1, 0.02, 0.07), "WATER_L")
        k.box((0.2, -0.36, 1.42), (0.22, 0.12, 0.32), "SNACK_R")
        k.flat((0.2, -0.43, 1.38), (0.14, 0.02, 0.08), "GOLD")
    studs = k.studs((0, 0.04, 2.2 * s), 1, 1, "HAIR", pitch=0.5, size=0.26, height=0.07)
    return [k, studs], 2.3 * s


def build_pose(k, i, pose, s, wide, arm):
    if (i, pose) == (0, "pick"):        # หยิบแพ็กเล็กมาดูหน้าอก กระเป๋าสะพายข้าง
        k.box((0.47, -0.02, 0.98), (0.2, 0.3, 0.34), "BAG")
        k.flat((0.08, -0.2, 1.3), (0.7, 0.02, 0.05), "BAG")
        held_arm(k, 0.38, s, 0.14, 1.36, arm)
        pack(k, 0.14, 1.5, 0.24, 0.32, "WATER")
        k.box((-0.38, 0, 1.17), (0.16, 0.24, 0.62), arm)
        k.box((-0.38, -0.01, 0.82), (0.15, 0.2, 0.12), "SKIN")
    elif (i, pose) == (3, "look"):      # ถือสองขนาดเทียบป้าย
        held_arm(k, -0.38, s, -0.2, 1.38, arm)
        held_arm(k, 0.38, s, 0.22, 1.38, arm)
        pack(k, -0.22, 1.5, 0.2, 0.28, "SNACK_R")
        pack(k, 0.25, 1.56, 0.3, 0.42, "SNACK_O")
    elif (i, pose) == (1, "look"):      # ตะกร้าห้อยแขนซ้าย ยกแพ็กใหญ่ขึ้นดู
        k.box((-0.44 * wide, 0, 1.17), (0.16, 0.24, 0.62), arm)
        k.box((-0.5 * wide, -0.2, 0.82), (0.5, 0.32, 0.26), "BASKET")
        k.flat((-0.5 * wide, -0.37, 0.82), (0.44, 0.02, 0.05), "BASKET_D")
        held_arm(k, 0.44 * wide, s, 0.2, 1.58, arm)
        pack(k, 0.18, 1.74, 0.42, 0.36, "PAPER", "TEAL")
    elif (i, pose) == (2, "pay"):       # นักเรียนยื่นสินค้ากับธนบัตรที่เคาน์เตอร์
        k.box((0, 0.3, 1.25 * s), (0.5, 0.26, 0.56), "PACK")
        held_arm(k, 0.38, s, 0.2, 1.26 * s, arm)
        pack(k, 0.2, 1.4 * s, 0.22, 0.3, "WATER")
        held_arm(k, -0.38, s, -0.2, 1.2 * s, arm)
        k.flat((-0.22, -0.36, 1.3 * s), (0.28, 0.02, 0.16), "LEAF")
        k.flat((-0.22, -0.375, 1.3 * s), (0.12, 0.02, 0.06), "LEAF_L")
    elif (i, pose) == (4, "pay"):       # อุ้มแพ็กใหญ่ 3 ชิ้น
        for n, z in enumerate((1.02, 1.3, 1.58)):
            pack(k, 0, z, 0.52, 0.26, "PAPER" if n % 2 == 0 else "PAPER_D", "TEAL")
        for x in (-0.38, 0.38):
            k.box((x, 0, 1.32), (0.16, 0.24, 0.34), arm)
            k.box((x * 0.82, -0.2, 1.06), (0.16, 0.36, 0.14), arm)
            k.box((x * 0.72, -0.34, 1.04), (0.15, 0.14, 0.14), "SKIN")
    else:
        raise ValueError(f"no pose {pose} for customer {i + 1}")


# ---------- main ----------
def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    jobs = [("shelf", build_shelf, "shelf", 3.4), ("counter", build_counter, "counter", 4.4)]
    jobs += [(f"item_{p}_{z}", (lambda p=p, z=z: build_item(p, z)), "item", 1.0)
             for p in ("water", "snack", "household") for z in ("small", "big")]
    jobs += [(f"customer_{i + 1}", (lambda i=i: build_customer(i)), "customer", 1.25) for i in range(5)]
    jobs += [(f"customer_{i + 1}_walk", (lambda i=i: build_customer(i, "walk")), "customer", 1.25) for i in range(4)]
    jobs += [(f"customer_{i + 1}_{pose}", (lambda i=i, pose=pose: build_customer(i, pose)), "customer_pose", 1.25)
             for i, pose in POSES]
    for key, build, size_key, width in jobs:
        scn = reset_scene()
        kits, h = build()
        finish(kits)
        print(f"INFO {key}: {sum(k.tris() for k in kits)} tris")
        camera_and_light(scn, 2.2 if size_key.startswith("customer") else h, size_key, width)
        render(scn, out_dir, key)


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(HERE, "..", "dist", "stud-preview")
main(os.path.abspath(OUT))
