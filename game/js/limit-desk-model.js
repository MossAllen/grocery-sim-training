/*
 * limit-desk-model.js — ข้อมูลและกติกาของโต๊ะคำสั่ง Limit W5R5 (GDD §4, §7, §8)
 * ไม่ผูกกับหน้าจอ ใช้ได้ทั้งในเบราว์เซอร์ (MTL.LimitDeskModel) และ Node (require)
 *   - บริษัทสมมติ 3 แห่งตามกลุ่มสินค้าร้าน ราคาและกติกาเป็น "ค่าฝึกในเกม" ไม่ใช่ค่าปัจจุบันของ SET
 *   - ภารกิจ 3 ฉาก (ง่าย → ยาก) ใช้กระดานและเหตุการณ์คงที่ ผลจึงคำนวณซ้ำได้ทุกครั้ง
 *   - จับคู่แบบราคาก่อน แล้วเวลาส่งก่อน ราคาซื้อขายใช้ราคาของคำสั่งที่รออยู่บนกระดาน
 * เงินเป็นสตางค์จำนวนเต็ม แปลงเป็นบาทตอนแสดงผลเท่านั้น · เงินสมมติ ไม่ส่งเข้าตลาดจริง
 */
(function (root) {
  'use strict';
  const PRACTICE = 'ค่าฝึกในเกม';
  const SAFETY = 'เงินสมมติ ไม่ส่งเข้าตลาดจริง และไม่ใช่คำแนะนำการลงทุน';
  const LOT = 100;                 // หน่วยซื้อขาย (หุ้น) · ค่าฝึก
  const CASH0 = 1000000;           // เงินในพอร์ตสมมติเริ่มต้น 10,000 บาท (สตางค์)
  const PREV_CLOSE = 1000;         // ราคาปิดวันก่อน 10.00 บาท (สตางค์) · ค่าฝึก
  const BAND_PCT = 30;             // กรอบราคา ±30% ของราคาปิดวันก่อน · ค่าฝึก
  // ช่วงราคา (tick) ที่ใช้ในโต๊ะ · ค่าฝึก ราคาช่วงอื่นให้ตรวจจากเว็บ SET
  const TICKS = [
    { from: 500, below: 1000, tick: 5, label: '5.00–9.95 บาท ขยับทีละ 0.05 บาท' },
    { from: 1000, below: 2500, tick: 10, label: '10.00–24.90 บาท ขยับทีละ 0.10 บาท' },
  ];
  const SESSION = { open: '10:00', close: '12:30', label: 'ช่วงซื้อขายจำลอง 10:00–12:30' };
  const LINKS = [
    { id: 'hours', label: 'SET — เวลาทำการซื้อขาย', url: 'https://www.set.or.th/th/market/information/trading-procedure/trading-hours' },
    { id: 'orders', label: 'SET — ประเภทคำสั่งซื้อขาย', url: 'https://www.set.or.th/th/market/information/trading-procedure/order-types' },
    { id: 'bands', label: 'SET — กรอบราคาซื้อขายและช่วงราคา', url: 'https://www.set.or.th/th/market/information/trading-procedure/price-bands-and-tick-sizes' },
  ];

  // ---------- ตัวช่วยแสดงผล ----------
  const group = (n) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const count = (n) => (n < 0 ? '-' : '') + group(n);
  // ราคาหุ้นแสดงทศนิยม 2 ตำแหน่งเสมอ (9.95, 10.00)
  const price = (satang) => `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, '0')}`;
  // จำนวนเงินรวมตัดศูนย์ท้ายแบบเดียวกับส่วนอื่นของเกม (1,990 / 990.5)
  const baht = (satang) => {
    const rest = Math.abs(satang) % 100;
    return (satang < 0 ? '-' : '') + group(Math.floor(Math.abs(satang) / 100)) + (rest ? '.' + String(rest).padStart(2, '0').replace(/0$/, '') : '');
  };
  const THAI = '๐๑๒๓๔๕๖๗๘๙';
  const clean = (value) => String(value ?? '').trim().replace(/[๐-๙]/g, (c) => THAI.indexOf(c)).replace(/[\s,]/g, '');
  // "9.95" → 995 สตางค์ · ทศนิยมเกิน 2 ตำแหน่งหรือไม่ใช่ตัวเลขได้ NaN
  const parsePrice = (value) => {
    const s = clean(value);
    if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(s)) return NaN;
    const [whole, frac = ''] = s.split('.');
    return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  };
  const parseQty = (value) => {
    const s = clean(value);
    return /^\d{1,7}$/.test(s) ? Number(s) : NaN;
  };

  // ---------- กติกาฝึก ----------
  const tickRow = (p) => TICKS.find((row) => p >= row.from && p < row.below) || null;
  const tickFor = (p) => tickRow(p)?.tick ?? null;
  function band(prevClose = PREV_CLOSE) {
    const rawCeil = Math.floor(prevClose * (100 + BAND_PCT) / 100), rawFloor = Math.ceil(prevClose * (100 - BAND_PCT) / 100);
    // ปัดเข้าในกรอบให้ตรงช่วงราคา
    const ceilTick = tickFor(rawCeil) || TICKS[TICKS.length - 1].tick, floorTick = tickFor(rawFloor) || TICKS[0].tick;
    return { ceiling: rawCeil - (rawCeil % ceilTick), floor: rawFloor + ((floorTick - (rawFloor % floorTick)) % floorTick) };
  }
  const BAND = band();
  // ปุ่ม + / − เลื่อนราคาไปช่วงราคาถัดไปที่ถูกต้อง
  const stepUp = (p) => { const t = tickFor(p); return t ? p - (p % t) + t : p; };
  const stepDown = (p) => { const t = tickFor(p - 1); return t ? (p % t ? p - (p % t) : p - t) : p; };

  // ---------- บริษัทสมมติตามกลุ่มสินค้า (ไม่ใช่บริษัทจริง ชื่อย่อมีขีดซึ่งไม่ใช่รูปแบบชื่อหุ้นจริง) ----------
  const COMPANIES = {
    water: { code: 'SIM-WTR', name: 'บริษัท น้ำใสตัวอย่าง', business: 'ผลิตน้ำดื่มบรรจุขวดส่งร้านค้าปลีก' },
    snack: { code: 'SIM-SNK', name: 'บริษัท ขนมกรอบตัวอย่าง', business: 'ผลิตขนมขบเคี้ยวส่งร้านค้าปลีก' },
    household: { code: 'SIM-HOM', name: 'บริษัท ของใช้ตัวอย่าง', business: 'ผลิตกระดาษทิชชูและของใช้ประจำวัน' },
  };
  const companyOf = (productId) => COMPANIES[productId] || COMPANIES.water;

  // ---------- ภารกิจ ----------
  // asks/bids คือคำสั่งของคนอื่นที่ส่งก่อนผู้เล่น · events คือคำสั่งขายที่เข้ามาภายหลังตามเวลา
  const MISSIONS = [
    {
      id: 1, level: 'ง่าย', day: 'วันจำลองที่ 1', title: 'ซื้อให้ได้ทันที', submitAt: '10:05',
      goal: { qty: 100, cap: 1000, needFill: true },
      story: 'อยากซื้อ 100 หุ้น และยอมจ่ายไม่เกิน 10.00 บาทต่อหุ้น',
      hint: 'ดูราคาที่มีคนเสนอขายต่ำสุดบนกระดาน ถ้าราคาที่ยอมจ่ายเท่ากับหรือสูงกว่านั้น คำสั่งจะจับคู่ได้',
      asks: [{ price: 1000, qty: 300 }, { price: 1010, qty: 500 }],
      bids: [{ price: 990, qty: 400 }, { price: 985, qty: 200 }],
      events: [{ at: '10:40', price: 1000, qty: 300 }],
    },
    {
      id: 2, level: 'กลาง', day: 'วันจำลองที่ 2', title: 'รอให้มีคนขายถึงราคา', submitAt: '10:10',
      goal: { qty: 200, cap: 995, needFill: true },
      story: 'อยากซื้อ 200 หุ้น และยอมจ่ายไม่เกิน 9.95 บาทต่อหุ้น ตอนนี้ยังไม่มีใครขายที่ราคานั้น',
      hint: 'Limit ซื้อจะรอบนกระดานจนมีคนเสนอขายที่ราคาเท่ากับหรือต่ำกว่าราคาที่ตั้ง ถ้าตั้งต่ำเกินไปอาจไม่ได้ซื้อเลย',
      asks: [{ price: 1000, qty: 300 }, { price: 1010, qty: 500 }],
      bids: [{ price: 990, qty: 400 }, { price: 985, qty: 200 }],
      events: [{ at: '10:20', price: 995, qty: 100 }, { at: '10:50', price: 995, qty: 200 }],
    },
    {
      id: 3, level: 'ยาก', day: 'วันจำลองที่ 3', title: 'คิวราคาเดียวกันและหมดเวลา', submitAt: '11:00',
      goal: { qty: 300, cap: 990, needFill: false },
      story: 'อยากซื้อ 300 หุ้น และยอมจ่ายไม่เกิน 9.90 บาทต่อหุ้น มีคนตั้งซื้อที่ 9.90 ไว้ก่อนคุณ 400 หุ้น',
      hint: 'คำสั่งราคาเดียวกัน คนที่ส่งก่อนได้จับคู่ก่อน ส่วนที่ยังไม่จับคู่เมื่อหมดเวลาซื้อขายจะสิ้นสุด',
      asks: [{ price: 995, qty: 200 }, { price: 1000, qty: 300 }],
      bids: [{ price: 990, qty: 400 }, { price: 985, qty: 200 }],
      events: [{ at: '11:30', price: 990, qty: 500 }],
    },
  ];
  const missionOf = (id) => MISSIONS.find((mission) => mission.id === id);

  const STATUS = { open: 'รอจับคู่', partial: 'จับคู่บางส่วน', filled: 'จับคู่ครบ', expired: 'สิ้นสุด' };

  // ---------- ตรวจคำสั่งก่อนส่ง (ชี้กติกาที่ต้องอ่าน ไม่เฉลยตัวเลขของภารกิจ) ----------
  function nearTicks(p) {
    const t = tickFor(p);
    if (!t) return '';
    const low = p - (p % t), high = low + t;
    return ` ลองใช้ ${price(low)} หรือ ${price(high)}`;
  }
  function validateOrder(mission, order, cash) {
    const errors = {};
    const p = typeof order.price === 'number' ? order.price : parsePrice(order.price);
    const q = typeof order.qty === 'number' ? order.qty : parseQty(order.qty);
    if (!Number.isSafeInteger(p) || p <= 0) errors.price = 'ใส่ราคาเป็นตัวเลขบาทต่อหุ้น เช่น 9.95';
    else if (p < BAND.floor || p > BAND.ceiling) errors.price = `ราคานี้อยู่นอกกรอบราคาของวัน (${price(BAND.floor)}–${price(BAND.ceiling)} บาท) ดูบัตรกติกา`;
    else if (p % tickFor(p)) errors.price = `ราคาไม่ตรงช่วงราคา (${tickRow(p).label})${nearTicks(p)}`;
    else if (p > mission.goal.cap) errors.price = `ภารกิจนี้ยอมจ่ายไม่เกิน ${price(mission.goal.cap)} บาทต่อหุ้น ราคาใน Limit ซื้อคือราคาสูงสุดที่ยอมจ่าย`;
    if (!Number.isSafeInteger(q) || q <= 0) errors.qty = 'ใส่จำนวนหุ้นเป็นจำนวนเต็ม';
    else if (q % LOT) errors.qty = `จำนวนหุ้นต้องเป็นทวีคูณของ ${LOT} หุ้น (หน่วยซื้อขาย)`;
    else if (q !== mission.goal.qty) errors.qty = `ภารกิจนี้ซื้อ ${count(mission.goal.qty)} หุ้น`;
    // Limit ซื้อต้องกันเงินเท่าราคาที่ตั้ง × จำนวน ตรวจเมื่ออ่านตัวเลขได้ แม้ข้อกำหนดของภารกิจยังไม่ตรง
    if (Number.isSafeInteger(p) && Number.isSafeInteger(q) && p > 0 && q > 0 && p * q > cash) errors.cash = `เงินในพอร์ตสมมติไม่พอ ต้องกันเงิน ${baht(p * q)} บาท มีอยู่ ${baht(cash)} บาท`;
    const ok = !Object.keys(errors).length;
    return { ok, errors, order: ok ? { price: p, qty: q, reserve: p * q } : null };
  }

  // ---------- จับคู่คำสั่ง ----------
  const byBid = (a, b) => b.price - a.price || a.seq - b.seq;
  const byAsk = (a, b) => a.price - b.price || a.seq - b.seq;
  // กระดานรวมจำนวนหุ้นของคนอื่นที่ราคาเดียวกันเป็นหนึ่งระดับ คำสั่งของผู้เล่นแยกแถวเพื่อให้เห็นลำดับคิว
  const levels = (orders) => orders.reduce((out, o) => {
    const last = out[out.length - 1];
    if (last && last.price === o.price && !o.mine && !last.mine) last.qty += o.qty;
    else out.push({ price: o.price, qty: o.qty, mine: !!o.mine, early: !o.mine });
    return out;
  }, []);
  const snapshot = (book) => ({
    bids: levels(book.bids.filter((o) => o.qty > 0).sort(byBid)),
    asks: levels(book.asks.filter((o) => o.qty > 0).sort(byAsk)).map(({ price: p, qty }) => ({ price: p, qty })),
  });

  // ผลคงที่: ส่งคำสั่ง → เหตุการณ์ขายตามเวลา → ปิดช่วงซื้อขาย
  function simulate(mission, order, ids = {}) {
    let seq = 0;
    const orderId = ids.orderId || `SIM-ORD-${mission.id}`;
    const book = {
      bids: mission.bids.map((o) => ({ ...o, seq: seq++ })),
      asks: mission.asks.map((o) => ({ ...o, seq: seq++ })),
    };
    const mine = { price: order.price, qty: order.qty, seq: seq++, mine: true };
    const trades = [];
    let queueHit = false;
    const steps = [];
    const state = () => {
      const filled = order.qty - mine.qty;
      return { filled, remaining: mine.qty, status: mine.qty === 0 ? 'filled' : filled > 0 ? 'partial' : 'open' };
    };
    const trade = (at, qty, p) => {
      const t = { id: `${orderId}-T${trades.length + 1}`, at, qty, price: p, amount: qty * p };
      trades.push(t);
      return t;
    };

    // 1) ส่งคำสั่งซื้อ: จับคู่กับคำสั่งขายที่ราคาไม่เกินราคาที่ตั้ง ตามราคาขายของคนที่รออยู่
    const fillsNow = [];
    for (const ask of book.asks.filter((o) => o.price <= mine.price).sort(byAsk)) {
      if (!mine.qty) break;
      const qty = Math.min(ask.qty, mine.qty);
      ask.qty -= qty; mine.qty -= qty;
      fillsNow.push(trade(mission.submitAt, qty, ask.price));
    }
    if (mine.qty) book.bids.push(mine);
    const bestAsk = book.asks.filter((o) => o.qty > 0).sort(byAsk)[0];
    steps.push({
      at: mission.submitAt, kind: 'submit', fills: fillsNow, ...state(), board: snapshot(book),
      text: fillsNow.length
        ? `ส่ง Limit ซื้อ ${count(order.qty)} หุ้น ที่ ${price(order.price)} · มีคนเสนอขายที่ ${fillsNow.map((f) => price(f.price)).join(', ')} ซึ่งไม่เกินราคาที่ยอมจ่าย จึงจับคู่ทันที ${count(fillsNow.reduce((s, f) => s + f.qty, 0))} หุ้น`
        : `ส่ง Limit ซื้อ ${count(order.qty)} หุ้น ที่ ${price(order.price)} · ราคาเสนอขายต่ำสุดตอนนี้ ${bestAsk ? price(bestAsk.price) : '—'} สูงกว่าราคาที่ยอมจ่าย คำสั่งจึงรอบนกระดาน`,
    });

    // 2) คำสั่งขายที่เข้ามาภายหลัง: จับคู่กับคำสั่งซื้อราคาสูงก่อน ราคาเท่ากันใครส่งก่อนได้ก่อน ที่ราคาของคำสั่งซื้อที่รออยู่
    for (const ev of mission.events) {
      let left = ev.qty;
      const fills = [];
      let toOthers = 0;
      for (const bid of book.bids.filter((o) => o.qty > 0 && o.price >= ev.price).sort(byBid)) {
        if (!left) break;
        const qty = Math.min(bid.qty, left);
        bid.qty -= qty; left -= qty;
        if (bid.mine) fills.push(trade(ev.at, qty, bid.price));
        else {
          toOthers += qty;
          // คนที่ส่งก่อนในราคาเดียวกันได้หุ้นไปก่อน ขณะที่คำสั่งของผู้เล่นยังรออยู่
          if (mine.qty > 0 && bid.price === mine.price && bid.seq < mine.seq && book.bids.includes(mine)) queueHit = true;
        }
      }
      if (left) book.asks.push({ price: ev.price, qty: left, seq: seq++ });
      const mineFill = fills.reduce((s, f) => s + f.qty, 0);
      let text = `มีคนส่งคำสั่งขาย ${count(ev.qty)} หุ้น ที่ ${price(ev.price)}`;
      if (mineFill) text += toOthers ? ` · คำสั่งซื้อที่ส่งก่อนได้ไป ${count(toOthers)} หุ้น แล้วคุณได้ ${count(mineFill)} หุ้น ที่ ${price(mine.price)}` : ` · ไม่เกินราคาที่คุณยอมจ่าย คุณได้ ${count(mineFill)} หุ้น ที่ ${price(mine.price)}`;
      else if (toOthers) text += ` · คำสั่งซื้อที่ส่งก่อนคุณได้ไป ${count(toOthers)} หุ้น${left ? ` ส่วนที่เหลือ ${count(left)} หุ้นรอขายบนกระดาน` : ''}`;
      else if (mine.qty && ev.price > mine.price) text += ` · สูงกว่าราคาที่คุณยอมจ่าย ${price(mine.price)} จึงยังไม่จับคู่`;
      else text += ' · คำสั่งของคุณจับคู่ครบไปแล้ว รายการนี้รอผู้ซื้อคนอื่น';
      steps.push({ at: ev.at, kind: 'sell', event: { ...ev }, fills, ...state(), board: snapshot(book), text });
    }

    // 3) ปิดช่วงซื้อขาย: ส่วนที่ยังไม่จับคู่สิ้นสุด
    const before = state();
    const expired = mine.qty;
    mine.qty = 0;
    const filled = order.qty - expired;
    const finalStatus = expired ? 'expired' : 'filled';
    steps.push({
      at: SESSION.close, kind: 'close', fills: [], filled, remaining: 0, expired, status: finalStatus, board: snapshot(book),
      text: expired
        ? `ปิดช่วงซื้อขายจำลอง · ส่วนที่ยังไม่จับคู่ ${count(expired)} หุ้นสิ้นสุด${filled ? ` (จับคู่แล้ว ${count(filled)} จาก ${count(order.qty)} หุ้น)` : ' ไม่ได้ซื้อเลย'}`
        : `ปิดช่วงซื้อขายจำลอง · คำสั่งจับคู่ครบตั้งแต่ ${trades[trades.length - 1].at} ไม่มีส่วนที่เหลือ`,
      wasStatus: before.status,
    });

    const cost = trades.reduce((s, t) => s + t.amount, 0);
    const cause = !expired ? 'filled' : queueHit ? 'queue' : filled ? 'partial' : 'no-seller';
    return {
      orderId, order: { price: order.price, qty: order.qty }, steps, trades, filled, expired, status: finalStatus, cost,
      avgPrice: filled ? cost / filled : null, cause, queueHit,
      // สถานะทั้งหมดที่ผ่าน (รอ / บางส่วน / ครบ / สิ้นสุด)
      seen: [...new Set(steps.map((step) => step.status))],
    };
  }

  // ---------- เหตุผลของผลลัพธ์ (คำถามอธิบายท้ายภารกิจ) ----------
  const CAUSES = [
    { id: 'filled', text: 'ราคาที่ยอมจ่ายเท่ากับหรือสูงกว่าราคาที่มีคนเสนอขาย คำสั่งจึงจับคู่ครบ' },
    { id: 'no-seller', text: 'ไม่มีคนเสนอขายที่ราคาเท่ากับหรือต่ำกว่าราคาที่ตั้ง คำสั่งจึงรอจนหมดเวลาแล้วสิ้นสุด' },
    { id: 'queue', text: 'มีคำสั่งซื้อราคาเดียวกันที่ส่งก่อนได้จับคู่ก่อน ส่วนที่เหลือของคุณสิ้นสุดเมื่อหมดเวลา' },
    { id: 'partial', text: 'จับคู่ได้บางส่วน แล้วไม่มีคนเสนอขายเพิ่มที่ราคาที่ตั้ง ส่วนที่เหลือจึงสิ้นสุดเมื่อหมดเวลา' },
  ];
  const causeText = (id) => CAUSES.find((c) => c.id === id)?.text || '';
  function checkCause(result, answer) {
    if (!answer) return { ok: false, error: 'เลือกเหตุผลก่อนตรวจ' };
    if (answer === result.cause) return { ok: true, error: '' };
    const why = {
      filled: result.filled ? `คำสั่งยังเหลือ ${count(result.expired)} หุ้นที่ไม่ได้จับคู่ ดูสถานะสุดท้ายอีกครั้ง` : 'คำสั่งนี้ไม่ได้จับคู่เลย ดูราคาเสนอขายเทียบกับราคาที่ตั้ง',
      'no-seller': result.filled ? `คำสั่งนี้จับคู่ได้ ${count(result.filled)} หุ้น จึงไม่ใช่ไม่มีคนขายเลย ดูไทม์ไลน์ว่าใครได้หุ้นไปก่อน` : 'ดูไทม์ไลน์ว่ามีคนเสนอขายที่ราคาเท่ากับหรือต่ำกว่าราคาที่ตั้งหรือไม่',
      queue: result.queueHit ? '' : 'ไม่มีคำสั่งซื้อราคาเดียวกันที่ได้หุ้นไปก่อนคุณในภารกิจนี้',
      partial: result.queueHit ? 'ดูไทม์ไลน์ว่าคำสั่งซื้อที่ส่งก่อนในราคาเดียวกันได้หุ้นไปก่อนหรือไม่' : result.filled ? 'คำสั่งนี้จับคู่ครบ ไม่มีส่วนที่เหลือ' : 'คำสั่งนี้ไม่ได้จับคู่เลยสักหุ้น',
    }[answer] || 'ดูไทม์ไลน์และสถานะสุดท้ายอีกครั้ง';
    return { ok: false, error: why };
  }
  const passed = (mission, result, causeOk) => causeOk && (!mission.goal.needFill || result.status === 'filled');
  function retryHint(mission, result) {
    if (!mission.goal.needFill || result.status === 'filled') return '';
    return `ภารกิจนี้ต้องได้ครบ ${count(mission.goal.qty)} หุ้น · ราคา ${price(result.order.price)} ต่ำกว่าราคาที่มีคนเสนอขายระหว่างวัน ภารกิจยอมจ่ายได้ถึง ${price(mission.goal.cap)} ลองตั้งราคาสูงสุดที่ยอมจ่ายแล้วส่งใหม่`;
  }

  // ---------- คำถามสรุปก่อนบันทึก (ไม่นับดาว แต่ต้องตอบถูกก่อนบันทึก) ----------
  const FINAL = [
    { id: 'level', q: 'คำสั่ง Limit ซื้อที่ 9.95 บาท หมายถึงข้อใด',
      options: [['at-or-below', 'ซื้อได้ที่ 9.95 บาทหรือต่ำกว่าเท่านั้น'], ['exact', 'ซื้อได้ที่ 9.95 บาทพอดีเท่านั้น'], ['at-or-above', 'ซื้อได้ที่ 9.95 บาทหรือสูงกว่า'], ['any', 'ซื้อได้ทุกราคาที่มีคนขาย']],
      answer: 'at-or-below', why: 'ราคาใน Limit ซื้อคือราคาสูงสุดที่ยอมจ่าย ถ้ามีคนขายถูกกว่าก็จับคู่ได้ แต่จะไม่จ่ายเกินราคานี้' },
    { id: 'unmatched', q: 'เงื่อนไขใดทำให้คำสั่ง Limit ซื้อยังไม่ถูกจับคู่',
      options: [['no-seller', 'ยังไม่มีคนเสนอขายที่ราคาเท่ากับหรือต่ำกว่าราคาที่ตั้ง'], ['lot', 'จำนวนหุ้นเป็นทวีคูณของ 100'], ['in-session', 'ส่งคำสั่งในช่วงซื้อขาย'], ['cash-left', 'มีเงินเหลือในพอร์ตหลังกันเงิน']],
      answer: 'no-seller', why: 'Limit กำหนดขอบเขตราคา จึงต้องรอคู่สัญญาที่เสนอขายในราคาที่ตรงเงื่อนไข ส่วนจำนวนตามหน่วยซื้อขาย เวลาซื้อขาย และเงินพอ เป็นเงื่อนไขที่ทำให้ส่งคำสั่งได้' },
  ];
  function checkFinal(answers) {
    const errors = {};
    for (const item of FINAL) {
      if (!answers[item.id]) errors[item.id] = 'เลือกคำตอบข้อนี้ก่อน';
      else if (answers[item.id] !== item.answer) errors[item.id] = item.why;
    }
    return { ok: !Object.keys(errors).length, errors };
  }

  // ---------- จดค่าจริงจากเว็บ SET (ไม่บังคับ) ----------
  const SET_FIELDS = [
    { id: 'hours', label: 'เวลาซื้อขายที่จด' },
    { id: 'lot', label: 'หน่วยซื้อขายที่จด' },
    { id: 'band', label: 'กรอบราคาที่จด' },
  ];
  const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function checkSetNote(note, today = isoDay(new Date())) {
    const out = { date: String(note.date || '').trim() };
    for (const field of SET_FIELDS) out[field.id] = String(note[field.id] || '').trim().slice(0, 80);
    const any = SET_FIELDS.some((field) => out[field.id]);
    if (!out.date && !any) return { ok: true, note: null, error: '' };
    if (!out.date) return { ok: false, note: null, error: 'ระบุวันที่ตรวจข้อมูลจากเว็บ SET ด้วย' };
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(out.date) && new Date(`${out.date}T00:00:00Z`);
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== out.date) return { ok: false, note: null, error: 'วันที่ตรวจไม่ถูกต้อง' };
    if (out.date > today) return { ok: false, note: null, error: 'วันที่ตรวจต้องไม่เกินวันนี้' };
    if (!any) return { ok: false, note: null, error: 'จดค่าที่ตรวจได้อย่างน้อย 1 ช่อง' };
    return { ok: true, note: out, error: '' };
  }

  // ---------- แฟ้มผลงานสัปดาห์ 5 (ใบงานหน้า 12 ธุรกรรมลงทุนจำลอง) ไม่เพิ่มคะแนนใหม่ ----------
  const portfolioKey = (productId) => `w5-limit-desk-${productId}`;
  function wallet(runs) {
    const trades = runs.flatMap((run) => run.result.trades);
    const spent = trades.reduce((s, t) => s + t.amount, 0);
    return { cash0: CASH0, cash: CASH0 - spent, shares: trades.reduce((s, t) => s + t.qty, 0), spent };
  }
  function runLine(run) {
    const m = missionOf(run.missionId), r = run.result;
    const fill = r.filled ? `จับคู่ ${count(r.filled)} หุ้น ราคาเฉลี่ย ${price(Math.round(r.avgPrice))} บาท รวม ${baht(r.cost)} บาท` : 'ไม่ได้จับคู่';
    return `ภารกิจ ${m.id} (${m.level}) ${m.title} · ${m.day} · คำสั่ง ${r.orderId} Limit ซื้อ ${count(r.order.qty)} หุ้น ที่ ${price(r.order.price)} บาท · ` +
      `สถานะที่ผ่าน ${r.seen.map((s) => STATUS[s]).join(' → ')} · ${fill}${r.expired ? ` · สิ้นสุด ${count(r.expired)} หุ้น` : ''} · เหตุผล ${causeText(r.cause)} · ส่งคำสั่ง ${run.attempts} ครั้ง`;
  }
  function portfolioEntry(product, runs, setNote, at) {
    const company = companyOf(product.id), w = wallet(runs);
    const lines = [
      `[${SAFETY}]`,
      `บริษัทสมมติ ${company.name} (${company.code}) · ${company.business} · ใช้เป็นบริบทของกลุ่ม${product.th}`,
      `กติกา${PRACTICE}: หน่วยซื้อขาย ${LOT} หุ้น · ${TICKS.map((t) => t.label).join(' / ')} · กรอบราคา ±${BAND_PCT}% จากราคาปิดวันก่อน ${price(PREV_CLOSE)} = ${price(BAND.floor)}–${price(BAND.ceiling)} บาท · ${SESSION.label}`,
      '', '[คำสั่งจำลองและผล]',
      ...runs.map(runLine),
      ...runs.flatMap((run) => run.result.trades.map((t) => `  - รายการจับคู่ ${t.id} เวลา ${t.at} · ${count(t.qty)} หุ้น × ${price(t.price)} = ${baht(t.amount)} บาท`)),
      `พอร์ตสมมติ: เงินเริ่มต้น ${baht(w.cash0)} บาท · ใช้ซื้อ ${baht(w.spent)} บาท · เงินคงเหลือ ${baht(w.cash)} บาท · ถือ ${company.code} ${count(w.shares)} หุ้น (ยังไม่คิดค่าธรรมเนียมและภาษี)`,
      '', '[อธิบาย]',
      'ระดับราคาที่ยอมรับ: Limit ซื้อที่ราคา P ซื้อได้ที่ P หรือต่ำกว่าเท่านั้น',
      'เงื่อนไขที่ยังไม่จับคู่: ยังไม่มีคนเสนอขายที่ราคาเท่ากับหรือต่ำกว่าราคาที่ตั้ง หรือคำสั่งราคาเดียวกันที่ส่งก่อนได้จับคู่ก่อน เมื่อหมดเวลาซื้อขายส่วนที่เหลือสิ้นสุด',
      '', '[ตรวจกับเว็บ SET]',
      setNote ? `วันที่ตรวจ ${setNote.date} · ${SET_FIELDS.map((f) => `${f.label} ${setNote[f.id] || '—'}`).join(' · ')}` : `ยังไม่ได้จดค่าจริงจากเว็บ SET (ค่าในโต๊ะเป็น${PRACTICE})`,
    ];
    const data = {
      version: 1, productId: product.id, at, practice: true,
      company: { code: company.code, name: company.name },
      rules: { lot: LOT, ticks: TICKS.map((t) => ({ from: t.from, below: t.below, tick: t.tick })), prevClose: PREV_CLOSE, bandPct: BAND_PCT, floor: BAND.floor, ceiling: BAND.ceiling, session: { open: SESSION.open, close: SESSION.close } },
      runs: runs.map((run) => ({
        missionId: run.missionId, attempts: run.attempts, orderId: run.result.orderId, side: 'buy', type: 'limit',
        price: run.result.order.price, qty: run.result.order.qty, status: run.result.status, seen: run.result.seen,
        filled: run.result.filled, expired: run.result.expired, cost: run.result.cost, cause: run.result.cause,
        trades: run.result.trades.map((t) => ({ id: t.id, at: t.at, qty: t.qty, price: t.price, amount: t.amount })),
      })),
      wallet: { cash0: w.cash0, cash: w.cash, shares: w.shares },
      setCheck: setNote,
    };
    return { key: portfolioKey(product.id), title: `โต๊ะคำสั่ง Limit จำลอง · ${product.th}`, text: lines.join('\n'), data };
  }

  const api = {
    PRACTICE, SAFETY, LOT, CASH0, PREV_CLOSE, BAND_PCT, BAND, TICKS, SESSION, LINKS, COMPANIES, MISSIONS, STATUS, CAUSES, FINAL, SET_FIELDS,
    price, baht, count, parsePrice, parseQty, tickFor, band, stepUp, stepDown, companyOf, missionOf,
    validateOrder, simulate, causeText, checkCause, passed, retryHint, checkFinal, checkSetNote, isoDay, wallet, runLine, portfolioKey, portfolioEntry,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MTL = root.MTL || {}; root.MTL.LimitDeskModel = api; }
})(typeof window !== 'undefined' ? window : null);
