/* shelf-walk-scene.js — first-person shelves, checkout, and optional customers in a single Canvas view. */
(function () {
  const M = (window.MTL = window.MTL || {});
  const ROOM = { left: -6.2, right: 6.2, near: -1, far: 9.6, height: 3.25 };
  const OUTLETS = [
    { id: 'a', x: -3.25, z: 7.05, color: '#a64530', light: '#f5d8bc', label: 'ชั้น A' },
    { id: 'b', x: 0, z: 7.05, color: '#366858', light: '#dcf0d9', label: 'ชั้น B' },
    { id: 'checkout', x: 3.25, z: 7.05, color: '#30596e', light: '#d9edf5', label: 'ชำระเงิน' },
  ];
  const DISTANCE = 2.46;
  const SPEED = 2.5;
  const NEAR_PLANE = 0.075;
  const PLAYER_RADIUS = 0.24;
  const ACTOR_RADIUS = 0.3;
  const ACTOR_HEIGHT = 1.72;
  const EYE_HEIGHT = 1.42;
  const TAU = 2 * Math.PI;

  const quadXY = (x1, y1, x2, y2, z) => [[x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z]];
  const quadXZ = (x1, z1, x2, z2, y) => [[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]];
  const quadYZ = (z1, y1, z2, y2, x) => [[x, y1, z1], [x, y1, z2], [x, y2, z2], [x, y2, z1]];

  // actors: [{ id, x, z, sprite, bubble, bubbleColor, ring, ringColor }] read on every draw, so callers may mutate them
  // start: { x, z, yaw } · ambience: { tint } washes the whole view, for example evening light
  function create(canvas, { stations, actors = [], start, ambience = {} }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (!canvas.hasAttribute('width')) canvas.width = 960;
    if (!canvas.hasAttribute('height')) canvas.height = 540;
    const pose = { x: OUTLETS[0].x, z: 4.05, yaw: 0, ...start };
    const sprites = new Map();
    const actorImage = (url) => {
      if (!url) return null;
      if (!sprites.has(url)) {
        const image = new Image();
        image.addEventListener('load', () => draw(), { once: true });
        image.src = url;
        sprites.set(url, image);
      }
      const image = sprites.get(url);
      return image.complete && image.naturalWidth ? image : null;
    };
    const displays = OUTLETS.map((outlet) => {
      const station = stations.find((entry) => entry.id === outlet.id) || {};
      const image = station.sprite ? new Image() : null;
      const display = { ...outlet, station, image };
      if (image) {
        image.addEventListener('load', () => draw(), { once: true });
        image.src = station.sprite;
      }
      return display;
    });
    const obstacles = displays.map(({ x, z }) => ({ x1: x - 1.25, x2: x + 1.25, z1: z - 0.48, z2: z + 0.48 }));
    const blocked = (x, z) => x < ROOM.left + PLAYER_RADIUS || x > ROOM.right - PLAYER_RADIUS ||
      z < ROOM.near + PLAYER_RADIUS || z > ROOM.far - PLAYER_RADIUS ||
      obstacles.some((box) => x > box.x1 - PLAYER_RADIUS && x < box.x2 + PLAYER_RADIUS &&
        z > box.z1 - PLAYER_RADIUS && z < box.z2 + PLAYER_RADIUS) ||
      actors.some((actor) => Math.hypot(actor.x - x, actor.z - z) < ACTOR_RADIUS + PLAYER_RADIUS);

    function step(forward, strafe, turn, seconds) {
      if (!(seconds > 0) || ![forward, strafe, turn, seconds].every(Number.isFinite)) return;
      const count = Math.ceil(Math.min(seconds, 3) / 0.05);
      const time = Math.min(seconds, 3) / count;
      const length = Math.max(1, Math.hypot(forward, strafe));
      const m = SPEED * time / length;
      for (let i = 0; i < count; i++) {
        pose.yaw = (pose.yaw + turn * 1.9 * time) % TAU;
        const sine = Math.sin(pose.yaw), cosine = Math.cos(pose.yaw);
        const x = pose.x + (sine * forward + cosine * strafe) * m;
        const z = pose.z + (cosine * forward - sine * strafe) * m;
        if (!blocked(x, pose.z)) pose.x = x;
        if (!blocked(pose.x, z)) pose.z = z;
      }
    }

    // Move the camera to a free spot, for example the listening point in front of a customer.
    function place(next) {
      const candidate = { ...pose, ...next };
      if (![candidate.x, candidate.z, candidate.yaw].every(Number.isFinite) || blocked(candidate.x, candidate.z)) return false;
      Object.assign(pose, candidate);
      return true;
    }

    function target() {
      let best = null, nearest = DISTANCE;
      for (const display of displays) {
        const dx = display.x - pose.x, dz = display.z - 0.6 - pose.z;
        const distance = Math.hypot(dx, dz);
        if (dz <= 0 || distance >= nearest) continue;
        const ahead = dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw);
        if (ahead < distance * 0.78) continue;
        nearest = distance;
        best = display.id;
      }
      return best;
    }

    let w, h, focal, eye, sine, cosine;
    function camera([x, y, z]) {
      const dx = x - pose.x, dz = z - pose.z;
      return { x: dx * cosine - dz * sine, y: y - EYE_HEIGHT, z: dx * sine + dz * cosine };
    }
    function project(point) {
      return [w / 2 + focal * point.x / point.z, eye - focal * point.y / point.z];
    }
    function nearIntersection(a, b) {
      const t = (NEAR_PLANE - a.z) / (b.z - a.z);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR_PLANE };
    }
    function fillFace(points, color) {
      const clipped = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const aFront = a.z >= NEAR_PLANE, bFront = b.z >= NEAR_PLANE;
        if (aFront) clipped.push(a);
        if (aFront !== bFront) clipped.push(nearIntersection(a, b));
      }
      if (clipped.length < 3) return;
      ctx.beginPath();
      for (const p of clipped) ctx.lineTo(...project(p));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    const face = (corners, color) => fillFace(corners.map(camera), color);

    function storeWalls() {
      const { left, right, near, far, height } = ROOM;
      face(quadXZ(left, near, right, far, height), '#fcf5e8');
      face(quadXY(left, 0, right, height, far), '#e5d1b5');
      face(quadXY(left, 0, right, height, near), '#dfc3a4');
      face(quadYZ(near, 0, far, height, left), '#e8d8bd');
      face(quadYZ(near, 0, far, height, right), '#d7bfa5');

      for (const location of [near, far]) {
        face(quadXY(left, 0, right, 0.16, location), '#ac8d6c');
        face(quadXY(left, height - 0.38, right, height - 0.29, location), '#9d6042');
      }
      for (const location of [left, right]) {
        face(quadYZ(near, 0, far, 0.16, location), '#ac8d6c');
        face(quadYZ(near, height - 0.38, far, height - 0.29, location), '#9d6042');
      }
      for (const z of [0.25, 3.1, 6.0, 8.65]) {
        for (const x of [-3.5, 0, 3.5]) {
          face(quadXZ(x - 0.78, z - 0.17, x + 0.78, z + 0.17, height - 0.025), '#d0c3a9');
          face(quadXZ(x - 0.66, z - 0.095, x + 0.66, z + 0.095, height - 0.034), '#fffdf6');
        }
      }
      face(quadXY(-5.52, 0, -4.73, 2.28, far - 0.015), '#8d6a4e');
      face(quadXY(-5.44, 0.08, -4.81, 2.20, far - 0.025), '#a7b8ac');
      face(quadXY(-5.43, 0.88, -4.82, 2.13, far - 0.035), '#c7dce0');
      face(quadXY(4.92, 1.1, 5.65, 2.22, far - 0.02), '#9b7859');
      face(quadXY(5.01, 1.19, 5.56, 2.13, far - 0.03), '#fbebcb');
      face(quadXY(5.08, 1.9, 5.49, 2.03, far - 0.04), '#9d6042');
    }

    function storeFloor() {
      const { left, right, near, far } = ROOM;
      face(quadXZ(left, near, right, far, 0), '#b3977b');
      const shades = ['#dfc5a5', '#d7b995', '#e7ceb1', '#dabd9a'];
      for (let row = 0, z = near; z < far; row++, z += 0.87) {
        for (let col = 0, x = left; x < right; col++, x += 0.87) {
          face(quadXZ(x + 0.013, z + 0.013, Math.min(x + 0.856, right), Math.min(z + 0.856, far), 0),
            shades[(row * 5 + col * 3 + Math.floor(col / 3)) % shades.length]);
        }
      }
      for (const { x, z } of displays) {
        face(quadXZ(x - 1.32, z - 0.73, x + 1.32, z + 0.53, 0.002), 'rgba(67, 40, 23, .17)');
      }
      for (const actor of actors) {
        if (actor.ring) fillFace(circle(actor.x, actor.z, actor.ring, 0.004).map(camera), actor.ringColor || 'rgba(255, 214, 90, .28)');
        fillFace(circle(actor.x, actor.z, 0.34, 0.006).map(camera), 'rgba(52, 33, 21, .22)');
      }
    }
    const circle = (x, z, radius, y) => Array.from({ length: 28 }, (_, i) =>
      [x + radius * Math.sin(i / 28 * TAU), y, z + radius * Math.cos(i / 28 * TAU)]);

    function customer(actor) {
      const image = actorImage(actor.sprite);
      const width = ACTOR_HEIGHT * 2 / 3;
      billboard(actor.x, ACTOR_HEIGHT / 2, actor.z, width, ACTOR_HEIGHT, (sx, sy, bw, bh) => {
        if (image) ctx.drawImage(image, sx - bw / 2, sy - bh / 2, bw, bh);
        else {
          ctx.fillStyle = '#577590';
          ctx.fillRect(sx - bw * 0.22, sy - bh * 0.2, bw * 0.44, bh * 0.68);
          ctx.beginPath();
          ctx.arc(sx, sy - bh * 0.32, bw * 0.17, 0, TAU);
          ctx.fillStyle = '#f2c9a0';
          ctx.fill();
        }
        if (!actor.bubble) return;
        const radius = Math.max(11, Math.min(30, bw * 0.24));
        const bx = sx + bw * 0.3, by = sy - bh * 0.5 - radius * 0.4;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, TAU);
        ctx.fillStyle = actor.bubbleColor || '#ffde59';
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, radius * 0.12);
        ctx.strokeStyle = '#3b2a1e';
        ctx.stroke();
        ctx.fillStyle = '#2b1d12';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.round(radius * 1.15) + 'px Sarabun, "Segoe UI Emoji", sans-serif';
        ctx.fillText(actor.bubble, bx, by + radius * 0.05);
      });
    }

    const depthQueue = [];
    function queueFace(corners, color) {
      const points = corners.map(camera);
      if (points.every((p) => p.z <= NEAR_PLANE)) return;
      const depth = points.reduce((sum, p) => sum + p.z, 0) / points.length;
      depthQueue.push({ depth, paint: () => fillFace(points, color) });
    }
    function box(x1, x2, y1, y2, z1, z2, [front, side, top]) {
      if (pose.z < z1) queueFace(quadXY(x1, y1, x2, y2, z1), front);
      if (pose.z > z2) queueFace(quadXY(x1, y1, x2, y2, z2), side);
      if (pose.x < x1) queueFace(quadYZ(z1, y1, z2, y2, x1), side);
      if (pose.x > x2) queueFace(quadYZ(z1, y1, z2, y2, x2), side);
      if (y2 < EYE_HEIGHT) queueFace(quadXZ(x1, z1, x2, z2, y2), top);
      if (y1 > EYE_HEIGHT) queueFace(quadXZ(x1, z1, x2, z2, y1), side);
    }
    function billboard(x, y, z, width, height, painter) {
      const point = camera([x, y, z]);
      if (point.z < 0.11) return;
      const [screenX, screenY] = project(point);
      const scale = focal / point.z;
      if (screenX + width * scale / 2 < 0 || screenX - width * scale / 2 > w) return;
      depthQueue.push({ depth: point.z, paint: () => painter(screenX, screenY, width * scale, height * scale) });
    }

    function shelf(display) {
      const { x, z, station, image, color, light, label } = display;
      const front = z - 0.46, back = z + 0.42;
      const wood = ['#966b48', '#68492f', '#c19264'];
      const frame = [color, '#51382a', '#ca956d'];
      box(x - 1.22, x + 1.22, 0.02, 2.38, back - 0.07, back, ['#644732', '#4d3426', '#a2754b']);
      for (const edge of [x - 1.24, x + 1.12]) {
        box(edge, edge + 0.12, 0.03, 2.38, front, back, frame);
      }
      for (const [row, level] of [0.2, 0.75, 1.31, 1.87].entries()) {
        box(x - 1.13, x + 1.12, level, level + 0.076, front, back, wood);
        if (row === 3) continue;
        for (let col = 0; col < 5; col++) {
          const itemX = x - 0.88 + col * 0.44;
          const width = col % 3 === 0 ? 0.32 : 0.35, height = 0.45;
          billboard(itemX, level + 0.08 + height / 2, front + 0.15, width, height, (sx, sy, iw, ih) => {
            if (image && image.complete && image.naturalWidth) {
              ctx.drawImage(image, sx - iw / 2, sy - ih / 2, iw, ih);
            } else {
              ctx.font = String(Math.round(ih * 0.72)) + 'px "Segoe UI Emoji", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(station.icon || '📦', sx, sy, iw);
            }
          });
        }
      }
      box(x - 1.23, x + 1.23, 1.96, 2.34, front, front + 0.12, frame);
      billboard(x, 2.16, front - 0.03, 1.50, 0.30, (sx, sy, bw, bh) => {
        ctx.fillStyle = '#fff6e7';
        ctx.font = '700 ' + Math.min(45, Math.round(bh * 0.83)) + 'px Sarabun, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sx, sy, bw);
      });
      const price = station.price == null ? '' : String(station.price) + ' บาท';
      billboard(x, 1.17, front - 0.025, 0.95, 0.32, (sx, sy, bw, bh) => {
        ctx.fillStyle = '#654c37';
        ctx.fillRect(sx - bw * 0.51, sy - bh * 0.48, bw * 1.02, bh);
        ctx.fillStyle = light;
        ctx.fillRect(sx - bw / 2, sy - bh / 2, bw, bh);
        ctx.fillStyle = '#382b22';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.min(34, Math.round(bh * 0.53)) + 'px Sarabun, Tahoma, sans-serif';
        ctx.fillText(price, sx, sy - bh * 0.17, bw * 0.93);
        ctx.font = '600 ' + Math.min(22, Math.round(bh * 0.35)) + 'px Sarabun, Tahoma, sans-serif';
        ctx.fillText(station.sizeText || '', sx, sy + bh * 0.25, bw * 0.93);
      });
    }
    function checkout(display) {
      const { x, z, label, color } = display;
      const front = z - 0.53;
      box(x - 1.22, x + 1.22, 0.03, 0.95, front, z + 0.41, [color, '#274858', '#568093']);
      box(x - 1.27, x + 1.27, 0.95, 1.08, front - 0.04, z + 0.45, ['#77583e', '#49392c', '#ba946b']);
      box(x + 0.42, x + 0.87, 1.08, 1.27, front + 0.19, front + 0.72, ['#353837', '#252b2b', '#636764']);
      box(x + 0.50, x + 0.87, 1.23, 1.47, front + 0.51, front + 0.64, ['#164453', '#243436', '#4e6e75']);
      queueFace(quadXY(x + 0.53, 1.29, x + 0.84, 1.42, front + 0.505), '#9fca8e');
      box(x - 1.06, x + 1.06, 2.03, 2.45, z - 0.34, z - 0.22, [color, '#272f31', '#568093']);
      billboard(x, 2.25, z - 0.36, 1.82, 0.32, (sx, sy, bw, bh) => {
        ctx.fillStyle = '#f4fbf9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.min(38, Math.round(bh * 0.73)) + 'px Sarabun, Tahoma, sans-serif';
        ctx.fillText(label, sx, sy, bw);
      });
      if (pose.z < front) queueFace(quadXY(x - 0.83, 0.25, x + 0.83, 0.75, front - 0.01), '#3e6d82');
    }

    function draw() {
      w = canvas.width; h = canvas.height;
      focal = Math.min(w * 0.51, h * 0.91); eye = h * 0.41;
      sine = Math.sin(pose.yaw); cosine = Math.cos(pose.yaw);
      ctx.fillStyle = '#e5d1b5';
      ctx.fillRect(0, 0, w, h);
      storeWalls();
      storeFloor();
      for (const display of displays) {
        if (display.id === 'checkout') checkout(display);
        else shelf(display);
      }
      for (const actor of actors) customer(actor);
      depthQueue.sort((a, b) => b.depth - a.depth);
      for (const entry of depthQueue) entry.paint();
      depthQueue.length = 0;

      const edge = ctx.createRadialGradient(w / 2, h * 0.49, w * 0.18, w / 2, h * 0.45, w * 0.69);
      edge.addColorStop(0, 'rgba(53, 30, 22, 0)');
      edge.addColorStop(1, 'rgba(53, 30, 22, .25)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, w, h);
      if (ambience.tint) {
        ctx.fillStyle = ambience.tint;
        ctx.fillRect(0, 0, w, h);
      }
      if (held) heldItem();
    }

    // The pack the player is carrying, drawn as a first-person hand in the lower right corner.
    let held = null;
    function heldItem() {
      const size = Math.min(w, h) * 0.36;
      const x = w - size * 0.62, y = h - size * 0.5;
      ctx.fillStyle = '#d9a47c';
      ctx.beginPath();
      ctx.ellipse(x + size * 0.18, h + size * 0.02, size * 0.3, size * 0.46, -0.45, 0, TAU);
      ctx.fill();
      const image = actorImage(held.sprite);
      if (image) ctx.drawImage(image, x - size * 0.3, y - size * 0.36, size * 0.56, size * 0.66);
      else {
        ctx.font = String(Math.round(size * 0.5)) + 'px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(held.icon || '📦', x - size * 0.02, y);
      }
      ctx.fillStyle = '#e8b892';
      ctx.beginPath();
      ctx.ellipse(x - size * 0.2, y + size * 0.16, size * 0.13, size * 0.09, 0.35, 0, TAU);
      ctx.fill();
    }
    const hold = (item) => { held = item ? { sprite: item.sprite, icon: item.icon } : null; draw(); };

    draw();
    return { step, target, draw, place, hold, pose: () => ({ ...pose }), actors, ambience };
  }

  M.ShelfWalkScene = { create };
})();
