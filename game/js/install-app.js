/* Installation is optional. A browser tab remains a normal game session. */
(function () {
  const game = document.querySelector('#app');
  const menu = document.createElement('details');
  menu.id = 'install-app';
  menu.className = 'install-app';
  menu.innerHTML = `<summary>ติดตั้งและเล่นออฟไลน์</summary>
    <div class="install-app-body">
      <p id="install-app-help"></p>
      <button type="button" class="btn primary" id="install-app-button" hidden>ติดตั้งเกม</button>
      <p class="install-app-status" id="install-app-status" role="status"></p>
    </div>`;
  const footer = document.createElement('footer');
  footer.append(menu);
  game.after(footer);

  const help = menu.querySelector('#install-app-help');
  const button = menu.querySelector('#install-app-button');
  const status = menu.querySelector('#install-app-status');
  const standalone = matchMedia('(display-mode: standalone)');
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvent;
  let installed = false;

  function showHelp() {
    const inApp = standalone.matches || navigator.standalone === true;
    button.hidden = !installEvent || installed || inApp;
    help.hidden = inApp || installed;
    if (!window.isSecureContext) {
      help.textContent = 'ลิงก์พรีวิวนี้ใช้ลองเล่นผ่าน Wi‑Fi เปิดเว็บเกมผ่าน HTTPS เพื่อติดตั้งและเตรียมเล่นออฟไลน์';
    } else if (apple) {
      help.textContent = 'บน iPhone หรือ iPad เปิดเกมใน Safari แตะ แชร์ → เพิ่มไปยังหน้าจอโฮม เปิด “เปิดเป็นเว็บแอป” ถ้ามี แล้วแตะ เพิ่ม';
    } else if (!button.hidden) {
      help.textContent = 'ติดตั้งเพื่อเปิดเกมจากไอคอนและเล่นได้โดยไม่ต้องเปิดแท็บเบราว์เซอร์';
    } else {
      help.textContent = 'บน Android เปิดเมนู Chrome → เพิ่มไปยังหน้าจอหลัก → ติดตั้ง หรือใช้เมนูติดตั้งแอปในเบราว์เซอร์ที่รองรับ';
    }
  }

  function showStatus(state, message) {
    status.dataset.state = state;
    status.textContent = message;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    showHelp();
  });

  button.addEventListener('click', async () => {
    const prompt = installEvent;
    if (!prompt) return;
    installEvent = undefined;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') installed = true;
    } catch {
      // The browser menu still provides installation when the prompt expires.
    } finally {
      const returnFocus = document.activeElement === button;
      showHelp();
      if (returnFocus) menu.querySelector('summary').focus();
    }
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    installEvent = undefined;
    showHelp();
  });
  standalone.addEventListener?.('change', showHelp);
  showHelp();

  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    showStatus('unavailable', 'เปิดเล่นผ่านเบราว์เซอร์ได้ตามปกติ');
    return;
  }

  async function prepareOffline() {
    showStatus('loading', 'กำลังเตรียมบทเรียนและฉากเดินไว้เล่นออฟไลน์…');
    try {
      const registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      const showUpdate = () => showStatus('update', 'มีรุ่นใหม่ บันทึกผลแล้วปิดหน้าต่างเกมทุกหน้าก่อนเปิดอีกครั้ง');
      const watchInstall = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          if (worker.state === 'redundant' && !registration.active) {
            showStatus('unavailable', 'เตรียมเกมออฟไลน์ไม่สำเร็จ ลองเปิดใหม่เมื่อเชื่อมต่ออินเทอร์เน็ต');
          }
        });
      };
      registration.addEventListener('updatefound', () => watchInstall(registration.installing));
      watchInstall(registration.installing);
      await navigator.serviceWorker.ready;
      menu.dataset.offlineReady = 'true';
      if (registration.waiting) showUpdate();
      else showStatus('ready', 'พร้อมเล่นบทเรียนและฉากเดินออฟไลน์ ลิงก์ประกอบภายนอกใช้การเชื่อมต่ออินเทอร์เน็ต');
    } catch {
      showStatus('unavailable', 'เตรียมเกมออฟไลน์ไม่สำเร็จ ลองเปิดใหม่เมื่อเชื่อมต่ออินเทอร์เน็ต');
    }
  }

  function scheduleOffline() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(prepareOffline, { timeout: 1500 });
    else setTimeout(prepareOffline, 0);
  }
  if (document.readyState === 'complete') scheduleOffline();
  else window.addEventListener('load', scheduleOffline, { once: true });
})();
