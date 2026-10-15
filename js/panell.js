/* ════════════════════════════════════════════════════════════════
   PANELL «Diseña tu reforma» — el pis en maqueta 3D (Three.js) i el
   preu tancat. S'entra veient el pis apagat: es toquen les zones que
   es volen reformar (a la maqueta o a la llista) i s'encenen; cada
   zona té el seu editor (m², acabats). La cuina i el bany es poden
   veure per dins. El preu i el panell funcionen encara que WebGL falli.
   Res de fotos: tot és geometria i textures dibuixades aquí.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from '../assets/js/three/OrbitControls.js';
import { RoomEnvironment } from '../assets/js/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../assets/js/three/RoundedBoxGeometry.js';

// Textos del JS: I18N.t amb la frase castellana escrita literal (js/i18n.js). Sense i18n, queda el castellà.
const I18N = window.I18N || { t: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (tot, k) => v[k] ?? tot) : s) };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const QUIET = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBIL = matchMedia('(max-width: 860px)').matches;

/* ═══ 1. PREUS (euros, IVA inclòs) ═══════════════════════════════ */
const PREUS = {
  // `obra` és €/m²; les claus amb `/m2` es multipliquen pels m² de la zona.
  cocina: {
    obra: 210,
    forma: { lineal: 5800, l: 7400, isla: 9900 },
    frente: { roble: 900 },
    encimera: { cuarzo: 1450, marmol: 2900 },
    'suelo/m2': { espiga: 95, microcemento: 75 },
    paquete: { completa: 2300, llave: 4100 },
    setmanes: { esencial: 3, completa: 3, llave: 4 },
  },
  bano: {
    obra: 380,
    tipo: { ducha: 3400, banera: 3000 },
    'pared/m2': { verde: 90, cobalto: 90, micro: 160 },
    mueble: { roble: 350 },
    paquete: { completa: 1400, llave: 2300 },
    setmanes: { esencial: 2, completa: 2, llave: 3 },
  },
  estancia: {       // dormitoris, saló i passadís
    obra: 15,       // protecció, retirada i neteja
    'suelo/m2': { porcelanico: 55, espiga: 85, microcemento: 75 },
    'paredes/m2': { pintar: 22, alisar: 48 },
    armario: 1400,
    ventana: 900,
  },
};

/* ═══ 2. EL PIS: zones, m² i opcions ═════════════════════════════ */
const FORM_DE = { salon: 'estancia', pasillo: 'estancia', dorm: 'estancia', cocina: 'cocina', bano: 'bano' };
const RANG = { salon: [14, 40, .5], dorm: [7, 20, .5], cocina: [6, 30, 1], bano: [4, 12, .5] };
const forms = Object.fromEntries($$('.pn-opcions').map(f => [f.dataset.per, f]));
const st = { dorm: 2, banos: 1, zones: new Map(), activa: null, vista: 'pis' };

function opcionsInicials(tipus, n) {
  if (tipus === 'cocina') return { m2: 9, forma: 'lineal', frente: 'blanco', encimera: 'roble', suelo: 'porcelanico', paquete: 'esencial' };
  if (tipus === 'bano') return { m2: 5, tipo: 'ducha', pared: 'blanco', mueble: 'roble', paquete: 'esencial' };
  const m2 = tipus === 'salon' ? 20 : tipus === 'dorm' ? (n === 1 ? 13 : 10) : 8;
  return { m2, suelo: 'porcelanico', paredes: 'pintar', armario: false, ventanas: false };
}
/* Ordre de la franja del fons: dormitori principal, bany, dormitoris, bany... */
function ordreFons() {
  const ids = [], banys = [];
  for (let i = 1; i <= st.banos; i++) banys.push('bano' + i);
  for (let i = 1; i <= st.dorm; i++) {
    ids.push('dorm' + i);
    if ((i === 1 || i === 3) && banys.length) ids.push(banys.shift());
  }
  return ids.concat(banys);
}
function idsZones() { return ['salon', 'cocina', 'pasillo', ...ordreFons()]; }
function sincronitzaZones() {
  const ids = idsZones();
  for (const id of [...st.zones.keys()]) if (!ids.includes(id)) st.zones.delete(id);
  for (const id of ids) {
    if (st.zones.has(id)) continue;
    const tipus = id.replace(/\d+$/, ''), n = +(id.match(/\d+$/) || [0])[0];
    st.zones.set(id, { id, tipus, n, on: false, opts: opcionsInicials(tipus, n) });
  }
  if (st.activa && !st.zones.has(st.activa)) st.activa = null;
}
function nomZona(z) {
  if (z.tipus === 'salon') return I18N.t('Salón y comedor');
  if (z.tipus === 'pasillo') return I18N.t('Pasillo y entrada');
  if (z.tipus === 'cocina') return I18N.t('Cocina');
  if (z.tipus === 'dorm') return I18N.t('Dormitorio') + ' ' + z.n;
  return I18N.t('Baño') + (st.banos > 1 ? ' ' + z.n : '');
}
function finestresZona(z) { return z.tipus === 'salon' ? 2 : z.tipus === 'dorm' || z.tipus === 'cocina' ? 1 : 0; }

/* ── Formularis de l'editor (un per tipus de zona) ── */
function llegeixForm(clau) {
  const v = {};
  for (const el of forms[clau].elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
    else if (el.type === 'checkbox') v[el.name] = el.checked;
    else v[el.name] = el.type === 'range' ? +el.value : el.value;
  }
  return v;
}
function escriuForm(clau, o) {
  for (const el of forms[clau].elements) {
    if (!el.name || !(el.name in o)) continue;
    if (el.type === 'radio') el.checked = el.value === String(o[el.name]);
    else if (el.type === 'checkbox') el.checked = !!o[el.name];
    else el.value = o[el.name];
  }
}
/* Nom visible d'una opció: el text de l'etiqueta (així el tradueix i18n.js) */
function nomValor(clau, nom, valor) {
  const inp = $(`input[name="${nom}"][value="${valor}"]`, forms[clau]) || $(`input[name="${nom}"]`, forms[clau]);
  if (!inp) return '';
  const lab = inp.closest('label');
  return ($('b', lab) || $('.visually-hidden', lab) || lab).textContent.trim();
}
function nomGrup(clau, nom) {
  const inp = $(`input[name="${nom}"]`, forms[clau]);
  const lg = inp && $('legend', inp.closest('fieldset'));
  return lg ? lg.firstChild.textContent.trim() : '';
}

function fmtNum(n) { const s = String(Math.round(n * 10) / 10); return document.documentElement.lang === 'en' ? s : s.replace('.', ','); }
function eur(n) {
  const lang = document.documentElement.lang || 'es';
  const sep = lang === 'en' ? ',' : '.';
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return lang === 'en' ? '€' + s : s + ' €';
}

/* ── Preu d'una zona ── */
function preuZona(z) {
  const clau = FORM_DE[z.tipus], P = PREUS[clau], o = z.opts, m2 = o.m2;
  let total = m2 * P.obra, setm;
  const detalls = [];
  if (clau === 'estancia') {
    total += (P['suelo/m2'][o.suelo] || 0) * m2 + (P['paredes/m2'][o.paredes] || 0) * m2;
    detalls.push(`${nomGrup(clau, 'suelo')}: ${nomValor(clau, 'suelo', o.suelo)}`, `${nomGrup(clau, 'paredes')}: ${nomValor(clau, 'paredes', o.paredes)}`);
    if (o.armario && z.tipus === 'dorm') { total += P.armario; detalls.push(nomValor(clau, 'armario')); }
    if (o.ventanas && finestresZona(z)) { total += P.ventana * finestresZona(z); detalls.push(nomValor(clau, 'ventanas')); }
    setm = 1 + (o.paredes === 'alisar' ? 1 : 0);
  } else {
    for (const [k, taula] of Object.entries(P)) {
      if (k === 'setmanes' || k === 'obra') continue;
      const [nom, perM2] = k.split('/');
      total += (taula[o[nom]] || 0) * (perM2 ? m2 : 1);
      detalls.push(nomValor(clau, nom, o[nom]));
    }
    setm = P.setmanes[o.paquete] + (m2 > (clau === 'cocina' ? 18 : 8) ? 1 : 0);
  }
  return { total: Math.round(total), detalls, setm };
}
function calcula() {
  const triades = [...st.zones.values()].filter(z => z.on);
  const linies = triades.map(z => { const p = preuZona(z); return [`${nomZona(z)} · ${fmtNum(z.opts.m2)} m²`, p.total, p, z]; });
  const setm = linies.map(l => l[2].setm).sort((a, b) => b - a);
  const setmanes = setm.length ? setm[0] + Math.ceil(setm.slice(1).reduce((a, b) => a + b, 0) * .5) : 0;
  return { total: linies.reduce((a, l) => a + l[1], 0), linies, setmanes, triades };
}

/* ── Pintar el panell ── */
const elTotal = $('[data-total]');
const elZones = $('[data-zones]'), elEditor = $('[data-editor]');
let totalVist = null;
function pintaPanell() {
  const r = calcula();
  // Llista de zones (alternativa a tocar la maqueta; també per a teclat)
  elZones.innerHTML = [...st.zones.values()].map(z =>
    `<button type="button" class="pn-zona${st.activa === z.id ? ' activa' : ''}" data-zona="${z.id}" aria-pressed="${z.on}">`
    + `<span class="pn-zona-nom">${nomZona(z)}</span><span class="pn-zona-m2">${fmtNum(z.opts.m2)} m²</span></button>`).join('');
  $('[data-tot]').hidden = r.triades.length === st.zones.size;
  $$('[data-compte]').forEach(o => { o.textContent = st[o.dataset.compte]; });
  $$('[data-compta]').forEach(b => {
    const k = b.dataset.compta, max = k === 'dorm' ? 5 : 3;
    b.disabled = +b.dataset.pas < 0 ? st[k] <= 1 : st[k] >= max;
  });
  // Editor de la zona activa: noms triats al costat de cada títol
  const z = st.activa && st.zones.get(st.activa);
  if (z) {
    const clau = FORM_DE[z.tipus];
    $('[data-editor-nom]').textContent = nomZona(z);
    $('[data-incloure]').checked = z.on;
    $$(`output[data-tria^="${clau}."]`).forEach(o => {
      const nom = o.dataset.tria.split('.')[1];
      o.textContent = nom === 'm2' ? fmtNum(z.opts.m2) + ' m²' : nomValor(clau, nom, z.opts[nom]);
    });
  }
  // Partides i total
  $('[data-partides]').innerHTML = r.linies.length
    ? r.linies.map(([t, n]) => `<li><span>${t}</span><span>${eur(n)}</span></li>`).join('')
    : `<li><span>${I18N.t('Todavía no has elegido ninguna zona.')}</span><span></span></li>`;
  animaTotal(r.total);
  pintaEntrega(r.setmanes);
  $$('[data-obre-pdf], [data-whatsapp]').forEach(b => { b.disabled = !r.triades.length; });
  $('[data-cap-zona]').hidden = !!r.triades.length;
  pintaEtiquetes();
  return r;
}

function animaTotal(nou) {
  const vell = totalVist ?? nou;
  totalVist = nou;
  if (vell !== nou) {
    elTotal.classList.toggle('puja', nou > vell);
    clearTimeout(animaTotal.t);
    animaTotal.t = setTimeout(() => elTotal.classList.remove('puja'), 700);
  }
  if (QUIET || vell === nou) { elTotal.textContent = eur(nou); return; }
  const t0 = performance.now(), dur = 420;
  cancelAnimationFrame(animaTotal.raf);
  const pas = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    elTotal.textContent = eur(Math.round((vell + (nou - vell) * e) / 10) * 10);
    if (k < 1) animaTotal.raf = requestAnimationFrame(pas); else elTotal.textContent = eur(nou);
  };
  animaTotal.raf = requestAnimationFrame(pas);
}

/* ── Setmanes d'inici: dilluns a partir de d'aquí a dues setmanes ── */
const elDies = $('[data-setmanes]');
function dataLang() { const l = document.documentElement.lang || 'es'; return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-GB' : 'es-ES'; }
function preparaSetmanes() {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 14);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  const mes = new Intl.DateTimeFormat(dataLang(), { month: 'short' });
  const completa = I18N.t('Completa');
  let html = '';
  for (let i = 0; i < 4; i++) {
    const dd = new Date(d); dd.setDate(d.getDate() + i * 7);
    const ple = i === 1;            // una setmana plena: es veu que l'agenda és real
    html += `<label class="pn-dia"><input type="radio" name="setmana" value="${dd.toISOString().slice(0, 10)}"${i === 0 ? ' checked' : ''}${ple ? ' disabled' : ''}>`
      + `<b>${dd.getDate()}</b><span>${ple ? completa : mes.format(dd).replace('.', '')}</span></label>`;
  }
  elDies.innerHTML = html;
}
function pintaEntrega(setmanes) {
  const inp = $('input[name="setmana"]:checked', elDies);
  if (!inp) return;
  const d = new Date(inp.value + 'T12:00:00'); d.setDate(d.getDate() + Math.max(1, setmanes) * 7);
  $('[data-entrega]').textContent = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long' }).format(d);
  const ini = new Date(inp.value + 'T12:00:00');
  $('output[data-tria="setmana"]').textContent = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long' }).format(ini);
}

/* ── Opcions que no caben en pocs m²: l'illa (16 m²) i la banyera (5 m²) ── */
const MINIMS = {
  cocina: ['forma', 'isla', 16, 'l', () => I18N.t('Una isla necesita 16 m² como mínimo. La hemos cambiado por una cocina en L.')],
  bano: ['tipo', 'banera', 5, 'ducha', () => I18N.t('Una bañera necesita 5 m² como mínimo. La hemos cambiado por una ducha.')],
};
function ajustaMinims(clau, avisa) {
  const r = MINIMS[clau]; if (!r) return;
  const [nom, opcio, min, alternativa, clauAvis] = r, f = forms[clau];
  const inp = $(`input[name="${nom}"][value="${opcio}"]`, f);
  const massaPetit = +f.m2.value < min;
  inp.disabled = massaPetit;
  inp.closest('label').classList.toggle('pn-no-cap', massaPetit);
  if (massaPetit && inp.checked) {
    $(`input[name="${nom}"][value="${alternativa}"]`, f).checked = true;
    if (avisa) {
      const avis = $('[data-avis]', f);
      avis.textContent = clauAvis(); avis.hidden = false;
      clearTimeout(ajustaMinims.t); ajustaMinims.t = setTimeout(() => { avis.hidden = true; }, 5000);
    }
  }
}

/* ── Obrir l'editor d'una zona ── */
function obreEditor(id) {
  st.activa = id;
  const z = id && st.zones.get(id);
  elEditor.hidden = !z;
  if (!z) return;
  const clau = FORM_DE[z.tipus];
  Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== clau; });
  if (RANG[z.tipus]) {
    const [mn, mx, pas] = RANG[z.tipus], rang = forms[clau].m2;
    rang.min = mn; rang.max = mx; rang.step = pas;
    if (clau === 'estancia') { $('[data-rang-min]').textContent = mn + ' m²'; $('[data-rang-max]').textContent = mx + ' m²'; }
  }
  escriuForm(clau, z.opts);
  if (clau === 'estancia') {
    const f = forms.estancia;
    $('[data-camp="m2"]', f).hidden = z.tipus === 'pasillo';
    $('[data-camp="pasillo"]', f).hidden = z.tipus !== 'pasillo';
    $('[data-camp="armario"]', f).hidden = z.tipus !== 'dorm';
    $('[data-camp="ventanas"]', f).hidden = !finestresZona(z);
    $('[data-camp="extres"]', f).hidden = z.tipus === 'pasillo';
  } else ajustaMinims(clau, false);
  $('[data-dins]').hidden = clau === 'estancia';
}


/* ═══ 3. TEXTURES DIBUIXADES ═════════════════════════════════════ */
function aleatori(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const LLENÇ = {};
function llenc(nom, mida, dibuixa) {
  if (LLENÇ[nom]) return LLENÇ[nom];
  const c = document.createElement('canvas'); c.width = c.height = mida;
  dibuixa(c.getContext('2d'), mida, aleatori(nom.length * 7919 + mida));
  return (LLENÇ[nom] = c);
}
function to(hex, dl, r) {   // varia la lluminositat d'un color
  const n = parseInt(hex.slice(1), 16);
  const k = 1 + (r() - .5) * dl;
  const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c.join(',')})`;
}
function veta(g, x, y, w, h, r, vertical) {   // veta de fusta dins d'un rectangle
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const n = Math.round((vertical ? w : h) / 3);
  for (let i = 0; i < n; i++) {
    g.strokeStyle = `rgba(70,40,15,${.04 + r() * .09})`; g.lineWidth = .6 + r() * 1.4;
    g.beginPath();
    const o = (vertical ? x : y) + r() * (vertical ? w : h), a = r() * 3, f = .004 + r() * .01;
    for (let t = 0; t <= (vertical ? h : w); t += 8) {
      const d = Math.sin(t * f + a) * 2.5;
      vertical ? g.lineTo(o + d, y + t) : g.lineTo(x + t, o + d);
    }
    g.stroke();
  }
  g.restore();
}
const DIBUIX = {
  roble: (g, s, r) => {          // taulons al llarg de l'eix x
    const h = s / 6;
    for (let i = 0; i < 6; i++) { g.fillStyle = to('#B98652', .16, r); g.fillRect(0, i * h, s, h); veta(g, 0, i * h, s, h, r, false); g.fillStyle = 'rgba(60,35,15,.25)'; g.fillRect(0, i * h, s, 1); }
  },
  robleV: (g, s, r) => {         // la mateixa fusta, de dalt a baix (frontals)
    const w = s / 4;
    for (let i = 0; i < 4; i++) { g.fillStyle = to('#BE8C58', .1, r); g.fillRect(i * w, 0, w, s); veta(g, i * w, 0, w, s, r, true); }
  },
  espiga: (g, s, r) => {         // espiga (punta d'Hongria), enrajola sense costures
    const cw = s / 4, ph = s / 16, files = s / ph;
    const tons = Array.from({ length: 4 * files }, () => to('#B07A48', .22, r));
    for (let c = 0; c < 4; c++) {
      const x = c * cw, dir = c % 2 ? -1 : 1;
      for (let k = -files - 6; k < files + 6; k++) {
        const y = k * ph;
        g.beginPath();
        if (dir > 0) { g.moveTo(x, y + cw); g.lineTo(x + cw, y); g.lineTo(x + cw, y + ph); g.lineTo(x, y + cw + ph); }
        else { g.moveTo(x, y); g.lineTo(x + cw, y + cw); g.lineTo(x + cw, y + cw + ph); g.lineTo(x, y + ph); }
        g.closePath();
        g.fillStyle = tons[c * files + ((k % files) + files) % files]; g.fill();
        g.strokeStyle = 'rgba(55,32,14,.35)'; g.lineWidth = 1.2; g.stroke();
      }
    }
  },
  cuarzo: (g, s, r) => {
    g.fillStyle = '#ECEAE5'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) { g.fillStyle = r() > .5 ? `rgba(120,118,112,${r() * .25})` : `rgba(255,255,255,${r() * .6})`; g.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5); }
  },
  marmol: (g, s, r) => {
    g.fillStyle = '#1F2123'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(235,235,230,${.08 + r() * .4})`; g.lineWidth = .5 + r() * 2.2;
      g.filter = r() > .6 ? 'blur(1.5px)' : 'none';
      g.beginPath(); let x = r() * s, y = -20; g.moveTo(x, y);
      while (y < s + 20) { const nx = x + (r() - .45) * 90, ny = y + 30 + r() * 70; g.quadraticCurveTo(x + (r() - .5) * 80, (y + ny) / 2, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.filter = 'none';
  },
  porcelanico: (g, s, r) => {     // 2×2 peces de 60 cm
    const t = s / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = to('#BDBAB3', .05, r); g.fillRect(i * t, j * t, t, t);
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '90,88,84'},${r() * .07})`; g.fillRect(i * t + r() * t, j * t + r() * t, 2 + r() * 6, 2 + r() * 6); }
    }
    g.fillStyle = '#9E9B94';
    for (let i = 0; i <= 2; i++) { g.fillRect(i * t - 1.5, 0, 3, s); g.fillRect(0, i * t - 1.5, s, 3); }
  },
  microcemento: (g, s, r) => {
    g.fillStyle = '#B5B1A9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = r() * s, y = r() * s, rad = 20 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() > .5 ? '255,255,250' : '80,76,70';
      gr.addColorStop(0, `rgba(${c},${r() * .07})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  },
  viejo: (g, s, r) => {           // terratzo vell, peces de 40 cm
    const n = 4, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = to('#C9C1B1', .06, r); g.fillRect(i * t, j * t, t, t);
      for (let k = 0; k < 260; k++) {
        g.fillStyle = ['rgba(120,104,88,.5)', 'rgba(232,226,214,.7)', 'rgba(150,140,128,.5)', 'rgba(95,90,84,.4)'][k % 4];
        g.beginPath(); g.arc(i * t + r() * t, j * t + r() * t, .8 + r() * 2.6, 0, 7); g.fill();
      }
    }
    g.fillStyle = '#A9A194'; for (let i = 0; i <= n; i++) { g.fillRect(i * t - 1, 0, 2, s); g.fillRect(0, i * t - 1, s, 2); }
  },
  rajolaTerra: (g, s, r) => {     // terra de bany, peça petita clara
    const n = 4, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = to('#D9D6CF', .05, r); g.fillRect(i * t, j * t, t, t); }
    g.fillStyle = '#BDB9B1'; for (let i = 0; i <= n; i++) { g.fillRect(i * t - 1, 0, 2, s); g.fillRect(0, i * t - 1, s, 2); }
  },
};
function azulejo(color) {          // rajola vertical 7,5 × 15 cm, artesana
  return llenc('az' + color, 512, (g, s, r) => {
    const cols = 8, files = 4, w = s / cols, h = s / files;
    for (let i = 0; i < cols; i++) for (let j = 0; j < files; j++) {
      const x = i * w, y = j * h;
      const gr = g.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, to(color, .16, r)); gr.addColorStop(1, to(color, .16, r));
      g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    g.fillStyle = 'rgba(230,228,222,.9)';
    for (let i = 0; i <= cols; i++) g.fillRect(i * w - 1.5, 0, 3, s);
    for (let j = 0; j <= files; j++) g.fillRect(0, j * h - 1.5, s, 3);
  });
}

const textures = {};
function tex(nom, metres, canvas) {   // textura amb UV en metres (vegeu uvMetres)
  const k = nom + metres;
  if (textures[k]) return textures[k];
  const c = canvas || llenc(nom, 512, DIBUIX[nom]);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.anisotropy = 8;
  return (textures[k] = t);
}

/* Mostres del panell: un tros de la mateixa textura */
function pintaMostres() {
  $$('.pn-mat').forEach(el => { el.style.backgroundImage = `url(${llenc(el.dataset.mat, 512, DIBUIX[el.dataset.mat]).toDataURL('image/jpeg', .8)})`; });
  document.documentElement.style.setProperty('--fusta', `url(${llenc('robleV', 512, DIBUIX.robleV).toDataURL('image/jpeg', .8)})`);
  const dib = {
    lineal: '<rect x="8" y="6" width="112" height="12"/>',
    l: '<rect x="8" y="6" width="112" height="12"/><rect x="8" y="18" width="12" height="34"/>',
    isla: '<rect x="8" y="6" width="112" height="12"/><rect x="40" y="32" width="54" height="14"/>',
    ducha: '<rect x="8" y="6" width="44" height="44" fill="none" stroke-dasharray="3 3"/><line x1="52" y1="6" x2="52" y2="40" stroke-width="2.5"/><circle cx="30" cy="28" r="2.5"/>',
    banera: '<rect x="8" y="6" width="84" height="26" rx="10"/><line x1="92" y1="6" x2="92" y2="30" stroke-width="2.5"/>',
  };
  $$('.pn-dib').forEach(el => {
    el.innerHTML = `<svg viewBox="0 0 128 56" aria-hidden="true" fill="#22262A" stroke="#22262A" stroke-width="1.5"><rect x="2" y="2" width="124" height="52" fill="none" stroke="#C4C8C1"/>${dib[el.dataset.dib]}</svg>`;
  });
}

/* ═══ 4. MAQUETA 3D ══════════════════════════════════════════════ */
const visor = $('.pn-visor');
const canvas = $('.pn-canvas');
const elEstat = $('.pn-estat');
let renderer, scene, camera, controls, sol, brut = true;


const M = {};                       // materials compartits
function mat(nom, o) { return (M[nom] = new THREE.MeshStandardMaterial(o)); }
function preparaMaterials() {
  mat('paret', { color: 0xE8E6E0, roughness: .95 });
  mat('tall', { color: 0x2E3337, roughness: .8 });                    // la secció de la maqueta
  mat('cos', { color: 0xEDEBE6, roughness: .8 });
  mat('socol', { color: 0x2A2C2E, roughness: .7 });
  mat('frente', { color: 0xE7E3DA, roughness: .55 });
  mat('tirador', { color: 0x1C1D1E, roughness: .35, metalness: .6 });
  mat('encimera', { map: tex('roble', 1.2), roughness: .5 });
  mat('terra', { map: tex('porcelanico', 1.2), roughness: .45 });
  mat('vitro', { color: 0x111213, roughness: .08, metalness: .2 });
  mat('inox', { color: 0xB9BCBE, roughness: .25, metalness: 1 });
  mat('finestra', { color: 0xE8EEF2, emissive: 0xEAF1F6, emissiveIntensity: .9, roughness: .1 });
  mat('marc', { color: 0xF5F4F0, roughness: .6 });
  mat('led', { color: 0xFFF1D6, emissive: 0xFFE2B0, emissiveIntensity: 0 });
  mat('fusta', { map: tex('roble', 1.2), roughness: .55 });
  mat('ceramica', { color: 0xF6F6F3, roughness: .18 });
  mat('vidre', { color: 0xDDE8E8, roughness: .05, transparent: true, opacity: .22, depthWrite: false });
  mat('mirall', { color: 0xDCE2E4, roughness: .04, metalness: 1 });
  mat('llauto', { color: 0xB08D57, roughness: .3, metalness: 1 });
  mat('tela', { color: 0xCBC5BA, roughness: 1 });
  mat('llencol', { color: 0xEDEAE3, roughness: .95 });
  mat('manta', { color: 0x8F9B86, roughness: 1 });
  mat('catifa', { color: 0xD9D3C7, roughness: 1 });
  mat('test', { color: 0xC9B8A0, roughness: .85 });
  mat('fulla', { color: 0x5D7255, roughness: .8, flatShading: true });
  mat('bombeta', { color: 0xFFF4E0, emissive: 0xFFE7BF, emissiveIntensity: 1.6 });
  mat('rajola', { map: tex('az#ECEAE4', .6, azulejo('#ECEAE4')), roughness: .3 });
  mat('moble', { map: tex('robleV', .8), roughness: .55 });
  mat('terraBany', { map: tex('rajolaTerra', .8), roughness: .4 });
  M.cota = new THREE.MeshBasicMaterial({ color: 0x2A4BD7 });
}

/* UV en metres: cada cara de la caixa rep les seves mides reals, així
   la textura té la mateixa escala a tot arreu (taulell, terra, frontal). */
function uvMetres(geo, w, h, d) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  uv.needsUpdate = true;
}
/* Caixa amb la base a y (no el centre): és com es pensa en obra */
function caixa(w, h, d, material, x, y, z, pare, ombra = true) {
  const g = new THREE.BoxGeometry(w, h, d); uvMetres(g, w, h, d);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y + h / 2, z); m.castShadow = ombra; m.receiveShadow = true;
  pare.add(m); return m;
}
function cilindre(rt, rb, h, material, x, y, z, pare, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; pare.add(m); return m;
}
/* Paret de maqueta: tallada, amb la secció en grafit a dalt */
function paret(w, h, d, x, y, z, pare) {
  const m = caixa(w, h, d, M.paret, x, y, z, pare);
  m.material = [M.paret, M.paret, M.tall, M.paret, M.paret, M.paret];
  return m;
}

/* ── Peces de cuina (en local: la tirada va per +x, el frontal mira a +z) ── */
function tiradaBaixa(tipus) {
  const g = new THREE.Group(); let x = 0;
  const tiradors = [];
  for (const t of tipus) {
    const w = .6, cx = x + w / 2;
    caixa(w - .004, .1, .5, M.socol, cx, 0, .25, g);
    caixa(w - .004, .76, .56, M.cos, cx, .1, .28, g);
    if (t === 'calaixos') {
      [0, 1, 2].forEach(i => {
        caixa(w - .008, .245, .02, M.frente, cx, .102 + i * .253, .57, g);
        tiradors.push(caixa(.3, .012, .016, M.tirador, cx, .102 + i * .253 + .205, .588, g));
      });
    } else {
      caixa(w - .008, .755, .02, M.frente, cx, .102, .57, g);
      tiradors.push(caixa(.3, .012, .016, M.tirador, cx, .79, .588, g));
    }
    if (t === 'placa') caixa(.56, .008, .5, M.vitro, cx, .9, .3, g);
    if (t === 'pica') {
      caixa(.5, .006, .4, M.inox, cx, .9, .3, g);
      cilindre(.014, .014, .34, M.tirador, cx, .9, .08, g);
      const b = caixa(.02, .02, .2, M.tirador, cx, 1.22, .17, g); b.rotation.x = .25;
    }
    x += w;
  }
  caixa(x + .02, .04, .63, M.encimera, x / 2, .86, .305, g);
  g.userData.llarg = x;
  return g;
}
function tiradaAlta(n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const cx = i * .6 + .3;
    caixa(.596, .72, .33, M.cos, cx, 1.48, .165, g);
    caixa(.592, .716, .02, M.frente, cx, 1.482, .34, g);
  }
  caixa(n * .6, .012, .02, M.led, n * .6 / 2, 1.466, .29, g, false);   // tira de llum (amb la instal·lació)
  return g;
}
function columna() {
  const g = new THREE.Group();
  caixa(.596, .1, .5, M.socol, .3, 0, .25, g);
  caixa(.596, 2.1, .58, M.cos, .3, .1, .29, g);
  caixa(.592, 1.25, .02, M.frente, .3, .102, .59, g);
  caixa(.592, .84, .02, M.frente, .3, 1.362, .59, g);
  caixa(.012, .5, .016, M.tirador, .54, .75, .608, g);
  caixa(.012, .3, .016, M.tirador, .54, 1.42, .608, g);
  return g;
}
function penjant(x, z, pare, alt = 1.8) {
  cilindre(.004, .004, 2.62 - alt, M.tirador, x, alt + .17, z, pare, 6).castShadow = false;
  const p = cilindre(.05, .17, .18, M.tirador, x, alt, z, pare);
  p.material = M.tirador;
  const b = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), M.bombeta);
  b.position.set(x, alt + .02, z); pare.add(b);
}
function planta(x, z, pare, esc = 1) {
  cilindre(.16 * esc, .12 * esc, .32 * esc, M.test, x, 0, z, pare);
  const r = aleatori(Math.round(x * 100 + z * 10));
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry((.12 + r() * .1) * esc, 0), M.fulla);
    f.position.set(x + (r() - .5) * .3 * esc, (.42 + r() * .45) * esc, z + (r() - .5) * .3 * esc);
    f.rotation.set(r() * 3, r() * 3, r() * 3); f.castShadow = true; pare.add(f);
  }
}
function cadira(x, z, rot, pare) {
  const g = new THREE.Group();
  caixa(.42, .03, .42, M.fusta, 0, .44, 0, g);
  caixa(.42, .4, .03, M.fusta, 0, .47, -.2, g);
  [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => cilindre(.015, .015, .44, M.tirador, a, 0, b, g, 8));
  g.position.set(x, 0, z); g.rotation.y = rot; pare.add(g);
}

/* ── Escena: cuina (la mida surt dels m²; els mobles fan 60 cm i hi caben els que hi caben) ── */
function midesCuina(m2) {
  const W = Math.min(6.4, Math.max(2.8, Math.sqrt(m2 * 1.35)));
  return { W, D: m2 / W, H: 2.6, T: .12 };
}
function finestraCuina(W) {
  const ww = Math.min(1.4, W * .32), wx2 = W / 2 - Math.max(.35, W * .08);
  return { wx1: wx2 - ww, wx2, wy1: 1.05, wy2: 2.25 };
}
function escenaCuina(v) {
  const g = new THREE.Group(), mi = midesCuina(v.m2), { W, D, H, T } = mi, x0 = -W / 2, z0 = -D / 2;
  const terra = caixa(W, .03, D, M.terra, 0, -.03, 0, g); terra.castShadow = false;
  paret(T, H, D + T, x0 - T / 2, 0, -T / 2, g);
  const { wx1, wx2, wy1, wy2 } = finestraCuina(W), zb = z0 - T / 2;
  paret(wx1 - x0 + T, H, T, (x0 - T + wx1) / 2, 0, zb, g);
  paret(W / 2 - wx2, H, T, (wx2 + W / 2) / 2, 0, zb, g);
  paret(wx2 - wx1, wy1, T, (wx1 + wx2) / 2, 0, zb, g);
  paret(wx2 - wx1, H - wy2, T, (wx1 + wx2) / 2, wy2, zb, g);
  caixa(wx2 - wx1, wy2 - wy1, .02, M.finestra, (wx1 + wx2) / 2, wy1, z0 - T * .7, g, false);
  caixa(.04, wy2 - wy1, .06, M.marc, (wx1 + wx2) / 2, wy1, z0 - .05, g);
  caixa(wx2 - wx1 + .08, .03, .16, M.marc, (wx1 + wx2) / 2, wy1 - .03, z0 + .02, g);
  const mobles = new THREE.Group(); g.add(mobles);
  g.userData = { mobles, mides: mi, mida: Math.max(W, D) };
  muntaCuina(mobles, v.forma, mi);
  return g;
}
/* Tipus de cada mòdul d'una tirada: la pica a sota la finestra, la placa separada */
function tipusTirada(n, pica, placa) {
  return Array.from({ length: n }, (_, i) => i === pica ? 'pica' : i === placa ? 'placa' : i % 2 ? 'porta' : 'calaixos');
}
function muntaCuina(m, forma, { W, D }) {
  const x0 = -W / 2, z0 = -D / 2, { wx1, wx2 } = finestraCuina(W), wc = (wx1 + wx2) / 2;
  const limita = (i, n) => Math.max(0, Math.min(n - 1, i));
  if (forma === 'l') {
    const n = Math.max(3, Math.floor((W - .05) / .6));
    const nl = Math.max(1, Math.floor((D - 1.3) / .6));
    const pica = limita(Math.round((wc - x0 - .3) / .6), n);
    const placaAlFons = nl < 2;
    const b = tiradaBaixa(tipusTirada(n, pica, placaAlFons ? limita(pica - 2, n) : -1)); b.position.set(x0, 0, z0); m.add(b);
    const na = Math.floor((wx1 - .1 - x0 - .35) / .6);
    if (na > 0) { const a = tiradaAlta(na); a.position.set(x0 + .35, 0, z0); m.add(a); }
    const zFi = z0 + .6 + nl * .6;
    const e = tiradaBaixa(tipusTirada(nl, -1, placaAlFons ? -1 : 1)); e.rotation.y = Math.PI / 2; e.position.set(x0, 0, zFi); m.add(e);
    const ea = tiradaAlta(nl); ea.rotation.y = Math.PI / 2; ea.position.set(x0, 0, zFi); m.add(ea);
    if (D / 2 - zFi >= .65) { const c = columna(); c.rotation.y = Math.PI / 2; c.position.set(x0, 0, zFi + .6); m.add(c); }
  } else {
    const col = W >= 3.4;
    const xs = x0 + (col ? .6 : 0);
    if (col) { const c = columna(); c.position.set(x0, 0, z0); m.add(c); }
    const n = Math.max(3, Math.min(9, Math.floor((W / 2 - xs - .05) / .6)));
    const pica = limita(Math.round((wc - xs - .3) / .6), n);
    const placa = pica >= 2 ? pica - 2 : limita(pica + 2, n) === pica ? (pica + 1) % n : limita(pica + 2, n);
    const b = tiradaBaixa(tipusTirada(n, pica, placa)); b.position.set(xs, 0, z0); m.add(b);
    const na = Math.floor((wx1 - .1 - xs) / .6);
    if (na > 0) { const a = tiradaAlta(na); a.position.set(xs, 0, z0); m.add(a); }
  }
  let taula = null;
  if (forma === 'isla') {
    const ni = Math.min(4, Math.max(2, Math.floor((W - 1.6) / .6))), len = ni * .6;
    const il = tiradaBaixa(Array.from({ length: ni }, (_, i) => i % 2 ? 'porta' : 'calaixos'));
    il.children[il.children.length - 1].visible = false;          // el taulell de l'illa és més fondo
    caixa(len + .1, .04, .98, M.encimera, len / 2, .86, .15, il);
    caixa(len, .86, .02, M.frente, len / 2, 0, -.01, il);         // costat dels tamborets, del color dels mobles
    const px = len / 2, pz = z0 + 2.22;
    il.rotation.y = Math.PI; il.position.set(px, 0, pz); m.add(il);
    const k = ni - 1;
    for (let i = 0; i < k; i++) {
      const x = (i - (k - 1) / 2) * .72;
      cilindre(.17, .17, .05, M.fusta, x, .62, pz + .7, m);
      cilindre(.018, .018, .62, M.tirador, x, 0, pz + .7, m, 8);
      cilindre(.16, .16, .015, M.tirador, x, 0, pz + .7, m);
    }
    penjant(-len / 4, pz - .1, m); penjant(len / 4, pz - .1, m);
  } else if (D >= 2.9 && W >= 3.3) {
    const tx = W / 2 - 1.0, tz = D / 2 - 1.0;
    cilindre(.45, .45, .035, M.fusta, tx, .72, tz, m, 48);
    cilindre(.05, .05, .72, M.tirador, tx, 0, tz, m, 12);
    cilindre(.22, .25, .02, M.tirador, tx, 0, tz, m);
    cadira(tx, tz + .65, Math.PI, m); cadira(tx + .65, tz, -Math.PI / 2, m);
    penjant(tx, tz, m, 1.55);
    taula = true;
  }
  if (forma === 'l') { if (taula || W > 3.2) planta(W / 2 - .35, D / 2 - .35, m); }
  else planta(x0 + .35, D / 2 - .35, m);
}

/* ── Escena: bany ── */
function midesBany(m2) {
  const W = Math.min(4.2, Math.max(1.9, Math.sqrt(m2) * 1.18));
  return { W, D: m2 / W, H: 2.5, T: .12 };
}
function escenaBany(v) {
  const g = new THREE.Group(), mi = midesBany(v.m2), { W, D, H, T } = mi, x0 = -W / 2, z0 = -D / 2;
  const terra = caixa(W, .03, D, M.terraBany, 0, -.03, 0, g); terra.castShadow = false;
  // Paret: obra + rajola per dins
  paret(T, H, D + T, x0 - T / 2, 0, -T / 2, g);
  paret(W + T, H, T, -T / 2, 0, z0 - T / 2, g);
  caixa(.01, H - .002, D, M.rajola, x0 + .005, 0, 0, g, false);
  caixa(W, H - .002, .01, M.rajola, 0, 0, z0 + .005, g, false);
  const peces = new THREE.Group(); g.add(peces);
  g.userData = { peces, mides: mi, mida: Math.max(W, D) };
  muntaBany(peces, v, mi);
  return g;
}
function muntaBany(p, v, { W, D }) {
  const x0 = -W / 2, z0 = -D / 2, banera = v.tipo === 'banera';
  let fiX, fonsZ;                     // fins on arriba la dutxa o la banyera
  if (banera) {
    const len = Math.min(1.7, W - 1.0), fons = .72;
    caixa(len, .55, fons, M.ceramica, x0 + len / 2, 0, z0 + fons / 2, p);
    caixa(len - .14, .01, fons - .14, new THREE.MeshStandardMaterial({ color: 0xE4E7E6, roughness: .15 }), x0 + len / 2, .545, z0 + fons / 2, p, false);
    caixa(.02, 1.4, .7, M.vidre, x0 + len - .01, .56, z0 + .35, p, false);
    caixa(.025, .025, .7, M.tirador, x0 + len - .01, 1.95, z0 + .35, p);
    cilindre(.012, .012, .7, M.tirador, x0 + .2, .9, z0 + .03, p, 8);
    caixa(.12, .02, .12, M.tirador, x0 + .2, 1.6, z0 + .08, p);
    fiX = x0 + len; fonsZ = z0 + fons;
  } else {
    const s = Math.max(.7, Math.min(1.0, D - .9, W * .42));
    caixa(s, .006, s, new THREE.MeshStandardMaterial({ color: 0x8E8D88, roughness: .5 }), x0 + s / 2, 0, z0 + s / 2, p, false);
    caixa(s * .7, .004, .05, M.inox, x0 + s / 2, .006, z0 + s - .1, p, false);
    caixa(.02, 2.0, s * .9, M.vidre, x0 + s, 0, z0 + s * .45, p, false);
    caixa(.025, .025, s * .9, M.tirador, x0 + s, 2.0, z0 + s * .45, p);
    cilindre(.012, .012, 1.0, M.tirador, x0 + s / 2, 1.1, z0 + .03, p, 8);
    cilindre(.13, .13, .015, M.tirador, x0 + s / 2, 2.1, z0 + .15, p);
    caixa(.02, .02, .14, M.tirador, x0 + s / 2, 2.1, z0 + .08, p);
    fiX = x0 + s; fonsZ = z0 + s;
  }
  // Lavabo suspès, a l'altra punta de la paret del fons
  const vw = Math.max(.5, Math.min(.9, W / 2 - fiX - .2)), xl = W / 2 - .1 - vw / 2, rm = Math.min(.34, vw / 2 - .02);
  caixa(vw, .42, .46, M.moble, xl, .42, z0 + .23, p);
  caixa(vw + .02, .06, .48, M.ceramica, xl, .84, z0 + .24, p);
  cilindre(.012, .012, .2, M.tirador, xl, .9, z0 + .06, p, 8);
  caixa(.02, .02, .12, M.tirador, xl, 1.08, z0 + .11, p);
  const mirall = new THREE.Mesh(new THREE.CylinderGeometry(rm, rm, .015, 48), M.mirall);
  mirall.rotation.x = Math.PI / 2; mirall.position.set(xl, 1.6, z0 + .012); p.add(mirall);
  const vora = new THREE.Mesh(new THREE.TorusGeometry(rm + .005, .012, 8, 64), M.llauto);
  vora.position.set(xl, 1.6, z0 + .02); p.add(vora);
  // Inodor suspès, a la paret de l'esquerra, davant de la dutxa o la banyera
  const zw = fonsZ + .45;
  const wc = new THREE.Group();
  const cos = new THREE.Mesh(new THREE.CylinderGeometry(.19, .16, .36, 32), M.ceramica);
  cos.scale.set(1, 1, 1.4); cos.position.set(0, .4, .3); cos.castShadow = true; wc.add(cos);
  caixa(.38, .03, .5, M.ceramica, 0, .58, .29, wc);
  caixa(.24, .16, .01, M.ceramica, 0, 1.05, .015, wc);
  wc.rotation.y = Math.PI / 2; wc.position.set(x0, 0, zw); p.add(wc);
  if (v.paquete === 'llave') {      // tovalloler elèctric, on hi hagi paret lliure
    const tv = new THREE.Group();
    for (let i = 0; i < 7; i++) caixa(.5, .02, .02, M.tirador, 0, .62 + i * .12, .06, tv);
    caixa(.02, .84, .02, M.tirador, -.25, .56, .06, tv); caixa(.02, .84, .02, M.tirador, .25, .56, .06, tv);
    const g1 = fiX + .05, g2 = xl - vw / 2 - .05;
    if (g2 - g1 >= .55) { tv.position.set((g1 + g2) / 2, 0, z0); p.add(tv); }
    else if (D / 2 - (zw + .3) >= .6) { tv.rotation.y = Math.PI / 2; tv.position.set(x0, 0, (zw + .3 + D / 2) / 2); p.add(tv); }
  }
}


/* ── Peces arrodonides (mobles tous: llits, sofà) ── */
function caixaR(w, h, d, r, material, x, y, z, pare) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
  pare.add(m); return m;
}

/* ═══ 5. EL PIS EN 3D ════════════════════════════════════════════
   Maqueta tallada a 1,1 m, vista des de dalt. Es munta un cop per
   cada combinació de dormitoris i banys; quan canvien els m², les
   peces només es mouen i s'estiren (res de reconstruir), i ho fan
   lliscant cap a la nova distribució a cada fotograma. */
const HM = 1.1, PASS = 1.05, TE = .2, TI = .1;
const GEO = new THREE.BoxGeometry(1, 1, 1);
let pla = null, plaAra = null, plaObj = null, radiObjectiu = null, hover = null, interior = null;

function caixaU(material, pare, ombra = true) {
  const m = new THREE.Mesh(GEO, material);
  m.castShadow = ombra; m.receiveShadow = true; pare.add(m); return m;
}
function posaCaixa(m, x1, x2, y1, y2, z1, z2) {
  const w = x2 - x1, h = y2 - y1, d = z2 - z1;
  if (w < .005 || h < .005 || d < .005) { m.visible = false; return; }
  m.visible = true; m.scale.set(w, h, d); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
}
/* Material de terra amb UV del món: la textura no s'estira quan la peça creix */
function matMon(nom, metres, rugositat) {
  const m = new THREE.MeshStandardMaterial({ map: tex(nom, metres), roughness: rugositat });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n  vMapUv = ( mapTransform * vec3( ( modelMatrix * vec4( position, 1.0 ) ).xz, 1.0 ) ).xy;');
  };
  return m;
}
const TERRES = { mantener: ['viejo', 1.6, .5], porcelanico: ['porcelanico', 1.2, .45], espiga: ['espiga', 1.4, .6], microcemento: ['microcemento', 2, .55] };
function materialsZona(z) {
  if (z.mat) return z.mat;
  z.mat = {
    terra: matMon('porcelanico', 1.2, .45),
    vel: new THREE.MeshBasicMaterial({ color: 0x1B1F22, transparent: true, opacity: .5, depthWrite: false }),
    marc: new THREE.MeshStandardMaterial({ color: 0xF5F4F0, roughness: .6 }),
  };
  return z.mat;
}

/* ── Distribució: cada zona fa exactament els seus m² ──
   Davant: saló i cuina. Darrere: dormitoris i banys. Entremig, el passadís. */
function calculaPla() {
  const Z = id => st.zones.get(id).opts.m2, fons = ordreFons();
  const Af = Z('salon') + Z('cocina'), Ab = fons.reduce((a, id) => a + Z(id), 0);
  const lo = Math.max(Af, Ab) / 5.2, hi = Math.min(Af, Ab) / 2.6;
  let W = Math.sqrt((Af + Ab) * 1.45);
  W = lo > hi ? lo : Math.min(hi, Math.max(lo, W));
  const dF = Af / W, dB = Ab / W, D = dF + PASS + dB;
  const z0 = -D / 2, zB = z0 + dB, zF = zB + PASS;
  const r = { W, D, zB, zF, zones: {} };
  let x = -W / 2;
  for (const id of fons) { const w = Z(id) / dB; r.zones[id] = { x1: x, x2: x + w, z1: z0, z2: zB }; x += w; }
  const ws = Z('salon') / dF;
  r.zones.salon = { x1: -W / 2, x2: -W / 2 + ws, z1: zF, z2: D / 2 };
  r.zones.cocina = { x1: -W / 2 + ws, x2: W / 2, z1: zF, z2: D / 2 };
  r.zones.pasillo = { x1: -W / 2, x2: W / 2, z1: zB, z2: zF };
  st.zones.get('pasillo').opts.m2 = Math.round(W * PASS * 2) / 2;
  return r;
}
function copiaPla(p) { return { ...p, zones: Object.fromEntries(Object.entries(p.zones).map(([k, v]) => [k, { ...v }])) }; }
/* Acosta `a` a `b`; torna la distància més gran que queda */
function acostaPla(a, b, k) {
  let max = 0;
  const pas = (o, t, c) => { const d = t[c] - o[c]; o[c] += d * k; max = Math.max(max, Math.abs(d)); };
  ['W', 'D', 'zB', 'zF'].forEach(c => pas(a, b, c));
  for (const id in b.zones) ['x1', 'x2', 'z1', 'z2'].forEach(c => pas(a.zones[id], b.zones[id], c));
  return max;
}

/* ── Parets: una línia recta amb forats (finestres o portes) ── */
let MP;   // materials de paret: secció grafit a dalt
function novaLinia(pare, nForats, finestres) {
  const L = { trams: [], forats: [] };
  for (let i = 0; i <= nForats; i++) { const m = caixaU(M.paret, pare); m.material = MP; L.trams.push(m); }
  if (finestres) for (let i = 0; i < nForats; i++) {
    const ampit = caixaU(M.paret, pare); ampit.material = MP;
    L.forats.push({ ampit, vidre: caixaU(M.vidrePla, pare, false), marc: caixaU(M.marc, pare) });
  }
  return L;
}
function posaLinia(L, a, b, pos, eix, g, forats) {
  let ini = a; const trams = [];
  forats.forEach(([f1, f2]) => { trams.push([ini, Math.max(ini, f1)]); ini = Math.max(ini, f2); });
  trams.push([ini, Math.max(ini, b)]);
  const posa = (m, t1, t2, y1, y2, gg = g) => eix === 'x'
    ? posaCaixa(m, t1, t2, y1, y2, pos - gg / 2, pos + gg / 2)
    : posaCaixa(m, pos - gg / 2, pos + gg / 2, y1, y2, t1, t2);
  L.trams.forEach((m, i) => posa(m, trams[i][0], trams[i][1], 0, HM));
  L.forats.forEach((f, i) => {
    const [f1, f2] = forats[i];
    posa(f.ampit, f1, f2, 0, .45);
    posa(f.vidre, f1, f2, .45, HM - .02, .03);
    posa(f.marc, f1 - .02, f2 + .02, .45, .5, g * 1.2);       // travesser: blanc, o grafit si és nova
  });
}

/* ── Mobles de cada zona: es munten un cop i `posa` els col·loca ── */
function llit(amp) {
  const g = new THREE.Group();
  caixa(amp + .1, .85, .07, M.fusta, 0, 0, .035, g);
  caixaR(amp + .06, .3, 2.0, .04, M.fusta, 0, 0, 1.07, g);
  caixaR(amp, .2, 1.92, .07, M.llencol, 0, .28, 1.08, g);
  caixaR(amp + .04, .08, 1.25, .05, M.manta, 0, .44, 1.42, g);
  (amp > 1 ? [-amp / 4, amp / 4] : [0]).forEach(x => caixaR(Math.min(.55, amp * .45), .12, .3, .06, M.llencol, x, .46, .3, g));
  return g;
}
function mobleDorm() {
  const g = new THREE.Group(), doble = llit(1.5), simple = llit(.95);
  const tauleta = new THREE.Group(); caixaR(.42, .45, .4, .03, M.fusta, 0, 0, 0, tauleta);
  const armari = new THREE.Group(); caixa(.6, 1.0, 1, M.frente, 0, 0, 0, armari);
  g.add(doble, simple, tauleta, armari);
  return { grup: g, posa(r, o) {
    const w = r.x2 - r.x1, d = r.z2 - r.z1, amb = !!o.armario;
    const llarg = Math.max(.8, Math.min(1.8, d - 1.4));
    armari.visible = amb; armari.scale.z = llarg; armari.position.set(r.x2 - TI / 2 - .32, 0, r.z1 + TI / 2 + .05 + llarg / 2);
    const lliure = w - (amb ? .7 : 0), esDoble = lliure >= 2.5, bw = esDoble ? 1.5 : .95;
    doble.visible = esDoble; simple.visible = !esDoble;
    const cx = r.x1 + lliure / 2;
    (esDoble ? doble : simple).position.set(cx, 0, r.z1 + TI / 2);
    tauleta.visible = lliure - bw > 1; tauleta.position.set(cx - bw / 2 - .32, 0, r.z1 + .32);
  } };
}
function mobleSalo() {
  const g = new THREE.Group();
  const sofa = new THREE.Group();
  caixaR(2.2, .42, .9, .06, M.tela, 0, 0, 0, sofa);
  caixaR(2.2, .4, .22, .06, M.tela, 0, .42, -.34, sofa);
  caixaR(.2, .22, .9, .05, M.tela, -1.0, .42, 0, sofa); caixaR(.2, .22, .9, .05, M.tela, 1.0, .42, 0, sofa);
  [-.5, .5].forEach(x => caixaR(.95, .12, .66, .06, M.coixi, x, .42, .06, sofa));
  sofa.rotation.y = -Math.PI / 2;
  const catifa = caixa(1.6, .015, 2.2, M.catifa, 0, 0, 0, g, false);
  const tauleta = new THREE.Group(); cilindre(.36, .36, .04, M.fusta, 0, .34, 0, tauleta, 40); cilindre(.05, .05, .34, M.tirador, 0, 0, 0, tauleta, 10);
  const tv = new THREE.Group(); caixaR(.42, .45, 1.6, .03, M.fusta, 0, 0, 0, tv); caixa(.06, .45, 1.1, M.vitro, -.1, .45, 0, tv);
  const taula = new THREE.Group();
  caixaR(.9, .04, 1.5, .015, M.fusta, 0, .72, 0, taula);
  [[-.35, -.6], [.35, -.6], [-.35, .6], [.35, .6]].forEach(([a, b]) => cilindre(.02, .02, .72, M.tirador, a, 0, b, taula, 8));
  cadira(-.65, -.35, Math.PI / 2, taula); cadira(-.65, .35, Math.PI / 2, taula);
  cadira(.65, -.35, -Math.PI / 2, taula); cadira(.65, .35, -Math.PI / 2, taula);
  const plt = new THREE.Group(); planta(0, 0, plt, .9);
  g.add(sofa, tauleta, tv, taula, plt);
  return { grup: g, posa(r) {
    const w = r.x2 - r.x1, d = r.z2 - r.z1, cz = (r.z1 + r.z2) / 2;
    const sx = r.x1 + Math.min(3.0, Math.max(2.2, w * .5));
    sofa.position.set(sx, 0, cz); tv.position.set(r.x1 + TE / 2 + .2, 0, cz);
    catifa.position.set((r.x1 + .6 + sx - .5) / 2, .008, cz); tauleta.position.set((r.x1 + .6 + sx - .5) / 2, 0, cz);
    taula.visible = w > 4.8; taula.position.set(r.x2 - 1.2, 0, cz);
    plt.visible = d > 3.2; plt.position.set(r.x1 + .35, 0, r.z2 - .35);
  } };
}
function mobleCuina() {
  const g = new THREE.Group(), tirada = new THREE.Group(), MAX = 8;
  const moduls = Array.from({ length: MAX }, (_, i) => {
    const m = new THREE.Group();
    caixa(.5, .1, .598, M.socol, -.3, 0, 0, m);
    caixa(.58, .76, .598, M.cos, -.29, .1, 0, m);
    caixa(.02, .74, .59, M.frente, -.59, .11, 0, m);
    m.position.z = i * .6 + .3; tirada.add(m); return m;
  });
  const taulell = caixa(.62, .04, 1, M.encimera, -.31, .86, 0, tirada);
  const placa = caixa(.5, .01, .56, M.vitro, -.3, .9, 0, tirada);
  const pica = caixa(.42, .01, .5, M.inox, -.3, .9, 0, tirada);
  const illa = new THREE.Group();
  caixaR(.9, .86, 1.8, .02, M.frente, 0, 0, 0, illa); caixa(1.0, .04, 1.9, M.encimera, 0, .86, 0, illa);
  g.add(tirada, illa);
  return { grup: g, posa(r, o) {
    const w = r.x2 - r.x1, d = r.z2 - r.z1, n = Math.max(2, Math.min(MAX, Math.floor((d - .5) / .6)));
    tirada.position.set(r.x2 - TE / 2 + .1, 0, r.z2 - .25 - n * .6);
    moduls.forEach((m, i) => { m.visible = i < n; });
    taulell.scale.z = n * .6; taulell.position.z = n * .3;
    placa.position.z = .9; pica.position.z = (n - 1) * .6 + .3;
    illa.visible = o.forma === 'isla' && w > 2.8 && d > 3.0;
    illa.position.set(r.x1 + (w - .6) / 2, 0, (r.z1 + r.z2) / 2);
  } };
}
function mobleBany() {
  const g = new THREE.Group();
  const plat = caixaU(M.plat, g, false), banyera = caixaU(M.ceramica, g), vidre = caixaU(M.vidre, g, false);
  const lavabo = new THREE.Group(); caixa(.7, .4, .45, M.moble, 0, .42, .225, lavabo); caixa(.72, .05, .47, M.ceramica, 0, .82, .235, lavabo);
  const wc = new THREE.Group();
  const cos = new THREE.Mesh(new THREE.CylinderGeometry(.18, .15, .4, 24), M.ceramica);
  cos.scale.set(1, 1, 1.35); cos.position.set(0, .2, .32); cos.castShadow = true; wc.add(cos);
  caixa(.38, .32, .16, M.ceramica, 0, .1, .08, wc);
  g.add(lavabo, wc);
  return { grup: g, posa(r, o) {
    const w = r.x2 - r.x1, d = r.z2 - r.z1, ban = o.tipo === 'banera', i = TI / 2 + .02;
    let px1, px2, pz1, pz2;
    if (d >= w) {                    // allargat: la dutxa o la banyera al fons
      px1 = r.x1 + i; px2 = r.x2 - i; pz1 = r.z1 + i; pz2 = pz1 + (ban ? .72 : Math.min(.9, d * .35));
      posaCaixa(vidre, px1, px1 + (px2 - px1) * .62, ban ? .55 : 0, 1.05, pz2, pz2 + .02);
      lavabo.rotation.y = Math.PI / 2; lavabo.position.set(r.x1 + TI / 2, 0, pz2 + .55);
      const zw = w >= 1.5 ? pz2 + .5 : pz2 + 1.35;
      wc.visible = zw + .45 < r.z2 - .1;
      if (w >= 1.5) { wc.rotation.y = -Math.PI / 2; wc.position.set(r.x2 - TI / 2, 0, zw); }
      else { wc.rotation.y = Math.PI / 2; wc.position.set(r.x1 + TI / 2, 0, zw); }
    } else {                          // ample: a l'esquerra
      px1 = r.x1 + i; px2 = px1 + (ban ? Math.min(1.7, w * .55) : Math.min(.9, w * .35)); pz1 = r.z1 + i; pz2 = pz1 + (ban ? .72 : Math.min(1.2, d - .2));
      posaCaixa(vidre, px2, px2 + .02, ban ? .55 : 0, 1.05, pz1, pz1 + (pz2 - pz1) * .62);
      lavabo.rotation.y = 0; lavabo.position.set(px2 + .5, 0, r.z1 + TI / 2);
      wc.rotation.y = 0; wc.position.set(r.x2 - .4, 0, r.z1 + TI / 2);
      wc.visible = r.x2 - .4 - (px2 + .5) > .75;
    }
    plat.visible = !ban; banyera.visible = ban;
    posaCaixa(ban ? banyera : plat, px1, px2, 0, ban ? .55 : .012, pz1, pz2);
  } };
}
const MOBLES = { dorm: mobleDorm, salon: mobleSalo, cocina: mobleCuina, bano: mobleBany };

/* ── Muntar el pis (quan canvien els dormitoris o els banys) ── */
const elEtiq = $('.pn-etiquetes');
let etiquetes = [];
function etiqueta(cls) {
  const el = document.createElement('div'); el.className = 'pn-et' + (cls ? ' ' + cls : '');
  elEtiq.appendChild(el);
  const e = { pos: new THREE.Vector3(), el }; etiquetes.push(e); return e;
}
function muntaPla(anima) {
  if (pla) { scene.remove(pla.grup); allibera(pla.grup); }
  elEtiq.replaceChildren(); etiquetes = [];
  const g = new THREE.Group(), fons = ordreFons();
  const P = { grup: g, zones: {}, linies: {} };
  P.base = caixaU(M.base, g, false);
  P.linies.davant = novaLinia(g, 3, true);
  P.linies.darrere = novaLinia(g, st.dorm, true);
  P.linies.esq = novaLinia(g, 0); P.linies.dre = novaLinia(g, 0);
  P.linies.fons = novaLinia(g, fons.length);
  P.linies.parts = fons.slice(0, -1).map(() => novaLinia(g, 0));
  P.linies.passadis = novaLinia(g, 1);
  P.linies.cuina = novaLinia(g, 1);
  // Cada finestra porta el material de la seva zona (blanca o grafit si és nova)
  const marcDe = id => materialsZona(st.zones.get(id)).marc;
  ['salon', 'salon', 'cocina'].forEach((id, i) => { P.linies.davant.forats[i].marc.material = marcDe(id); });
  fons.filter(id => id.startsWith('dorm')).forEach((id, i) => { P.linies.darrere.forats[i].marc.material = marcDe(id); });
  for (const [id, z] of st.zones) {
    const mt = materialsZona(z);
    const terra = caixaU(mt.terra, g, false);
    const vel = caixaU(mt.vel, g, false); vel.userData.zona = id; vel.renderOrder = 2;
    const mb = MOBLES[z.tipus] ? MOBLES[z.tipus]() : null;
    if (mb) g.add(mb.grup);
    P.zones[id] = { terra, vel, mobles: mb, et: etiqueta() };
  }
  P.marc = [0, 1, 2, 3].map(() => caixaU(M.cota, g, false));
  P.cotes = { x: [0, 1, 2].map(() => caixaU(M.cota, g, false)), z: [0, 1, 2].map(() => caixaU(M.cota, g, false)) };
  P.etX = etiqueta('pn-et-cota'); P.etZ = etiqueta('pn-et-cota');
  pla = P; scene.add(g);
  plaObj = calculaPla(); plaAra = copiaPla(plaObj);
  aplicaPla(plaAra); aplicaMaterials();
  if (anima) creix(g, 700);
  pintaEtiquetes();
  brut = true;
}
function aplicaPla(L) {
  const P = pla, { W, D, zB, zF } = L, Z = L.zones, s = Z.salon, c = Z.cocina, fons = ordreFons();
  posaCaixa(P.base, -W / 2 - .9, W / 2 + .9, -.2, -.031, -D / 2 - .9, D / 2 + .9);
  const ws = s.x2 - s.x1, fw = Math.min(1.4, ws * .26), wc = c.x2 - c.x1, cw = Math.min(1.1, wc * .4);
  posaLinia(P.linies.davant, -W / 2 - TE, W / 2 + TE, D / 2 + TE / 2, 'x', TE, [
    [s.x1 + ws * .28 - fw / 2, s.x1 + ws * .28 + fw / 2], [s.x1 + ws * .72 - fw / 2, s.x1 + ws * .72 + fw / 2],
    [(c.x1 + c.x2) / 2 - cw / 2, (c.x1 + c.x2) / 2 + cw / 2]]);
  posaLinia(P.linies.darrere, -W / 2 - TE, W / 2 + TE, -D / 2 - TE / 2, 'x', TE, fons.filter(id => id.startsWith('dorm')).map(id => {
    const r = Z[id], w = Math.min(1.2, (r.x2 - r.x1) * .45), cx = (r.x1 + r.x2) / 2; return [cx - w / 2, cx + w / 2];
  }));
  posaLinia(P.linies.esq, -D / 2, D / 2, -W / 2 - TE / 2, 'z', TE, []);
  posaLinia(P.linies.dre, -D / 2, D / 2, W / 2 + TE / 2, 'z', TE, []);
  posaLinia(P.linies.fons, -W / 2, W / 2, zB, 'x', TI, fons.map(id => {
    const r = Z[id], p = Math.min(.8, r.x2 - r.x1 - .35) / 2, cx = (r.x1 + r.x2) / 2; return [cx - p, cx + p];
  }));
  fons.slice(0, -1).forEach((id, i) => posaLinia(P.linies.parts[i], -D / 2, zB, Z[id].x2, 'z', TI, []));
  posaLinia(P.linies.passadis, -W / 2, W / 2, zF, 'x', TI, [[s.x1 + .6, s.x2 - .6]]);
  posaLinia(P.linies.cuina, zF, D / 2, s.x2, 'z', TI, [[zF + .3, Math.min(zF + 1.3, D / 2 - .3)]]);
  for (const [id, o] of Object.entries(P.zones)) {
    const r = Z[id];
    posaCaixa(o.terra, r.x1, r.x2, -.03, 0, r.z1, r.z2);
    posaCaixa(o.vel, r.x1 + TI / 2, r.x2 - TI / 2, 0, HM + .05, r.z1 + TI / 2, r.z2 - TI / 2);
    if (o.mobles) o.mobles.posa(r, st.zones.get(id).opts);
    o.et.pos.set((r.x1 + r.x2) / 2, HM + .3, (r.z1 + r.z2) / 2);
  }
  // Marc blau a la zona que s'edita
  const a = st.activa && Z[st.activa], m = P.marc, i = .14, y1 = .004, y2 = .03, g = .05;
  m.forEach(x => { x.visible = !!a; });
  if (a) {
    posaCaixa(m[0], a.x1 + i, a.x2 - i, y1, y2, a.z1 + i, a.z1 + i + g);
    posaCaixa(m[1], a.x1 + i, a.x2 - i, y1, y2, a.z2 - i - g, a.z2 - i);
    posaCaixa(m[2], a.x1 + i, a.x1 + i + g, y1, y2, a.z1 + i, a.z2 - i);
    posaCaixa(m[3], a.x2 - i - g, a.x2 - i, y1, y2, a.z1 + i, a.z2 - i);
  }
  // Cotes
  const zc = D / 2 + TE + .55, xc = W / 2 + TE + .55, h1 = .005, h2 = .02, t = .025;
  posaCaixa(P.cotes.x[0], -W / 2, W / 2, h1, h2, zc - t / 2, zc + t / 2);
  posaCaixa(P.cotes.x[1], -W / 2 - t / 2, -W / 2 + t / 2, h1, h2, zc - .15, zc + .15);
  posaCaixa(P.cotes.x[2], W / 2 - t / 2, W / 2 + t / 2, h1, h2, zc - .15, zc + .15);
  posaCaixa(P.cotes.z[0], xc - t / 2, xc + t / 2, h1, h2, -D / 2, D / 2);
  posaCaixa(P.cotes.z[1], xc - .15, xc + .15, h1, h2, -D / 2 - t / 2, -D / 2 + t / 2);
  posaCaixa(P.cotes.z[2], xc - .15, xc + .15, h1, h2, D / 2 - t / 2, D / 2 + t / 2);
  P.etX.pos.set(0, .05, zc); P.etZ.pos.set(xc, .05, 0);
  const tx = fmtM(W), tz = fmtM(D);
  if (P.etX.el.textContent !== tx) P.etX.el.textContent = tx;
  if (P.etZ.el.textContent !== tz) P.etZ.el.textContent = tz;
}
function fmtM(l) { const s = l.toFixed(1); return (document.documentElement.lang === 'en' ? s : s.replace('.', ',')) + ' m'; }
function pintaEtiquetes() {
  if (!pla) return;
  for (const [id, o] of Object.entries(pla.zones)) {
    const z = st.zones.get(id);
    o.et.el.innerHTML = `${nomZona(z)}<small>${fmtNum(z.opts.m2)} m²</small>`;
    o.et.el.classList.toggle('pn-et-off', !z.on);
    o.et.el.classList.toggle('pn-et-activa', st.activa === id);
  }
}
/* La distribució a la qual ha d'anar el pis (lliscant) */
function nouObjectiu() {
  if (!pla) return;
  plaObj = calculaPla();
  radiObjectiu = vista('pis', Math.max(plaObj.W, plaObj.D)).r;
  brut = true;
}
/* Un pas cap a l'objectiu: distribució, vels de les zones i distància de la càmera */
function avancaPla(dt) {
  if (!pla) return false;
  const k = QUIET ? 1 : 1 - Math.exp(-dt * 11);
  let mou = acostaPla(plaAra, plaObj, k) > .0005;
  if (mou || plaAra._brut) { aplicaPla(plaAra); plaAra._brut = false; }
  for (const [id, o] of Object.entries(pla.zones)) {
    const z = st.zones.get(id), obj = z.on ? 0 : hover === id ? .3 : .5, mt = o.vel.material;
    const d = obj - mt.opacity;
    if (Math.abs(d) > .002) { mt.opacity += d * (QUIET ? 1 : 1 - Math.exp(-dt * 9)); mou = true; } else mt.opacity = obj;
    o.vel.visible = mt.opacity > .003 || !z.on;
  }
  if (radiObjectiu != null) {
    const v = camera.position.clone().sub(controls.target), r = v.length(), d = radiObjectiu - r;
    if (Math.abs(d) > .01) { camera.position.copy(controls.target).add(v.setLength(r + d * k)); mou = true; } else radiObjectiu = null;
  }
  return mou;
}

/* ── Animació (tweens petits, sense biblioteca) ── */
const tweens = new Set();
const ease = k => 1 - Math.pow(1 - k, 3);
function tween(dur, fn) {
  if (QUIET || !dur) { fn(1); brut = true; return; }
  tweens.add({ t0: performance.now(), dur, fn });
}
function tweenColor(material, hex, dur = 380) {
  const de = material.color.clone(), a = new THREE.Color(hex);
  tween(dur, k => material.color.copy(de).lerp(a, k));
}
function creix(obj, dur = 650) {          // «s'aixeca» des del terra
  obj.scale.y = QUIET ? 1 : .001;
  tween(dur, k => { obj.scale.y = Math.max(.001, k); });
}

/* ── Càmera ── */
function vista(quina, mida = 0, asp = visor.clientWidth / Math.max(1, visor.clientHeight)) {
  const f = Math.pow(Math.max(1, 1.45 / asp), .75);
  if (quina === 'cocina') return { t: new THREE.Vector3(.05, .8, -.1), r: (mida * 1.3 + 2.4) * f, pol: 1.06, az: .6 };
  if (quina === 'bano') return { t: new THREE.Vector3(0, 1.0, -.1), r: (mida * 1.35 + 2.2) * f, pol: 1.08, az: .6 };
  return { t: new THREE.Vector3(0, 0, .25), r: (mida * 1.5 + 5) * f, pol: .8, az: .38 };
}
function vistaActual(asp) {
  const mida = st.vista === 'pis' ? (plaObj ? Math.max(plaObj.W, plaObj.D) : 10) : interior ? interior.userData.mida : 5;
  return vista(st.vista, mida, asp);
}
function posa(v, dur = 900) {
  const de = camera.position.clone(), deT = controls.target.clone();
  const a = new THREE.Vector3(Math.sin(v.pol) * Math.sin(v.az), Math.cos(v.pol), Math.sin(v.pol) * Math.cos(v.az)).multiplyScalar(v.r).add(v.t);
  const pis = st.vista === 'pis';
  controls.minAzimuthAngle = v.az - (pis ? 1.2 : .75); controls.maxAzimuthAngle = v.az + (pis ? 1.2 : .75);
  controls.minDistance = v.r * .5; controls.maxDistance = v.r * 1.4;
  controls.minPolarAngle = pis ? .2 : .7; controls.maxPolarAngle = pis ? 1.15 : 1.38;
  radiObjectiu = null;
  tween(dur, k => { camera.position.lerpVectors(de, a, k); controls.target.lerpVectors(deT, v.t, k); });
}
function ombraPer(mida) {
  const c = sol.shadow.camera, s = mida / 2 + 2;
  c.left = c.bottom = -s; c.right = c.top = s; c.far = 50; c.updateProjectionMatrix();
}

/* ── Materials segons les opcions de cada zona ── */
function allibera(obj) { obj.traverse(o => { if (o.geometry && o.geometry !== GEO) o.geometry.dispose(); }); }
function aplicaMaterials() {
  if (!renderer) return;
  for (const z of st.zones.values()) {
    const mt = materialsZona(z), o = z.opts;
    if (z.tipus === 'cocina') {
      const colors = { blanco: 0xE7E3DA, salvia: 0x8F9B86, noche: 0x2B3446, grafito: 0x3A3C3F };
      if (o.frente === 'roble') { if (M.frente.map !== tex('robleV', .8)) { M.frente.map = tex('robleV', .8); M.frente.color.set(0xffffff); M.frente.needsUpdate = true; } }
      else { if (M.frente.map) { M.frente.map = null; M.frente.needsUpdate = true; } if (M.frente.color.getHex() !== colors[o.frente]) tweenColor(M.frente, colors[o.frente]); }
      const fosc = o.frente !== 'blanco' && o.frente !== 'roble';
      M.tirador.color.set(fosc ? 0xB08D57 : 0x1C1D1E); M.tirador.metalness = fosc ? 1 : .6;
      const enc = { roble: ['roble', 1.2, .5], cuarzo: ['cuarzo', 1, .22], marmol: ['marmol', 1.6, .12] }[o.encimera];
      M.encimera.map = tex(enc[0], enc[1]); M.encimera.roughness = enc[2]; M.encimera.needsUpdate = true;
      const ter = TERRES[o.suelo] || TERRES.porcelanico;
      M.terra.map = tex(ter[0], ter[1]); M.terra.roughness = ter[2]; M.terra.needsUpdate = true;
      mt.terra.map = tex(ter[0], ter[1]); mt.terra.roughness = ter[2];
      M.led.emissiveIntensity = o.paquete === 'esencial' ? 0 : 2.2;
    } else if (z.tipus === 'bano') {
      if (st.activa === z.id || !st.activa || z.n === 1) {     // els banys comparteixen materials: mana el que s'edita
        const az = { blanco: '#ECEAE4', verde: '#9DB4A6', cobalto: '#2C4C9A' }[o.pared];
        M.rajola.map = o.pared === 'micro' ? tex('microcemento', 1.6) : tex('az' + az, .6, azulejo(az));
        M.rajola.roughness = o.pared === 'micro' ? .6 : .28; M.rajola.needsUpdate = true;
        M.terraBany.map = o.pared === 'micro' ? tex('microcemento', 2) : tex('rajolaTerra', .8); M.terraBany.needsUpdate = true;
        if (o.mueble === 'roble') { M.moble.map = tex('robleV', .8); M.moble.color.set(0xffffff); }
        else { M.moble.map = null; M.moble.color.set(o.mueble === 'blanco' ? 0xECEAE4 : 0x3A3C3F); }
        M.moble.needsUpdate = true;
      }
      mt.terra.map = o.pared === 'micro' ? tex('microcemento', 2) : tex('rajolaTerra', .8);
    } else {
      const ter = TERRES[o.suelo] || TERRES.porcelanico;
      mt.terra.map = tex(ter[0], ter[1]); mt.terra.roughness = ter[2];
      mt.marc.color.set(o.ventanas ? 0x34383B : 0xF5F4F0);
    }
    mt.terra.needsUpdate = true;
  }
  if (plaAra) plaAra._brut = true;     // els mobles (armari, illa, banyera) depenen de les opcions
  brut = true;
}

/* ── Veure la cuina o el bany per dins ── */
function obreInterior() {
  const z = st.zones.get(st.activa);
  if (!z || !renderer) return;
  st.vista = z.tipus;
  if (interior) { scene.remove(interior); allibera(interior); }
  interior = z.tipus === 'cocina' ? escenaCuina(z.opts) : escenaBany(z.opts);
  interior.userData.ultim = { ...z.opts };
  scene.add(interior); creix(interior, 600);
  pla.grup.visible = false; elEtiq.hidden = true;
  $('[data-torna]').hidden = false;
  ombraPer(interior.userData.mida + 2);
  posa(vistaActual());
  $('.pn-pista').textContent = I18N.t('Arrastra para girarla');
  brut = true;
}
function tancaInterior() {
  if (interior) { scene.remove(interior); allibera(interior); interior = null; }
  st.vista = 'pis';
  pla.grup.visible = true; elEtiq.hidden = false;
  $('[data-torna]').hidden = true;
  ombraPer(Math.max(plaObj.W, plaObj.D) + 2);
  posa(vistaActual());
  $('.pn-pista').textContent = I18N.t('Toca una zona para elegirla. Arrastra para girar el piso.');
  brut = true;
}
/* Canvis d'opcions amb la cuina o el bany oberts */
let refrescPendent = false;
function refrescaInterior() {
  if (!interior || refrescPendent) return;
  refrescPendent = true;
  requestAnimationFrame(() => {
    refrescPendent = false;
    const z = st.zones.get(st.activa);
    if (!interior || !z || z.tipus !== st.vista) return;
    const v = z.opts, u = interior.userData.ultim;
    if (v.m2 !== u.m2) {
      scene.remove(interior); allibera(interior);
      interior = z.tipus === 'cocina' ? escenaCuina(v) : escenaBany(v);
      scene.add(interior);
      radiObjectiu = vistaActual().r;
    } else if (z.tipus === 'cocina' && v.forma !== u.forma) {
      const m = interior.userData.mobles; m.children.slice().forEach(c => { m.remove(c); allibera(c); });
      muntaCuina(m, v.forma, interior.userData.mides); creix(m, 550);
    } else if (z.tipus === 'bano' && (v.tipo !== u.tipo || v.paquete !== u.paquete)) {
      const p = interior.userData.peces; p.children.slice().forEach(c => { p.remove(c); allibera(c); });
      muntaBany(p, v, interior.userData.mides); creix(p, 500);
    }
    interior.userData.ultim = { ...v };
    brut = true;
  });
}

/* ── Tocar la maqueta ── */
const ray = new THREE.Raycaster(), punter = new THREE.Vector2();
function zonaSota(e) {
  if (!pla || st.vista !== 'pis') return null;
  const r = canvas.getBoundingClientRect();
  punter.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(punter, camera);
  const hit = ray.intersectObjects(Object.values(pla.zones).map(o => o.vel), false)[0];
  return hit ? hit.object.userData.zona : null;
}

function iniciaWebGL() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { renderer = null; }
  if (!renderer || !renderer.getContext()) {
    renderer = null;
    elEstat.textContent = I18N.t('Tu navegador no puede mostrar la maqueta en 3D. El precio funciona igual.');
    return false;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBIL ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .42;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC2, .5));
  sol = new THREE.DirectionalLight(0xFFEFD8, 3.0);
  sol.position.set(-3, 9, 6.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(MOBIL ? 1024 : 2048, MOBIL ? 1024 : 2048);
  sol.shadow.bias = -.0005; sol.shadow.normalBias = .025; sol.shadow.radius = 4;
  scene.add(sol, sol.target);
  const terra = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: .1 }));
  terra.rotation.x = -Math.PI / 2; terra.position.y = -.201; terra.receiveShadow = true; scene.add(terra);

  camera = new THREE.PerspectiveCamera(30, 1, .1, 200);
  camera.position.set(8, 14, 12);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !QUIET; controls.dampingFactor = .08;
  controls.enablePan = false; controls.rotateSpeed = .55; controls.zoomSpeed = .6;
  controls.addEventListener('start', () => { radiObjectiu = null; });

  preparaMaterials();
  M.base = new THREE.MeshStandardMaterial({ color: 0xF3F2EE, roughness: .9 });
  M.vidrePla = new THREE.MeshStandardMaterial({ color: 0xCFE0E6, roughness: .05, transparent: true, opacity: .45, depthWrite: false });
  M.plat = new THREE.MeshStandardMaterial({ color: 0x8E8D88, roughness: .5 });
  M.coixi = new THREE.MeshStandardMaterial({ color: 0xB9B1A3, roughness: 1 });
  MP = [M.paret, M.paret, M.tall, M.paret, M.paret, M.paret];

  new ResizeObserver(() => {
    const w = visor.clientWidth, h = visor.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); brut = true;
  }).observe(visor);

  let visible = true, tAbans = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(visor);
  const v3 = new THREE.Vector3();
  renderer.setAnimationLoop(t => {
    const dt = Math.min(.05, (t - tAbans) / 1000); tAbans = t;
    if (!visible) return;
    for (const tw of tweens) {
      const k = Math.min(1, (t - tw.t0) / tw.dur);
      tw.fn(ease(k)); if (k >= 1) tweens.delete(tw);
      brut = true;
    }
    if (st.vista === 'pis' && avancaPla(dt)) brut = true;
    if (controls.update()) brut = true;
    if (!brut) return;
    brut = false;
    renderer.render(scene, camera);
    if (st.vista === 'pis' && etiquetes.length) {
      const w = visor.clientWidth, h = visor.clientHeight, sy = pla ? pla.grup.scale.y : 1;
      for (const e of etiquetes) {
        v3.copy(e.pos).project(camera);
        e.el.style.transform = `translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px) translate(-50%, -50%)`;
        e.el.style.opacity = sy > .95 ? '' : 0;
      }
    }
  });

  // Tocar: un clic sense arrossegar tria la zona; el ratolí per sobre la il·lumina
  let baixa = null;
  canvas.addEventListener('pointerdown', e => { baixa = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!baixa) return;
    const mou = Math.hypot(e.clientX - baixa.x, e.clientY - baixa.y); baixa = null;
    if (mou > 6) return;
    const id = zonaSota(e);
    if (id) { tocaZona(id); if (!elEditor.hidden) elEditor.scrollIntoView({ behavior: QUIET ? 'auto' : 'smooth', block: MOBIL ? 'start' : 'nearest' }); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || baixa) return;
    const id = zonaSota(e);
    if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : ''; brut = true; }
  });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; canvas.style.cursor = ''; brut = true; } });

  elEstat.dataset.estat = 'llest';
  return true;
}


/* ═══ 5. PDF I WHATSAPP ══════════════════════════════════════════
   El PDF es fa aquí mateix, sense biblioteca: una pàgina A4 amb la
   captura de la maqueta (JPEG), el que s'ha triat i les partides.
   El servidor (/api/disseny) només desa el correu i dona el WhatsApp. */

function resumDisseny() {
  const r = calcula(), files = [];
  for (const [nom, , p] of r.linies) files.push([nom, p.detalls.join(' · ')]);
  files.push([I18N.t('Empezamos'), $('output[data-tria="setmana"]').textContent.trim()]);
  files.push([I18N.t('Te la entregamos'), I18N.t('semana del {dia}', { dia: $('[data-entrega]').textContent.trim() })]);
  const totes = r.triades.length === st.zones.size;
  const modeNom = totes ? I18N.t('Todo el piso') : r.triades.map(nomZona).join(', ');
  const m2 = r.triades.reduce((a, z) => a + z.opts.m2, 0);
  return { mode: 'integral', modeNom, files, linies: r.linies.map(l => [l[0], l[1]]), total: r.total, v: { m2, paquete: '' } };
}

/* Captura de la maqueta a 1600×1000, amb les etiquetes dibuixades a sobre */
function capturaMaqueta(w = 1600, h = 1000) {
  if (!renderer) return null;
  for (const tw of tweens) tw.fn(1);            // la foto, amb les animacions acabades
  tweens.clear();
  controls.update();
  const abans = new THREE.Vector2(); renderer.getSize(abans);
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  // Mateix angle que veu l'usuari, però la distància que toca per a una foto apaïsada
  const posAbans = camera.position.clone();
  const vf = vistaActual(w / h);
  camera.position.sub(controls.target).normalize().multiplyScalar(vf.r * .92).add(controls.target);
  renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const fons = g.createRadialGradient(w * .4, h * .3, 0, w * .4, h * .3, w * .9);
  fons.addColorStop(0, '#F3F4F1'); fons.addColorStop(1, '#DADDD6');
  g.fillStyle = fons; g.fillRect(0, 0, w, h);
  g.drawImage(renderer.domElement, 0, 0, w, h);
  const v3 = new THREE.Vector3();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const e of etiquetes) {
    v3.copy(e.pos).project(camera);
    const x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * h;
    const nom = e.el.firstChild.textContent, sub = ($('small', e.el) || {}).textContent || '';
    const cota = !!e.cls;
    g.font = `600 ${cota ? 20 : 22}px "Bricolage Grotesque", Arial, sans-serif`;
    const amp = Math.max(g.measureText(nom).width, sub ? g.measureText(sub).width : 0) + 22;
    const alt = sub ? 54 : 32;
    g.fillStyle = cota ? '#2A4BD7' : 'rgba(255,255,255,.88)';
    g.beginPath(); g.roundRect(x - amp / 2, y - alt / 2, amp, alt, 6); g.fill();
    g.fillStyle = cota ? '#FFFFFF' : '#22262A';
    g.fillText(nom, x, sub ? y - 10 : y);
    if (sub) { g.font = '500 18px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#5F6661'; g.fillText(sub, x, y + 13); }
  }
  camera.position.copy(posAbans);
  renderer.setPixelRatio(pr); renderer.setSize(abans.x, abans.y, false);
  camera.aspect = abans.x / abans.y; camera.updateProjectionMatrix(); brut = true;
  return c.toDataURL('image/jpeg', .88);
}

/* ── Escriptor de PDF mínim (Helvetica amb codificació WinAnsi) ── */
const AMPLES = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584'.split(',').map(Number);
const WINANSI = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
function bytesText(s) {
  const out = [];
  for (const ch of s.normalize('NFC')) {
    const c = ch.codePointAt(0);
    out.push(WINANSI[ch] ?? (c < 256 ? c : 63));
  }
  return out;
}
function amplada(s, mida, negreta) {
  let t = 0;
  for (const b of bytesText(s)) {
    const base = b >= 0xC0 ? String.fromCharCode(b).normalize('NFD').charCodeAt(0) : b;   // «é» fa com «e»
    let a = base >= 32 && base < 127 ? AMPLES[base - 32] : b === 0x97 || b === 0x85 ? 1000 : b === 0x80 || b === 0x96 ? 556 : 333;
    if (negreta && b >= 65) a *= 1.07;
    t += a;
  }
  return t * mida / 1000;
}
function trenca(s, mida, max, negreta) {
  const linies = []; let l = '';
  for (const p of s.split(' ')) {
    const prova = l ? l + ' ' + p : p;
    if (amplada(prova, mida, negreta) > max && l) { linies.push(l); l = p; } else l = prova;
  }
  if (l) linies.push(l);
  return linies;
}
function cadenaPdf(s) {
  return '(' + bytesText(s).map(b => (b === 40 || b === 41 || b === 92 ? '\\' : '') + String.fromCharCode(b)).join('') + ')';
}
function fesPdf(r, jpeg, correu) {
  const W = 595.28, H = 841.89, M = 44, amp = W - 2 * M;
  const ops = [];
  const color = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => v.toFixed(3)).join(' '); };
  const text = (s, x, y, mida, { negreta = false, col = '#22262A', dreta = false } = {}) => {
    const xx = dreta ? x - amplada(s, mida, negreta) : x;
    ops.push(`BT ${color(col)} rg /${negreta ? 'F2' : 'F1'} ${mida} Tf ${xx.toFixed(2)} ${y.toFixed(2)} Td ${cadenaPdf(s)} Tj ET`);
  };
  const linia = (x1, y1, x2, y2, col = '#C4C8C1', g = .6) => ops.push(`${color(col)} RG ${g} w ${x1} ${y1} m ${x2} ${y2} l S`);

  // Capçalera
  text('Cota Cero Reformas', M, H - 50, 12, { negreta: true });
  text('cota-cero.pages.dev  ·  600 000 000', W - M, H - 50, 9, { col: '#5F6661', dreta: true });
  linia(M, H - 62, W - M, H - 62);
  // Títol
  const titol = trenca(`${I18N.t('Tu reforma')}: ${r.modeNom}`, 22, amp, true).slice(0, 2);
  titol.forEach((l, i) => text(l, M, H - 96 - i * 26, 22, { negreta: true }));
  const extra = (titol.length - 1) * 26;
  const avui = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  text(`${I18N.t('Diseñada el {dia}', { dia: avui })}${correu ? '  ·  ' + correu : ''}`, M, H - 114 - extra, 9.5, { col: '#5F6661' });
  // Imatge
  let y = H - 128 - extra;
  let ih = 0;
  if (jpeg) {
    // Amb moltes zones la llista és llarga: la imatge s'encongeix perquè tot càpiga en una pàgina
    const ampCol0 = amp * .5 - 14;
    const altEsq = 20 + r.files.reduce((a, [, v]) => a + 17.5 + trenca(v, 10.5, ampCol0, true).length * 13.5, 0);
    const altDre = 20 + r.linies.reduce((a, [n]) => a + trenca(n, 9.5, ampCol0 - 70).length * 12 + 17, 0) + 70;
    const lloc = y - 30 - Math.max(altEsq, altDre) - 90;
    ih = Math.max(150, Math.min(amp * jpeg.h / jpeg.w, lloc));
    const iw = ih * jpeg.w / jpeg.h;
    ops.push(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${M} ${(y - ih).toFixed(2)} cm /Im1 Do Q`);
    y -= ih + 30;
  }
  // Columna esquerra: el que has triat
  const cx2 = M + amp * .5 + 14, ampCol = amp * .5 - 14;
  let ye = y;
  text(I18N.t('Lo que has elegido'), M, ye, 11, { negreta: true }); ye -= 20;
  for (const [nom, valor] of r.files) {
    text(nom, M, ye, 8.5, { col: '#5F6661' }); ye -= 12.5;
    for (const l of trenca(valor, 10.5, ampCol, true)) { text(l, M, ye, 10.5, { negreta: true }); ye -= 13.5; }
    ye -= 5;
  }
  // Columna dreta: partides i total
  let yd = y;
  text(I18N.t('Partidas'), cx2, yd, 11, { negreta: true }); yd -= 20;
  for (const [nom, n] of r.linies) {
    const ls = trenca(nom, 9.5, ampCol - 70);
    ls.forEach((l, i) => { text(l, cx2, yd - i * 12, 9.5); });
    text(n ? eur(n) : I18N.t('Incluido'), W - M, yd, 9.5, { negreta: true, dreta: true });
    yd -= ls.length * 12 + 4;
    linia(cx2, yd + 1, W - M, yd + 1, '#DADDD6', .5); yd -= 13;
  }
  yd -= 6;
  text($('.pn-preu-etiqueta').textContent.trim(), cx2, yd, 9, { col: '#5F6661' }); yd -= 30;
  text(eur(r.total), cx2, yd, 28, { negreta: true, col: '#2A4BD7' });
  // Peu
  linia(M, 74, W - M, 74);
  trenca(I18N.t('Lo que no está en esta lista no se cobra. Antes de firmar venimos a tu casa a medir, y si todo cuadra, firmamos este precio.'), 8.5, amp).forEach((l, i) => text(l, M, 60 - i * 11, 8.5, { col: '#5F6661' }));

  // Muntatge dels objectes
  const parts = [], offsets = [];
  let mida = 0;
  const posa = b => { const u = typeof b === 'string' ? Uint8Array.from(b, c => c.charCodeAt(0)) : b; parts.push(u); mida += u.length; };
  const obj = (n, cos, stream) => {
    offsets[n] = mida;
    posa(`${n} 0 obj\n${cos}\n`);
    if (stream) { posa('stream\n'); posa(stream); posa('\nendstream\n'); }
    posa('endobj\n');
  };
  posa('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const contingut = Uint8Array.from(ops.join('\n'), c => c.charCodeAt(0));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${jpeg ? ' /XObject << /Im1 7 0 R >>' : ''} >> /Contents 4 0 R >>`);
  obj(4, `<< /Length ${contingut.length} >>`, contingut);
  obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const n = jpeg ? 8 : 7;
  if (jpeg) obj(7, `<< /Type /XObject /Subtype /Image /Width ${jpeg.w} /Height ${jpeg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>`, jpeg.bytes);
  const xref = mida;
  let x = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  posa(x + `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

async function descarregaPdf(correu) {
  const r = resumDisseny();
  const url = capturaMaqueta();
  let jpeg = null;
  if (url) {
    const bin = atob(url.split(',')[1]);
    jpeg = { w: 1600, h: 1000, bytes: Uint8Array.from(bin, c => c.charCodeAt(0)) };
  }
  const blob = fesPdf(r, jpeg, correu);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cota-cero-${r.mode}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return r;
}

function dadesServidor(r, extra) {
  return {
    ...extra, mode: r.mode, m2: r.v.m2, total: r.total, paquete: r.v.paquete,
    inici: ($('input[name="setmana"]:checked', elDies) || {}).value || '',
    idioma: document.documentElement.lang || 'es', files: r.files,
  };
}
function envia(dades) {
  return fetch('/api/disseny', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dades),
  }).then(res => res.ok ? res.json() : Promise.reject(res.status));
}

/* ── Finestra del PDF ── */
const dialeg = $('[data-dialeg-pdf]'), formPdf = $('[data-form-pdf]');
const botoPdf = $('[data-baixa-pdf]'), errPdf = $('[data-error-pdf]'), fetPdf = $('[data-fet-pdf]');
const textBotoPdf = botoPdf.textContent;
$('[data-obre-pdf]').addEventListener('click', () => {
  errPdf.hidden = true; fetPdf.hidden = true; formPdf.correu.removeAttribute('aria-invalid');
  dialeg.showModal(); formPdf.correu.focus();
});
$('[data-tanca]').addEventListener('click', () => dialeg.close());
dialeg.addEventListener('click', e => { if (e.target === dialeg) dialeg.close(); });
formPdf.addEventListener('submit', async e => {
  e.preventDefault();
  const correu = formPdf.correu.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correu)) {
    errPdf.hidden = false; formPdf.correu.setAttribute('aria-invalid', 'true'); formPdf.correu.focus(); return;
  }
  errPdf.hidden = true; formPdf.correu.removeAttribute('aria-invalid');
  botoPdf.setAttribute('aria-busy', 'true'); botoPdf.disabled = true; botoPdf.textContent = I18N.t('Preparando el PDF…');
  try {
    const r = await descarregaPdf(correu);
    envia(dadesServidor(r, { accio: 'pdf', correu })).catch(() => {});   // el PDF no depèn del servidor
    fetPdf.hidden = false;
  } finally {
    botoPdf.removeAttribute('aria-busy'); botoPdf.disabled = false; botoPdf.textContent = textBotoPdf;
  }
});

/* ── WhatsApp: el número és un secret del servidor ── */
const errWa = $('[data-error-wa]');
$('[data-whatsapp]').addEventListener('click', async () => {
  errWa.hidden = true;
  const r = resumDisseny();
  const missatge = I18N.t('Hola, he diseñado mi reforma en vuestra web: {obra}. {detall}. Precio: {preu}. ¿Podemos hablar?',
    { obra: r.modeNom, detall: r.files.map(f => `${f[0]}: ${f[1]}`).join('; '), preu: eur(r.total) });
  const finestra = window.open('', '_blank');          // s'obre ara, amb el clic, perquè no la bloquegin
  try {
    const d = await envia(dadesServidor(r, { accio: 'whatsapp' }));
    const num = String(d.whatsapp || '').replace(/\D/g, '');
    if (!num) throw new Error('sense número');
    const url = `https://wa.me/${num}?text=${encodeURIComponent(missatge)}`;
    if (finestra) { finestra.opener = null; finestra.location.href = url; } else location.href = url;
  } catch {
    if (finestra) finestra.close();
    errWa.hidden = false;
  }
});


/* ═══ 7. ARRENCADA I ESDEVENIMENTS ═══════════════════════════════ */
/* Tocar una zona (a la maqueta o a la llista): apagada → s'encén i s'edita;
   encesa → s'edita; la que ja s'edita → s'apaga. */
function tocaZona(id) {
  const z = st.zones.get(id);
  const nova = !z.on;
  if (!z.on) z.on = true;
  else if (st.activa === id) z.on = false;
  obreEditor(id);
  if (nova && pla && pla.zones[id].mobles) creix(pla.zones[id].mobles.grup, 520);
  refresca();
}
function refresca() { if (plaAra) plaAra._brut = true; pintaPanell(); brut = true; }

pintaMostres();
preparaSetmanes();
sincronitzaZones();
if (iniciaWebGL()) {
  muntaPla(true);
  ombraPer(Math.max(plaObj.W, plaObj.D) + 2);
  posa(vista('pis', Math.max(plaObj.W, plaObj.D)), QUIET ? 0 : 1600);
} else calculaPlaSenseWebGL();
function calculaPlaSenseWebGL() { /* sense 3D, el passadís es queda amb els m² per defecte */ }

elZones.addEventListener('click', e => {
  const b = e.target.closest('[data-zona]');
  if (b) { tocaZona(b.dataset.zona); $(`[data-zona="${b.dataset.zona}"]`, elZones)?.focus(); }
});
$('[data-tot]').addEventListener('click', () => {
  for (const z of st.zones.values()) z.on = true;
  if (pla) Object.values(pla.zones).forEach(o => { if (o.mobles) creix(o.mobles.grup, 520); });
  refresca();
});
$$('[data-compta]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.compta;
  st[k] = Math.max(1, Math.min(k === 'dorm' ? 5 : 3, st[k] + +b.dataset.pas));
  sincronitzaZones();
  if (st.vista !== 'pis' && !st.activa) tancaInterior();
  obreEditor(st.activa);
  if (renderer) { muntaPla(true); nouObjectiu(); }
  pintaPanell();
}));
$('[data-incloure]').addEventListener('change', e => {
  const z = st.zones.get(st.activa);
  if (z) { z.on = e.target.checked; refresca(); }
});
Object.entries(forms).forEach(([clau, f]) => {
  f.addEventListener('submit', e => e.preventDefault());
  f.addEventListener('input', e => {
    const z = st.zones.get(st.activa);
    if (!z) return;
    if (e.target.name === 'm2') ajustaMinims(clau, true);
    const v = llegeixForm(clau), abans = z.opts.m2;
    if (z.tipus === 'pasillo') delete v.m2;
    z.opts = { ...z.opts, ...v };
    z.on = true;
    if (z.opts.m2 !== abans) nouObjectiu();
    aplicaMaterials();
    refrescaInterior();
    refresca();
  });
});
$('[data-dins]').addEventListener('click', obreInterior);
$('[data-torna]').addEventListener('click', tancaInterior);
elDies.addEventListener('change', () => pintaPanell());

/* Canvi d'idioma: es repinta tot el que escriu el JS (noms, dates, etiquetes de la maqueta) */
document.addEventListener('idioma-canviat', () => {
  const i = $$('input[name="setmana"]', elDies).findIndex(x => x.checked);
  preparaSetmanes();
  const ara = $$('input[name="setmana"]', elDies)[i];
  if (ara && !ara.disabled) ara.checked = true;
  if (plaAra) plaAra._brut = true;
  pintaPanell();
  brut = true;
});

// Entrada des de les pàgines de servei: ?tipo=cocina|bano|casa (o #cocina...)
const entrada = location.hash.slice(1) || new URLSearchParams(location.search).get('tipo');
if (entrada === 'cocina') tocaZona('cocina');
else if (entrada === 'bano') tocaZona('bano1');
else if (entrada === 'casa' || entrada === 'integral') { for (const z of st.zones.values()) z.on = true; refresca(); }
else pintaPanell();
