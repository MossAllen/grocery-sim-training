/*
 * store-scene.js — ฉากร้านชำบน canvas (Claude)
 * ใช้ภาพจาก MTL_SPRITE_MANIFEST ถ้ามี (ผลงาน Blender) ไม่มีก็วาดด้วยรูปทรง + อีโมจิ
 */
(function () {
  const M = (window.MTL = window.MTL || {});
  const W = 800, H = 380;
  const spriteCache = {};
  function sprite(key) {
    const url = (window.MTL_SPRITE_MANIFEST || {})[key];
    if (!url) return null;
    let img = spriteCache[key];
    if (!img) { img = spriteCache[key] = new Image(); img.src = url; img.onerror = () => { img.broken = true; }; }
    return img.complete && !img.broken && img.naturalWidth ? img : null;
  }
  const FACES = ['🧑', '👩', '👨', '🧓', '👧'];
  const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#577590', '#b5838d'];

  class StoreScene {
    constructor(canvas, opts = {}) {
      this.c = canvas; this.g = canvas.getContext('2d');
      canvas.width = W; canvas.height = H;
      this.opts = opts;
      this.product = opts.product;
      this.customers = []; this.floaters = [];
      this.clock = opts.startMinute ?? 7 * 60; // นาทีของวัน
      this.minutesPerSec = opts.minutesPerSec ?? 0.5;
      this.running = false; this.last = 0; this.id = 0;
      this.sign = opts.sign || null;
      canvas.addEventListener('click', (e) => this.onClick(e));
      M.currentScene = this; // ใช้ตรวจ/ทดสอบจาก console
    }
    timeLabel(m = this.clock) { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
    start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.loop(t)); }
    stop() { this.running = false; }
    loop(t) {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
      this.update(dt); this.draw();
      requestAnimationFrame((tt) => this.loop(tt));
    }
    spawn(data = {}) {
      const i = this.id++ % FACES.length;
      const cust = {
        id: this.id, x: 40, y: 330, face: data.face || FACES[i], shirt: SHIRTS[i], sprite: `customer_${i + 1}`,
        path: [{ x: 120, y: 250 }, { x: 160 + Math.random() * 380, y: 190 }, { x: 650, y: 260 }, { x: 760, y: 340 }],
        step: 0, wait: 0, speed: 120 + Math.random() * 50, data, bubble: data.bubble || null, done: false,
      };
      cust.path[1].wait = data.shelfWait ?? 1.6;
      cust.path[2].wait = data.counterWait ?? 0.7;
      this.customers.push(cust);
      M.sfx.play('door');
      return cust;
    }
    float(x, y, text, color = '#2f9e60') { this.floaters.push({ x, y, text, color, t: 0 }); }
    update(dt) {
      this.clock += dt * this.minutesPerSec;
      for (const c of this.customers) {
        if (c.wait > 0) { c.wait -= dt; continue; }
        const p = c.path[c.step];
        if (!p) { c.done = true; continue; }
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        const v = c.speed * dt * (this.opts.speedMul || 1);
        if (d <= v) {
          c.x = p.x; c.y = p.y; c.wait = p.wait || 0;
          if (this.opts.onArrive) this.opts.onArrive(c, c.step);
          c.step++;
        } else { c.x += (dx / d) * v; c.y += (dy / d) * v; }
      }
      const gone = this.customers.filter((c) => c.done);
      if (gone.length) { this.customers = this.customers.filter((c) => !c.done); gone.forEach((c) => this.opts.onLeave && this.opts.onLeave(c)); }
      this.floaters.forEach((f) => (f.t += dt));
      this.floaters = this.floaters.filter((f) => f.t < 1.4);
    }
    onClick(e) {
      const r = this.c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best = null, bd = 40;
      for (const c of this.customers) { const d = Math.hypot(c.x - x, c.y - 20 - y); if (d < bd) { bd = d; best = c; } }
      if (best && this.opts.onCustomerClick) this.opts.onCustomerClick(best);
    }
    draw() {
      const g = this.g;
      // พื้น
      const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#f7e7cf'); grd.addColorStop(1, '#e8d2b0');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,90,50,.12)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, H); g.stroke(); }
      for (let y = 150; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      // ผนัง
      g.fillStyle = '#c9b18c'; g.fillRect(0, 0, W, 60);
      g.fillStyle = '#2a2622'; g.font = 'bold 20px Leelawadee UI, Tahoma, sans-serif'; g.textAlign = 'left';
      g.fillText('🏪 ร้านชำ', 16, 38);
      g.font = 'bold 18px Tahoma, sans-serif'; g.textAlign = 'right'; g.fillText('🕒 ' + this.timeLabel(), W - 16, 38);
      // ชั้นวาง
      const shelf = sprite('shelf');
      const P = this.product;
      for (let s = 0; s < 3; s++) {
        const sx = 150 + s * 150, sy = 70;
        if (shelf) g.drawImage(shelf, sx, sy - 10, 130, 90);
        else {
          g.fillStyle = '#8d6e4c'; g.fillRect(sx, sy, 130, 70);
          g.fillStyle = '#a7845e'; g.fillRect(sx + 4, sy + 30, 122, 6); g.fillRect(sx + 4, sy + 62, 122, 6);
        }
        const key = s === 1 ? 'big' : 'small';
        const img = P && sprite(`item_${P.id}_${key}`);
        for (let k = 0; k < 4; k++) {
          for (let row = 0; row < 2; row++) {
            const ix = sx + 18 + k * 30, iy = sy + 26 + row * 32;
            if (img) g.drawImage(img, ix - 12, iy - 26, 24, 28);
            else { g.font = (s === 1 ? '22px' : '18px') + ' sans-serif'; g.textAlign = 'center'; g.fillText(P ? P.emoji[key] : '📦', ix, iy); }
          }
        }
      }
      // ป้ายโปร
      if (this.sign) {
        g.fillStyle = '#ffde59'; g.strokeStyle = '#b94a1c'; g.lineWidth = 3;
        g.beginPath(); g.roundRect ? g.roundRect(300, 150, 200, 34, 8) : g.rect(300, 150, 200, 34); g.fill(); g.stroke();
        g.fillStyle = '#b94a1c'; g.font = 'bold 16px Leelawadee UI, Tahoma, sans-serif'; g.textAlign = 'center';
        g.fillText(this.sign, 400, 173);
      }
      // เคาน์เตอร์
      const counter = sprite('counter');
      if (counter) g.drawImage(counter, 600, 260, 160, 80);
      else {
        g.fillStyle = '#6b4f35'; g.fillRect(610, 280, 150, 50); g.fillStyle = '#8d6e4c'; g.fillRect(604, 272, 162, 12);
        g.font = '24px sans-serif'; g.textAlign = 'center'; g.fillText('🧾', 700, 300);
      }
      // ประตู
      g.fillStyle = '#9ad1d4'; g.fillRect(0, 290, 18, 80);
      // ลูกค้า
      const sorted = this.customers.slice().sort((a, b) => a.y - b.y);
      for (const c of sorted) {
        const img = sprite(c.sprite);
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(c.x, c.y + 4, 16, 5, 0, 0, Math.PI * 2); g.fill();
        if (img) g.drawImage(img, c.x - 28, c.y - 80, 56, 84);
        else {
          g.fillStyle = c.shirt; g.beginPath(); g.roundRect ? g.roundRect(c.x - 13, c.y - 30, 26, 32, 8) : g.rect(c.x - 13, c.y - 30, 26, 32); g.fill();
          g.font = '30px sans-serif'; g.textAlign = 'center'; g.fillText(c.face, c.x, c.y - 30);
        }
        if (c.bubble) {
          g.fillStyle = c.bubbleColor || '#fff'; g.strokeStyle = '#2a2622'; g.lineWidth = 2;
          g.beginPath(); g.arc(c.x + 18, c.y - 66, 14, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = '#2a2622'; g.font = 'bold 16px Tahoma, sans-serif'; g.textAlign = 'center'; g.fillText(c.bubble, c.x + 18, c.y - 60);
        }
      }
      for (const f of this.floaters) {
        g.globalAlpha = Math.max(0, 1 - f.t / 1.4);
        g.fillStyle = f.color; g.font = 'bold 18px Tahoma, sans-serif'; g.textAlign = 'center';
        g.fillText(f.text, f.x, f.y - 70 - f.t * 30);
        g.globalAlpha = 1;
      }
      if (this.opts.overlay) this.opts.overlay(g, W, H);
    }
  }
  M.StoreScene = StoreScene;
})();
