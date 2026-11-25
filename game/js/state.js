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
    totalStars() { return Object.values(this.data.rounds).reduce((a, r) => a + (r.stars || 0), 0); },
  };
})();
