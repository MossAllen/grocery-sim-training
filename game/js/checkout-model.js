/*
 * checkout-model.js — W2R2 shelf prices, hand, scanner, receipt, payment, and change (Claude)
 * No DOM. Works in the browser (MTL.CheckoutModel) and in Node (require) for tools/check.js.
 * Money: whole baht for cash and receipts, satang for unit prices that need two decimals.
 */
(function (root) {
  const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
  // Second price set on replay: the small pack is cheaper per unit, so the sticker-price shortcut fails the other way.
  const ALTERNATE = { water: [9, 24], snack: [8, 27], household: [9, 60] };
  const BUDGET_MARGIN = 5;

  const number = (value, digits = 2) => Number(value).toLocaleString('th-TH', { maximumFractionDigits: digits });
  function sizeText(product, size) {
    if (product.id === 'water') return size < 1 ? number(size * 1000, 0) + ' มล.' : number(size) + ' ลิตร';
    return number(size, 0) + (product.id === 'snack' ? ' กรัม' : ' ม้วน');
  }

  // caseIndex 0 uses the curriculum prices, 1 the alternate set. Unit prices are satang per `basis` units.
  function mission(product, caseIndex) {
    const prices = caseIndex === 1 ? ALTERNATE[product.id] : [product.small.price, product.big.price];
    const items = ['small', 'big'].map((size, i) => ({
      id: i ? 'b' : 'a', shelf: i ? 'B' : 'A', size, name: product[size].name, quantity: product[size].size,
      price: prices[i], sizeText: sizeText(product, product[size].size),
      per: prices[i] * product.per / product[size].size,
      perSatang: Math.round(prices[i] * product.per / product[size].size * 100),
    }));
    return {
      caseIndex, items, budget: Math.max(...prices) + BUDGET_MARGIN, basis: product.per, unit: product.perLabel,
      denominator: product.id === 'water' ? 'ลิตร' : product.id === 'snack' ? 'กรัม' : 'ม้วน',
      best: items[0].perSatang < items[1].perSatang ? items[0] : items[1],
    };
  }

  // Fewest Thai notes and coins that add up to the budget, largest first.
  function wallet(amount) {
    const cash = [];
    let rest = amount;
    for (const value of DENOMINATIONS) while (rest >= value) { cash.push(value); rest -= value; }
    return cash;
  }

  function createCounter(plan, { transactionId = 'w2-local' } = {}) {
    const purse = wallet(plan.budget);
    const lines = [];
    let hand = null, units = null, payment = null, changeAnswer = null, changeReceived = false;
    const item = (id) => plan.items.find((entry) => entry.id === id);
    const total = () => lines.reduce((sum, line) => sum + line.price, 0);
    const unitsReady = () => units?.length === plan.items.length &&
      units.every((value) => Number.isSafeInteger(value) && value >= 0);

    return {
      plan, purse, transactionId, lines,
      hand: () => hand,
      total,
      // Taking a pack from a shelf is a new pick event, also when it replaces the pack in hand.
      pick(id) {
        const next = item(id);
        if (!next) throw new Error(`unknown shelf ${id}`);
        if (lines.length) return { picked: false, reason: 'สแกนแล้ว ซื้อได้ 1 แพ็ก' };
        if (hand === next) return { picked: false, reason: 'ถือแพ็กนี้อยู่แล้ว' };
        const previous = hand;
        hand = next;
        return { picked: true, item: next, previous };
      },
      putBack() {
        if (!hand || lines.length) return false;
        hand = null;
        return true;
      },
      // Unit prices typed at the counter, in satang. null means the field is empty or not a number.
      setUnits(values) {
        if (lines.length) return false;
        units = [...values];
        return true;
      },
      unitsReady,
      // One accepted scan adds one receipt line. Rejected scans explain why and change nothing.
      scan() {
        if (lines.length) return { accepted: false, reason: 'สแกนแล้ว ภารกิจนี้ซื้อ 1 แพ็ก รายการไม่เพิ่มซ้ำ' };
        if (!hand) return { accepted: false, reason: 'ยังไม่มีสินค้าในมือ กลับไปหยิบจากชั้นก่อน' };
        if (!unitsReady()) return { accepted: false, reason: 'กรอกราคาต่อหน่วยของทั้งสองชั้นก่อนสแกน' };
        const line = { id: hand.id, shelf: hand.shelf, name: hand.name, quantity: 1, price: hand.price };
        lines.push(line);
        hand = null;
        return { accepted: true, line, total: total() };
      },
      // Pay with indexes into the purse, so two coins of the same value stay distinct.
      pay(indexes) {
        if (!lines.length) return { paid: false, reason: 'สแกนสินค้าก่อนจ่ายเงิน' };
        if (payment) return { paid: false, reason: 'จ่ายเงินแล้ว' };
        const unique = [...new Set(indexes)];
        if (unique.length !== indexes.length || unique.some((i) => !Number.isInteger(i) || i < 0 || i >= purse.length)) {
          return { paid: false, reason: 'เลือกเงินจากกระเป๋าเท่านั้น' };
        }
        const amount = unique.reduce((sum, i) => sum + purse[i], 0);
        if (amount < total()) return { paid: false, reason: `เงินยังไม่พอ ขาดอีก ${total() - amount} บาท` };
        payment = { indexes: unique.sort((a, b) => a - b), amount, change: amount - total() };
        return { paid: true, ...payment };
      },
      payment: () => payment,
      // The learner's first answer is kept. Change = money handed over − receipt total.
      answerChange(value) {
        if (!payment) throw new Error('pay first');
        if (changeAnswer === null) changeAnswer = value;
        return value === payment.change;
      },
      // True only the first time change above 0 is handed back in this transaction (cash_change cue).
      receiveChange() {
        if (!payment || changeReceived) return false;
        changeReceived = true;
        return payment.change > 0;
      },
      changeReceived: () => changeReceived,
      // Score keeps the original three points: both unit prices and buying the pack that is cheaper per unit.
      result() {
        const choice = lines[0] ? item(lines[0].id) : null;
        const unitCorrect = plan.items.map((entry, i) => !!units && units[i] === entry.perSatang);
        const chosenBest = !!choice && choice === plan.best;
        const points = unitCorrect.filter(Boolean).length + Number(chosenBest);
        return {
          choice, unitCorrect, chosenBest, points, score: points / 3,
          total: total(), paid: payment?.amount ?? null, change: payment?.change ?? null,
          changeAnswer, changeCorrect: payment ? changeAnswer === payment.change : false,
        };
      },
    };
  }

  const api = { DENOMINATIONS, ALTERNATE, BUDGET_MARGIN, mission, wallet, createCounter, sizeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MTL = root.MTL || {}; root.MTL.CheckoutModel = api; }
})(typeof window !== 'undefined' ? window : null);
