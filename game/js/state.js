/* state.js — บันทึกความคืบหน้าลง localStorage (Claude) */
(function () {
  const M = (window.MTL = window.MTL || {});
  const KEY = 'mtl-save-v1';
  const fresh = () => ({
    version: 1,
    product: null,
    player: '',
    rounds: {},      // "w-r" -> { stars, score, skill, at }
    sim: {},         // ผลจำลอง เช่น baseline, promoPlan, promoRun, post
    portfolio: {},   // id -> { week, title, text }
    settings: { sound: true, tts: true, unlockAll: false },
  });

  M.State = {
    data: fresh(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.data = Object.assign(fresh(), JSON.parse(raw));
        this.data.settings = Object.assign(fresh().settings, this.data.settings);
        // เซฟ v0.1: เก็บชิ้นงานสัปดาห์ 4 เดิมไว้อ่านในแฟ้ม ก่อนรอบ v0.2 เขียนทับคีย์เดิม
        this.data.sim = this.data.sim || {}; this.data.portfolio = this.data.portfolio || {};
        if (!this.data.sim.promoV2) {
          ['w4-baseline', 'w4-plan', 'w4-run'].forEach((k) => {
            const v = this.data.portfolio[k];
            if (v && !this.data.portfolio[`${k}-v01`]) this.data.portfolio[`${k}-v01`] = { ...v, title: `${v.title} (v0.1 สูตรเดิม)` };
          });
          this.data.sim.promoV2 = {};
        }
      } catch (e) { this.data = fresh(); }
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
    reset() { const s = this.data.settings; this.data = fresh(); this.data.settings = s; this.save(); },
    round(w, r) { return this.data.rounds[`${w}-${r}`]; },
    setRound(w, r, rec) {
      const k = `${w}-${r}`, old = this.data.rounds[k];
      if (!old || rec.stars > old.stars || (rec.stars === old.stars && rec.score > old.score)) {
        this.data.rounds[k] = Object.assign({ at: Date.now() }, rec);
      }
      this.save();
    },
    addPortfolio(id, week, title, text) {
      this.data.portfolio[id] = { week, title, text };
      this.save();
    },
    // ชุดข้อมูลโปรสัปดาห์ 4 ตาม GDD §11 แยกตามสินค้า (เซฟ v0.1 ที่ยังไม่มีฟิลด์นี้โหลดได้ตามเดิม)
    promo(pid) {
      const s = this.data.sim || (this.data.sim = {});
      const all = s.promoV2 || (s.promoV2 = {});
      return all[pid] || (all[pid] = { version: 2, baseline: null, plan: null, run: null, history: [] });
    },
    newId(prefix) { return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`; },
    totalStars() { return Object.values(this.data.rounds).reduce((a, r) => a + (r.stars || 0), 0); },
  };
})();
