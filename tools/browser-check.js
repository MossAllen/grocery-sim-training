/* Browser scenario called by run-browser-check.js. Results pass through the game's controls and save handlers. */
module.exports = async ({ week, idx, playRound, stopAtNumericLesson }) => {
  const M = window.MTL;
  const { State } = M;
  const round = week === 'final' ? M.FINAL : M.WEEKS[week].rounds[idx];
  const ctx = { product: M.PRODUCTS[State.data.product], state: State.data, week, idx };
  const get = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const check = (value, message) => { if (!value) throw new Error(message); };
  const click = (selector) => {
    const element = get(selector);
    check(element && !element.disabled, `Unavailable control: ${selector}`);
    element.click();
  };
  const stage = (selector) => click(`.stage ${selector}`);
  const text = (value) => String(value).replace(/\s+/g, ' ').trim();
  const textChoice = (selector, value) => all(selector).find((element) => !element.disabled && text(element.textContent) === text(value));
  const textButton = (selector, value) => {
    const match = textChoice(selector, value);
    check(match && !match.disabled, `Unavailable choice: ${value}`);
    match.click();
  };
  const healthy = (selector) => {
    const element = get(selector);
    check(element && !element.classList.contains('hidden'), `Missing screen: ${selector}`);
    check(!/\b(?:undefined|NaN)\b/.test(element.innerText), `Invalid text in ${selector}`);
  };
  const waitFor = async (ready, label) => {
    const deadline = performance.now() + 5000;
    while (!ready()) {
      check(performance.now() < deadline, `Timed out waiting for ${label}`);
      await new Promise((done) => setTimeout(done, 20));
    }
  };

  // Capture the actual randomly generated exercise so the run can answer it deterministically.
  let generated;
  const factoryKey = { calc: 'gen', sort: 'gen', dialogue: 'script', mcq: 'questions' }[round.engine];
  const engine = M.engines[round.engine];
  if (factoryKey) {
    M.engines[round.engine] = (element, config, ...args) => {
      const factory = config[factoryKey];
      if (typeof factory !== 'function') {
        generated = factory;
        return engine(element, config, ...args);
      }
      return engine(element, { ...config, [factoryKey]: (...params) => {
        generated = factory(...params);
        return generated;
      } }, ...args);
    };
  }

  try {
    click('#homeBtn');
    if (week === 'final') click('#finalBtn');
    else {
      click(`.week[data-w="${week}"]`);
      click(`.round[data-r="${idx}"]`);
      if (week === 1 && idx === 1) {
        await waitFor(() => get('[data-walk-classic]'), 'classic practice choice');
        click('[data-walk-classic]');
      }
      await waitFor(() => typeof round.lesson === 'function' && get('.lesson'), 'lesson to load');
      for (const [i, step] of round.lesson(ctx).entries()) {
        healthy('.lesson');
        if (stopAtNumericLesson && step.type === 'try') return;
        if (step.type === 'reveal') {
          for (const _ of step.parts) {
            click('.lesson .lv-rev');
            if (step.build) check(all('.lesson .lv-part').length === 1, 'Build illustration was duplicated');
          }
        } else if (step.type === 'try') {
          get('.lesson .ans').value = String(step.answer);
          click('.lesson .ck');
        } else if (step.type === 'pick') click(`.lesson .opt[data-k="${step.answer}"]`);
        if (step.say) click('.lesson .sayit');
        healthy('.lesson');
        check(get('.lesson .dots .now') === all('.lesson .dots i')[i], 'Wrong lesson step');
        click('.lesson .nx');
      }
      healthy('.precheck');
      const answer = round.check.answer;
      click(`.precheck .opt:not([data-k="${answer}"])`);
      check(get('.precheck .opt.bad'), 'No feedback for the incorrect pre-check choice');
      click(`.precheck .opt[data-k="${answer}"]`);
      check(get('.precheck .opt.right'), 'No feedback for the correct pre-check choice');
      click('.precheck .go');
    }
    healthy('.stage');
    if (!playRound) return;

    if (round.engine === 'mcq') {
      for (const question of generated) {
        stage(`.opt[data-k="${question.answer}"]`);
        stage('.nx');
      }
    } else if (round.engine === 'calc') {
      generated.fields.forEach((field, i) => {
        get(`.stage [name="f${i}"]`).value = field.options ? String(field.answer) : field.answer.toFixed(6);
      });
      stage('.chk');
      stage('.sv');
    } else if (round.engine === 'sort') {
      for (const item of generated.items) {
        textButton('.stage .sort-pool .chip', item.text);
        stage(`.bucket[data-b="${generated.buckets.indexOf(item.bucket)}"]`);
      }
      stage('.chk');
      stage('.sv');
    } else if (round.engine === 'dialogue') {
      for (const step of generated.filter((step) => step.choices || step.listen)) {
        const selector = '.stage .choices .opt';
        const choice = step.listen ? step.answer : step.choices.find((option) => option.ok).en;
        await waitFor(() => textChoice(selector, choice), `dialogue choice ${choice}`);
        textButton(selector, choice);
      }
      await waitFor(() => get('.stage .sv'), 'dialogue save button');
      stage('.sv');
    } else if (round.engine === 'post') {
      all('.stage input[type="checkbox"]').slice(0, 6).forEach((element) => element.click());
      stage('.go');
      stage('.sv');
    } else if (round.engine === 'pitch') {
      stage('.go');
      stage('.hear');
      all('.stage input[type="checkbox"]').forEach((element) => element.click());
      stage('.sv');
    } else if (round.engine === 'sim') {
      if (round.mode === 'plan') stage('.lock');
      else {
        if (round.mode === 'baseline') stage('.use-sim');
        stage('.go');
        stage('.skip');
      }
      // These UI submissions exercise each save path. The model's numeric answers are verified by check.js.
      all('.stage form input[inputmode="decimal"], .stage form input[inputmode="numeric"]').forEach((element) => { element.value = '0'; });
      all('.stage form select').forEach((element) => { element.selectedIndex = 1; });
      stage('.chk');
      stage('.sv');
    } else if (round.variant === 'timeCompare' && ctx.product.id === 'water') {
      stage('.observe-compare');
      const periods = [['am-carry', 'am-fast', 'am-price'], ['pm-stock', 'pm-stock-more']];
      for (const events of periods) {
        for (const id of events) {
          stage(`[data-event="${id}"]`);
          stage('.tc-record');
        }
        stage('.tc-continue');
      }
      for (const id of periods.flat()) {
        stage('[data-answer="fact"]');
        stage('.tc-next');
        stage(`[data-answer="${id}-supported"]`);
        stage('.tc-next');
      }
      stage('[data-answer="carry"]');
      stage('.tc-next');
      stage('[data-answer="home"]');
      stage('.tc-next');
      const data = State.data.observations.timeCompare[ctx.product.id];
      check(data.events.length === 5 && data.comparison[0].sampleCount === 3 && data.comparison[1].sampleCount === 2,
        'Observation counts were not saved for both periods');
    } else if (round.engine === 'observe') {
      if (round.variant === 'timeCompare') stage('.observe-standard');
      const scene = M.currentScene;
      const observed = M.behaviors(ctx.product).slice(0, round.need || 5);
      check(scene && scene.c === get('.stage canvas'), 'Missing observation scene');
      const canvas = scene.c;
      const bounds = canvas.getBoundingClientRect();
      for (const behavior of observed) {
        // Place a real customer at the shelf. Clicking coordinates exercises canvas hit detection.
        scene.customers = [];
        const customer = scene.spawn({ b: behavior, shelfWait: 7 });
        ({ x: customer.x, y: customer.y } = customer.path[1]);
        scene.opts.onArrive(customer, 1);
        canvas.dispatchEvent(new MouseEvent('click', {
          clientX: bounds.left + customer.x / canvas.width * bounds.width,
          clientY: bounds.top + (customer.y - 20) / canvas.height * bounds.height,
        }));
        stage('.nt');
      }
      for (const behavior of observed) {
        textButton('.stage .pop .opt', behavior.good);
        stage('.pop .nx');
      }
    } else throw new Error(`Uncovered engine: ${round.engine}`);

    healthy('#modal');
    const saved = State.round(week, idx);
    check(saved && Number.isFinite(saved.score), 'The round result was not saved');
    if (round.engine !== 'sim') check(saved.stars === 3, `Expected three stars, got ${saved.stars}`);
    const persisted = JSON.parse(localStorage.getItem('mtl-save-v1'));
    check(persisted.rounds[`${week}-${idx}`].score === saved.score, 'The round result was not persisted');
    click('#modal [data-a]:not([data-a="again"])');
  } finally {
    if (factoryKey) M.engines[round.engine] = engine;
  }
};
