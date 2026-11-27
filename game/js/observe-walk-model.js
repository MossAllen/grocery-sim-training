/*
 * observe-walk-model.js — กลไกสังเกตลูกค้า W1R2 ตาม docs/GDD.md §9 (Claude)
 * ไม่แตะ DOM: ชุดเหตุการณ์ การรับรู้ในฉาก การจด คำถามวิเคราะห์ คะแนน 12 ข้อ และรูปแบบเซฟ
 * ใช้ได้ทั้งในเบราว์เซอร์ (MTL.ObserveModel) และใน Node (require) สำหรับ tools/check.js
 * หน้าจอแบบรายการ (time-compare.js) และฉากเดิน (observe-walk.js) ใช้ session เดียวกันนี้
 */
(function (root) {
  const PERIODS = [
    { id: 'am', label: 'ช่วงเช้า', start: 7 * 60, answer: 'carry' },
    { id: 'pm', label: 'ช่วงเย็น', start: 17 * 60, answer: 'home' },
  ];
  const GROUPS = [
    { id: 'carry', label: 'ซื้อเร็วหรือพกพา' },
    { id: 'value', label: 'เทียบราคา' },
    { id: 'home', label: 'ซื้อไว้ใช้ที่บ้าน' },
  ];
  // ระยะรับรู้ในฉากเดิน (เมตร) · ได้ยินจากทุกทิศเมื่อใกล้พอ · เห็นการกระทำเมื่อหันหน้าเข้าหา
  const SENSE = { hear: 2.2, see: 4.6, viewCos: Math.cos(36 * Math.PI / 180), approach: 1.85 };
  // ข้อเสนอหลังคะแนนเพื่อเตรียม W1R3 · ใช้กลุ่มของเหตุการณ์ที่ผู้เล่นเลือกอ้าง
  const PROPOSALS = {
    carry: { shelf: 'วาง{สินค้าเล็ก}ใกล้เคาน์เตอร์ช่วงเช้า', service: 'เปิดช่องจ่ายเร็วสำหรับลูกค้าที่ซื้อชิ้นเดียวช่วงเช้า' },
    value: { shelf: 'ติดป้ายราคาต่อหน่วยของสองขนาดไว้คู่กัน', service: 'ให้พนักงานตอบราคาต่อหน่วยเมื่อลูกค้าถาม' },
    home: { shelf: 'วาง{สินค้าชุด}ให้หยิบง่ายช่วงเย็น', service: 'ช่วยรวมหลายชิ้นใส่ถุงเดียวช่วงเย็น' },
  };

  const timeLabel = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const groupLabel = (id) => GROUPS.find((group) => group.id === id).label;
  const periodOf = (id) => PERIODS.find((period) => period.id === id);

  // ข้อความ observedText, supported, alternative และ explanation ตรงตาราง GDD §9 · ฉากเดินเพิ่มจุดยืน สิ่งที่เห็น และคำพูด
  function buildEvents(product) {
    const small = product.small.name, big = product.big.name;
    return [
      { id: 'am-carry', minute: 422, period: 'am', group: 'carry', sprite: 'customer_1', pose: 'customer_1_pick',
        place: 'ชั้น A', spot: { x: -3.95, z: 6.0 }, needsSight: false,
        seen: `ลูกค้าหยิบ${small}ที่ชั้น A แล้วมองกระเป๋า`, heard: `“${small} ใส่กระเป๋าได้ไหม”`,
        observedText: `ลูกค้าถามว่า “${small} ใส่กระเป๋าได้ไหม”`,
        supported: 'ลูกค้าอาจให้ความสำคัญกับการพกพา', alternative: 'ลูกค้าต้องการราคาถูกสุด',
        explanation: 'คำถามเรื่องใส่กระเป๋าสนับสนุนเรื่องการพกพา ลูกค้ายังไม่ได้ถามราคา' },
      { id: 'am-fast', minute: 426, period: 'am', group: 'carry', sprite: 'customer_3', pose: 'customer_3_pay',
        // ออกจากทางเดินซ้ายแล้วเดินผ่านหน้าชั้นวางไปหยุดหน้าเคาน์เตอร์ (ตาราง GDD §9) ผ่านกลางภาพจากจุดเริ่ม
        // ได้ยินและเห็นได้เมื่อถึงแล้ว · enter เป็นรายการจุดแวะ จุดแรกคือจุดเริ่มเดิน
        walk: 'customer_3_walk', enter: [{ x: -5.6, z: 5.0 }],
        place: 'เคาน์เตอร์', spot: { x: 3.0, z: 5.85 }, needsSight: false,
        seen: 'ลูกค้าเดินไปหยุดหน้าเคาน์เตอร์', heard: '“หยิบแล้วจ่ายได้เลยไหม กำลังจะขึ้นรถ”',
        observedText: 'ลูกค้าถามว่า “หยิบแล้วจ่ายได้เลยไหม กำลังจะขึ้นรถ”',
        supported: 'ลูกค้าอาจอยากซื้อให้ทันเวลา', alternative: 'ลูกค้าต้องการซื้อหลายชิ้น',
        explanation: 'ถ้อยคำเรื่องขึ้นรถและจ่ายทันทีสนับสนุนเรื่องเวลา ลูกค้ายังไม่ได้ระบุจำนวน' },
      { id: 'am-price', minute: 429, period: 'am', group: 'value', sprite: 'customer_4', pose: 'customer_4_look',
        place: 'ระหว่างชั้น A และ B', spot: { x: -1.62, z: 6.05 }, needsSight: true,
        seen: 'ลูกค้าหยุดเทียบป้ายราคา 2 ขนาดระหว่างชั้น A และ B', heard: '“สองขนาดนี้ ขนาดไหนถูกกว่าต่อหน่วย”',
        observedText: 'ลูกค้าเทียบป้ายสองขนาดแล้วถามว่าขนาดไหนถูกกว่าต่อหน่วย',
        supported: 'ลูกค้าอาจใช้ราคาต่อหน่วยช่วยตัดสิน', alternative: 'ลูกค้ากำลังรีบเดินทาง',
        explanation: 'คำถามและการเทียบป้ายสนับสนุนเรื่องราคาต่อหน่วย ลูกค้ายังไม่ได้พูดถึงเวลา' },
      { id: 'pm-stock', minute: 1024, period: 'pm', group: 'home', sprite: 'customer_2', pose: 'customer_2_look',
        place: 'ชั้น B', spot: { x: 0.75, z: 6.0 }, needsSight: false,
        seen: `ลูกค้าดู${big}ที่ชั้น B`, heard: `“${big} มีพอใช้ที่บ้านทั้งสัปดาห์ไหม”`,
        observedText: `ลูกค้าถามว่า “${big} มีพอใช้ที่บ้านทั้งสัปดาห์ไหม”`,
        supported: 'ลูกค้าอาจซื้อไว้ใช้ที่บ้าน', alternative: 'ลูกค้าต้องการขนาดที่พกง่าย',
        explanation: 'คำถามระบุปริมาณสำหรับใช้ที่บ้าน ลูกค้ายังไม่ได้ถามเรื่องการพกพา' },
      { id: 'pm-stock-more', minute: 1028, period: 'pm', group: 'home', sprite: 'customer_5', pose: 'customer_5_pay',
        place: 'เคาน์เตอร์', spot: { x: 3.0, z: 5.85 }, needsSight: true,
        seen: `ลูกค้าวาง${big}หลายชิ้นบนเคาน์เตอร์`, heard: `“ขอ${big} 3 ${product.unit} เอาไปเก็บไว้ที่บ้าน”`,
        observedText: 'ลูกค้าขอหลายชิ้นและบอกว่า “เอาไปเก็บไว้ที่บ้าน”',
        supported: 'ลูกค้าอาจซื้อไว้ใช้ที่บ้าน', alternative: 'ลูกค้าต้องการราคาต่อหน่วยต่ำสุด',
        explanation: 'ทั้งการขอหลายชิ้นและคำพูดชี้ไปที่การเก็บไว้ใช้ที่บ้าน ลูกค้ายังไม่ได้เปรียบเทียบราคา' },
    ];
  }

  // ผู้เล่นที่ pose {x, z, yaw} รับรู้ลูกค้าที่ spot ได้แค่ไหน · bearing เป็นองศา บวก = ทางขวา
  function perceive(pose, event) {
    const dx = event.spot.x - pose.x, dz = event.spot.z - pose.z;
    const distance = Math.hypot(dx, dz);
    const sine = Math.sin(pose.yaw), cosine = Math.cos(pose.yaw);
    const ahead = dx * sine + dz * cosine, side = dx * cosine - dz * sine;
    const inView = distance < 1e-6 || ahead / distance >= SENSE.viewCos;
    const heard = distance <= SENSE.hear;
    const seen = inView && distance <= SENSE.see;
    return { distance, inView, heard, seen, ready: heard && (!event.needsSight || inView),
      bearing: Math.atan2(side, ahead) * 180 / Math.PI };
  }
  const direction = (bearing) => Math.abs(bearing) <= 25 ? 'ข้างหน้า' : Math.abs(bearing) >= 135 ? 'ข้างหลัง' : bearing > 0 ? 'ทางขวา' : 'ทางซ้าย';
  // จุดยืนฟังที่อยู่หน้าลูกค้าและหันเข้าหา · ใช้กับปุ่มรายการเหตุการณ์
  const approachPose = (event) => ({ x: event.spot.x, z: event.spot.z - SENSE.approach, yaw: 0 });

  function createSession(product, events = buildEvents(product)) {
    const byId = new Map(events.map((event) => [event.id, event]));
    const recorded = new Set();
    const answers = {};
    const comparison = [];
    let proposal = null;
    const get = (id) => {
      const event = byId.get(id);
      if (!event) throw new Error(`ไม่รู้จักเหตุการณ์ ${id}`);
      return event;
    };
    const periodEvents = (periodId) => events.filter((event) => event.period === periodId);
    const answer = (id) => answers[id] || (answers[id] = {});
    const fill = (text) => text.replace('{สินค้าเล็ก}', product.small.name).replace('{สินค้าชุด}', product.big.name);

    function tally(periodId) {
      const period = periodOf(periodId);
      const sample = periodEvents(periodId);
      const rows = GROUPS.map((group) => {
        const matches = sample.filter((event) => event.group === group.id);
        return { group, count: matches.length, denominator: sample.length, times: matches.map((event) => timeLabel(event.minute)) };
      });
      const evidence = sample.filter((event) => event.group === period.answer);
      return { period, sample, rows, evidence };
    }

    return {
      product, events, periods: PERIODS, groups: GROUPS,
      get, periodEvents, timeLabel, groupLabel,
      isRecorded: (id) => recorded.has(get(id).id),
      // จดได้ครั้งเดียวต่อรหัสเหตุการณ์ · จดซ้ำคืน added: false ให้หน้าจอแสดงสถานะแทน
      record(id) {
        const event = get(id);
        if (recorded.has(id)) return { added: false, event };
        recorded.add(id);
        return { added: true, event };
      },
      recordedCount: (periodId) => periodId ? periodEvents(periodId).filter((event) => recorded.has(event.id)).length : recorded.size,
      notebook: () => events.filter((event) => recorded.has(event.id)).sort((a, b) => a.minute - b.minute),
      periodDone: (periodId) => periodEvents(periodId).every((event) => recorded.has(event.id)),
      allRecorded: () => events.every((event) => recorded.has(event.id)),

      observationQuestion(id) {
        const event = get(id);
        return { title: 'ข้อความใดคือสิ่งที่เห็นหรือได้ยินโดยตรง', answer: 'fact',
          options: [{ id: 'fact', label: event.observedText }, { id: 'inference', label: event.supported }],
          explain: `จดคำพูดหรือการกระทำนี้ได้โดยตรง “${event.observedText}” ส่วนเหตุผลเป็นสิ่งที่เราเสนอจากหลักฐาน` };
      },
      reasonQuestion(id) {
        const event = get(id);
        const supported = `${id}-supported`;
        return { title: 'หลักฐานนี้รองรับการตีความใด', answer: supported, explain: event.explanation,
          options: [{ id: supported, label: event.supported }, { id: `${id}-alternative`, label: event.alternative }] };
      },
      comparisonQuestion(periodId) {
        const { period, sample, rows, evidence } = tally(periodId);
        const total = events.length;
        return { title: 'ความต้องการกลุ่มใดพบมากสุดในตัวอย่างนี้', answer: period.answer, options: GROUPS, period, sample, rows,
          explain: `แถวเวลา ${evidence.map((event) => timeLabel(event.minute)).join(' และ ')} เข้ากลุ่ม${groupLabel(period.answer)} ` +
            `${evidence.length} ÷ ${sample.length} ใน${period.label} ผลนี้มาจากตัวอย่างจำลอง ${total} เหตุการณ์ ` +
            'จึงใช้เป็นสมมติฐานสำหรับเก็บข้อมูลเพิ่ม ยังสรุปแทนลูกค้าทั้งหมดไม่ได้' };
      },
      // นับคะแนนจากคำตอบครั้งแรกเท่านั้น (GDD §9) · คำตอบซ้ำไม่เปลี่ยนผล
      answerObservation(id, choiceId) {
        const choice = answer(get(id).id);
        if (!choice.selectedObservationId) choice.selectedObservationId = choiceId;
        return choiceId === 'fact';
      },
      answerReason(id, choiceId) {
        const choice = answer(get(id).id);
        if (!choice.selectedReasonId) choice.selectedReasonId = choiceId;
        return choiceId === `${id}-supported`;
      },
      answerComparison(periodId, groupId) {
        const { period, sample } = tally(periodId);
        if (!comparison.some((entry) => entry.period === periodId)) {
          comparison.push({ period: periodId, sampleCount: sample.length, selectedGroupId: groupId });
        }
        return groupId === period.answer;
      },
      score() {
        const total = events.length * 2 + PERIODS.length;
        const correct = events.filter((event) => answers[event.id]?.selectedObservationId === 'fact').length +
          events.filter((event) => answers[event.id]?.selectedReasonId === `${event.id}-supported`).length +
          comparison.filter((entry) => entry.selectedGroupId === periodOf(entry.period).answer).length;
        return { correct, total, score: correct / total };
      },
      summary: () => PERIODS.map((period) => {
        const { sample, evidence } = tally(period.id);
        return `${period.label} ${groupLabel(period.answer)} ${evidence.length} ÷ ${sample.length}`;
      }).join(' · '),

      proposalOptions(eventId) {
        const event = get(eventId);
        return Object.entries(PROPOSALS[event.group]).map(([kind, text]) => ({ id: kind, label: fill(text) }));
      },
      propose(eventId, kind) {
        const option = this.proposalOptions(eventId).find((entry) => entry.id === kind);
        if (!option) throw new Error(`ไม่รู้จักข้อเสนอ ${kind}`);
        proposal = { eventId, kind, text: option.label };
        return proposal;
      },

      // รูปแบบเซฟ state.observations.timeCompare[productId] ตาม GDD §9 · route บอกว่ามาจากฉากเดินหรือแบบรายการ
      result(route) {
        const record = {
          source: 'simulated',
          events: events.map(({ id, minute, period, observedText }) => ({ id, minute, period, observedText, ...answers[id] })),
          comparison: comparison.slice(), score: this.score().score,
        };
        if (route) record.route = route;
        if (proposal) record.proposal = { ...proposal };
        return record;
      },
      portfolioText() {
        const rows = events.slice().sort((a, b) => a.minute - b.minute).map((event, index) =>
          `| ${index + 1} | ${timeLabel(event.minute)} | ${event.observedText} | ${event.supported} |`).join('\n');
        const cited = proposal ? get(proposal.eventId) : null;
        return `| ครั้ง | เวลา | สิ่งที่เห็นหรือได้ยิน | เหตุผลที่เป็นไปได้ |\n|---|---|---|---|\n${rows}\n${this.summary()}\n` +
          (cited ? `ข้อเสนอเตรียม W1R3: ${proposal.text} (อ้างเหตุการณ์ ${timeLabel(cited.minute)} \`${cited.id}\`)\n` : '') +
          '(ข้อมูลจำลองจากเกม ใช้ตั้งสมมติฐานเพื่อเก็บข้อมูลเพิ่ม)';
      },
    };
  }

  const api = { PERIODS, GROUPS, SENSE, PROPOSALS, buildEvents, createSession, perceive, direction, approachPose, timeLabel, groupLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MTL = root.MTL || {}; root.MTL.ObserveModel = api; }
})(typeof window !== 'undefined' ? window : null);
