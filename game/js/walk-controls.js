/* walk-controls.js — keyboard, touch pad, and drag-to-turn input shared by the first-person store missions. */
(function () {
  const M = (window.MTL = window.MTL || {});
  const { $$ } = M;
  const direction = {
    forward: [1, 0, 0], back: [-1, 0, 0], left: [0, -1, 0], right: [0, 1, 0],
    'turn-left': [0, 0, -1], 'turn-right': [0, 0, 1],
  };
  const keyMoves = {
    ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyQ: 'turn-left', KeyR: 'turn-right',
  };
  const HOLD_MS = 180, NUDGE = 0.26;

  const button = (move, glyph, label) => '<button type="button" class="btn" data-move="' + move + '" aria-label="' + label +
    '" title="' + label + '"><span aria-hidden="true">' + glyph + '</span></button>';
  const pad = () => '<div class="walk-pad" role="group" aria-label="เดินและหัน">' +
    button('turn-left', '↶', 'หันซ้าย') + button('forward', '↑', 'เดินหน้า') + button('turn-right', '↷', 'หันขวา') +
    button('left', '←', 'เดินซ้าย') + button('back', '↓', 'ถอยหลัง') + button('right', '→', 'เดินขวา') + '</div>';

  // root: element that receives key events · viewport: focusable canvas wrapper
  // paused(): true while a form or panel replaces walking · onMove(): after each redraw · onInteract(): E, Enter on viewport, or tap
  function attach({ root, viewport, scene, paused = () => false, onMove = () => {}, onInteract = () => {} }) {
    let closed = false, frame, last = 0, hold, drag, queueTime = 0, queued = [];
    const pressed = new Set();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stop = () => { pressed.clear(); queued = []; queueTime = 0; hold = null; drag = null; };
    const moved = () => { scene.draw(); onMove(); };

    function renderFrame(now) {
      if (closed) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      if (!paused()) {
        const moves = [...pressed].map((key) => keyMoves[key]);
        if (hold && now - hold.start > HOLD_MS) moves.push(hold.move);
        if (moves.length) {
          const vector = [0, 0, 0];
          for (const move of new Set(moves)) direction[move].forEach((value, i) => { vector[i] += value; });
          const [forward, strafe, turn] = vector.map(Math.sign);
          scene.step(forward, strafe, turn, dt);
          moved();
        } else if (queued.length) {
          const time = Math.min(dt, NUDGE - queueTime);
          scene.step(...direction[queued[0]], time);
          queueTime += time;
          if (queueTime >= NUDGE) { queued.shift(); queueTime = 0; }
          moved();
        }
      }
      frame = requestAnimationFrame(renderFrame);
    }
    const nudge = (move) => {
      if (paused()) return;
      if (reducedMotion) {
        scene.step(...direction[move], NUDGE);
        moved();
      } else if (queued.length < 8) queued.push(move);
    };

    for (const control of $$('[data-move]', root)) {
      const move = control.dataset.move;
      control.onclick = (event) => { if (event.detail === 0) nudge(move); };
      control.onpointerdown = (event) => {
        if (event.button !== 0 || hold) return;
        hold = { id: event.pointerId, move, start: performance.now() };
        control.setPointerCapture(event.pointerId);
      };
      const release = (event) => {
        if (hold?.id !== event.pointerId) return;
        if (event.type === 'pointerup' && performance.now() - hold.start <= HOLD_MS) nudge(move);
        hold = null;
      };
      control.onpointerup = control.onpointercancel = control.onlostpointercapture = release;
    }

    viewport.onpointerdown = (event) => {
      if (event.button !== 0) return;
      viewport.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, origin: event.clientX, moved: false };
      viewport.setPointerCapture(event.pointerId);
    };
    viewport.onpointermove = (event) => {
      if (drag?.id !== event.pointerId || paused()) return;
      drag.moved ||= Math.abs(event.clientX - drag.origin) > 5;
      const dx = event.clientX - drag.x;
      drag.x = event.clientX;
      if (drag.moved && dx) {
        scene.step(0, 0, Math.sign(dx), Math.min(0.18, Math.abs(dx) * 0.005));
        moved();
      }
    };
    const endDrag = (event) => {
      if (drag?.id !== event.pointerId) return;
      const tap = !drag.moved && event.type === 'pointerup';
      drag = null;
      if (tap) onInteract();
    };
    viewport.onpointerup = viewport.onpointercancel = viewport.onlostpointercapture = endDrag;

    root.onkeydown = (event) => {
      if (paused() || event.ctrlKey || event.altKey || event.metaKey) return;
      if (keyMoves[event.code]) {
        // Arrow keys still move a focused radio group or text field instead of the camera.
        if (event.target.matches?.('input, select, textarea')) return;
        event.preventDefault();
        pressed.add(event.code);
      } else if ((event.code === 'KeyE' || (event.code === 'Enter' && event.target === viewport)) && !event.repeat) {
        event.preventDefault();
        onInteract();
      }
    };
    root.onkeyup = (event) => pressed.delete(event.code);
    root.onfocusout = (event) => { if (!root.contains(event.relatedTarget)) stop(); };
    window.addEventListener('blur', stop);
    frame = requestAnimationFrame(renderFrame);

    return {
      stop, nudge,
      destroy() {
        closed = true;
        stop();
        cancelAnimationFrame(frame);
        window.removeEventListener('blur', stop);
        root.onkeydown = root.onkeyup = root.onfocusout = null;
      },
    };
  }

  M.WalkControls = { pad, attach };
})();
