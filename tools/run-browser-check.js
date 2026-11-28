// Run isolated mobile browser playthroughs, axe checks, and a desktop Chrome Lighthouse audit in mobile mode.
const { spawn } = require('node:child_process');
const { createReadStream, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { gzipSync } = require('node:zlib');
const scenario = require('./browser-check.js');
const verifyShelfWalk = require('./browser-check-shelf-walk.js');
const verifyObserveWalk = require('./browser-check-observe-walk.js');
const verifyApp = require('./browser-check-app.js');
const verifyW4R3Walk = require('./browser-check-w4r3-walk.js');

const game = path.resolve(__dirname, '..', 'game');
const products = ['water', 'snack', 'household'];
const chromeArgs = ['--disable-crashpad-for-testing'];
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};
const gzipCache = new Map();

function respond(req, res, basePath) {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(basePath)) {
    res.writeHead(404).end();
    return;
  }
  const file = path.resolve(game, `./${decodeURIComponent(url.pathname.slice(basePath.length)) || 'index.html'}`);
  const stat = file.startsWith(game + path.sep) && statSync(file, { throwIfNoEntry: false });
  if (!stat || !stat.isFile()) {
    res.writeHead(404).end();
    return;
  }
  const type = types[path.extname(file)] || 'application/octet-stream';
  const headers = { 'Content-Type': type };
  if (type.startsWith('text/')) {
    // GitHub Pages compresses these resources. Use the same transfer shape for Lighthouse on localhost.
    headers.Vary = 'Accept-Encoding';
    if (req.headers['accept-encoding']?.split(',').some((encoding) => encoding.trim() === 'gzip')) {
      let entry = gzipCache.get(file);
      if (!entry || entry.mtime !== stat.mtimeMs || entry.size !== stat.size) {
        entry = { mtime: stat.mtimeMs, size: stat.size, bytes: gzipSync(readFileSync(file)) };
        gzipCache.set(file, entry);
      }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': entry.bytes.length }).end(entry.bytes);
      return;
    }
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  createReadStream(file).pipe(res);
}

async function axe(page, script, screen) {
  if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path: script });
  const { violations } = await page.evaluate(() => window.axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
  console.log(`axe ${screen}: ${violations.length} WCAG violations`);
  const severe = violations.filter((issue) => ['serious', 'critical'].includes(issue.impact))
    .map((issue) => `${screen}: ${issue.id} (${issue.impact}) ${issue.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  if (severe.length) console.log(severe.join('\n'));
  return severe;
}

async function verifyGame(browser, url, axeScript) {
  const problems = [];
  for (const product of products) {
    for (const playRound of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true,
        hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        if (!playRound) {
          // Reopen a previously losing save, with no access to a live user profile.
          await context.addInitScript((state) => localStorage.setItem('mtl-save-v1', JSON.stringify(state)), {
            version: 1, product, rounds: {}, portfolio: {},
            sim: { plan: { bundle: 36 }, run: { sets: 2, singles: 1, units: 5, sales: 90, profit: -33, baseProfit: 150, rain: false } },
            settings: { sound: false, tts: false, unlockAll: true },
          });
        }
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.url().startsWith(url) && response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
            errors.push(`${response.status()} ${response.url()}`);
          }
        });
        await page.goto(url);
        await page.evaluate(() => {
          window.MTL.speak = (text) => {
            if (typeof text !== 'string' || /\b(?:undefined|NaN)\b/.test(text)) throw new Error(`Invalid speech text: ${text}`);
          };
        });
        if (playRound) {
          if (axeScript && product === products[0]) problems.push(...await axe(page, axeScript, 'start'));
          await page.locator(`.product-pick [data-p="${product}"]`).click();
          await page.locator('#startBtn').click();
          await page.locator('#soundBtn').click();
          await page.locator('#menuBtn').click();
          if (axeScript && product === products[0]) problems.push(...await axe(page, axeScript, 'settings'));
          await page.locator('#ul').check();
          await page.locator('#modal [data-a="close"]').click();
          if (axeScript && product === products[0]) {
            problems.push(...await axe(page, axeScript, 'map'));
            await page.evaluate(scenario, { week: 0, idx: 4, stopAtNumericLesson: true });
            problems.push(...await axe(page, axeScript, 'numeric lesson'));
          }
        }
        const play = async (week, idx) => {
          try { await page.evaluate(scenario, { week, idx, playRound }); }
          catch (error) { throw new Error(`${product} ${week === 'final' ? week : `W${week + 1}R${idx + 1}`} (save=${playRound})`, { cause: error }); }
        };
        for (let week = 0; week < 8; week++) {
          for (let idx = 0; idx < 5; idx++) {
            await play(week, idx);
            if (axeScript && !playRound && product === products[0] && week === 3 && idx === 0) {
              problems.push(...await axe(page, axeScript, 'W4R1'));
              await page.evaluate(() => {
                document.querySelector('.use-sim').click();
                document.querySelector('.stage .go').click();
                document.querySelector('.stage .skip').click();
              });
              problems.push(...await axe(page, axeScript, 'W4R1 calculator'));
            }
          }
          console.log(`${product} W${week + 1}: ${playRound ? '5 rounds saved' : '5 lessons and checks (loss save)'}`);
        }
        if (playRound) await play('final', 0);
        if (errors.length) throw new Error(`${product}: ${errors.join(', ')}`);
      } finally {
        await context.close();
      }
    }
  }
  console.log('Playwright passed: 240 lessons and pre-checks, 120 round saves, and 3 final assessment saves.');
  return problems;
}

async function runLighthouse(url, cliPath, chromePath, flags) {
  const audit = spawn(process.execPath, [cliPath, url, ...flags, '--quiet', '--output=json',
    '--output-path=stdout', '--only-categories=performance,accessibility'], {
    env: { ...process.env, CHROME_PATH: chromePath },
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: AbortSignal.timeout(90_000),
    killSignal: 'SIGINT',
  });
  let output = '';
  let diagnostics = '';
  audit.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  audit.stderr.setEncoding('utf8').on('data', (chunk) => { diagnostics += chunk; });
  const [exit] = await once(audit, 'close');
  if (exit !== 0) throw new Error(`Lighthouse exited with code ${exit}\n${diagnostics.trim()}`);
  const report = JSON.parse(output);
  if (report.runtimeError) throw new Error(`Lighthouse ${report.runtimeError.code}: ${report.runtimeError.message}`);
  return report;
}

async function lighthouseOnWindows(url, cliPath, chromium, chromePath) {
  const temp = realpathSync(os.tmpdir());
  const profilePrefix = 'grocery-lighthouse-';
  const profile = mkdtempSync(path.join(temp, profilePrefix));
  let context;
  try {
    // A dedicated profile lets Lighthouse attach directly, even when Chrome does not log its debug port.
    context = await chromium.launchPersistentContext(profile, {
      executablePath: chromePath,
      args: [...chromeArgs, '--remote-debugging-port=0'],
    });
    const port = Number(readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    if (!Number.isInteger(port) || port <= 0) throw new Error('Chrome did not expose its local debugging port');
    return await runLighthouse(url, cliPath, chromePath, [`--port=${port}`]);
  } finally {
    if (context) await context.close();
    if (path.dirname(profile) === temp && path.basename(profile).startsWith(profilePrefix)) {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

async function lighthouse(url, cliPath, chromium) {
  const chromePath = process.env.CHROME_PATH || chromium.executablePath();
  // On Linux, let Lighthouse own the entire browser and its temporary profile.
  const measure = process.platform === 'win32'
    ? () => lighthouseOnWindows(url, cliPath, chromium, chromePath)
    : () => runLighthouse(url, cliPath, chromePath, ['--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage']);
  let report;
  try {
    report = await measure();
  } catch (error) {
    if (error.code !== 'ABORT_ERR' && !/ERR_ABORTED|ECONNRESET|ECONNREFUSED|waiting for dynamic debugging port/i.test(error.message)) throw error;
    console.warn(`Transient Lighthouse error, retrying with a new profile: ${error.message}`);
    report = await measure();
  }
  const scores = Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, Math.round(category.score * 100)]));
  console.log('Lighthouse (mobile)', scores);
  if (scores.performance >= 80) return [];
  for (const metric of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']) {
    console.log(`${metric}: ${report.audits[metric].displayValue}`);
  }
  const lcp = report.audits['lcp-breakdown-insight']?.details?.items?.find((item) => item.type === 'node');
  if (lcp) console.log(`LCP element: ${lcp.selector || lcp.snippet || lcp.nodeLabel}`);
  for (const task of report.audits['long-tasks']?.details?.items?.slice(0, 5) || []) {
    console.log(`long task ${Math.round(task.duration)}ms: ${task.url}`);
  }
  for (const entry of report.audits['bootup-time']?.details?.items?.slice(0, 5) || []) {
    console.log(`startup ${Math.round(entry.total)}ms (${Math.round(entry.scripting)}ms JS): ${entry.url}`);
  }
  for (const audit of Object.values(report.audits)) {
    if (audit.score === 0 && audit.displayValue) console.log(`${audit.id}: ${audit.displayValue}`);
  }
  return [`Lighthouse mobile performance below 80 (${scores.performance})`];
}

async function verifyCheckoutRetry(browser, url) {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  try {
    let requests = 0;
    await page.route('**/checkout-model.js?*', (route) => {
      requests++;
      return requests === 1 ? route.abort() : route.continue();
    });
    await page.goto(`${url}#shelf-walk`);
    await page.locator('[data-p="water"]').click();
    await page.locator('#startBtn').click();
    // Exercise retry when the model alone failed and the other walk scripts have already loaded.
    await page.waitForFunction(() => {
      const { playShelfWalk, ShelfWalkScene, WalkControls } = window.MTL;
      return playShelfWalk && ShelfWalkScene && WalkControls;
    }, null, { timeout: 5000 });
    await page.locator('#retryLesson').click({ timeout: 5000 });
    await page.locator('.shelf-walk canvas').waitFor({ timeout: 5000 });
    if (requests !== 2) throw new Error(`Expected one checkout model retry, got ${requests} requests`);
    console.log('W2R2 checkout model request retry: passed');
  } finally {
    await page.close();
  }
}

async function phasedScenario(browser, url, file, phases) {
  const run = require(path.join(__dirname, file));
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    for (const [index, phase] of phases.entries()) {
      if (index) await page.reload();
      try { await page.evaluate(run, phase); }
      catch (error) { throw new Error(`${file} ${phase}`, { cause: error }); }
    }
    if (errors.length) throw new Error(`${file}: ${errors.join(', ')}`);
    console.log(`${file}: ${phases.join(' → ')} passed`);
  } finally {
    await context.close();
  }
}

// W6R5 โต๊ะอ่านผลประกอบการ: เข้าทาง #report-desk บนจอ 320×568 แบบสัมผัส แล้วตรวจ axe และความกว้างหน้าจอ
async function verifyReportDesk(browser, url, axeScript) {
  const problems = [];
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}#report-desk`);
    try { await page.evaluate(require('./browser-check-report-desk.js'), 'hash'); }
    catch (error) { throw new Error('browser-check-report-desk.js hash', { cause: error }); }
    if (axeScript) problems.push(...await axe(page, axeScript, 'W6R5 report desk'));
    if (errors.length) throw new Error(`report desk hash entry: ${errors.join(', ')}`);
    console.log('browser-check-report-desk.js: #report-desk on 320px passed');
  } finally {
    await context.close();
  }
  return problems;
}

// W5R5 โต๊ะคำสั่ง Limit: เข้าทาง #limit-desk บนจอ 320×568 แบบสัมผัส ส่งคำสั่งแล้วเดินเวลา ตรวจ axe และความกว้างหน้าจอ
async function verifyLimitDesk(browser, url, axeScript) {
  const problems = [];
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}#limit-desk`);
    try { await page.evaluate(require('./browser-check-limit-desk.js'), 'hash'); }
    catch (error) { throw new Error('browser-check-limit-desk.js hash', { cause: error }); }
    if (axeScript) problems.push(...await axe(page, axeScript, 'W5R5 limit desk'));
    if (errors.length) throw new Error(`limit desk hash entry: ${errors.join(', ')}`);
    console.log('browser-check-limit-desk.js: #limit-desk on 320px passed');
  } finally {
    await context.close();
  }
  return problems;
}

async function withGameServer(run, basePath = '/') {
  const server = http.createServer((req, res) => respond(req, res, basePath));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { return await run(`http://127.0.0.1:${server.address().port}${basePath}`); }
  finally { server.close(); }
}

async function main() {
  const [modules, mode] = process.argv.slice(2);
  if (!modules || (mode && mode !== '--play-only')) {
    throw new Error('Usage: node tools/run-browser-check.js <node_modules path> [--play-only]');
  }
  const modulesPath = path.resolve(modules);
  const dependency = (entry) => path.join(modulesPath, entry);
  const { chromium } = require(dependency('playwright'));
  const axeScript = mode ? null : dependency('axe-core/axe.min.js');
  process.chdir(os.tmpdir());
  const problems = await withGameServer(async (url) => {
    const browser = await chromium.launch({ args: chromeArgs });
    let checks;
    try {
      await verifyCheckoutRetry(browser, url);
      checks = await verifyGame(browser, url, axeScript);
      checks.push(...await withGameServer((appUrl) => verifyApp(browser, appUrl, axeScript), '/grocery-sim-training/'));
      checks.push(...await verifyShelfWalk(browser, url, axeScript));
      checks.push(...await verifyObserveWalk(browser, url, axeScript));
      checks.push(...await verifyW4R3Walk(browser, url, axeScript));
      await phasedScenario(browser, url, 'browser-check-w4.js', ['seed', 'exercise', 'reload']);
      await phasedScenario(browser, url, 'browser-check-worksheets.js', ['exercise', 'reload']);
      checks.push(...await verifyReportDesk(browser, url, axeScript));
      await phasedScenario(browser, url, 'browser-check-report-desk.js', ['states', 'reload']);
      checks.push(...await verifyLimitDesk(browser, url, axeScript));
      await phasedScenario(browser, url, 'browser-check-limit-desk.js', ['states', 'reload']);
    }
    finally { await browser.close(); }
    if (!mode) checks.push(...await lighthouse(url, dependency('lighthouse/cli/index.js'), chromium));
    return checks;
  });
  if (problems.length) throw new Error(problems.join('\n'));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { axe, lighthouse, withGameServer };
