"""stud_kit.py - a small helper for chunky, bevelled stud-style Roblox props in Blender.

Run headless to build the example crate and export it:
    blender -b --python stud_kit.py -- --out example_crate.fbx

Or import it from your own build script:
    import sys; sys.path.append(r"<folder with stud_kit.py>")
    from stud_kit import Kit, PALETTE
    k = Kit("MyProp")
    k.box((0, 0, 0.5), (2, 2, 1), "WOOD_M")
    k.export("MyProp.fbx")

Units: 1 Blender unit = 1 Roblox stud. Z is up in Blender (Y is up in Roblox; the FBX export handles it).
"""
import math
import sys

import bpy
import bmesh
from mathutils import Vector

# ---------------------------------------------------------------------------------------------------
# Palette: a small fixed set of colours, 3-4 shades per material (light / mid / dark / darkest).
# Grow this for your own game; every colour in every model should come from here.
# ---------------------------------------------------------------------------------------------------
PALETTE = {
    "WOOD_L": "e0874a", "WOOD_M": "d9713c", "WOOD_D": "aa5a32", "WOOD_DD": "4e2e19",
    "RED_L": "e8434b", "RED": "d81e2a", "RED_D": "a8141f", "RED_DD": "6e0d15",
    "GOLD_L": "ffd95a", "GOLD": "f4c41c", "GOLD_D": "c79312",
    "CREAM_L": "fbf3df", "CREAM": "f1e4c3", "CREAM_D": "d8c79f",
    "IRON_L": "6b7078", "IRON": "4a4e55", "IRON_D": "2e3136",
    "LEAF_L": "7cc86a", "LEAF": "4f9e45", "LEAF_D": "2f6b2c",
    "STONE_L": "d9d6cf", "STONE": "b9b4aa", "STONE_D": "8e897f",
    "INK": "26232a", "WHITE": "ffffff",
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def snap(colour):
    """A palette name or any hex -> the nearest palette colour (as raw sRGB 0..1)."""
    if colour in PALETTE:
        return hex_rgb(PALETTE[colour])
    want = hex_rgb(colour)
    best = min(PALETTE.values(), key=lambda h: sum((a - b) ** 2 for a, b in zip(hex_rgb(h), want)))
    return hex_rgb(best)


# ---------------------------------------------------------------------------------------------------
# Kit: collects bevelled pieces into one mesh with per-face colours, then shades and exports it.
# ---------------------------------------------------------------------------------------------------
class Kit:
    def __init__(self, name, ao_floor=0.55, ao_height=0.8):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.faces.layers.int.new("pal")  # index into self.colours
        self.glow = self.bm.faces.layers.int.new("glow")  # 1 = no contact shading (Neon pieces)
        self.colours = []
        self.ao_floor = ao_floor  # darkest a contact can get (0.45-0.6 looks right)
        self.ao_height = ao_height  # studs above a piece's base that stay darker

    def _colour_index(self, colour):
        rgb = snap(colour)
        if rgb not in self.colours:
            self.colours.append(rgb)
        return self.colours.index(rgb)

    def _tag(self, faces, colour, glow):
        ci = self._colour_index(colour)
        for f in faces:
            f[self.col] = ci
            f[self.glow] = 1 if glow else 0

    def box(self, center, size, colour, bev=None, segs=None, glow=False, rotation=None):
        """A bevelled box. center/size in studs (x, y, z with z up).
        bev: bevel width (default scales with size: 0.03-0.1). segs: 1 for thin parts, 2 for big ones.
        rotation: optional quaternion applied around the box centre."""
        sx, sy, sz = size
        small = min(size)
        if bev is None:
            bev = max(0.03, min(0.1, small * 0.06))
        if segs is None:
            segs = 1 if small < 2.5 else 2
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        for v in tmp.verts:
            x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
            if rotation is not None:
                x, y, z = rotation @ Vector((x, y, z))
            v.co = Vector((x + center[0], y + center[1], z + center[2]))
        if bev > 0:
            bev = min(bev, small * 0.45)
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bev, segments=segs, profile=0.5,
                            affect="EDGES", clamp_overlap=True)
        self._merge(tmp, colour, glow)

    def flat(self, center, size, colour, glow=False):
        """An unbevelled box: bricks, grooves, plaques, stripes (cheapest)."""
        self.box(center, size, colour, bev=0, segs=1, glow=glow)

    def cyl(self, center, radius, height, colour, sides=8, bev=0.04, glow=False):
        """An upright cylinder (8 sides small, 10-14 medium, 16 only for big hero curves)."""
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=sides,
                              radius1=radius, radius2=radius, depth=height)
        for v in tmp.verts:
            v.co += Vector(center)
        if bev > 0:
            rim = [e for e in tmp.edges if len(e.link_faces) == 2 and
                   abs(e.link_faces[0].normal.z) != abs(e.link_faces[1].normal.z)]
            bmesh.ops.bevel(tmp, geom=rim, offset=min(bev, radius * 0.3, height * 0.3), segments=1,
                            profile=0.5, affect="EDGES", clamp_overlap=True)
        self._merge(tmp, colour, glow)

    def lathe(self, center, profile, colour, sides=10, glow=False):
        """Spin a profile [(radius, z), ...] (bottom to top) around Z: pots, lanterns, vases."""
        tmp = bmesh.new()
        rings = []
        for r, z in profile:
            ring = []
            for i in range(sides):
                a = 2 * math.pi * i / sides
                ring.append(tmp.verts.new((center[0] + r * math.cos(a), center[1] + r * math.sin(a),
                                           center[2] + z)))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                tmp.faces.new((a[i], a[j], b[j], b[i]))
        tmp.faces.new(list(reversed(rings[0])))
        tmp.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        self._merge(tmp, colour, glow)

    def studs(self, top_center, nx, ny, colour, pitch=1.0, size=0.6, height=0.2):
        """Square studs on a top surface (keep them sparse: tops and a front row only).
        Returns a separate Kit so studs export as their own toggleable mesh (<name>__Studs)."""
        k = Kit(self.name + "__Studs", ao_floor=1.0)
        x0 = top_center[0] - (nx - 1) * pitch / 2
        y0 = top_center[1] - (ny - 1) * pitch / 2
        for i in range(nx):
            for j in range(ny):
                k.box((x0 + i * pitch, y0 + j * pitch, top_center[2] + height / 2),
                      (size, size, height), colour, bev=0.04, segs=1)
        return k

    def _merge(self, tmp, colour, glow):
        tmp.verts.ensure_lookup_table()
        new_faces = []
        vmap = {v: self.bm.verts.new(v.co) for v in tmp.verts}
        for f in tmp.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.smooth = True
            new_faces.append(nf)
        # remember each piece's base height for contact shading
        base = min(v.co.z for v in tmp.verts)
        for f in new_faces:
            f.tag = False
        self._tag(new_faces, colour, glow)
        for f in new_faces:
            f.normal_update()
        self._bases = getattr(self, "_bases", [])
        self._bases.append((new_faces, base))
        tmp.free()

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    # -----------------------------------------------------------------------------------------------
    def build(self):
        """Make the Blender object: raw sRGB vertex colours x simple contact shading, smooth + weighted
        normals (42 degree sharp angle)."""
        base_of = {}
        for faces, base in getattr(self, "_bases", []):
            for f in faces:
                base_of[f] = base
        me = bpy.data.meshes.new(self.name)
        # write colours per corner before handing the bmesh to the mesh
        attr_rgb = []
        for f in self.bm.faces:
            r, g, b = self.colours[f[self.col]]
            for loop in f.loops:
                k = 1.0
                if not f[self.glow]:
                    rise = loop.vert.co.z - base_of.get(f, loop.vert.co.z)
                    t = max(0.0, min(1.0, rise / self.ao_height))
                    k = self.ao_floor + (1 - self.ao_floor) * (t ** 0.6)
                attr_rgb.append((r * k, g * k, b * k, 1.0))
        self.bm.to_mesh(me)
        ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        for i, c in enumerate(attr_rgb):
            ca.data[i].color_srgb = c  # raw sRGB: do NOT linearize (it renders ~2x too dark in Roblox)
        me.color_attributes.active_color = ca
        try:
            me.set_sharpness_by_angle(angle=math.radians(42))
        except AttributeError:
            pass
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        mod = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        return ob

    def export(self, path, extra=()):
        """Export this kit (and extra kits, e.g. studs) as one FBX, each as its own mesh."""
        obs = [self.build()] + [k.build() for k in extra]
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.export_scene.fbx(filepath=path, use_selection=True, apply_scale_options="FBX_SCALE_NONE",
                                 mesh_smooth_type="FACE", colors_type="SRGB", use_mesh_modifiers=True,
                                 bake_space_transform=True, axis_forward="-Z", axis_up="Y")
        total = 0
        for k, o in zip([self] + list(extra), obs):
            t = k.tris()
            total += t
            lo = [min(v.co[i] for v in o.data.vertices) for i in range(3)]
            hi = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
            size = [round(hi[i] - lo[i], 3) for i in range(3)]
            warn = "  <-- over 18k: split it" if t > 18000 else ""
            print(f"INFO {o.name}: {t} tris, size x{size[0]} y{size[1]} z{size[2]} (Blender, z up){warn}")
        print(f"INFO total {total} tris -> {path}")
        return obs


# ---------------------------------------------------------------------------------------------------
# Example: a market crate with planks, a dark rim, a label and a few apples (about 1k tris)
# ---------------------------------------------------------------------------------------------------
def example(out):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    k = Kit("Crate")
    # body: planks with small gaps (gaps read as shadow lines), shade varies on every third plank
    for i in range(4):
        z = 0.35 + i * 0.6
        shade = "WOOD_D" if i % 3 == 2 else "WOOD_M"
        k.box((0, -1.25, z), (2.6, 0.18, 0.52), shade)   # front
        k.box((0, 1.25, z), (2.6, 0.18, 0.52), shade)    # back
        k.box((-1.25, 0, z), (0.18, 2.3, 0.52), shade)   # left
        k.box((1.25, 0, z), (0.18, 2.3, 0.52), shade)    # right
    # darker corner posts and a light top rim (light tops, dark bottoms)
    for x in (-1.3, 1.3):
        for y in (-1.3, 1.3):
            k.box((x, y, 1.25), (0.32, 0.32, 2.5), "WOOD_DD")
    k.box((0, -1.32, 2.45), (2.9, 0.2, 0.14), "WOOD_L")
    k.box((0, 1.32, 2.45), (2.9, 0.2, 0.14), "WOOD_L")
    # base plinth, darkest
    k.box((0, 0, 0.06), (2.9, 2.9, 0.12), "WOOD_DD", segs=1)
    # story detail: a cream label sitting on the planks, a red stripe on it (no coplanar faces = no flicker)
    k.box((0, -1.40, 1.2), (1.2, 0.12, 0.7), "CREAM")
    k.flat((0, -1.48, 1.35), (1.0, 0.04, 0.14), "RED")
    # a hidden shelf inside so the apples rest on something
    k.flat((0, 0, 2.1), (2.3, 2.3, 0.2), "WOOD_DD")
    # apples on top (lathe, 8 sides) with a leaf
    for x, y in ((-0.6, -0.4), (0.1, 0.3), (0.6, -0.5), (-0.3, 0.6)):
        k.lathe((x, y, 2.2), [(0.05, 0.0), (0.3, 0.12), (0.36, 0.32), (0.28, 0.52), (0.08, 0.58)], "RED", sides=8)
        k.flat((x + 0.08, y, 2.82), (0.18, 0.05, 0.08), "LEAF")
    k.export(out)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else "example_crate.fbx"
    example(out)
