/*
 * promo-model.js — โมเดลจำลองโปรสัปดาห์ 4 ตาม docs/GDD.md §5 (Claude)
 * ไม่แตะ DOM · เงินทุกช่องเป็น "สตางค์" จำนวนเต็ม · เล่นซ้ำได้ด้วย seed เดิม
 * ใช้ได้ทั้งในเบราว์เซอร์ (MTL.PromoModel) และใน Node (require) สำหรับ tools/check.js
 */
(function (root) {
  const MOD = 2147483647;

  // ค่าพฤติกรรมลูกค้า (GDD §5 ตาราง "ลูกค้าและเหตุการณ์ในฉากร้าน") — ค่าจำลอง ปรับสมดุลได้
  const GROUPS = [
    { id: 'rush',    th: 'รีบเดินทาง',  see: 'หยิบเร็ว ชอบซื้อชิ้นเดียว',               am: 0.40, pm: 0.20, p: 0.72, q: 0.10, a: 0.20, b: 0.80, r4: 0.03, compH: 0.07 },
    { id: 'home',    th: 'ซื้อเข้าบ้าน', see: 'มองหาขนาดใหญ่ มักซื้อหลายชิ้น',         am: 0.20, pm: 0.40, p: 0.78, q: 0.38, a: 0.18, b: 1.15, r4: 0.20, compH: 0.07 },
    { id: 'student', th: 'นักเรียน',    see: 'ถามราคารวมก่อนหยิบ',                    am: 0.25, pm: 0.20, p: 0.63, q: 0.16, a: 0.30, b: 1.40, r4: 0.06, compH: 0.07 },
    { id: 'compare', th: 'เทียบราคา',   see: 'อ่านป้ายและเปรียบทางเลือกก่อนตัดสินใจ', am: 0.15, pm: 0.20, p: 0.57, q: 0.22, a: 0.40, b: 1.60, r4: 0.12, compH: 0.20 },
  ];

  const EVENTS = {
    rain:     { th: 'ฝนตก',                    icon: '🌧️', note: 'ลูกค้าที่อาจเข้าร้านลดลง' },
    shelfOut: { th: 'สินค้าหน้าชั้นหมดชั่วคราว', icon: '📦', note: 'ช่วงกลางเวลาขายไม่ได้ชั่วคราว' },
    comp:     { th: 'คู่แข่งลดราคา',            icon: '🏷️', note: 'ลูกค้าบางส่วนลังเลไปซื้อร้านอื่น' },
    none:     { th: 'ไม่มีเหตุการณ์',            icon: '☀️', note: 'อากาศและหน้าร้านปกติ' },
  };

  const round = (x) => Math.floor(x + 0.5);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  function rng(seed) {
    let x = seed;
    const next = () => { x = (48271 * x) % MOD; return (x - 1) / (MOD - 1); };
    for (let i = 0; i < 4; i++) next(); // ข้าม 4 ค่าแรก
    return next;
  }

  function eventFromU(u) {
    if (u < 0.20) return 'rain';
    if (u < 0.35) return 'shelfOut';
    if (u < 0.50) return 'comp';
    return 'none';
  }

  /** ค่าตั้งต้นโหมดจำลอง: ราคาชุด 10% และค่าทำโปร 3.75 × ส่วนต่างต่อชิ้น (สตางค์) */
  function defaults(P, C) {
    return { B: round(0.90 * 2 * P), F: round(3.75 * Math.max(0, P - C)) };
  }

  /**
   * สร้างลูกค้าและผลขายของคู่ช่วงปกติ/โปร
   * opt: { seed, P, C, B, T=30, K0=60, K1=60, slot:'am'|'pm', event?: 'rain'|'shelfOut'|'comp'|'none' }
   * ไม่ส่ง B (หรือ B=null) = จำลองเฉพาะช่วงปกติ
   */
  function simulatePair(opt) {
    const T = opt.T ?? 30, K0 = opt.K0 ?? 60, K1 = opt.K1 ?? 60;
    const P = opt.P, C = opt.C, B = opt.B ?? null;
    const slot = opt.slot || 'pm';
    const next = rng(opt.seed);
    const uCount = next();
    const uEvent = next(); // ใช้ค่าที่สองตามลำดับเดิมเสมอ
    const event = opt.event || eventFromU(uEvent);

    const nPot = round((18 + Math.floor(9 * uCount)) * T / 30);
    const n0 = event === 'rain' ? round(nPot * 0.75) : nPot;
    const d = B != null && B > 0 && B <= 2 * P ? (2 * P - B) / (2 * P) : 0;
    const n1 = B != null ? round(n0 * (1 + d)) : n0;

    // สัดส่วนสะสมของกลุ่มตามช่วงเวลา
    let acc = 0;
    const cum = GROUPS.map((g) => (acc += g[slot]));

    const people = [];
    for (let i = 0; i < n1; i++) {
      const uT = next(), uG = next(), uI = next(), uQ = next(), uS = next();
      let gi = cum.findIndex((c) => uG < c);
      if (gi < 0) gi = GROUPS.length - 1;
      people.push({ i, minute: Math.floor(T * uT), g: gi, uI, uQ, uS });
    }
    people.sort((x, y) => x.minute - y.minute || x.i - y.i);

    const outLo = Math.floor(T / 3), outHi = Math.ceil((2 * T) / 3);
    const run = (isPromo) => {
      let stock = isPromo ? K1 : K0;
      const list = isPromo ? people : people.filter((p) => p.i < n0);
      const dd = isPromo ? d : 0;
      const sales = [];
      let N = 0, S = 0, U = 0, lostEvent = 0, lostStock = 0, shortBundle = 0;
      for (const p of list) {
        const g = GROUPS[p.g];
        const h = event === 'comp' ? g.compH : 0;
        let want = { sets: 0, singles: 0 };
        if (dd > 0) {
          if (p.uI < clamp(g.p - h + 0.02 + g.a * dd, 0, 1)) {
            if (p.uQ < clamp(g.q + g.b * dd, 0, 0.85)) want.sets = p.uS < clamp(g.r4 + 0.80 * dd, 0, 0.45) ? 2 : 1;
            else want.singles = 1;
          }
        } else if (p.uI < clamp(g.p - h, 0, 1)) {
          want.singles = p.uQ < g.q ? 2 : 1;
        }
        const wanted = want.sets * 2 + want.singles;
        const rec = { minute: p.minute, group: g.id, i: p.i, sets: 0, singles: 0, wanted, note: '' };
        if (wanted && event === 'shelfOut' && p.minute >= outLo && p.minute < outHi) {
          lostEvent += wanted; rec.note = 'shelfOut';
        } else if (want.sets) {
          const give = Math.min(want.sets, Math.floor(stock / 2));
          if (give > 0) { rec.sets = give; lostStock += (want.sets - give) * 2; }
          else if (stock === 1) { rec.singles = 1; rec.note = 'bundleShort'; shortBundle++; lostStock += 1; }
          else lostStock += wanted;
        } else if (want.singles) {
          rec.singles = Math.min(want.singles, stock);
          lostStock += want.singles - rec.singles;
        }
        const got = rec.sets * 2 + rec.singles;
        stock -= got; N += got; S += rec.sets; U += rec.singles;
        if (!rec.note && wanted && got < wanted) rec.note = 'lowStock';
        sales.push(rec);
      }
      return { customers: list.length, sales, N, S, U, stockLeft: stock, lostEvent, lostStock, shortBundle };
    };

    const normal = run(false);
    const promo = B != null ? run(true) : null;
    return { seed: opt.seed, slot, T, K0, K1, P, C, B, d, event, nPot, n0, n1, normal, promo };
  }

  /** ตัวเลขการเงินของคู่ช่วง (สตางค์) และคำตัดสินตาม §5 รอบ 3 */
  function evaluate({ P, C, B, F, N0, S, U }) {
    const R0 = N0 * P, COGS0 = N0 * C, G0 = R0 - COGS0;
    const N1 = 2 * S + U, R1 = S * B + U * P, COGS1 = N1 * C, G1 = R1 - COGS1 - F;
    const delta = G1 - G0;
    const decision = G1 <= 0 ? 'หยุด' : delta >= 0 ? 'ทำต่อ' : 'ปรับ';
    return { R0, COGS0, G0, N1, R1, COGS1, G1, delta, decision };
  }

  /** เป้าหมายรอบ 2: จำนวนชุดถึงเป้า T0 · คืนตัวเลข หรือ 'impossible' */
  function setsNeeded(T0, M) {
    if (T0 <= 0) return 0;
    if (M <= 0) return 'impossible';
    return Math.ceil(T0 / M);
  }

  function plan({ P, C, B, F, G0, K1 }) {
    const M = B - 2 * C;
    const cover = setsNeeded(F, M);
    const match = setsNeeded(G0 + F, M);
    const stockShort = (k) => typeof k === 'number' && K1 != null && 2 * k > K1;
    return { M, cover, match, coverStockShort: stockShort(cover), matchStockShort: stockShort(match) };
  }

  const baht = (s) => s / 100;
  const satang = (b) => Math.round(Number(b) * 100);

  const api = { GROUPS, EVENTS, rng, defaults, simulatePair, evaluate, plan, setsNeeded, round, baht, satang };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MTL = root.MTL || {}; root.MTL.PromoModel = api; }
})(typeof window !== 'undefined' ? window : null);
