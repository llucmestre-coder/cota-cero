/* ════════════════════════════════════════════════════════════════
   COTA CERO — la maqueta del pis a la home (peça 4; en Lluc, 24 i 26/10/2026).
   El mateix 3D del panell (js/pis3d.js) es munta amb l'scroll: el terra i les cotes mentre la secció entra, les
   parets com a línies del plànol que després s'aixequen, els mobles estança per estança, i la càmera baixa de la
   planta a la vista del pis. Després gira molt a poc a poc i es pot arrossegar en horitzontal. Un clic porta al panell.
   Three.js es baixa quan la secció és a una pantalla; abans, i sense WebGL o amb moviment reduït, la imatge fixa
   (una captura d'aquest mateix 3D). A la home només hi ha aquest 3D viu: la cuina i el bany són imatges.
   ════════════════════════════════════════════════════════════════ */
const RITME = 1;            // pantalles d'scroll amb la maqueta fixa (en Lluc, 26/10/2026: 1 pantalla)
const GIR = .2;             // gir sol: radians cap a cada costat
const PERIODE = 28000;      // gir sol: ms d'una anada i tornada

const I18N = window.I18N || { t: s => s };
const sec = document.querySelector('.maqueta');
const render = sec && sec.querySelector('.maqueta-render');
const QUIET = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TACTIL = !matchMedia('(hover: hover)').matches;
const MOBIL = matchMedia('(max-width: 760px)').matches;
const PROVA = new URLSearchParams(location.search).has('prova');

/* El pis amb què s'obre el panell: 2 dormitoris i 1 bany, tot marcat, estil «Luz de norte» (js/panell.js) */
const ZONES = [['salon', 'salon', 20], ['cocina', 'cocina', 9], ['pasillo', 'pasillo', 9.5], ['dorm1', 'dorm', 13], ['bano1', 'bano', 5], ['dorm2', 'dorm', 10]];
const FONS = ['dorm1', 'bano1', 'dorm2'];
const OPCIONS = { suelo: 'porcelanico', sueloB: 'rajola', ventanas: false, armario: false, forma: 'lineal', tipo: 'ducha' };

function teWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/* ── Cuina i bany: «Antes» amb el ratolí a sobre (CSS). Al tàctil, «Antes» passa sol al després quan la targeta arriba
   al mig de la pantalla (en Lluc, 26/10/2026) ── */
const cases = document.querySelectorAll('.casa');
if (TACTIL && !QUIET && 'IntersectionObserver' in window) {
  cases.forEach(k => k.classList.add('casa-abans'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    setTimeout(() => e.target.classList.remove('casa-abans'), 500);
  }), { rootMargin: '-35% 0px -35% 0px' });
  cases.forEach(k => io.observe(k));
}

if (sec) {
  sec.style.setProperty('--ritme', RITME);
  if (TACTIL) sec.querySelector('.maqueta-crida').textContent = I18N.t('Toca para diseñar tu reforma');
  if (QUIET || !teWebGL()) sec.classList.add('maqueta-quieta');
  else {
    // Three.js només quan la secció és a una pantalla (la xarxa no en baixa res abans)
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); munta(); } }, { rootMargin: '100% 0px' }).observe(sec);
  }
}

let P3, THREE, renderer, scene, camera, canvas, pis, mida = 10, v = null, visible = false, brut = true;
let parets = [], terres = [], mobles = [], cotes = [];
let dAz = 0, arr = null, mogut = false, pAbans = -1, azAbans = 0, fixat = null;

async function munta() {
  try {
    P3 = await import('./pis3d.js?v=20261026a');
    THREE = await P3.carregaThree();
  } catch (e) { sec.classList.add('maqueta-quieta'); return; }
  await new Promise(r => setTimeout(r));   // cedeix el fil entre carregar i muntar l'escena
  canvas = document.createElement('canvas');
  canvas.className = 'maqueta-3d'; canvas.setAttribute('aria-hidden', 'true');
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBIL, alpha: true, powerPreference: MOBIL ? 'low-power' : 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer || !renderer.getContext()) { sec.classList.add('maqueta-quieta'); return; }
  // Al mòbil, més lleuger: sense antialiàsing, densitat 1, ombres sense suavitzar i mapa d'ombres petit
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBIL ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = MOBIL ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const esc = P3.iniciaEscena(renderer, MOBIL);
  // El tall de la maqueta, després de l'entorn: si hi era abans, tallava els llums del sostre de RoomEnvironment i
  // tot sortia més fosc que al panell
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), P3.HM + .06)];
  scene = esc.scene; scene.environmentIntensity = .55;    // de dia, com el panell
  camera = new THREE.PerspectiveCamera(30, 1, .1, 200);

  const zones = new Map(ZONES.map(([id, tipus, m2]) => [id, { id, tipus, opts: { ...OPCIONS, m2 } }]));
  pis = P3.creaPis({ zones, dorm: 2, fons: FONS, mobles: z => (P3.MOBLES[z.tipus] ? P3.MOBLES[z.tipus]() : null) });
  for (const z of zones.values()) if (z.tipus === 'bano') { const t = P3.materialsZona(z).terra; t.map = P3.tex('rajolaTerra', .8); t.needsUpdate = true; }
  const L = P3.distribucio(id => zones.get(id).opts.m2, FONS);
  P3.aplicaPis(pis, L, FONS, null, id => zones.get(id).opts);
  Object.values(pis.zones).forEach(o => { o.vel.visible = false; });   // tot marcat: cap estança fosca
  scene.add(pis.grup);
  mida = Math.max(L.W, L.D);
  const c = esc.sol.shadow.camera, s = mida / 2 + 3;
  c.left = c.bottom = -s; c.right = c.top = s; c.far = 50; c.updateProjectionMatrix();

  // Les peces que es munten, amb la mida i la posició finals
  const linies = Object.values(pis.linies).flatMap(l => (Array.isArray(l) ? l : [l]));
  parets = linies.flatMap(l => [...l.trams, ...l.forats.flatMap(f => [f.ampit, f.vidre, f.marc])]).map(m => ({ m, sy: m.scale.y, py: m.position.y, vis: m.visible }));
  const zs = Object.values(pis.zones);
  terres = [pis.base, ...zs.map(o => o.terra)].map(m => ({ m, sx: m.scale.x, sz: m.scale.z }));
  mobles = zs.filter(o => o.mobles).map(o => o.mobles.grup);
  cotes = [...pis.cotes.x, ...pis.cotes.z].map(m => ({ m, vis: m.visible }));

  render.insertBefore(canvas, render.firstChild);
  encaixa();
  new ResizeObserver(encaixa).observe(canvas);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(sec);
  renderer.setAnimationLoop(fotograma);
  sec.classList.add('maqueta-viva');
  // Proves automàtiques (?prova): fixar el progrés i el gir per a les captures. Sense ?prova no hi ha res.
  if (PROVA) window.__maqueta = {
    fixa: (p, az = 0) => { fixat = [p, az]; brut = true; }, allibera: () => { fixat = null; }, renderer, scene, pis, camera: () => camera,
    // La imatge fixa (assets/img/maqueta/pis*.webp) surt d'aquí: el canvas mateix, a la densitat que es demana
    captura: (densitat) => {
      renderer.setPixelRatio(densitat); encaixa(); posa(1, 0); renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      renderer.setPixelRatio(Math.min(devicePixelRatio, MOBIL ? 1 : 1.75)); encaixa();
      return url;
    },
  };
}

function encaixa() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  v = P3.vista('pis', mida, w / h);
  brut = true;
}

/* El progrés comença quan la secció entra per baix (el plànol es dibuixa mentre puja) i acaba quan el seu final arriba
   a baix de la pantalla */
function progres() {
  const r = sec.getBoundingClientRect();
  return Math.min(1, Math.max(0, (innerHeight - r.top) / r.height));
}
const tram = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const suau = k => k * k * (3 - 2 * k);

/* 0–.3 el terra (cada estança surt del seu centre) i les cotes · .14 les parets, com les línies del plànol ·
   .34–.62 les parets s'aixequen · .6–.85 els mobles, estança per estança · la càmera baixa de la planta tot el tram */
function posa(p, az) {
  terres.forEach((o, i) => {
    const k = Math.max(.001, suau(tram(p, i ? .03 + i * .025 : 0, i ? .17 + i * .025 : .1)));
    o.m.scale.x = o.sx * k; o.m.scale.z = o.sz * k;
  });
  cotes.forEach(o => { o.m.visible = o.vis && p > .12; });
  const kp = p < .14 ? 0 : .03 + .97 * suau(tram(p, .34, .62));
  parets.forEach(o => { o.m.scale.y = o.sy * Math.max(.001, kp); o.m.position.y = o.py * kp; o.m.visible = o.vis && kp > .002; });
  mobles.forEach((g, i) => { const k = suau(tram(p, .6 + i * .03, .74 + i * .03)); g.scale.y = Math.max(.001, k); g.visible = k > .002; });
  const kc = suau(tram(p, .05, .92)), lluny = MOBIL ? 1.24 : 1.1;   // prou lluny perquè el pis no toqui les vores de la seva capsa
  camera.position.copy(P3.puntVista({ t: v.t, r: v.r * lluny * (1.32 - .32 * kc), pol: .22 + (v.pol - .22) * kc, az: v.az - .7 * (1 - kc) + az }));
  camera.lookAt(v.t);
}

function fotograma(t) {
  if (!visible && !fixat) return;
  let p, az;
  if (fixat) [p, az] = fixat;
  else {
    p = progres();
    const k = suau(tram(p, .88, 1));                        // el gir sol entra quan el pis ja és muntat
    az = dAz + Math.sin(t / PERIODE * 2 * Math.PI) * GIR * k;
  }
  if (!brut && Math.abs(p - pAbans) < 1e-4 && Math.abs(az - azAbans) < 1e-4) return;   // res no ha canviat: no es pinta
  pAbans = p; azAbans = az; brut = false;
  posa(p, az);
  renderer.render(scene, camera);
}

if (sec) {
  // La invitació surt quan el pis és muntat
  addEventListener('scroll', () => { sec.classList.toggle('maqueta-feta', progres() > .9); }, { passive: true });
  sec.classList.toggle('maqueta-feta', progres() > .9);

  // Arrossegar: només en horitzontal (la vertical és l'scroll de la pàgina, també al mòbil). Un clic sense arrossegar
  // segueix l'enllaç cap al panell.
  render.addEventListener('pointerdown', e => { arr = { x: e.clientX, az: dAz }; mogut = false; });
  addEventListener('pointermove', e => {
    if (!arr) return;
    const dx = e.clientX - arr.x;
    if (Math.abs(dx) > 6) mogut = true;
    if (mogut) dAz = Math.max(-1.1, Math.min(1.1, arr.az - dx * .006));
  });
  addEventListener('pointerup', () => { arr = null; });
  addEventListener('pointercancel', () => { arr = null; });
  render.addEventListener('click', e => { if (mogut) { e.preventDefault(); mogut = false; } });
  render.addEventListener('dragstart', e => e.preventDefault());
}
