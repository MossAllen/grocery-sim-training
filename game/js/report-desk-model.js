/*
 * report-desk-model.js — ข้อมูลและกติกาของโต๊ะอ่านผลประกอบการ W6R5 (GDD §4, §8, §11)
 * ไม่ผูกกับหน้าจอ ใช้ได้ทั้งในเบราว์เซอร์ (MTL.ReportDeskModel) และ Node (require)
 *   - รายงานบริษัทสมมติ 2 ฉบับ (56-1 One Report / 10-K) เป็นข้อมูลคงที่ ไม่ใช่บริษัทจริง
 *   - resolveStore: ตรวจว่าผลทดลอง W4R3 เป็นของผู้เล่นและอ้างฐาน แผน ผลตรงกันจริงหรือไม่
 *   - sampleStore: ตัวอย่างฝึก seed 4001 ใช้เมื่อไม่มีผลของผู้เล่น (กำกับว่าเป็นตัวอย่าง)
 * เงินในผลร้านเป็นสตางค์จำนวนเต็ม แปลงเป็นบาทตอนแสดงผลเท่านั้น
 */
(function (root) {
  'use strict';
  const REAL = 'จริง — ผู้ฝึกบันทึก'; // ต้องตรงกับ M.RealW4.real (ตรวจใน tools/check.js)
  const SIM = 'จำลอง';
  const PLAN = 'แผน';
  const UNKNOWN = 'ไม่ทราบ';
  const INSUFFICIENT = 'หลักฐานยังไม่พอสำหรับสรุปผลโปร';
  const DECISIONS = ['ทำต่อ', 'ปรับ', 'หยุด'];
  const SAMPLE_SEED = 4001;
  const WALK_LABELS = { 'w4r3-sign': 'ป้ายราคา', 'w4r3-stock': 'สต็อก', 'w4r3-counter': 'เคาน์เตอร์' };

  // ---------- ตัวช่วยแสดงผล ----------
  const pm = () => (typeof module !== 'undefined' && module.exports ? require('./promo-model.js') : root.MTL.PromoModel);
  const group = (n) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const count = (n) => (n < 0 ? '-' : '') + group(n);
  // สตางค์จำนวนเต็ม → บาท (ไม่ปัดเศษ ตัดศูนย์ท้ายแบบเดียวกับส่วนอื่นของเกม)
  const baht = (satang) => {
    const rest = Math.abs(satang) % 100;
    return (satang < 0 ? '-' : '') + group(Math.floor(Math.abs(satang) / 100)) + (rest ? '.' + String(rest).padStart(2, '0').replace(/0$/, '') : '');
  };
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const whole = (value) => Number.isSafeInteger(value);

  // ---------- รายงานบริษัทสมมติ ----------
  const METRICS = [
    { id: 'revenue', label: 'รายได้รวม', money: true },
    { id: 'netProfit', label: 'กำไรสุทธิ', money: true, question: 'ทั้งปีบริษัทได้กำไรไหม' },
    { id: 'opCash', label: 'กระแสเงินสดจากการดำเนินงาน', money: true, question: 'ธุรกิจหลักทำเงินสดเข้าจริงเท่าไร' },
    { id: 'risk', label: 'ความเสี่ยง', money: false },
  ];
  const metricOf = (id) => METRICS.find((metric) => metric.id === id);
  const NO_UNIT = { id: 'none', currency: null, short: null, label: 'ไม่มีหน่วยเงิน (เป็นข้อความ)' };

  const REPORTS = [
    {
      key: 'th', docId: 'SIM-TH-56-1-2025', form: '56-1 One Report', flag: '🇹🇭', company: 'บริษัทไทยตัวอย่าง',
      statement: 'งบการเงินรวม', currency: 'THB', unitId: 'million-thb',
      periods: [
        { id: 'fy2025', end: '2025-12-31', label: 'ปีสิ้นสุด 31 ธ.ค. 2025', length: 'ทั้งปี' },
        { id: 'fy2024', end: '2024-12-31', label: 'ปีสิ้นสุด 31 ธ.ค. 2024', length: 'ทั้งปี' },
        { id: 'q3-2025', end: '2025-09-30', label: 'ไตรมาส 3 สิ้นสุด 30 ก.ย. 2025', length: '3 เดือน', absent: 'รายงานฉบับนี้เป็นรายงานประจำปี ไม่มีคอลัมน์รายไตรมาส' },
      ],
      units: [
        { id: 'million-thb', currency: 'THB', short: 'ล้านบาท', label: 'สกุลเงินบาท · หน่วยล้านบาท' },
        { id: 'thb', currency: 'THB', short: 'บาท', label: 'สกุลเงินบาท · หน่วยบาท' },
        { id: 'thousand-thb', currency: 'THB', short: 'พันบาท', label: 'สกุลเงินบาท · หน่วยพันบาท' },
        NO_UNIT,
      ],
      pages: [
        { id: 'overview', page: 7, section: 'ภาพรวมการประกอบธุรกิจ', kind: 'text', metrics: [],
          body: 'บริษัทไทยตัวอย่างดำเนินร้านค้าปลีกในเครือ 124 สาขา พนักงาน 2,310 คน (ตัวเลขในหน้านี้เป็นจำนวนสาขาและคน ไม่ใช่ตัวเลขการเงิน)' },
        { id: 'financials', page: 24, section: 'งบการเงินรวม · ผลการดำเนินงานและกระแสเงินสด', kind: 'table', metrics: ['revenue', 'netProfit', 'opCash'],
          unitNote: 'หน่วย: ล้านบาท', columns: ['fy2025', 'fy2024'],
          rows: [
            { metric: 'revenue', label: 'รายได้รวม', values: [124, 109] },
            { metric: 'netProfit', label: 'กำไรสุทธิ', values: [14, 12] },
            { metric: 'opCash', label: 'เงินสดสุทธิจากกิจกรรมดำเนินงาน', values: [19, 6] },
          ] },
        { id: 'risk', page: 41, section: 'ปัจจัยความเสี่ยง', kind: 'text', metrics: ['risk'],
          body: 'ราคาวัตถุดิบและค่าขนส่งผันผวนอาจกดอัตรากำไร และการแข่งขันด้านราคาจากร้านใกล้เคียงอาจทำให้ยอดขายต่อสาขาลดลง' },
      ],
    },
    {
      key: 'us', docId: 'SIM-US-10K-FY2025', form: '10-K', flag: '🇺🇸', company: 'บริษัทสหรัฐตัวอย่าง',
      statement: 'Consolidated Financial Statements', currency: 'USD', unitId: 'million-usd',
      periods: [
        { id: 'fy2025', end: '2025-09-27', label: 'ปีบัญชีสิ้นสุด 27 ก.ย. 2025', length: 'ทั้งปี' },
        { id: 'fy2024', end: '2024-09-28', label: 'ปีบัญชีสิ้นสุด 28 ก.ย. 2024', length: 'ทั้งปี' },
        { id: 'q3-2025', end: '2025-06-28', label: 'ไตรมาส 3 สิ้นสุด 28 มิ.ย. 2025', length: '3 เดือน', absent: '10-K เป็นรายงานประจำปี ตัวเลขรายไตรมาสอยู่ในแบบ 10-Q' },
      ],
      units: [
        { id: 'million-usd', currency: 'USD', short: 'ล้านดอลลาร์สหรัฐ', label: 'สกุลเงินดอลลาร์สหรัฐ · หน่วยล้านดอลลาร์' },
        { id: 'thousand-usd', currency: 'USD', short: 'พันดอลลาร์สหรัฐ', label: 'สกุลเงินดอลลาร์สหรัฐ · หน่วยพันดอลลาร์' },
        { id: 'million-thb', currency: 'THB', short: 'ล้านบาท', label: 'สกุลเงินบาท · หน่วยล้านบาท' },
        NO_UNIT,
      ],
      pages: [
        { id: 'overview', page: 3, section: 'Item 1 · Business', kind: 'text', metrics: [],
          body: 'บริษัทสหรัฐตัวอย่างมี 286 สาขาใน 5 รัฐ (ตัวเลขในหน้านี้เป็นจำนวนสาขา ไม่ใช่ตัวเลขการเงิน)' },
        { id: 'financials', page: 61, section: 'Item 8 · Consolidated Statements of Operations and Cash Flows', kind: 'table', metrics: ['revenue', 'netProfit', 'opCash'],
          unitNote: 'หน่วย: ล้านดอลลาร์สหรัฐ (In millions of U.S. dollars)', columns: ['fy2025', 'fy2024'],
          rows: [
            { metric: 'revenue', label: 'Net sales · รายได้', values: [2310, 2140] },
            { metric: 'netProfit', label: 'Net income · กำไรสุทธิ', values: [286, 251] },
            { metric: 'opCash', label: 'Net cash provided by operating activities · เงินสดจากการดำเนินงาน', values: [198, 305] },
          ] },
        { id: 'risk', page: 12, section: 'Item 1A · Risk Factors', kind: 'text', metrics: ['risk'],
          body: 'ความต้องการของลูกค้าอาจเปลี่ยนเร็ว และการพึ่งพาผู้จัดหาสินค้ารายใหญ่อาจทำให้สินค้าขาดช่วง' },
      ],
    },
  ];
  const reportOf = (key) => REPORTS.find((report) => report.key === key);

  const pageTitle = (page) => `หน้า ${page.page} · ${page.section}`;

  // ค่าที่ถูกต้องของแต่ละรายการ ใช้ทั้งตรวจคำตอบและให้ชุดทดสอบเลือกตาม
  function expected(report, metricId) {
    const page = report.pages.find((item) => item.metrics.includes(metricId));
    const row = page.rows && page.rows.find((item) => item.metric === metricId);
    return {
      page, pageId: page.id, periodId: report.periods[0].id,
      unitId: metricId === 'risk' ? NO_UNIT.id : report.unitId,
      value: row ? row.values[0] : null, body: metricId === 'risk' ? page.body : null,
    };
  }

  // ตรวจรายการที่ผู้เล่นเลือก ถ้าผิดให้ชี้ว่าต้องกลับไปตรวจส่วนไหนของเอกสาร (ไม่เฉลยค่าตรง ๆ)
  function checkReading(report, picks) {
    const errors = {};
    const metric = metricOf(picks.metric);
    if (!metric) return { ok: false, errors: { metric: 'เลือกรายการที่จะจดก่อน' }, entry: null };
    const want = expected(report, metric.id);
    const page = report.pages.find((item) => item.id === picks.page);
    const period = report.periods.find((item) => item.id === picks.period);
    const unit = report.units.find((item) => item.id === picks.unit);
    if (!page) errors.page = 'เลือกหน้า/หัวข้อที่อ่านตัวเลข';
    else if (page.id !== want.pageId) {
      errors.page = `${metric.label}ไม่ได้อยู่ใน${pageTitle(page)} · เปิดหน้าที่มีหัวข้อ "${want.page.section}" แล้วอ่านใหม่` +
        (page.kind === 'text' && page.metrics.length === 0 ? ' (ตัวเลขในหน้าภาพรวมเป็นจำนวนสาขาและคน)' : '');
    }
    if (!period) errors.period = 'เลือกงวดของตัวเลข';
    else if (period.id !== want.periodId) {
      errors.period = period.absent
        ? `${period.absent} · ตรวจหัวคอลัมน์ของตารางในหน้า ${want.page.page}`
        : `ตรวจหัวคอลัมน์ของตารางในหน้า ${want.page.page} ว่างวดล่าสุดคือคอลัมน์ใด`;
    }
    if (!unit) errors.unit = 'เลือกสกุลเงินและหน่วย';
    else if (unit.id !== want.unitId) {
      errors.unit = metric.money
        ? (unit.id === NO_UNIT.id ? `${metric.label}เป็นจำนวนเงิน ต้องระบุสกุลเงินและหน่วย` : `ตรวจบรรทัด "หน่วย" ที่หัวตารางในหน้า ${want.page.page} อีกครั้ง ทั้งสกุลเงินและหน่วย`)
        : `${metric.label}เป็นข้อความ ไม่มีหน่วยเงิน`;
    }
    if (Object.keys(errors).length) return { ok: false, errors, entry: null };
    const real = want.page;
    return {
      ok: true, errors,
      entry: {
        reportKey: report.key, docId: report.docId, form: report.form, company: report.company, statement: report.statement,
        metric: metric.id, metricLabel: metric.label, value: want.value, text: want.body,
        pageId: real.id, page: real.page, section: real.section,
        periodId: period.id, periodEnd: period.end, periodLabel: period.label, periodLength: period.length,
        currency: unit.currency, unit: unit.short,
      },
    };
  }

  const valueText = (entry) => (entry.value === null ? entry.text : `${count(entry.value)} ${entry.unit}`);
  const entryText = (entry) => `${entry.metricLabel} ${valueText(entry)} · งวด ${entry.periodLabel} (${entry.periodEnd}, ${entry.periodLength}) · ` +
    `${entry.currency ? `สกุลเงิน ${entry.currency} · หน่วย ${entry.unit}` : 'ไม่มีหน่วยเงิน'} · ${entry.statement} หน้า ${entry.page} ${entry.section} · เอกสาร ${entry.docId}`;

  // กำไรสุทธิเทียบเงินสดจากการดำเนินงานของงวดล่าสุด
  function contrastFor(report) {
    const profit = expected(report, 'netProfit'), cash = expected(report, 'opCash');
    const unit = report.units.find((item) => item.id === report.unitId);
    const gap = cash.value - profit.value;
    const relation = gap > 0 ? 'สูงกว่า' : gap < 0 ? 'ต่ำกว่า' : 'เท่ากับ';
    return {
      reportKey: report.key, docId: report.docId, page: profit.page.page, section: profit.page.section, period: report.periods[0],
      currency: report.currency, unit: unit.short, profit: profit.value, cash: cash.value, gap, relation,
      text: `เงินสดจากการดำเนินงาน ${count(cash.value)} ${relation}กำไรสุทธิ ${count(profit.value)}${gap ? ` อยู่ ${count(Math.abs(gap))}` : ''} ${unit.short}`,
    };
  }

  // ผู้เล่นต้องแยกให้ได้ว่าตัวเลขใดตอบคำถามใด ไม่นับคะแนน แต่ต้องตรงก่อนบันทึก
  function checkContrast(answers) {
    const errors = {};
    if (!answers.profit) errors.profit = 'เลือกคำตอบข้อ 1';
    else if (answers.profit !== 'netProfit') errors.profit = 'ข้อ 1 ถามว่าทั้งปีได้กำไรไหม กำไรสุทธิตอบคำถามนี้ ส่วนเงินสดจากการดำเนินงานบอกเงินสดที่ธุรกิจหลักทำเข้ามา';
    if (!answers.cash) errors.cash = 'เลือกคำตอบข้อ 2';
    else if (answers.cash !== 'opCash') errors.cash = 'ข้อ 2 ถามถึงเงินสดที่เข้าจริงจากธุรกิจหลัก ให้ดูกระแสเงินสดจากการดำเนินงาน ไม่ใช่กำไรสุทธิ';
    return { ok: !Object.keys(errors).length, errors };
  }

  // ---------- ผลทดลองของร้าน (W4R3) ----------
  const REJECTS = {
    'no-baseline': { message: 'ยังไม่มียอดปกติของสินค้านี้ที่ผู้เล่นบันทึกไว้', go: [3, 0], goLabel: 'ไป W4R1 บันทึกยอดปกติ' },
    'no-plan': { message: 'ยอดปกติชุดล่าสุดยังไม่มีแผนโปรที่อ้างฐานเดียวกัน', go: [3, 1], goLabel: 'ไป W4R2 ทำแผนโปร' },
    'no-run': { message: 'ยังไม่มีผลทดลองที่อ้างฐานและแผนชุดเดียวกัน', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
    practice: { message: 'ข้อมูลที่พบมาจากโจทย์ฝึก ไม่ใช่ผลของผู้เล่น', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
    unlinked: { message: 'รหัสฐาน แผน หรือผลไม่ครบหรือไม่ตรงกัน', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
    legacy: { message: 'ผลทดลองชุดนี้ระบุที่มาหรือรูปแบบผลไม่ครบหรือไม่ตรงกัน', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
    'baseline-period': { message: 'ยอดปกติจากร้านต้องระบุวัน เวลา และจำนวนนาทีของช่วงปกติ', go: [3, 0], goLabel: 'ไป W4R1 บันทึกยอดปกติ' },
    period: { message: 'ผลโปรจากร้านต้องระบุวัน เวลา และจำนวนนาทีของช่วงโปร', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
    numbers: { message: 'ตัวเลขในผลทดลองไม่ครบหรือไม่ใช่สตางค์จำนวนเต็ม', go: [3, 2], goLabel: 'กลับไป W4R3 ทดลองโปร' },
  };
  const stop = (reason) => ({ ok: false, reason, ...REJECTS[reason] });
  const idOk = (value) => typeof value === 'string' && value.trim() !== '';
  const isPractice = (id) => /^practice-/.test(String(id || ''));

  function validPeriod(period) {
    if (!period || !whole(period.duration) || period.duration < 1 || period.duration > 120 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(text(period.day)) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(period.start))) return false;
    const start = Date.parse(`${period.day}T${period.start}:00Z`);
    if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== period.day) return false;
    const [day, time] = new Date(start + period.duration * 60000).toISOString().split('T');
    return (period.endDay ?? period.day) === day && period.end === time.slice(0, 5);
  }

  function periodInfo(period, baseline) {
    if (period) {
      const end = period.endDay && period.endDay !== period.day ? `${period.endDay} ${period.end}` : period.end;
      return { text: `${period.day} ${period.start}–${end}`, minutes: period.duration };
    }
    const minutes = whole(baseline.T) && baseline.T > 0 ? baseline.T : 30, start = baseline.slot === 'am' ? 540 : 1020;
    return { text: `ช่วงจำลอง ${clock(start)}–${clock(start + minutes)}`, minutes };
  }

  function originOf(inputs) {
    const origin = text(inputs?.origin), reference = text(inputs?.reference);
    if (!['บันทึกยอดขายร้าน', 'นับที่ร้าน', 'ใบงานที่ได้รับอนุญาต'].includes(origin)) return null;
    return /^[A-Za-z0-9_-]{1,30}$/.test(reference) ? `${origin} (${reference})` : origin;
  }

  function runKind(b, r) {
    if (b.source === REAL && r.source === REAL && r.kind === 'observed') return 'observed';
    if (b.source === REAL && r.source === SIM && r.kind === 'forecast') return 'forecast';
    if (b.source === SIM && r.source === SIM && (r.kind === undefined || r.kind === 'simulated')) return 'simulated';
    return null;
  }

  // เงื่อนไขที่ทำให้ผลจริงสองช่วงเทียบกันไม่ได้ (ตามเกณฑ์ comparable ใน real-w4.js)
  function differences(b, r) {
    const list = [], bi = b.inputs || {}, ri = r.inputs || {};
    if (ri.matches !== true) list.push('ยังไม่ยืนยันว่าสินค้า ราคา ต้นทุน และปัจจัยอื่นเทียบกับช่วงปกติได้');
    if (b.period.duration !== r.period.duration) list.push(`ความยาวช่วงต่างกัน (${b.period.duration} กับ ${r.period.duration} นาที)`);
    if (b.period.start !== r.period.start) list.push(`เวลาเริ่มต่างกัน (${b.period.start} กับ ${r.period.start})`);
    for (const [key, label] of [['weather', 'อากาศ'], ['supply', 'สินค้าหน้าชั้น'], ['competitor', 'โปรของคู่แข่ง']]) {
      const normal = text(bi[key]), promo = text(ri[key]);
      if (!normal || !promo || normal === UNKNOWN || promo === UNKNOWN) list.push(`${label}ยังไม่ทราบ`);
      else if (normal !== promo) list.push(`${label}ต่างกัน`);
    }
    return list;
  }

  function verdictFor(r, kind, reasons) {
    const decision = DECISIONS.includes(r.decision) ? r.decision : null;
    // ผลคาดการณ์เทียบกันไม่ได้โดยเจตนา (comparable=false) แต่มีคำตัดสินตามแบบจำลอง
    if (kind === 'forecast') return decision ? { kind, label: `${decision} ตามแบบจำลอง`, decision, comparable: false } : { kind, label: INSUFFICIENT, decision: null, comparable: false };
    if (kind === 'observed') return r.comparable === true && !reasons.length && decision ? { kind, label: decision, decision, comparable: true } : { kind, label: INSUFFICIENT, decision: null, comparable: false };
    return decision ? { kind, label: decision, decision, comparable: null } : { kind, label: INSUFFICIENT, decision: null, comparable: null };
  }

  function walkEvidenceOf(r) {
    if (!Array.isArray(r.evidence)) return [];
    return r.evidence.filter((item) => item && typeof item === 'object' && idOk(item.id)).slice(0, 6)
      .map((item) => ({ id: item.id, label: WALK_LABELS[item.id] || item.id, text: text(item.text).slice(0, 300) }));
  }

  function columns(b, r, normalPeriod, promoPeriod, source) {
    const N1 = 2 * r.S + r.U;
    return {
      normal: {
        title: 'ช่วงปกติ', period: normalPeriod.text, minutes: normalPeriod.minutes, provenance: source.normal, origin: source.normalOrigin ?? null,
        qty: b.N0, sales: b.R0, cogs: b.COGS0, expense: 0, expenseSource: null, result: b.G0,
      },
      promo: {
        title: source.promoTitle, period: promoPeriod.text, minutes: promoPeriod.minutes, provenance: source.promo, origin: source.promoOrigin ?? null,
        qty: N1, sets: r.S, singles: r.U, bundle: r.B, sales: r.R1, cogs: r.COGS1, expense: r.F, expenseSource: source.expense, result: r.G1,
      },
    };
  }

  // ตรวจว่าผลทดลองเป็นของผู้เล่นและผูกกับฐาน แผน ผลชุดเดียวกัน · ตัวอย่างฝึก ข้อมูลเก่า หรือรหัสไม่ครบจะถูกปฏิเสธ
  function resolveStore(product, evidence, rawStore) {
    const { baseline: b, plan: p, run: r } = evidence || {};
    if (!b) {
      const practice = rawStore && (rawStore.plan?.practiceBase || rawStore.run?.practiceBase || isPractice(rawStore.plan?.baselineId) || isPractice(rawStore.run?.baselineId));
      return stop(practice ? 'practice' : 'no-baseline');
    }
    if (!p) return stop('no-plan');
    if (!r) return stop('no-run');
    if (b.practiceBase || p.practiceBase || r.practiceBase || isPractice(b.id)) return stop('practice');
    if (![b.id, p.id, r.id].every(idOk) || p.baselineId !== b.id || r.baselineId !== b.id || r.planId !== p.id) return stop('unlinked');
    const kind = runKind(b, r);
    if (!kind) return stop('legacy');
    const observed = kind === 'observed', forecast = kind === 'forecast';
    if (b.source === REAL && !validPeriod(b.period)) return stop('baseline-period');
    if (observed && !validPeriod(r.period)) return stop('period');
    const money = [b.P, b.C, b.R0, b.COGS0, b.G0, r.B, r.F, r.R1, r.COGS1, r.G1];
    const counts = [b.N0, r.S, r.U];
    if (!money.every(whole) || !counts.every((n) => whole(n) && n >= 0) || b.P <= 0 || r.B <= 0) return stop('numbers');

    const notes = observed ? differences(b, r) : [];
    const verdict = verdictFor(r, kind, notes);
    const normalPeriod = periodInfo(b.source === REAL ? b.period : null, b);
    const promoPeriod = observed ? periodInfo(r.period, b) : normalPeriod;
    const origin = b.source === REAL ? originOf(b.inputs) : null;
    const promoOrigin = observed ? originOf(r.inputs) : null;
    const card = {
      type: 'player', productId: product.id, productName: product.th, unit: product.unit,
      baselineId: b.id, planId: p.id, runId: r.id, baselineSource: b.source, runSource: r.source,
      route: idOk(r.route) ? r.route : null, runKind: kind, comparable: verdict.comparable,
      verdict, reasons: observed && !verdict.comparable ? (notes.length ? notes : ['เงื่อนไขของสองช่วงยังเทียบกันไม่ได้']) : [],
      currency: 'THB', moneyUnit: 'บาท',
      columns: columns(b, r, normalPeriod, promoPeriod, {
        normal: b.source, promo: forecast ? `${SIM} (ผลโปรจำลอง)` : observed ? 'คำนวณจากข้อมูลจริง' : SIM,
        promoTitle: forecast ? 'ผลโปรจำลอง' : 'ช่วงโปร', expense: observed ? REAL : PLAN, normalOrigin: origin, promoOrigin,
      }),
      origin, promoOrigin,
      walkEvidence: walkEvidenceOf(r),
    };
    card.delta = r.G1 - b.G0;
    return { ok: true, card };
  }

  // ตัวอย่างฝึก seed 4001 · น้ำดื่ม: 25 → 32 ชิ้น ยอดขาย 500 → 604 บาท ผลหลังค่าโปร 200 → 190 บาท คำตัดสิน ปรับ
  function sampleStore(product) {
    const PM = pm(), P = PM.satang(product.promo.price), C = PM.satang(product.promo.cost);
    const { B, F } = PM.defaults(P, C);
    const slot = SAMPLE_SEED % 2 ? 'am' : 'pm', minutes = 30;
    const pair = PM.simulatePair({ seed: SAMPLE_SEED, P, C, B, T: minutes, K0: 60, K1: 60, slot, event: 'none' });
    const v = PM.evaluate({ P, C, B, F, N0: pair.normal.N, S: pair.promo.S, U: pair.promo.U });
    const period = { text: `ช่วงจำลอง ${clock(slot === 'am' ? 540 : 1020)}–${clock((slot === 'am' ? 540 : 1020) + minutes)}`, minutes };
    const b = { N0: pair.normal.N, R0: v.R0, COGS0: v.COGS0, G0: v.G0 };
    const r = { S: pair.promo.S, U: pair.promo.U, B, F, R1: v.R1, COGS1: v.COGS1, G1: v.G1 };
    return {
      type: 'sample', productId: product.id, productName: product.th, unit: product.unit, seed: SAMPLE_SEED,
      baselineId: null, planId: null, runId: null, baselineSource: SIM, runSource: SIM, route: null, runKind: 'sample', comparable: null,
      verdict: { kind: 'sample', label: v.decision, decision: v.decision, comparable: null }, reasons: [],
      currency: 'THB', moneyUnit: 'บาท',
      columns: columns(b, r, period, period, { normal: `ตัวอย่างฝึก · ${SIM}`, promo: `ตัวอย่างฝึก · ${SIM}`, promoTitle: 'ช่วงโปร', expense: PLAN }),
      origin: null, promoOrigin: null, walkEvidence: [], delta: v.G1 - v.G0,
    };
  }

  // ---------- แฟ้มผลงานสัปดาห์ 6 (ใช้ State.addPortfolio ร่วมกับรอบอื่น ไม่เพิ่มคะแนนใหม่) ----------
  const portfolioKey = (productId) => `w6-report-desk-${productId}`;
  const storeLabel = (card) => card.type === 'sample' ? `ตัวอย่างฝึก · ${SIM} seed ${card.seed} (ไม่ใช่ผลของผู้เล่น)` :
    card.runKind === 'forecast' ? `ผลคาดการณ์ ตามแบบจำลอง` : card.runKind === 'observed' ? REAL : `${SIM} (ผลของผู้เล่นจากเกม)`;

  function columnLine(col, card) {
    const parts = [`${col.title} [${col.provenance}] ${col.period} · ${col.minutes} นาที · ${card.moneyUnit}`];
    if (col.origin) parts.push(`แหล่งข้อมูล ${col.origin}`);
    parts.push(`ขาย ${count(col.qty)} ${card.unit}${col.sets === undefined ? '' : ` (${count(col.sets)} ชุด + ${count(col.singles)} เดี่ยว)`}`,
      `ยอดขาย ${baht(col.sales)} · ต้นทุนขาย ${baht(col.cogs)}`);
    if (col.expenseSource) parts.push(`ค่าทำโปร ${baht(col.expense)} [${col.expenseSource}]`);
    parts.push(`ผลหลังค่าใช้จ่าย ${baht(col.result)} บาท`);
    return parts.join(' · ');
  }

  function portfolioEntry(product, card, entries, contrasts, at) {
    const reports = REPORTS.map((report) => ({ report, rows: entries[report.key] || [] }));
    const lines = [
      `[ผลทดลองของร้าน — ${storeLabel(card)}] ${product.th}`,
      columnLine(card.columns.normal, card), columnLine(card.columns.promo, card),
      `คำตัดสิน: ${card.verdict.label}${card.reasons.length ? ` · เงื่อนไขที่ต่างกัน: ${card.reasons.join(', ')}` : ''}`,
      card.type === 'sample' ? 'ตัวอย่างฝึก ไม่มีรหัสฐาน แผน หรือผลของผู้เล่น' :
        `อ้างฐาน ${card.baselineId} · แผน ${card.planId} · ผล ${card.runId}${card.route ? ` · เส้นทาง ${card.route}` : ''}` +
        `${card.walkEvidence.length ? ` · หลักฐานฉากเดิน ${card.walkEvidence.map((item) => item.id).join(', ')}` : ' · ไม่มีบันทึกจากฉากเดิน'}`,
      '', '[รายงานบริษัทตัวอย่าง — ข้อมูลสมมติแบบคงที่ ไม่ใช่บริษัทจริง]',
      ...reports.flatMap(({ report, rows }) => [`${report.flag} ${report.company} · ${report.form} · เอกสาร ${report.docId}`, ...rows.map((entry) => `  - ${entryText(entry)}`)]),
      '', '[เทียบกำไรกับเงินสด]',
      ...contrasts.map((item) => `${item.docId} · ${item.period.label} (${item.period.end}) · ${item.currency} ${item.unit} · ${item.section} หน้า ${item.page}: ${item.text}`),
      '', `[เทียบบัตร] ผลร้าน ${card.columns.promo.minutes} นาที · ${card.moneyUnit} ต่างงวดและหน่วยกับรายงานบริษัท ${contrasts.map((item) => `${item.period.length} · ${item.unit}`).join(' / ')} จึงไม่เทียบตัวเลขตรง ๆ`,
    ];
    const data = {
      version: 1, productId: product.id, at,
      store: {
        source: card.type, baselineSource: card.baselineSource, runSource: card.runSource, baselineId: card.baselineId, planId: card.planId, runId: card.runId,
        runKind: card.runKind, comparable: card.comparable, verdict: card.verdict.label, route: card.route, sampleSeed: card.seed ?? null,
        minutes: { normal: card.columns.normal.minutes, promo: card.columns.promo.minutes }, currency: card.currency, unit: card.moneyUnit,
        periods: { normal: card.columns.normal.period, promo: card.columns.promo.period },
        origins: { normal: card.columns.normal.origin, promo: card.columns.promo.origin },
        walkEvidenceIds: card.walkEvidence.map((item) => item.id),
      },
      reports: reports.map(({ report, rows }) => ({
        reportKey: report.key, docId: report.docId, form: report.form, company: report.company,
        entries: rows.map((entry) => ({
          metric: entry.metric, value: entry.value, page: entry.page, section: entry.section, periodEnd: entry.periodEnd,
          periodLength: entry.periodLength, currency: entry.currency, unit: entry.unit,
        })),
      })),
      contrast: contrasts.map((item) => ({ docId: item.docId, periodEnd: item.period.end, currency: item.currency, unit: item.unit, page: item.page, profit: item.profit, cash: item.cash })),
    };
    return { key: portfolioKey(product.id), title: `โต๊ะอ่านผลประกอบการ · ${product.th}`, text: lines.join('\n'), data };
  }

  const api = {
    REAL, SIM, PLAN, INSUFFICIENT, SAMPLE_SEED, WALK_LABELS, METRICS, REPORTS, REJECTS,
    reportOf, metricOf, pageTitle, expected, checkReading, valueText, entryText, contrastFor, checkContrast,
    resolveStore, sampleStore, storeLabel, portfolioKey, portfolioEntry, baht, count,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MTL = root.MTL || {}; root.MTL.ReportDeskModel = api; }
})(typeof window !== 'undefined' ? window : null);
