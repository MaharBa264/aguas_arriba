// Page controls and the state they share with the scene. Loaded after
// cast-model.js and before river.js, which draws whatever this state describes.
const Controls = (() => {
  const el = id => document.getElementById(id);
  const idx = id => el(id).selectedIndex;
  const canvas = document.querySelector('canvas');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const fly = {
    // Each entry: label, then the options. Index 1 is the default where noted below.
    gear: {
      rod: ['Largo de caña', '7,5 pies', '9 pies', '10 pies'],
      weight: ['Clase de caña y línea', '#3', '#5', '#7'],
      reel: ['Reel (solo cambia el dibujo)', 'Bobina estándar', 'Bobina de eje grande'],
      line: ['Perfil de línea flotante', 'Peso adelantado (WF)', 'Doble cono (DT)'],
      leader: ['Largo del líder', '7,5 pies', '9 pies', '12 pies'],
      tip: ['Tippet', '3X', '5X', '6X']
    },
    middleByDefault: ['rod', 'weight', 'leader', 'tip'],
    // Indexed by CastModel.phaseAt.
    phases: ['Levante', 'Golpe atrás', 'Pausa atrás', 'Golpe adelante', 'Presentación'],
    hints: ['Elevá la punta para despegar la línea.', 'Acelerá hacia atrás y detené la caña.', 'La caña se detuvo. El bucle todavía viaja.', 'Acelerá adelante y volvé a detener la punta.', 'Seguí el líder hasta donde posa la mosca.']
  };
  for (const [id, [label, ...options]] of Object.entries(fly.gear)) {
    const wrapper = document.createElement('label'), select = document.createElement('select');
    wrapper.textContent = label;
    select.id = id;
    options.forEach(option => select.add(new Option(option)));
    if (fly.middleByDefault.includes(id)) select.selectedIndex = 1;
    wrapper.append(select);
    el('gear').append(wrapper);
  }

  // [yaw, elevation] in radians.
  const views = {oblique: [.27, .19], side: [0, .09], rear: [-1.39, .27], above: [.10, 1.23], detail: [.36, .14]};
  const zoomRange = [+el('zoom').min, +el('zoom').max];
  // progress runs from 0 to 1 over the current cast.
  const state = {progress: 0, playing: false, yaw: 0, elevation: .09, zoom: 1, detail: false};
  let cast = null;

  const time = () => cast ? state.progress * cast.duration : 0;
  const settings = () => ({
    rod: idx('rod'), line: idx('line'), weight: idx('weight'), leader: idx('leader'), tip: idx('tip'),
    wind: +el('wind').value, dir: +el('dir').value * Math.PI / 180, gust: el('gust').checked
  });

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function sync() {
    const t = time(), phase = cast ? CastModel.phaseAt(t, cast.timing) : 0;
    let label = fly.phases[phase], hint = fly.hints[phase];
    if (cast && cast.landing && t >= cast.landing.time) { label = 'La mosca toca el agua'; hint = 'La onda marca el punto de contacto.'; }
    setText(el('phase'), label);
    setText(el('hint'), hint);
    el('time').value = state.progress * 1000;
    el('time').setAttribute('aria-valuetext', `${t.toFixed(1).replace('.', ',')} segundos, ${label}`);
    setText(el('playIcon'), state.playing ? '❚❚' : '▶');
    setText(el('playText'), state.playing ? 'Pausa' : 'Reproducir');
  }

  // A new simulation keeps the instant on screen, so calm and wind can be compared.
  function setCast(next) {
    const t = time(), atEnd = state.progress >= 1;
    cast = next;
    if (!atEnd) state.progress = clamp(t / cast.duration, 0, 1);
    sync();
  }
  function seek(seconds) { state.progress = clamp(seconds / cast.duration, 0, 1); }
  function setView(key) {
    state.detail = key === 'detail';
    [state.yaw, state.elevation] = views[key];
    el('view').value = key;
  }
  function setZoom(value) {
    state.zoom = clamp(value, ...zoomRange);
    el('zoom').value = state.zoom;
  }

  el('play').onclick = () => {
    if (state.progress >= 1) state.progress = 0;
    state.playing = !state.playing;
    sync();
  };
  el('time').oninput = event => { state.playing = false; state.progress = event.target.value / 1000; sync(); };
  el('view').onchange = event => setView(event.target.value);
  el('zoom').oninput = event => setZoom(+event.target.value);
  el('puntano').onclick = () => {
    el('wind').value = 32;
    el('dir').value = 90;
    el('gust').checked = el('dust').checked = true;
    el('note').textContent = ' Para el compadre.';
  };

  // Chapter buttons take the scene to the instant their text describes. The instants come
  // from the cast on screen, because the caster waits for the line before going forward.
  const moments = {
    start: () => 0,
    pause: () => cast.timing.pause,
    presentation: () => cast.timing.front[1] + .4,
    end: () => cast.duration
  };
  for (const button of document.querySelectorAll('[data-moment]')) {
    button.onclick = () => {
      const {moment, view, rate} = button.dataset;
      if (view) setView(view);
      if (rate) el('rate').value = rate;
      seek(moments[moment]());
      state.playing = 'play' in button.dataset;
      sync();
    };
  }

  // One pointer orbits the camera, two pointers pinch to zoom. The canvas keeps
  // touch-action:pan-y, so a vertical swipe still scrolls the page.
  const pointers = new Map();
  let drag = null, pinch = null;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
  function startGesture() {
    drag = pinch = null;
    if (pointers.size === 1) { const [[x, y]] = pointers.values(); drag = {x, y, yaw: state.yaw, elevation: state.elevation}; }
    if (pointers.size === 2) pinch = {spread: spread(), zoom: state.zoom};
  }
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    startGesture();
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinch) setZoom(pinch.zoom * spread() / pinch.spread);
    else if (drag) {
      state.yaw = drag.yaw - (event.clientX - drag.x) * .009;
      state.elevation = clamp(drag.elevation + (event.clientY - drag.y) * .008, .035, 1.48);
      el('view').value = 'free';
    }
  });
  for (const type of ['pointerup', 'pointercancel']) {
    canvas.addEventListener(type, event => { pointers.delete(event.pointerId); startGesture(); });
  }
  // Ctrl + wheel, which is also how a trackpad pinch arrives. A plain wheel scrolls the page.
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setZoom(state.zoom * Math.exp(-event.deltaY * .01));
  }, {passive: false});

  return {el, idx, canvas, state, time, settings, sync, setCast, setView};
})();
