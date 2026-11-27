/*
 * curriculum.js — เนื้อหาเกม 8 สัปดาห์ × 5 รอบ
 * ที่มา: "แผนฝึกการตลาด 8 สัปดาห์.docx"
 * แบบแผนเกม (ChatGPT SOL) แก้ได้ที่ docs/GDD.md แล้ว Claude แปลงเป็นโค้ดในไฟล์นี้
 *
 * รูปแบบรอบ: { title, skill, theory, task, engine, ...ค่าของ engine }
 * engine: mcq | calc | sort | dialogue | observe | sim | post | pitch
 * skill:  num ตัวเลข | evid หลักฐาน | reason เหตุผล | eng ภาษาอังกฤษ | work ชิ้นงาน
 */
(function () {
  const M = (window.MTL = window.MTL || {});
  const { R, fmt, baht, words } = M;

  M.SKILLS = { num: 'ตัวเลข', evid: 'หลักฐาน', reason: 'เหตุผล', eng: 'ภาษาอังกฤษ', work: 'ชิ้นงาน' };

  // ---------- สินค้า 3 กลุ่ม ----------
  M.PRODUCTS = {
    water: {
      id: 'water', th: 'น้ำดื่ม', icon: '💧', unit: 'ขวด', perLabel: 'บาท/ลิตร', per: 1,
      emoji: { small: '🥤', big: '🧴' },
      small: { name: 'น้ำดื่ม 600 มล.', size: 0.6, cost: 7, price: 12 },
      big: { name: 'น้ำดื่ม 1.5 ลิตร', size: 1.5, cost: 12, price: 20 },
      items: [
        { name: 'น้ำดื่ม 600 มล.', cost: 7, price: 12 },
        { name: 'น้ำดื่ม 1 ลิตร', cost: 12, price: 20 },
        { name: 'น้ำแร่ 500 มล.', cost: 9, price: 15 },
      ],
      promo: { name: 'น้ำดื่ม 1 ลิตร', cost: 12, price: 20 },
      en: { thing: 'some water', unit: 'bottle', units: 'bottles', small: 'small bottle', big: 'big bottle', cust: 'people who need a drink before getting on the bus' },
    },
    snack: {
      id: 'snack', th: 'ขนม', icon: '🍪', unit: 'ถุง', perLabel: 'บาท/100 กรัม', per: 100,
      emoji: { small: '🍪', big: '🥨' },
      small: { name: 'มันฝรั่งทอด 25 กรัม', size: 25, cost: 6, price: 10 },
      big: { name: 'มันฝรั่งทอด 75 กรัม', size: 75, cost: 16, price: 25 },
      items: [
        { name: 'มันฝรั่งทอด 25 กรัม', cost: 6, price: 10 },
        { name: 'ขนมปังกรอบ 50 กรัม', cost: 12, price: 20 },
        { name: 'ถั่วอบ 40 กรัม', cost: 9, price: 15 },
      ],
      promo: { name: 'ขนมปังกรอบ 50 กรัม', cost: 12, price: 20 },
      en: { thing: 'some snacks', unit: 'bag', units: 'bags', small: 'small bag', big: 'big bag', cust: 'students who want a quick snack after school' },
    },
    household: {
      id: 'household', th: 'ของใช้ประจำวัน', icon: '🧻', unit: 'แพ็ก', perLabel: 'บาท/ม้วน', per: 1,
      emoji: { small: '🧻', big: '📦' },
      small: { name: 'กระดาษทิชชู 1 ม้วน', size: 1, cost: 7, price: 12 },
      big: { name: 'กระดาษทิชชู 6 ม้วน', size: 6, cost: 45, price: 59 },
      items: [
        { name: 'ทิชชูพกพา', cost: 10, price: 15 },
        { name: 'สบู่ก้อน', cost: 14, price: 22 },
        { name: 'ยาสีฟันหลอดเล็ก', cost: 18, price: 29 },
      ],
      promo: { name: 'ทิชชูพกพา', cost: 10, price: 15 },
      en: { thing: 'some tissues', unit: 'pack', units: 'packs', small: 'small pack', big: 'big pack', cust: 'families who need everyday items near home' },
    },
  };

  // พฤติกรรมลูกค้าสำหรับฉากสังเกต (ใช้ได้ทุกสินค้า)
  M.behaviors = (P) => [
    { see: `ลูกค้าถามว่ามี${P.th}ขนาดเล็กกว่านี้ไหม`, good: 'อยากได้ขนาดที่พกง่าย', P: 'Product' },
    { see: `ลูกค้าหยิบ ${P.small.name} แล้ววางคืน หันไปดูป้ายราคา`, good: 'กำลังเทียบราคากับขนาด', P: 'Price' },
    { see: 'ลูกค้าถามว่ามีโปรซื้อ 2 ชิ้นไหม', good: 'สนใจความคุ้มเมื่อซื้อหลายชิ้น', P: 'Promotion' },
    { see: `ลูกค้าเดินหา${P.th}อยู่นานกว่าจะเจอ`, good: 'สินค้าวางในจุดที่มองเห็นยาก', P: 'Place' },
    { see: 'ลูกค้าถามว่าสั่งทางแชตแล้วมารับที่ร้านได้ไหม', good: 'ต้องการช่องทางสั่งที่สะดวก', P: 'Place' },
    { see: 'ลูกค้าบอกว่าร้านข้าง ๆ ขายถูกกว่า 2 บาท', good: 'เปรียบเทียบราคากับคู่แข่ง', P: 'Price' },
    { see: `ลูกค้ารีบหยิบ ${P.small.name} แล้วจ่ายเงินในไม่ถึง 30 วินาที`, good: 'รีบเดินทาง ต้องการซื้อเร็ว', P: 'Product' },
    { see: 'ลูกค้าอ่านป้าย "ซื้อ 2 คุ้มกว่า" แล้วหยิบเพิ่มอีก 1 ชิ้น', good: 'ป้ายโปรมีผลต่อการตัดสินใจ', P: 'Promotion' },
    { see: `ลูกค้าซื้อ ${P.big.name} ครั้งละ 3 ${P.unit} ไปใช้ที่บ้าน`, good: 'ซื้อไปใช้ที่บ้าน สนใจความคุ้ม', P: 'Product' },
    // เพิ่มจาก Gemini Neo (Antigravity CLI) 2026-11-26
    { see: 'ลูกค้าพลิกดูฉลากด้านหลังสินค้าอยู่ครู่หนึ่งแล้ววางกลับเข้าชั้น', good: 'ลูกค้าอาจกำลังตรวจสอบส่วนผสม ปริมาณ หรือข้อมูลการใช้งานของสินค้าก่อนตัดสินใจ', P: 'Product' },
    { see: 'ลูกค้าหยิบสินค้าขนาดเล็กและขนาดใหญ่มาเทียบกันแล้วกดเครื่องคิดเลขในมือถือ', good: 'ลูกค้าอาจกำลังคำนวณราคาต่อหน่วยเพื่อเทียบความคุ้มค่าระหว่างสองขนาด', P: 'Price' },
    { see: 'ลูกค้ามองไปที่แถวรอจ่ายเงินที่ยาวถึงกลางร้าน แล้ววางสินค้าลงก่อนเดินออกจากร้าน', good: 'ขั้นตอนหรือพื้นที่รอชำระเงินอาจทำให้ลูกค้ารู้สึกใช้เวลานานจนเปลี่ยนใจไม่ซื้อ', P: 'Place' },
    { see: 'ลูกค้าถามว่าช่วงนี้มีสิทธิ์สะสมแต้มหรือคูปองส่วนลดสำหรับลูกค้าประจำไหม', good: 'แรงจูงใจอย่างระบบสะสมแต้มหรือคูปองอาจช่วยให้ลูกค้ากลับมาซื้อซ้ำบ่อยขึ้น', P: 'Promotion' },
    { see: 'ลูกค้าถามว่าสินค้าที่มีหลายแบบวางอยู่ตรงหน้าต่างกันอย่างไร', good: 'ลูกค้าอาจยังไม่เห็นความแตกต่างของคุณสมบัติสินค้าแต่ละแบบอย่างชัดเจน', P: 'Product' },
    { see: 'ลูกค้าหยุดอ่านป้ายแนะนำสินค้าใหม่หน้าร้านแล้วชวนคนที่เดินมาด้วยกันเข้ามาดู', good: 'สื่อประชาสัมพันธ์หน้าร้านที่เห็นชัดช่วยดึงความสนใจและชักชวนให้คนเข้าร้านเพิ่มได้', P: 'Promotion' },
  ];
  M.badReasons = ['ลูกค้าเป็นคนขี้เหนียว', 'ลูกค้าไม่ชอบร้านเรา', 'ลูกค้าคงอารมณ์ไม่ดี', 'ลูกค้าจะไม่กลับมาซื้ออีก'];

  const table = (head, rows) =>
    `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

  // ---------- 8 สัปดาห์ ----------
  M.WEEKS = [
    // ===== สัปดาห์ 1 =====
    {
      title: 'รู้จักลูกค้าและวิเคราะห์ 4P',
      goal: 'ใช้สิ่งที่ลูกค้าพูดหรือทำจริงมาอธิบายว่าสินค้า ราคา ช่องทางขาย และการส่งเสริมการขายตอบโจทย์เขาอย่างไร',
      rounds: [
        {
          title: 'รู้จัก 4P กับสินค้าที่เลือก', skill: 'reason', engine: 'mcq',
          theory: '4P คือ Product (สินค้า) Price (ราคา) Place (ช่องทางขาย) และ Promotion (การส่งเสริมการขาย)',
          task: 'จับคู่สิ่งที่เห็นในร้านกับ P ที่ถูกต้อง',
          questions: (ctx) => {
            const P = ctx.product;
            const opts = ['Product (สินค้า)', 'Price (ราคา)', 'Place (ช่องทางขาย)', 'Promotion (ส่งเสริมการขาย)'];
            return [
              { q: `ร้านเลือกวาง ${P.small.name} และ ${P.big.name} ให้ลูกค้าเลือก เป็นเรื่องของ P ใด`, options: opts, answer: 0, explain: 'ขนาดและแบบของสินค้าที่เสนอขายคือ Product' },
              { q: `ป้ายบอกว่า ${P.small.name} ราคา ${P.small.price} บาท เป็นเรื่องของ P ใด`, options: opts, answer: 1, explain: 'ตัวเลขที่ลูกค้าต้องจ่ายคือ Price' },
              { q: 'ร้านขายหน้าร้านและรับสั่งทางแชตให้มารับเอง เป็นเรื่องของ P ใด', options: opts, answer: 2, explain: 'ช่องทางที่ลูกค้าเข้าถึงและรับสินค้าคือ Place' },
              { q: 'ร้านติดป้าย "ซื้อ 2 คุ้มกว่า" ไว้หน้าชั้น เป็นเรื่องของ P ใด', options: opts, answer: 3, explain: 'การสื่อสารเพื่อจูงใจให้ซื้อคือ Promotion' },
            ];
          },
        },
        {
          title: 'สังเกตพฤติกรรมลูกค้า', skill: 'evid', engine: 'observe',
          variant: 'timeCompare',
          theory: 'ข้อสังเกตคือสิ่งที่เห็นหรือได้ยิน เช่น ลูกค้าถามราคาขวดเล็ก ส่วนการตีความคือเหตุผลที่เราเสนอจากสิ่งนั้น',
          task: 'เลือกสังเกตแบบเดิมหรือเทียบเช้ากับเย็น จดเหตุการณ์ 5 ครั้ง แล้วเลือกเหตุผลที่หลักฐานรองรับ',
          need: 5,
        },
        {
          title: 'เชื่อมหลักฐานกับ 4P', skill: 'evid', engine: 'sort',
          theory: 'พฤติกรรมเดียวอาจเกี่ยวกับหลาย P แต่ให้เลือก P ที่เกี่ยวข้องที่สุดเพื่อใช้เป็นหลักฐาน',
          task: 'คลิกข้อสังเกตแล้วคลิกกล่อง P ที่ตรงที่สุด',
          gen: (ctx) => {
            const bs = R.shuffle(M.behaviors(ctx.product));
            const pick = [];
            ['Product', 'Price', 'Place', 'Promotion'].forEach((p) => pick.push(bs.find((b) => b.P === p && !pick.includes(b))));
            bs.forEach((b) => { if (pick.length < 7 && !pick.includes(b)) pick.push(b); });
            return { buckets: ['Product', 'Price', 'Place', 'Promotion'], items: pick.map((b) => ({ text: b.see, bucket: b.P, why: b.good })) };
          },
        },
        {
          title: 'ถามความต้องการเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>What are you looking for today?</i> ใช้เปิดบทสนทนา ส่วน <i>What size would you like?</i> ใช้ถามขนาด',
          task: 'เป็นคนขาย เลือกประโยคที่ถูกต้องและสุภาพ กด 🔊 เพื่อฟังซ้ำแล้วพูดตามออกเสียง',
          script: (ctx) => {
            const P = ctx.product, E = P.en;
            return [
              { them: 'Hi! Good morning.', th: 'สวัสดีตอนเช้า' },
              { choices: [
                { en: 'What are you looking for today?', th: 'วันนี้มองหาอะไรอยู่คะ/ครับ', ok: true },
                { en: 'What you looking today?', ok: false, why: 'ขาดคำว่า are และ for' },
                { en: 'What do you want to buy it?', ok: false, why: 'มีคำว่า it เกินมา' },
              ] },
              { them: `I need ${E.thing}.`, th: `ต้องการ${P.th}` },
              { choices: [
                { en: 'What size would you like?', th: 'ต้องการขนาดไหน', ok: true },
                { en: 'What size you like?', ok: false, why: 'ขาด would หรือ do' },
                { en: 'Which size is like?', ok: false, why: 'โครงประโยคไม่ถูก' },
              ] },
              { them: `A ${E.small}, please.`, th: 'ขอขนาดเล็ก' },
              { choices: [
                { en: `Here you are. It's ${baht(P.small.price)}.`, th: `นี่ค่ะ/ครับ ราคา ${P.small.price} บาท`, ok: true },
                { en: `Here is you are. ${P.small.price} baht.`, ok: false, why: 'ใช้ Here you are. ไม่มี is' },
                { en: `It's ${baht(P.small.price + 10)}.`, ok: false, why: `ราคาผิด ราคาจริงคือ ${P.small.price} บาท` },
              ] },
            ];
          },
        },
        {
          title: 'ทำงบใช้เงินรายเดือน', skill: 'num', engine: 'calc',
          theory: 'เงินเหลือเริ่มจากรายรับหักค่าเรียน ค่าเดินทาง รายจ่ายจำเป็น และค่างวดหนี้ จากนั้นจึงจัดสรรเงินสำรอง',
          task: 'คำนวณเงินเหลือก่อนและหลังกันเงินสำรอง',
          gen: () => {
            let inc, tu, tr, nd, debt, left;
            do {
              inc = R.int(40, 70) * 100; tu = R.int(8, 14) * 100; tr = R.int(5, 10) * 100; nd = R.int(12, 20) * 100; debt = R.pick([0, 300, 500, 800]);
              left = inc - tu - tr - nd - debt;
            } while (left < 400);
            const reserve = Math.max(100, Math.round((left * 0.4) / 100) * 100);
            return {
              intro: `<b>โจทย์จำลอง</b>${table(['รายการ', 'บาท'], [['รายรับ', fmt(inc)], ['ค่าเรียน', fmt(tu)], ['ค่าเดินทาง', fmt(tr)], ['รายจ่ายจำเป็น', fmt(nd)], ['ค่างวดหนี้', fmt(debt)], ['กันเงินสำรอง', fmt(reserve)]])}`,
              fields: [
                { label: 'เงินเหลือก่อนกันสำรอง', answer: left, unit: 'บาท' },
                { label: 'เงินที่ใช้ได้หลังกันสำรอง', answer: left - reserve, unit: 'บาท' },
              ],
              solution: `${fmt(inc)} − ${fmt(tu)} − ${fmt(tr)} − ${fmt(nd)} − ${fmt(debt)} = <b>${fmt(left)}</b> บาท<br>หักสำรอง ${fmt(reserve)} เหลือใช้ <b>${fmt(left - reserve)}</b> บาท`,
              portfolio: { id: 'w1-budget', title: 'งบใช้เงินรายเดือน', text: `รายรับ ${inc} | ค่าเรียน ${tu} | เดินทาง ${tr} | จำเป็น ${nd} | หนี้ ${debt} | เหลือ ${left} | สำรอง ${reserve} | ใช้ได้ ${left - reserve} บาท (ข้อมูลจำลอง)` },
            };
          },
        },
      ],
    },

    // ===== สัปดาห์ 2 =====
    {
      title: 'เลือกกลุ่มลูกค้าและเทียบคู่แข่ง',
      goal: 'เลือกกลุ่มเป้าหมายจากเหตุผลที่ซื้อ และเขียนจุดยืนของสินค้าที่อธิบายได้ด้วยข้อมูลจากร้าน',
      rounds: [
        {
          title: 'แบ่งลูกค้าตามเหตุผลที่ซื้อ', skill: 'evid', engine: 'sort',
          theory: 'การแบ่งกลุ่มลูกค้าช่วยให้เห็นความต้องการต่างกัน เช่น คนรีบเดินทางต้องการขนาดพกง่าย ส่วนคนซื้อไปเก็บที่บ้านสนใจความคุ้ม',
          task: 'จัดพฤติกรรมแต่ละข้อเข้ากลุ่มลูกค้าที่ตรงที่สุด',
          gen: (ctx) => {
            const P = ctx.product;
            return {
              buckets: ['คนรีบเดินทาง', 'คนซื้อไปใช้ที่บ้าน'],
              items: [
                { text: `หยิบ ${P.small.name} แล้วรีบจ่ายก่อนรถเมล์มา`, bucket: 'คนรีบเดินทาง' },
                { text: 'ถามว่าพกใส่กระเป๋าได้ไหม', bucket: 'คนรีบเดินทาง' },
                { text: 'ซื้อช่วง 07:00–07:30 ก่อนเข้างาน', bucket: 'คนรีบเดินทาง' },
                { text: `ซื้อ ${P.big.name} ครั้งละหลาย${P.unit}`, bucket: 'คนซื้อไปใช้ที่บ้าน' },
                { text: 'ถามว่าแพ็กใหญ่คุ้มกว่าไหม', bucket: 'คนซื้อไปใช้ที่บ้าน' },
                { text: 'ถามว่าส่งของถึงบ้านได้ไหม', bucket: 'คนซื้อไปใช้ที่บ้าน' },
              ],
            };
          },
        },
        {
          title: 'เทียบคู่แข่งด้วยหน่วยเดียวกัน', skill: 'num', engine: 'calc',
          theory: 'ราคาต่อหน่วยช่วยเทียบสินค้าต่างขนาด เช่น ราคาต่อลิตร = ราคาขวด ÷ ปริมาตรเป็นลิตร',
          task: 'คำนวณราคาต่อหน่วยของทั้งสองร้าน (ทศนิยม 2 ตำแหน่ง) แล้วตอบว่าร้านไหนคุ้มกว่า',
          gen: (ctx) => {
            const P = ctx.product;
            const a = P.small.price + R.int(-1, 2), b = P.big.price + R.int(-3, 3);
            const ua = (a / P.small.size) * P.per, ub = (b / P.big.size) * P.per;
            const cheaper = Math.abs(ua - ub) < 0.005 ? 'เท่ากัน' : ua < ub ? 'ร้าน A' : 'ร้าน B';
            const f = (p, s) => (P.per === 100 ? `${p} ÷ ${s} × 100` : `${p} ÷ ${s}`);
            return {
              intro: `<b>ผลสำรวจร้านคู่แข่ง</b>${table(['ร้าน', 'สินค้า', 'ราคา'], [['A', P.small.name, a + ' บาท'], ['B', P.big.name, b + ' บาท']])}<p class="muted">หน่วยที่ใช้เทียบ: ${P.perLabel}</p>`,
              fields: [
                { label: `ร้าน A (${P.perLabel})`, answer: ua, tol: 0.011, unit: '' },
                { label: `ร้าน B (${P.perLabel})`, answer: ub, tol: 0.011, unit: '' },
                { label: 'ร้านไหนคุ้มกว่าเมื่อเทียบต่อหน่วย', options: ['ร้าน A', 'ร้าน B', 'เท่ากัน'], answer: cheaper },
              ],
              solution: `A: ${f(a, P.small.size)} = <b>${fmt(ua)}</b> ${P.perLabel}<br>B: ${f(b, P.big.size)} = <b>${fmt(ub)}</b> ${P.perLabel}<br>คำตอบ: <b>${cheaper}</b> — แต่ "คุ้มกว่า" ไม่ได้แปลว่าทุกกลุ่มเลือกแบบนั้น คนรีบเดินทางอาจยอมจ่ายต่อหน่วยแพงกว่าเพื่อขนาดที่พกง่าย`,
            };
          },
        },
        {
          title: 'เขียนจุดยืนของสินค้า', skill: 'reason', engine: 'mcq',
          theory: 'จุดยืนระบุว่าขายให้ใคร ตอบโจทย์อะไร และทำไมลูกค้าควรเลือกสินค้าเรา ตามหลักฐานที่มี',
          task: 'เลือกประโยคจุดยืนที่ครบ "ใคร + ประโยชน์ + เหตุผลจากหลักฐาน"',
          questions: (ctx) => {
            const P = ctx.product;
            return [
              {
                q: 'ประโยคจุดยืนใดดีที่สุด', answer: 0,
                options: [
                  `${P.small.name} สำหรับคนรีบขึ้นรถ เพราะหยิบง่ายและพกสะดวก (ลูกค้า 3 ใน 5 คนที่สังเกตถามหาขนาดเล็ก)`,
                  `${P.th}ของเราดีที่สุดในย่านนี้`,
                  `${P.th}ราคาถูก ทุกคนต้องซื้อ`,
                  `ขาย${P.th}ทุกขนาดให้ทุกคน`,
                ],
                explain: 'ข้อแรกบอกทั้งกลุ่มลูกค้า ประโยชน์ และหลักฐานที่ตรวจได้ ข้ออื่นกว้างเกินไปหรือไม่มีหลักฐาน',
              },
              {
                q: 'ถ้าเลือกกลุ่ม "คนซื้อไปใช้ที่บ้าน" ควรใช้หลักฐานใดสนับสนุน', answer: 1,
                options: ['ลูกค้ารีบจ่ายเงินภายใน 30 วินาที', `ราคาต่อหน่วยของ ${P.big.name} ถูกกว่าและมีลูกค้าถามเรื่องความคุ้ม`, 'ร้านเปิด 7 โมงเช้า', 'เจ้าของร้านชอบแพ็กใหญ่'],
                explain: 'หลักฐานต้องโยงกับเหตุผลที่กลุ่มนั้นซื้อ คือความคุ้ม',
              },
            ];
          },
        },
        {
          title: 'แนะนำสินค้าเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>This size is easy to carry.</i> ใช้บอกประโยชน์ที่ลูกค้ารับรู้ได้ เปลี่ยนประโยชน์ให้ตรงกลุ่มลูกค้า',
          task: 'แนะนำสินค้า 2 ครั้ง: ครั้งแรกคนรีบเดินทาง ครั้งที่สองคนซื้อไปใช้ที่บ้าน',
          script: (ctx) => {
            const E = ctx.product.en;
            return [
              { them: "I'm in a hurry. I need to catch the bus.", th: 'รีบมาก ต้องไปขึ้นรถเมล์' },
              { choices: [
                { en: `This ${E.small} is easy to carry.`, th: 'ขนาดเล็กนี้พกง่าย', ok: true },
                { en: `This ${E.big} is good value for your home.`, ok: false, why: 'ประโยชน์ไม่ตรงกับคนรีบเดินทาง' },
                { en: `This ${E.small} is easy carry.`, ok: false, why: 'ต้องเป็น easy to carry' },
              ] },
              { them: 'I want something for my family at home.', th: 'อยากได้ไว้ใช้ที่บ้านกับครอบครัว' },
              { choices: [
                { en: `This ${E.big} is better value for your family.`, th: 'แพ็กใหญ่คุ้มกว่าสำหรับครอบครัว', ok: true },
                { en: `This ${E.small} is easy to carry.`, ok: false, why: 'กลุ่มนี้สนใจความคุ้ม ไม่ใช่การพกพา' },
                { en: `This ${E.big} is more better value.`, ok: false, why: 'ใช้ better อย่างเดียว ไม่ใช้ more better' },
              ] },
            ];
          },
        },
        {
          title: 'เทียบจ่ายสดกับผ่อน', skill: 'num', engine: 'calc',
          theory: 'ดอกเบี้ยและค่าธรรมเนียมเพิ่มต้นทุนการผ่อน เงินเฟ้อกระทบกำลังซื้อ และสภาพคล่องบอกว่าเงินพร้อมจ่ายระหว่างเดือนได้แค่ไหน',
          task: 'คำนวณยอดจ่ายรวมเมื่อผ่อน ส่วนที่จ่ายเพิ่มจากราคาสด และเงินเหลือต่อเดือน',
          gen: () => {
            const cash = R.int(10, 30) * 100, down = R.pick([0, 200, 300]), n = R.pick([3, 4, 6, 10]);
            const rate = R.pick([0.05, 0.08, 0.1, 0.12]);
            const mon = Math.ceil(((cash - down) * (1 + rate)) / n / 10) * 10, fee = R.pick([0, 50, 100]);
            const total = down + mon * n + fee, extra = total - cash, spare = R.int(8, 15) * 100;
            return {
              intro: `${table(['รายการ', 'ค่า'], [['ราคาเงินสด', fmt(cash) + ' บาท'], ['เงินดาวน์', fmt(down) + ' บาท'], ['ค่างวด', `${fmt(mon)} บาท × ${n} เดือน`], ['ค่าธรรมเนียมแยก', fmt(fee) + ' บาท'], ['เงินที่ใช้ได้ต่อเดือน (จากงบ)', fmt(spare) + ' บาท']])}`,
              fields: [
                { label: 'ยอดจ่ายรวมเมื่อผ่อน', answer: total, unit: 'บาท' },
                { label: 'จ่ายเพิ่มจากราคาสด', answer: extra, unit: 'บาท' },
                { label: 'เงินเหลือต่อเดือนหลังจ่ายค่างวด', answer: spare - mon, unit: 'บาท' },
              ],
              solution: `${fmt(down)} + (${fmt(mon)} × ${n}) + ${fmt(fee)} = <b>${fmt(total)}</b> บาท<br>${fmt(total)} − ${fmt(cash)} = <b>${fmt(extra)}</b> บาท<br>${fmt(spare)} − ${fmt(mon)} = <b>${fmt(spare - mon)}</b> บาท ${spare - mon < 0 ? '(ติดลบ = ไม่ควรผ่อน)' : ''}`,
            };
          },
        },
      ],
    },

    // ===== สัปดาห์ 3 =====
    {
      title: 'คำนวณต้นทุน สต็อก และเงินสด',
      goal: 'อธิบายความต่างระหว่างกำไร สินค้าคงเหลือ และเงินสดด้วยรายการซื้อขายของร้าน',
      rounds: [
        {
          title: 'ทำรายการสินค้าและส่วนต่างต่อชิ้น', skill: 'num', engine: 'calc',
          theory: 'ต้นทุนต่อชิ้นคือเงินที่ร้านใช้เพื่อให้ได้สินค้าหนึ่งชิ้น ราคาขายคือเงินที่เรียกเก็บลูกค้า ส่วนต่าง = ราคาขาย − ต้นทุน',
          task: 'หาส่วนต่างต่อชิ้นของสินค้า 3 รายการ และบอกว่ารายการใดได้ส่วนต่างต่อชิ้นมากที่สุด',
          gen: (ctx) => {
            const it = ctx.product.items.map((x) => ({ ...x, cost: x.cost + R.int(-1, 1), price: x.price + R.int(0, 2) }));
            const best = it.reduce((a, b) => (b.price - b.cost > a.price - a.cost ? b : a));
            const tie = it.filter((x) => x.price - x.cost === best.price - best.cost).length > 1;
            return {
              intro: table(['สินค้า', 'ต้นทุน/ชิ้น', 'ราคาขาย/ชิ้น'], it.map((x) => [x.name, x.cost, x.price])),
              fields: [
                ...it.map((x) => ({ label: `ส่วนต่าง ${x.name}`, answer: x.price - x.cost, unit: 'บาท' })),
                { label: 'ส่วนต่างต่อชิ้นมากที่สุด', options: [...it.map((x) => x.name), 'เท่ากันมากกว่าหนึ่งรายการ'], answer: tie ? 'เท่ากันมากกว่าหนึ่งรายการ' : best.name },
              ],
              solution: it.map((x) => `${x.name}: ${x.price} − ${x.cost} = <b>${x.price - x.cost}</b>`).join('<br>'),
            };
          },
        },
        {
          title: 'หายอดขายและกำไรขั้นต้น', skill: 'num', engine: 'calc',
          theory: 'ยอดขาย = จำนวนขาย × ราคาขาย · ต้นทุนขาย = จำนวนขาย × ต้นทุนต่อชิ้น · กำไรขั้นต้น = ยอดขาย − ต้นทุนขาย',
          task: 'รวมยอดทั้งร้านจากสินค้า 2 รายการ',
          gen: (ctx) => {
            const [a, b] = R.shuffle(ctx.product.items).slice(0, 2).map((x) => ({ ...x, q: R.int(8, 30) }));
            const sales = a.q * a.price + b.q * b.price, cogs = a.q * a.cost + b.q * b.cost;
            return {
              intro: table(['สินค้า', 'จำนวนขาย', 'ต้นทุน/ชิ้น', 'ราคาขาย/ชิ้น'], [a, b].map((x) => [x.name, x.q, x.cost, x.price])),
              fields: [
                { label: 'ยอดขายรวม', answer: sales, unit: 'บาท' },
                { label: 'ต้นทุนขายรวม', answer: cogs, unit: 'บาท' },
                { label: 'กำไรขั้นต้น', answer: sales - cogs, unit: 'บาท' },
              ],
              solution: `ยอดขาย = ${a.q}×${a.price} + ${b.q}×${b.price} = <b>${sales}</b><br>ต้นทุนขาย = ${a.q}×${a.cost} + ${b.q}×${b.cost} = <b>${cogs}</b><br>กำไรขั้นต้น = ${sales} − ${cogs} = <b>${sales - cogs}</b> บาท`,
            };
          },
        },
        {
          title: 'ตรวจสินค้าคงเหลือกับเงินสด', skill: 'num', engine: 'calc',
          theory: 'คงเหลือตามบันทึก = ยกมา + รับเข้า − ขาย − ของเสียหรือนำออก · เงินสดเพิ่มหรือลดตามยอดรับและจ่ายจริง',
          task: 'หาคงเหลือตามบันทึก ส่วนต่างกับยอดนับจริง และเงินสดเพิ่ม/ลด (ติดลบให้ใส่เครื่องหมาย −)',
          gen: (ctx) => {
            const x = ctx.product.promo;
            const b = R.int(10, 30), i = R.pick([12, 24, 36]), s = R.int(10, b + i - 5), d = R.int(0, 3);
            const book = b + i - s - d, counted = book - R.pick([0, 0, 1, 2]);
            const cin = s * x.price, cout = i * x.cost;
            return {
              intro: `<b>${x.name}</b> (ต้นทุน ${x.cost} ขาย ${x.price} บาท/ชิ้น · ซื้อและขายเป็นเงินสด)` +
                table(['ยกมา', 'รับเข้า', 'ขาย', 'เสีย/นำออก', 'นับจริง'], [[b, i, s, d, counted]]),
              fields: [
                { label: 'คงเหลือตามบันทึก', answer: book, unit: x.unit || 'ชิ้น' },
                { label: 'นับจริง − ตามบันทึก', answer: counted - book, unit: 'ชิ้น' },
                { label: 'เงินสดเพิ่ม(+)/ลด(−) สุทธิ', answer: cin - cout, unit: 'บาท' },
              ],
              solution: `${b} + ${i} − ${s} − ${d} = <b>${book}</b> ชิ้น · ส่วนต่าง ${counted} − ${book} = <b>${counted - book}</b> ${counted - book ? '(ต้องหาสาเหตุ เช่น นับผิด ของหาย)' : ''}<br>เงินรับ ${s}×${x.price} = ${cin} · เงินจ่าย ${i}×${x.cost} = ${cout} → สุทธิ <b>${cin - cout}</b> บาท<br><i>สังเกต: กำไรขั้นต้นคือ ${s}×(${x.price}−${x.cost}) = ${s * (x.price - x.cost)} บาท ไม่เท่ากับเงินสด เพราะเงินบางส่วนยังจมอยู่ในสต็อก</i>`,
            };
          },
        },
        {
          title: 'อธิบายต้นทุนและราคาขายเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>It costs twelve baht per unit and sells for twenty baht.</i> แยกต้นทุนกับราคาขายได้ชัดเจน',
          task: 'ฟังตัวเลขที่หุ้นส่วนพูด แล้วตอบด้วยประโยคที่ตัวเลขถูก',
          script: (ctx) => {
            const [a, b] = ctx.product.items;
            const nums = (n) => R.shuffle([n, n + 2, Math.max(1, n - 3)]);
            return [
              { them: `It costs ${baht(a.cost)} per unit and sells for ${baht(a.price)}.`, th: '(ฟังแล้วตอบ)' },
              { listen: 'ต้นทุนต่อชิ้นที่ได้ยินคือเท่าไร', options: nums(a.cost).map((n) => n + ' บาท'), answer: a.cost + ' บาท' },
              { listen: 'ราคาขายที่ได้ยินคือเท่าไร', options: nums(a.price).map((n) => n + ' บาท'), answer: a.price + ' บาท' },
              { them: `What about the ${b.name.split(' ')[0]}? (ต้นทุน ${b.cost} / ขาย ${b.price})`, th: 'แล้วอีกรายการล่ะ', speakText: 'What about the other item?' },
              { choices: [
                { en: `It costs ${baht(b.cost)} per unit and sells for ${baht(b.price)}.`, ok: true },
                { en: `It sells ${baht(b.cost)} per unit and costs for ${baht(b.price)}.`, ok: false, why: 'สลับต้นทุนกับราคาขาย' },
                { en: `It costs ${baht(b.price)} per unit and sells for ${baht(b.cost)}.`, ok: false, why: 'ตัวเลขสลับกัน' },
              ] },
            ];
          },
        },
        {
          title: 'ลงบัญชีและอ่านงบ 3 ประเภท', skill: 'reason', engine: 'mcq',
          theory: 'สินทรัพย์ = หนี้สิน + ส่วนของเจ้าของ · ระบบสต็อกต่อเนื่อง: ขายสดต้องบันทึกทั้งรายได้และต้นทุนขาย',
          task: 'เลือกการบันทึกบัญชีที่ถูกต้อง',
          questions: () => [
            { q: 'ซื้อสินค้าเข้าร้านเป็นเงินสด', options: ['Dr สินค้าคงเหลือ / Cr เงินสด', 'Dr เงินสด / Cr สินค้าคงเหลือ', 'Dr ต้นทุนขาย / Cr เจ้าหนี้', 'Dr รายได้ / Cr เงินสด'], answer: 0, explain: 'ของเพิ่ม (Dr สินค้าคงเหลือ) เงินลด (Cr เงินสด)' },
            { q: 'ซื้อสินค้าเป็นเงินเชื่อ', options: ['Dr สินค้าคงเหลือ / Cr เจ้าหนี้', 'Dr สินค้าคงเหลือ / Cr เงินสด', 'Dr เจ้าหนี้ / Cr สินค้าคงเหลือ', 'ไม่ต้องบันทึกจนกว่าจะจ่ายเงิน'], answer: 0, explain: 'ยังไม่จ่ายเงิน จึงเกิดหนี้สิน (เจ้าหนี้) แทน' },
            { q: 'ขายสินค้าเป็นเงินสด (ระบบสต็อกต่อเนื่อง) ต้องบันทึกอย่างไร', options: ['Dr เงินสด / Cr รายได้ และ Dr ต้นทุนขาย / Cr สินค้าคงเหลือ', 'Dr เงินสด / Cr รายได้ อย่างเดียว', 'Dr รายได้ / Cr เงินสด', 'Dr สินค้าคงเหลือ / Cr ต้นทุนขาย'], answer: 0, explain: 'ต้องบันทึกสองคู่: รับรายได้ และโอนต้นทุนของที่ขายออกจากสต็อก' },
            { q: 'ซื้อ 20 ชิ้น ชิ้นละ 12 บาท ขาย 15 ชิ้น ชิ้นละ 20 บาท จ่ายค่าป้าย 30 บาท กำไรหลังค่าป้ายเท่าไร', options: ['90 บาท', '120 บาท', '30 บาท', '60 บาท'], answer: 0, explain: '300 − 180 = 120 กำไรขั้นต้น หักค่าป้าย 30 = 90 บาท แต่เงินสดเพิ่มแค่ 30 บาท เพราะของ 5 ชิ้น (60 บาท) ยังอยู่ในสต็อก' },
          ],
        },
      ],
    },

    // ===== สัปดาห์ 4 =====
    {
      title: 'ทดลองโปรโมชันและหาจุดคุ้มทุน',
      goal: 'ใช้จำนวนที่ขายกับกำไรหลังค่าทำโปร ตัดสินว่าโปรควรทำต่อ ปรับ หรือหยุด',
      rounds: [
        {
          title: 'วัดยอดขายปกติ (จำลอง 30 นาที)', skill: 'evid', engine: 'sim', mode: 'baseline',
          theory: 'ข้อมูลก่อนทดลองเป็น<b>ฐานเทียบ</b> จดวัน เวลา ระยะเวลา ราคา ทุน และเหตุการณ์คู่กับจำนวนขายเสมอ · กำไรขั้นต้นช่วงปกติ G0 = จำนวนชิ้น × (ราคาต่อชิ้น − ทุนต่อชิ้น)',
          task: 'จำลองหน้าร้าน 30 นาที นับยอดขายปกติ แล้วคำนวณยอดขาย ต้นทุนขาย และกำไรขั้นต้น · ใบงานหน้า 11 คอลัมน์ช่วงปกติ: ที่ร้านจริงให้สังเกต 10–15 นาทีและจดปัจจัยอื่น',
          check: { q: 'นอกจากจำนวนที่ขายได้ ต้องจดอะไรคู่กันจึงจะเทียบกับช่วงโปรได้', options: ['วัน เวลา ระยะเวลา ราคา ทุน และเหตุการณ์', 'จำนวนชิ้นอย่างเดียวก็พอ', 'ชื่อลูกค้าที่ซื้อ', 'ยอดขายของร้านคู่แข่ง'], answer: 0,
            explain: 'จำนวนขายที่ไม่มีเวลาและหน่วยเปรียบเทียบยาก ต้องรู้ว่าช่วงไหน นานเท่าไร ราคาและทุนเท่าไร และมีเหตุการณ์อะไรเกิดขึ้น' },
        },
        {
          title: 'ออกแบบโปรและคำนวณก่อนลอง', skill: 'num', engine: 'sim', mode: 'plan',
          theory: 'ส่วนต่างต่อชุด M = ราคาโปรต่อชุด − 2 × ทุนต่อชิ้น · ถ้า M เป็นบวก จำนวนชุด = ⌈เป้าหมาย ÷ M⌉ · เป้าคุ้มค่าป้าย = F · เป้าเท่าช่วงปกติ = G0 + F · ถ้า M ≤ 0 ยิ่งขายยิ่งเสียส่วนต่าง',
          task: 'ตั้งราคาโปร "ซื้อ 2 ชิ้น" เพียงตัวแปรเดียว แล้วคำนวณจุดคุ้มทุนทั้งสองแบบก่อนทดลอง · ใบงานหน้า 11 เงื่อนไขและจำนวนขั้นต่ำ',
          check: { q: 'ถ้าส่วนต่างต่อชุดติดลบ ขายชุดเพิ่มช่วยให้คุ้มค่าป้ายได้หรือไม่', options: ['ไม่ได้ ยิ่งขายยิ่งเสียส่วนต่าง', 'ได้ ถ้าขายให้มากพอ', 'ได้ ถ้าลดค่าป้าย', 'ไม่เกี่ยวกัน'], answer: 0,
            explain: 'ส่วนต่างชุด = ราคาโปร − 2 × ทุนต่อชิ้น ถ้าติดลบ ทุกชุดที่ขายทำให้ขาดเพิ่ม ต้องขึ้นราคาชุดก่อน' },
        },
        {
          title: 'ทดลองโปรและเทียบผล', skill: 'reason', engine: 'sim', mode: 'run',
          theory: 'ผลหลังค่าทำโปร G1 = ยอดขาย − ต้นทุนขาย − ค่าใช้จ่ายเพิ่มจากโปร · ต้นทุนขายนับทุกชิ้น N1 = 2 × ชุด + ชิ้นเดี่ยว · <b>G1 ≤ 0 หยุด · G1 − G0 ≥ 0 ทำต่อ · นอกนั้นปรับ</b>',
          task: 'จำลองช่วงโปร 30 นาทีด้วยลูกค้าและเหตุการณ์ชุดเดียวกับช่วงปกติ เทียบผลแล้วตัดสินใจ · ใบงานหน้า 11 คอลัมน์ช่วงทดลองและข้อสรุป',
          check: { q: 'ยอดขายช่วงโปรสูงกว่าช่วงปกติ สรุปได้เลยไหมว่าควรทำต่อ', options: ['ยัง ต้องดูผลหลังหักต้นทุนและค่าทำโปร ในเงื่อนไขที่เทียบกันได้', 'ได้ ยอดขายสูงกว่าแปลว่าดีกว่า', 'ได้ ถ้าลูกค้ามากกว่า', 'ไม่ได้ เพราะโปรไม่เคยคุ้ม'], answer: 0,
            explain: 'ยอดขายเพิ่มอาจมาพร้อมส่วนต่างต่อชุดที่ลดลงและค่าป้าย ต้องเทียบผลหลังค่าใช้จ่ายกับช่วงปกติ และจดฝน ของหมด หรือโปรคู่แข่ง' },
        },
        {
          title: 'บอกราคารวมเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>Two bottles are thirty-six baht in total.</i> ใช้ยืนยันจำนวนและยอดที่ต้องจ่าย · ยอดรวม = จำนวนชุด × ราคาชุด + ชิ้นเดี่ยว × ราคาปกติ',
          task: 'ลูกค้าสั่ง 1, 2 และ 4 ชิ้น บอกจำนวนและราคารวมตามโปรที่วางแผนไว้ · ใบงานหน้า 11 ราคาปกติ ราคาโปร และหมายเหตุ',
          check: { q: '“... in total” บอกตัวเลขใด', options: ['ยอดที่ลูกค้าต้องจ่ายรวม', 'ราคาต่อชิ้น', 'ส่วนลดต่อชิ้น', 'ต้นทุนของร้าน'], answer: 0,
            explain: 'in total ชี้ยอดจ่ายรวม คิดตามกติกาโปรแล้วพูดทั้งจำนวนและยอดรวม' },
          script: (ctx) => {
            const P = ctx.product, E = P.en;
            const prices = M.RealW4?.pricing(ctx);
            const p = prices?.P ?? Math.round(P.promo.price * 100);
            const B = prices?.B ?? Math.round((ctx.state.sim.plan?.bundle ?? Math.round(0.9 * 2 * P.promo.price)) * 100);
            const sayPrice = M.RealW4?.sayPrice || ((satang) => baht(satang / 100));
            const showPrice = (satang) => M.fmt(satang / 100);
            const uniq = (choices) => choices.filter((c, i) => c.ok || (c.en !== choices.find((x) => x.ok).en && choices.findIndex((x) => x.en === c.en) === i));
            return [
              { them: `Can I have one ${E.unit}, please?`, th: 'ขอ 1 ชิ้น' },
              { choices: uniq([
                { en: `One ${E.unit} is ${sayPrice(p)}.`, ok: true },
                { en: `One ${E.unit} is ${sayPrice(B)}.`, ok: false, why: `${showPrice(B)} บาทคือราคาโปร 2 ชิ้น` },
                { en: `One ${E.units} are ${sayPrice(p)}.`, ok: false, why: 'หนึ่งชิ้นใช้เอกพจน์ is' },
              ]) },
              { them: `Actually, I'll take two ${E.units}.`, th: 'เอา 2 ชิ้นดีกว่า' },
              { choices: uniq([
                { en: `Two ${E.units} are ${sayPrice(B)} in total.`, ok: true },
                { en: `Two ${E.units} are ${sayPrice(2 * p)} in total.`, ok: false, why: `ลืมราคาโปร 2 ชิ้น ${showPrice(B)} บาท` },
                { en: `Two ${E.unit} is ${sayPrice(B)} in total.`, ok: false, why: 'สองชิ้นใช้พหูพจน์ are' },
              ]) },
              { them: `And my friend wants four ${E.units}.`, th: 'เพื่อนเอา 4 ชิ้น' },
              { choices: uniq([
                { en: `Four ${E.units} are ${sayPrice(2 * B)} in total.`, ok: true },
                { en: `Four ${E.units} are ${sayPrice(4 * p)} in total.`, ok: false, why: `4 ชิ้น = โปร 2 ชุด = 2 × ${showPrice(B)} = ${showPrice(2 * B)} บาท` },
                { en: `Four ${E.units} are ${sayPrice(B + 2 * p)} in total.`, ok: false, why: `คิดโปรแค่ชุดเดียว 4 ชิ้นได้ 2 ชุด = ${showPrice(2 * B)} บาท` },
                { en: `Four ${E.unit} is ${sayPrice(2 * B)} in total.`, ok: false, why: 'สี่ชิ้นใช้พหูพจน์ are' },
              ]) },
            ];
          },
        },
        {
          title: 'จับคู่ธุรกรรมกับหลักฐานภาษี', skill: 'evid', engine: 'mcq',
          theory: 'ใบเสร็จยืนยันการซื้อขาย · ใบกำกับภาษีใช้เมื่อธุรกรรมเกี่ยวกับ VAT · หนังสือรับรองการหักภาษี ณ ที่จ่ายใช้เมื่อมีการหักตามกรณีในโจทย์ · เกณฑ์และอัตราจริงต้องตรวจจากกรมสรรพากรฉบับปัจจุบัน',
          task: 'เลือกหลักฐานที่ควรเก็บ · ใบงานหน้า 11 ค่าใช้จ่ายโปร: ทำรายการเอกสารตัวอย่างของการขาย ซื้อ และจ้างทำป้าย ปิดข้อมูลที่ระบุตัวบุคคล',
          check: { q: 'จ้างทำป้ายและมีการหักภาษีตามกรณี ควรมีหลักฐานใดเพิ่มเติม', options: ['หนังสือรับรองการหักภาษี ณ ที่จ่าย', 'สลิปเงินเดือน', 'แบบ W-8BEN', 'ไม่ต้องมีเพิ่ม'], answer: 0,
            explain: 'ใบเสร็จยืนยันการซื้อขาย ใบกำกับภาษีใช้เมื่อเกี่ยวกับ VAT และหนังสือรับรองใช้เมื่อมีการหักภาษี ณ ที่จ่าย' },
          questions: () => [
            { q: 'ร้านซื้อสินค้าจากร้านส่งที่จดทะเบียน VAT ควรขอเอกสารใด', options: ['ใบกำกับภาษี', 'หนังสือรับรองการหักภาษี ณ ที่จ่าย', 'ไม่ต้องเก็บอะไร', 'สลิปเงินเดือน'], answer: 0, explain: 'ผู้ขายที่จด VAT ออกใบกำกับภาษีได้ เก็บไว้เป็นหลักฐานการซื้อ' },
            { q: 'ร้านขายของให้ลูกค้าทั่วไปหน้าร้าน ควรเก็บหลักฐานใด', options: ['บันทึกยอดขายหรือสำเนาใบเสร็จ', 'หนังสือรับรองการหักภาษี ณ ที่จ่าย', 'แบบ W-8BEN', 'ไม่ต้องจดเพราะเป็นเงินสด'], answer: 0, explain: 'เงินได้จากการขายต้องบันทึกได้ แม้รับเป็นเงินสด' },
            { q: 'จ้างทำป้ายโปรโมชันและมีการหักภาษี ณ ที่จ่ายไว้ เอกสารใดเกี่ยวข้อง', options: ['หนังสือรับรองการหักภาษี ณ ที่จ่าย', 'ใบกำกับภาษีขาย', 'ใบแจ้งยอดบัตรเครดิต', 'ไม่มีเอกสาร'], answer: 0, explain: 'เมื่อมีการหัก ผู้จ่ายออกหนังสือรับรองให้ผู้ถูกหัก ทั้งสองฝ่ายควรเก็บไว้' },
            { q: 'ข้อใดเป็นภาษีที่เกี่ยวกับ "เงินได้" ของเจ้าของร้าน', options: ['ภาษีเงินได้', 'ภาษีมูลค่าเพิ่ม', 'อากรขาเข้า', 'ภาษีป้าย'], answer: 0, explain: 'ภาษีเงินได้คิดจากเงินได้ ส่วน VAT คิดจากการขายหรือบริการ' },
          ],
        },
      ],
    },

    // ===== สัปดาห์ 5 =====
    {
      title: 'ทำโพสต์การตลาดและรู้จักหุ้นไทย',
      goal: 'สร้างโพสต์ที่ลูกค้ารู้ว่าซื้ออย่างไร วัดการตอบสนองเป็นอัตรา และฝึกอ่านกติกาหุ้นไทยจากแหล่งทางการ',
      rounds: [
        {
          title: 'วาดเส้นทางลูกค้า', skill: 'reason', engine: 'sort',
          theory: 'เส้นทางลูกค้าช่วยระบุว่าลูกค้าเห็นสินค้า ทักถาม และซื้อผ่านจุดใด',
          task: 'จัดคำถามที่ลูกค้าอาจติด ลงในขั้นที่คำถามนั้นเกิดขึ้น',
          gen: () => ({
            buckets: ['① เห็นโพสต์', '② ทักถาม', '③ ซื้อ/รับของ'],
            items: [
              { text: 'สินค้านี้คืออะไร ขนาดเท่าไร', bucket: '① เห็นโพสต์' },
              { text: 'ราคาเท่าไร', bucket: '① เห็นโพสต์' },
              { text: 'ตอนนี้ยังมีของไหม', bucket: '② ทักถาม' },
              { text: 'สั่งได้ถึงกี่โมง', bucket: '② ทักถาม' },
              { text: 'รับของตรงไหน', bucket: '③ ซื้อ/รับของ' },
              { text: 'จ่ายเงินช่องทางไหนได้บ้าง', bucket: '③ ซื้อ/รับของ' },
            ],
          }),
        },
        {
          title: 'ทำโพสต์ขายสินค้า 1 ชิ้น', skill: 'work', engine: 'post',
          theory: 'โพสต์ควรบอกสินค้า ขนาด ราคา ประโยชน์ และวิธีสั่ง พร้อมภาพที่ใช้ได้',
          task: 'เลือกส่วนประกอบของโพสต์ ดูตัวอย่าง แล้วทดสอบกับผู้ชมจำลอง',
        },
        {
          title: 'วัดผลเป็นอัตรา', skill: 'num', engine: 'calc',
          theory: 'อัตราทัก = จำนวนคนที่ทัก ÷ จำนวนคนที่เห็น × 100 · ให้นับหน่วยและช่วงเวลาให้สอดคล้องกัน',
          task: 'คำนวณอัตราทักและอัตราสั่งในกลุ่มผู้ทัก (ทศนิยม 1 ตำแหน่ง)',
          gen: (ctx) => {
            let p = ctx.state.sim.post;
            const fromSim = !!p;
            if (!p) { const v = R.int(150, 400); const m = R.int(5, 25); p = { views: v, messages: m, orders: R.int(1, m) }; }
            const r1 = (p.messages / p.views) * 100, r2 = (p.orders / p.messages) * 100;
            return {
              intro: `${fromSim ? '<b>ข้อมูลจากโพสต์ที่คุณทดสอบในรอบก่อน (ข้อมูลจำลอง)</b>' : '<b>ข้อมูลจำลอง</b>'}${table(['คนเห็น', 'คนทัก', 'ผู้ทักที่สั่ง'], [[p.views, p.messages, p.orders]])}`,
              fields: [
                { label: 'อัตราทัก (ตัวหาร = คนเห็น)', answer: r1, tol: 0.06, unit: '%' },
                { label: 'อัตราสั่งในกลุ่มผู้ทัก (ตัวหาร = คนทัก)', answer: r2, tol: 0.06, unit: '%' },
                { label: 'อัตราสั่งเทียบคนเห็นทั้งหมด', answer: (p.orders / p.views) * 100, tol: 0.06, unit: '%' },
              ],
              solution: `${p.messages} ÷ ${p.views} × 100 = <b>${fmt(r1, 1)}%</b><br>${p.orders} ÷ ${p.messages} × 100 = <b>${fmt(r2, 1)}%</b><br>${p.orders} ÷ ${p.views} × 100 = <b>${fmt((p.orders / p.views) * 100, 1)}%</b><br>ตัวหารต่างกัน ตัวเลขจึงต่างกัน ต้องเขียนกำกับทุกครั้ง`,
            };
          },
        },
        {
          title: 'ตอบแชตลูกค้าเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>Message us to check availability.</i> ชวนให้ลูกค้าทักมาถามว่ามีสินค้าหรือไม่',
          task: 'ตอบข้อความลูกค้าเรื่องสินค้า จำนวน และวิธีรับของ',
          script: (ctx) => {
            const P = ctx.product, E = P.en;
            return [
              { them: `Hi, do you still have the ${E.small}?`, th: 'ยังมีขนาดเล็กไหม' },
              { choices: [
                { en: `Yes, we do. It's ${baht(P.small.price)}.`, ok: true },
                { en: 'Yes, we have it is.', ok: false, why: 'โครงประโยคผิด' },
                { en: 'Message us to check availability.', ok: false, why: 'ลูกค้าทักมาแล้ว ควรตอบให้ตรงคำถาม' },
              ] },
              { them: 'Great. Can I order five?', th: 'สั่ง 5 ได้ไหม' },
              { choices: [
                { en: `Sure. Five ${E.units} are ${baht(5 * P.small.price)} in total.`, ok: true },
                { en: `Sure. Five ${E.units} are ${baht(5 * P.small.price + 5)} in total.`, ok: false, why: 'ยอดรวมผิด' },
                { en: `Sure. Five ${E.unit} is ${baht(5 * P.small.price)}.`, ok: false, why: 'ห้าชิ้นต้องใช้พหูพจน์' },
              ] },
              { them: 'Where can I pick them up?', th: 'รับของที่ไหน' },
              { choices: [
                { en: 'You can pick them up at the counter.', ok: true },
                { en: 'You can pick up them at counter.', ok: false, why: 'ใช้ pick them up และ at the counter' },
                { en: 'We help customers save time.', ok: false, why: 'ไม่ตอบคำถาม' },
              ] },
            ];
          },
        },
        {
          title: 'กติกาซื้อขายหุ้นไทย', skill: 'reason', engine: 'mcq',
          theory: 'SET จัดตลาดซื้อขาย ก.ล.ต. กำกับดูแล โบรกเกอร์รับและส่งคำสั่ง · Limit ระบุขอบเขตราคา ส่วน Market มุ่งจับคู่ตามราคาที่มีตามเงื่อนไขตลาด',
          task: 'ตอบคำถาม แล้วเปิดหน้า SET เรื่องเวลาซื้อขาย หน่วยซื้อขาย และประเภทคำสั่ง เพื่อตรวจซ้ำด้วยตัวเอง',
          questions: () => [
            { q: 'หน่วยงานใดกำกับดูแลตลาดทุนไทย', options: ['ก.ล.ต.', 'โบรกเกอร์', 'บริษัทจดทะเบียน', 'กรมสรรพากร'], answer: 0, explain: 'ก.ล.ต. กำกับดูแล ส่วน SET จัดตลาด' },
            { q: 'ใครรับคำสั่งซื้อขายจากนักลงทุนแล้วส่งเข้าตลาด', options: ['โบรกเกอร์', 'ก.ล.ต.', 'ธนาคารแห่งประเทศไทย', 'บริษัทจดทะเบียน'], answer: 0, explain: 'นักลงทุนส่งคำสั่งผ่านบริษัทหลักทรัพย์ (โบรกเกอร์)' },
            { q: 'อยากซื้อหุ้นโดยจ่ายไม่เกินราคาที่กำหนด ควรใช้คำสั่งแบบใด', options: ['Limit', 'Market', 'ซื้อแบบไหนก็ได้ผลเท่ากัน', 'ไม่มีคำสั่งแบบนี้'], answer: 0, explain: 'Limit ระบุขอบเขตราคาที่ยอมรับ' },
            { q: 'เกณฑ์รับหลักทรัพย์เข้าจดทะเบียนใน SET หรือ mai ใช้กับใคร', options: ['บริษัทที่ต้องการเข้าจดทะเบียน', 'นักลงทุนรายย่อยทุกคน', 'โบรกเกอร์', 'ลูกค้าร้านชำ'], answer: 0, explain: 'เป็นเกณฑ์ของบริษัท ไม่ใช่กติกาของผู้ซื้อ' },
          ],
        },
      ],
    },

    // ===== สัปดาห์ 6 =====
    {
      title: 'วางรูปแบบธุรกิจและอ่านงบหุ้นไทยกับหุ้นสหรัฐ',
      goal: 'อธิบายว่าร้านสร้างคุณค่าและหารายได้อย่างไร แล้วใช้คำถามแบบเดียวกันอ่านรายงานบริษัทจริง',
      rounds: [
        {
          title: 'Business Model Canvas ด้านลูกค้า', skill: 'work', engine: 'sort',
          theory: 'เริ่มจาก 4 ช่อง: กลุ่มลูกค้า คุณค่าที่เสนอ ช่องทาง และความสัมพันธ์กับลูกค้า',
          task: 'จัดข้อมูลร้านลงช่องที่ถูกต้อง',
          gen: (ctx) => {
            const P = ctx.product;
            return {
              buckets: ['กลุ่มลูกค้า', 'คุณค่าที่เสนอ', 'ช่องทาง', 'ความสัมพันธ์กับลูกค้า'],
              items: [
                { text: 'คนรีบเดินทางช่วงเช้า', bucket: 'กลุ่มลูกค้า' },
                { text: 'ครอบครัวในซอยที่ซื้อของใช้ประจำ', bucket: 'กลุ่มลูกค้า' },
                { text: `หยิบ${P.th}ได้เร็วภายใน 1 นาที`, bucket: 'คุณค่าที่เสนอ' },
                { text: 'ใกล้บ้าน ไม่ต้องเดินทางไกล', bucket: 'คุณค่าที่เสนอ' },
                { text: 'หน้าร้าน + สั่งทางแชตแล้วมารับ', bucket: 'ช่องทาง' },
                { text: 'ทักทายลูกค้าประจำและจำสินค้าที่ชอบ', bucket: 'ความสัมพันธ์กับลูกค้า' },
              ],
            };
          },
          portfolio: 'bmc',
        },
        {
          title: 'Business Model Canvas ด้านปฏิบัติการและการเงิน', skill: 'work', engine: 'sort',
          theory: 'อีก 5 ช่อง: กระแสรายได้ ทรัพยากรหลัก กิจกรรมหลัก คู่ค้าหลัก และโครงสร้างต้นทุน',
          task: 'จัดข้อมูลร้านลงช่องที่ถูกต้องให้ครบ 9 ช่อง',
          gen: (ctx) => {
            const P = ctx.product;
            return {
              buckets: ['กระแสรายได้', 'ทรัพยากรหลัก', 'กิจกรรมหลัก', 'คู่ค้าหลัก', 'โครงสร้างต้นทุน'],
              items: [
                { text: `เงินจากการขาย${P.th}ทีละชิ้นและแพ็ก`, bucket: 'กระแสรายได้' },
                { text: 'ชั้นวาง ตู้เย็น และทำเลหน้าซอย', bucket: 'ทรัพยากรหลัก' },
                { text: 'เติมสินค้าเข้าชั้นและนับสต็อก', bucket: 'กิจกรรมหลัก' },
                { text: 'ร้านส่งที่ส่งของทุกสัปดาห์', bucket: 'คู่ค้าหลัก' },
                { text: 'ต้นทุนสินค้า ค่าไฟ และค่าป้าย', bucket: 'โครงสร้างต้นทุน' },
              ],
            };
          },
        },
        {
          title: 'ตั้งสมมติฐานที่วัดได้', skill: 'reason', engine: 'mcq',
          theory: 'สมมติฐานระบุสิ่งที่จะเปลี่ยน ผลที่คาด กลุ่มลูกค้า และช่วงเวลา',
          task: 'เลือกสมมติฐานที่วัดผลได้จริง',
          questions: (ctx) => {
            const P = ctx.product;
            return [
              {
                q: 'สมมติฐานใดวัดผลได้ดีที่สุด', answer: 0,
                options: [
                  `ถ้าย้าย ${P.small.name} ไปไว้ข้างเคาน์เตอร์ ช่วง 07:00–08:00 จะขายให้คนรีบเดินทางได้เพิ่มจาก 10 เป็น 13 ชิ้นภายใน 1 สัปดาห์`,
                  'ถ้าร้านสวยขึ้น ลูกค้าจะชอบมากขึ้น',
                  `ขาย${P.th}ให้ดีขึ้น`,
                  'ลูกค้าน่าจะอยากได้โปร',
                ],
                explain: 'ข้อแรกระบุสิ่งที่เปลี่ยน กลุ่มลูกค้า ช่วงเวลา และตัวเลขที่ถือว่าดีขึ้น',
              },
              {
                q: 'ถ้าจะทดสอบสมมติฐานเรื่องตำแหน่งวาง ควรเปลี่ยนกี่อย่างพร้อมกัน', answer: 0,
                options: ['อย่างเดียว คือตำแหน่งวาง', 'เปลี่ยนตำแหน่ง ราคา และป้ายพร้อมกัน', 'เปลี่ยนให้มากที่สุด', 'ไม่ต้องเปลี่ยน แค่รอดู'],
                explain: 'เปลี่ยนทีละอย่างจึงรู้ว่าผลมาจากอะไร',
              },
            ];
          },
        },
        {
          title: 'บอกคุณค่าของร้านเป็นภาษาอังกฤษ', skill: 'eng', engine: 'dialogue',
          theory: '<i>We help customers save time by keeping everyday items nearby.</i> ผูกสิ่งที่ร้านทำกับประโยชน์ที่ลูกค้าได้รับ',
          task: 'ตอบคำถามกรรมการด้วยโครง We help… by…',
          script: (ctx) => [
            { them: 'What does your shop do?', th: 'ร้านของคุณทำอะไร' },
            { choices: [
              { en: 'We help customers save time by keeping everyday items nearby.', ok: true },
              { en: 'We help customers by save time.', ok: false, why: 'หลัง by ต้องเป็นกริยา -ing และควรบอกว่าช่วยอย่างไร' },
              { en: 'Our shop is help people.', ok: false, why: 'โครงประโยคผิด' },
            ] },
            { them: 'Who are your main customers?', th: 'ลูกค้าหลักคือใคร' },
            { choices: [
              { en: `Our main customers are ${ctx.product.en.cust}.`, ok: true },
              { en: 'Our main customers are everyone.', ok: false, why: 'กว้างเกินไป ไม่มีกลุ่มเป้าหมาย' },
              { en: 'Main customer is people.', ok: false, why: 'ไวยากรณ์และความหมายไม่ชัด' },
            ] },
          ],
        },
        {
          title: 'อ่าน 56-1 One Report และ 10-K', skill: 'evid', engine: 'mcq',
          theory: '56-1 One Report และ 10-K เป็นรายงานประจำปีของบริษัทในระบบไทยและสหรัฐตามลำดับ ส่วน 10-Q ใช้ติดตามงวดรายไตรมาส',
          task: 'ตอบคำถาม แล้วเปิดรายงานจริง (เช่น โอสถสภา One Report และ Coca-Cola 10-K) เพื่อจดลงใบงาน 3',
          questions: () => [
            { q: 'รายงานประจำปีของบริษัทจดทะเบียนไทยเรียกว่าอะไร', options: ['56-1 One Report', '10-K', 'W-8BEN', 'ใบกำกับภาษี'], answer: 0, explain: 'ค้นได้จากระบบของ ก.ล.ต.' },
            { q: 'ถ้าต้องการรายงานรายไตรมาสของบริษัทสหรัฐ ควรดูแบบใด', options: ['10-Q', '10-K', '56-1 One Report', 'W-8BEN'], answer: 0, explain: '10-K รายปี 10-Q รายไตรมาส ค้นได้ใน SEC EDGAR' },
            { q: 'เวลาจดกำไรสุทธิจากรายงาน ต้องจดอะไรกำกับเสมอ', options: ['วันสิ้นงวด สกุลเงิน หน่วย และหน้าที่อ้าง', 'ชื่อผู้บริหารเท่านั้น', 'ราคาหุ้นวันนี้', 'ไม่ต้องจดอะไรเพิ่ม'], answer: 0, explain: 'ผู้อื่นจะเปิดไปตรวจตัวเลขเดียวกันได้' },
            { q: 'ทำไมกำไรสุทธิกับกระแสเงินสดจากการดำเนินงานอาจไม่เท่ากัน', options: ['รายการบางอย่างบันทึกเป็นรายได้/ค่าใช้จ่ายก่อนหรือหลังเงินสดเข้าออก', 'รายงานพิมพ์ผิดเสมอ', 'กำไรคือเงินในบัญชีธนาคาร', 'ไม่มีทางต่างกัน'], answer: 0, explain: 'เหมือนร้านชำ: กำไรขั้นต้นไม่เท่ากับเงินสด เพราะเงินจมในสต็อกหรือยังเก็บเงินไม่ได้' },
          ],
        },
      ],
    },

    // ===== สัปดาห์ 7 =====
    {
      title: 'บริการลูกค้าและบันทึกธุรกรรมลงทุน',
      goal: 'ตอบลูกค้าด้วยข้อมูลที่ตรวจสอบได้ และแยกเงินต้น เงินปันผล ผลจากการขาย และข้อมูลภาษีในบันทึกลงทุน',
      rounds: [
        {
          title: 'ทำป้ายสื่อสารจุดเด่น', skill: 'work', engine: 'mcq',
          theory: 'ป้ายที่อ่านเร็วควรสื่อประโยชน์หนึ่งข้อพร้อมข้อมูลที่ลูกค้าใช้ตัดสินใจ เช่น ราคา ขนาด หรือจุดหยิบ',
          task: 'เลือกป้ายที่อ่าน 5 วินาทีแล้วจำได้',
          questions: (ctx) => {
            const P = ctx.product;
            return [
              {
                q: 'ป้ายใดเหมาะกับคนรีบเดินทางที่สุด', answer: 0,
                options: [
                  `พกง่าย หยิบเร็ว · ${P.small.name} ${P.small.price} บาท · หยิบข้างเคาน์เตอร์`,
                  `ยินดีต้อนรับสู่ร้านของเรา เรามีสินค้ามากมายหลายชนิด ราคาย่อมเยา คุณภาพดี บริการประทับใจ`,
                  `${P.th}`,
                  'SALE!!! SALE!!! SALE!!!',
                ],
                explain: 'มีประโยชน์หนึ่งข้อ ราคา และจุดหยิบ อ่านจบใน 5 วินาที',
              },
            ];
          },
        },
        {
          title: 'ตอบลูกค้าเมื่อสินค้าหมด', skill: 'eng', engine: 'dialogue',
          theory: 'ขั้นตอนบริการ: ฟัง ตรวจข้อมูล เสนอทางเลือก ทวนข้อตกลง · <i>We\'re out of that item, but this one is similar.</i>',
          task: 'สินค้าที่ลูกค้าต้องการหมด เสนอสินค้าทดแทนพร้อมบอกความเหมือนและความต่าง',
          script: (ctx) => {
            const E = ctx.product.en;
            return [
              { them: `Do you have the ${E.big}?`, th: 'มีแพ็กใหญ่ไหม' },
              { choices: [
                { en: "We're out of that item, but this one is similar.", ok: true },
                { en: 'No. Bye.', ok: false, why: 'ไม่เสนอทางเลือก ลูกค้าจะเดินออก' },
                { en: 'We are out of item that.', ok: false, why: 'ลำดับคำผิด: out of that item' },
              ] },
              { them: 'How is it different?', th: 'ต่างกันยังไง' },
              { choices: [
                { en: "It's the same size, but it's a different brand. It's one baht cheaper.", ok: true },
                { en: "It's different. Very good.", ok: false, why: 'ไม่บอกความเหมือนและความต่างที่มีผลต่อการซื้อ' },
                { en: "It's same size but different brand cheaper.", ok: false, why: 'ไวยากรณ์ไม่ครบ' },
              ] },
            ];
          },
        },
        {
          title: 'อธิบายราคาและแนะนำของทดแทน', skill: 'eng', engine: 'dialogue',
          theory: 'การทวนราคา ขนาด และยอดรวมช่วยให้ทั้งสองฝ่ายเข้าใจตรงกัน',
          task: 'ราคาต่างจากที่ลูกค้าคาด เสนอทางเลือกแล้วทวนข้อตกลง',
          script: (ctx) => {
            const P = ctx.product, E = P.en, p = P.promo.price, alt = p - 2;
            return [
              { them: `I thought it was ${baht(p - 4)}.`, th: `นึกว่าราคา ${p - 4} บาท` },
              { choices: [
                { en: `Sorry, it's ${baht(p)} now. Would you like to try this one instead? It's ${baht(alt)}.`, ok: true },
                { en: 'No, you are wrong.', ok: false, why: 'ไม่สุภาพ และไม่ได้เสนอทางเลือก' },
                { en: `OK, ${baht(p - 4)}.`, ok: false, why: 'ยอมราคาผิดทำให้ร้านขาดทุน' },
              ] },
              { them: "OK, I'll take two of those.", th: 'เอาอันนั้น 2 ชิ้น' },
              { choices: [
                { en: `Is that two ${E.units} at ${baht(alt)} each?`, ok: true },
                { en: `Is that two ${E.units} at ${baht(p)} each?`, ok: false, why: `ลูกค้าเลือกตัวทดแทนราคา ${alt} บาท` },
                { en: `Two ${E.unit} at ${baht(alt)}?`, ok: false, why: 'ใช้พหูพจน์และประโยคคำถามให้ครบ' },
              ] },
              { them: 'Yes.', th: 'ใช่' },
              { choices: [
                { en: `That's ${baht(2 * alt)} in total.`, ok: true },
                { en: `That's ${baht(2 * p)} in total.`, ok: false, why: 'ยอดรวมผิด' },
                { en: `That's ${baht(alt)} in total.`, ok: false, why: 'ลืมคูณ 2' },
              ] },
            ];
          },
        },
        {
          title: 'บทสนทนาเต็มและการทอนเงิน', skill: 'eng', engine: 'dialogue',
          theory: '<i>Would you like to try this one instead?</i> ถามความสนใจ · <i>Is that two bottles at eighteen baht each?</i> ทวนจำนวนและราคา',
          task: 'ฟังจำนวนเงินที่ลูกค้าจ่าย แล้วทอนให้ถูก',
          script: (ctx) => {
            const P = ctx.product, E = P.en, p = P.small.price, q = R.int(2, 4), tot = p * q;
            const paid = tot <= 20 ? 20 : tot <= 50 ? 50 : 100;
            return [
              { them: `Hi, ${words(q)} ${E.units}, please.`, th: `ขอ ${q} ชิ้น` },
              { choices: [
                { en: `Is that ${words(q)} ${E.units} at ${baht(p)} each?`, ok: true },
                { en: `Is that ${words(q + 1)} ${E.units} at ${baht(p)} each?`, ok: false, why: 'จำนวนไม่ตรง' },
                { en: 'What are you looking for today?', ok: false, why: 'ลูกค้าบอกแล้ว ควรทวนข้อตกลง' },
              ] },
              { them: `Yes. Here's ${baht(paid)}.`, th: '(ฟังจำนวนเงิน)' },
              { listen: 'ลูกค้าจ่ายเงินมาเท่าไร', options: R.shuffle([20, 50, 100]).map((n) => n + ' บาท'), answer: paid + ' บาท' },
              { choices: R.shuffle([
                { en: `That's ${baht(tot)}. Here's your change, ${baht(paid - tot)}.`, ok: true },
                { en: `That's ${baht(tot)}. Here's your change, ${baht(paid - tot + 5)}.`, ok: false, why: `ทอน ${paid} − ${tot} = ${paid - tot} บาท` },
                { en: `That's ${baht(tot + p)}. Here's your change, ${baht(paid - tot - p)}.`, ok: false, why: 'ยอดรวมผิด' },
              ]) },
            ];
          },
        },
        {
          title: 'สมุดบันทึกธุรกรรมลงทุนจำลอง', skill: 'num', engine: 'calc',
          theory: 'แยกเงินที่ใช้ซื้อ เงินปันผล ค่าธรรมเนียม และผลเมื่อขาย · W-8BEN ใช้รับรองสถานะบุคคลต่างชาติในระบบหักภาษีสหรัฐ',
          task: 'คำนวณต้นทุนรวมค่าซื้อ เงินปันผลสุทธิ และผลจากการขายหลังค่าธรรมเนียม (หน่วยดอลลาร์)',
          gen: () => {
            const q = R.int(5, 20), px = R.int(8, 30), fee = 1, div = R.int(2, 8), wht = M.round2(div * 0.15);
            const sell = q * px + R.int(-15, 25), fee2 = 1, basis = q * px + fee;
            return {
              intro: `<b>ข้อมูลจำลอง (USD)</b>${table(['รายการ', 'รายละเอียด'], [['ซื้อ', `${q} หน่วย × $${px} · ค่าซื้อ $${fee}`], ['รับปันผล', `$${div} · ถูกหักภาษี $${wht}`], ['ขาย', `ยอดขายรวม $${sell} · ค่าขาย $${fee2}`]])}`,
              fields: [
                { label: 'ต้นทุนรวมค่าซื้อ', answer: basis, unit: 'USD' },
                { label: 'เงินปันผลสุทธิ', answer: div - wht, unit: 'USD' },
                { label: 'ผลจากการขายหลังค่าธรรมเนียม', answer: sell - fee2 - basis, unit: 'USD' },
              ],
              solution: `ต้นทุน = ${q}×${px} + ${fee} = <b>${basis}</b><br>ปันผลสุทธิ = ${div} − ${wht} = <b>${M.round2(div - wht)}</b><br>ผลจากการขาย = ${sell} − ${fee2} − ${basis} = <b>${sell - fee2 - basis}</b><br><i>ภาษีที่ถูกหักแยกจากค่าธรรมเนียม และต้องดูข้อกำหนดตามปีภาษีจริง</i>`,
            };
          },
        },
      ],
    },

    // ===== สัปดาห์ 8 =====
    {
      title: 'สรุปแผนการตลาดและนำเสนอ',
      goal: 'รวบรวมข้อมูลจากร้านเป็นแผนหนึ่งหน้าและนำเสนอผลพร้อมข้อเสนอว่าจะทดลองอะไรต่อ',
      rounds: [
        {
          title: 'เขียนแผนการตลาดหน้าเดียว', skill: 'reason', engine: 'mcq',
          theory: 'แผนที่ใช้ได้ระบุลูกค้า ปัญหา จุดยืน วิธีทำ เป้าหมาย วิธีวัด และสิ่งที่จะทำต่อหลังเห็นผล',
          task: 'เลือกองค์ประกอบที่ทำให้แผนตรวจสอบได้',
          questions: (ctx) => {
            const run = ctx.state.sim.run;
            return [
              { q: 'ข้อเสนอหลักใดเขียนได้ดีที่สุด', answer: 0, options: [
                `ทำโปร 2 ชิ้นต่อในช่วงเช้า เพราะช่วงทดลอง${run ? ` ได้ผลหลังค่าป้าย ${run.profit} บาท เทียบช่วงปกติ ${run.baseProfit} บาท` : 'ได้กำไรหลังค่าป้ายสูงกว่าช่วงปกติ'} (ข้อมูลจำลอง 30 นาที)`,
                'ทำโปรต่อเพราะรู้สึกว่าลูกค้าชอบ',
                'ลดราคาทุกอย่าง 50%',
                'ไม่ต้องวัดผล ทำไปเรื่อย ๆ',
              ], explain: 'โยงข้อเสนอกับตัวเลข ช่วงเวลา และบอกว่าเป็นข้อมูลจริงหรือจำลอง' },
              { q: 'สิ่งใดต้องมีใน "วิธีวัด"', answer: 0, options: ['ตัวชี้วัด ตัวหาร และช่วงเวลา', 'สีของป้าย', 'ชื่อเจ้าของร้าน', 'จำนวนสไลด์'], explain: 'ผู้ฟังตรวจแผนได้เมื่อรู้แหล่งข้อมูล ช่วงเวลา หน่วย และตัวหาร' },
            ];
          },
        },
        {
          title: 'ตรวจหลักฐานและคำนวณซ้ำ', skill: 'num', engine: 'calc',
          theory: 'ผู้ฟังตรวจแผนได้เมื่อรู้แหล่งข้อมูล ช่วงเวลา หน่วย และตัวหารที่ใช้',
          task: 'ย้อนคำนวณตัวเลขสำคัญจากผลงานของคุณ (ถ้ายังไม่มีจะใช้ข้อมูลจำลอง)',
          gen: (ctx) => {
            const S = ctx.state.sim, P = ctx.product.promo;
            const base = S.baseline || { units: R.int(12, 20) };
            const plan = S.plan || { bundle: 2 * P.price - 4, sign: 30 };
            const run = S.run || { sets: R.int(6, 14), singles: R.int(2, 6) };
            const post = S.post || { views: 200, messages: 10, orders: 4 };
            const gp = base.units * (P.price - P.cost);
            const margin = plan.bundle - 2 * P.cost;
            const promoProfit = run.sets * margin + run.singles * (P.price - P.cost) - plan.sign;
            return {
              intro: table(['ข้อมูล', 'ค่า'], [
                ['ช่วงปกติ', `ขาย ${base.units} ชิ้น · ต้นทุน ${P.cost} ขาย ${P.price}`],
                ['ช่วงโปร', `ขาย ${run.sets} ชุด (ชุดละ ${plan.bundle} บาท) + เดี่ยว ${run.singles} ชิ้น · ค่าป้าย ${plan.sign} บาท`],
                ['โพสต์', `เห็น ${post.views} · ทัก ${post.messages}`],
              ]),
              fields: [
                { label: 'กำไรขั้นต้นช่วงปกติ', answer: gp, unit: 'บาท' },
                { label: 'ผลหลังค่าป้ายช่วงโปร', answer: promoProfit, unit: 'บาท' },
                { label: 'อัตราทักของโพสต์', answer: (post.messages / post.views) * 100, tol: 0.06, unit: '%' },
              ],
              solution: `${base.units} × (${P.price} − ${P.cost}) = <b>${gp}</b><br>${run.sets} × ${margin} + ${run.singles} × ${P.price - P.cost} − ${plan.sign} = <b>${promoProfit}</b><br>${post.messages} ÷ ${post.views} × 100 = <b>${fmt((post.messages / post.views) * 100, 1)}%</b>`,
            };
          },
        },
        {
          title: 'จัดเนื้อหาสไลด์ 3 หน้า', skill: 'work', engine: 'sort',
          theory: 'แต่ละหน้าตอบหนึ่งคำถาม: ลูกค้ามีปัญหาอะไร · ทดลองอย่างไร · ผลบอกว่าจะทำอะไรต่อ',
          task: 'จัดเนื้อหาลงสไลด์ที่ถูกต้อง',
          gen: () => ({
            buckets: ['สไลด์ 1 ลูกค้าและปัญหา', 'สไลด์ 2 สิ่งที่ทดลองและวิธีวัด', 'สไลด์ 3 ผลและสิ่งที่จะทำต่อ'],
            items: [
              { text: 'คนรีบเดินทางต้องการซื้อเร็วและพกง่าย', bucket: 'สไลด์ 1 ลูกค้าและปัญหา' },
              { text: 'ข้อสังเกต: ลูกค้าถามหาขนาดเล็ก 3 ครั้ง', bucket: 'สไลด์ 1 ลูกค้าและปัญหา' },
              { text: 'โปร 2 ชิ้น ทดลอง 30 นาที เปลี่ยนแค่ราคา', bucket: 'สไลด์ 2 สิ่งที่ทดลองและวิธีวัด' },
              { text: 'วัดจำนวนชุดที่ขายและกำไรหลังค่าป้าย', bucket: 'สไลด์ 2 สิ่งที่ทดลองและวิธีวัด' },
              { text: 'ผลหลังค่าป้ายเทียบช่วงปกติ (บาท)', bucket: 'สไลด์ 3 ผลและสิ่งที่จะทำต่อ' },
              { text: 'ครั้งหน้าจะทดลองซ้ำช่วงเวลาเดียวกัน', bucket: 'สไลด์ 3 ผลและสิ่งที่จะทำต่อ' },
            ],
          }),
        },
        {
          title: 'นำเสนอภาษาอังกฤษ 60 วินาที', skill: 'eng', engine: 'pitch',
          theory: 'แบ่งเวลา: ลูกค้ากับปัญหา 15 วิ · ข้อเสนอและวิธีทดลอง 20 วิ · ผล 15 วิ · สิ่งที่จะทำต่อ 10 วิ',
          task: 'อ่านบทพูดที่สร้างจากผลงานของคุณ จับเวลา อัดเสียงถ้าทำได้ แล้วประเมินตัวเอง',
        },
        {
          title: 'เทียบผลตอบแทนเมื่อค่าเงินเปลี่ยน', skill: 'num', engine: 'calc',
          theory: 'หุ้นรายตัวผูกกับบริษัทเดียว ดัชนีเป็นตัวชี้วัดตะกร้าสินทรัพย์ ETF เป็นกองทุนที่ซื้อขายในตลาด · ผลตอบแทนเป็นบาทขึ้นกับค่าเงินด้วย',
          task: 'คำนวณเงินบาทที่ใช้ซื้อ ได้คืน และผลต่างเป็น % (ก่อนค่าธรรมเนียมและภาษี)',
          gen: () => {
            const usd = R.int(10, 30) * 10, r1 = R.pick([33, 34, 35, 36, 37]), r2 = r1 + R.pick([-2, -1, 1, 2]);
            const usd2 = usd + R.int(-5, 15);
            const t1 = usd * r1, t2 = usd2 * r2, d = t2 - t1;
            return {
              intro: table(['รายการ', 'ค่า'], [['ซื้อ', `$${usd} ที่ ${r1} บาท/ดอลลาร์`], ['ขาย', `$${usd2} ที่ ${r2} บาท/ดอลลาร์`]]),
              fields: [
                { label: 'เงินบาทที่ใช้ซื้อ', answer: t1, unit: 'บาท' },
                { label: 'เงินบาทที่ได้คืน', answer: t2, unit: 'บาท' },
                { label: 'ผลต่าง (ติดลบใส่ −)', answer: d, unit: 'บาท' },
                { label: 'ผลต่างเป็น % ของเงินที่ใช้ซื้อ', answer: (d / t1) * 100, tol: 0.06, unit: '%' },
              ],
              solution: `${usd} × ${r1} = <b>${fmt(t1)}</b> · ${usd2} × ${r2} = <b>${fmt(t2)}</b><br>ผลต่าง = <b>${fmt(d)}</b> บาท = <b>${fmt((d / t1) * 100)}%</b><br>${usd2 > usd && d < 0 ? '<i>ราคาเป็นดอลลาร์ขึ้น แต่เงินบาทแข็งค่า ผลเป็นบาทจึงติดลบ</i>' : ''}`,
            };
          },
        },
      ],
    },
  ];

  // ---------- แบบทดสอบท้ายแผน (หน้า 14) ----------
  M.FINAL = {
    title: 'แบบทดสอบสินค้าใหม่ (ปิดโน้ต)', skill: 'num', engine: 'calc',
    theory: 'ใช้ทุกสูตรที่ฝึกมา: ส่วนต่างต่อชุด จุดคุ้มค่าป้าย กำไรช่วงปกติ และจำนวนที่ต้องขายเพื่อให้ได้เท่าเดิม',
    task: 'ทำโจทย์โดยไม่เปิดโน้ต กด 🎲 เพื่อสุ่มตัวเลขชุดใหม่ฝึกซ้ำ',
    gen: (ctx, first) => {
      let c = 10, p = 15, n = 10, B = 28, s = 20;
      if (!first) {
        do { c = R.int(8, 14); p = c + R.int(4, 7); n = R.int(8, 14); B = 2 * p - R.int(1, 3); s = R.int(3, 8) * 5; } while (B - 2 * c <= 0);
      }
      const m = B - 2 * c, be = Math.ceil(s / m), base = n * (p - c), match = Math.ceil((base + s) / m), at6 = 6 * m - s;
      return {
        intro: `ร้านขายกระดาษทิชชูต้นทุนแพ็กละ <b>${c}</b> บาท ราคาปกติ <b>${p}</b> บาท ขายได้ <b>${n}</b> แพ็กใน 1 ชั่วโมง ร้านกำลังลองโปร <b>2 แพ็ก ${B} บาท</b> มีค่าป้าย <b>${s}</b> บาท`,
        fields: [
          { label: 'ส่วนต่างต่อชุดก่อนค่าป้าย', answer: m, unit: 'บาท' },
          { label: 'จำนวนชุดที่คุ้มค่าป้าย', answer: be, unit: 'ชุด' },
          { label: 'กำไรช่วงปกติ 1 ชั่วโมง', answer: base, unit: 'บาท' },
          { label: 'จำนวนชุดที่ได้กำไรอย่างน้อยเท่าช่วงปกติ', answer: match, unit: 'ชุด' },
          { label: 'ถ้าขายได้ 6 ชุด กำไรหลังค่าป้าย', answer: at6, unit: 'บาท' },
        ],
        solution: `${B} − 2×${c} = <b>${m}</b> · ⌈${s} ÷ ${m}⌉ = <b>${be}</b> · ${n}×(${p}−${c}) = <b>${base}</b> · ⌈(${base} + ${s}) ÷ ${m}⌉ = <b>${match}</b> · 6×${m} − ${s} = <b>${at6}</b><br>ตัวอย่างอังกฤษ: “Two packs are ${baht(B)} in total. You can pick them up at the counter.”`,
      };
    },
  };
})();
