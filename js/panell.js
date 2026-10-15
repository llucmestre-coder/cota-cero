/* ════════════════════════════════════════════════════════════════
   PANELL «Diseña tu reforma» — maqueta 3D (Three.js) + preu tancat.
   Dues meitats independents: el preu i el panell funcionen sols; el
   3D se'ls escolta. Si WebGL falla, el panell continua igual.
   Res de fotos: tot és geometria i textures dibuixades aquí.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { OrbitControls } from '../assets/js/three/OrbitControls.js';
import { RoomEnvironment } from '../assets/js/three/RoomEnvironment.js';

// Textos del JS: I18N.t amb la frase castellana escrita literal (js/i18n.js). Sense i18n, queda el castellà.
const I18N = window.I18N || { t: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (tot, k) => v[k] ?? tot) : s) };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const QUIET = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBIL = matchMedia('(max-width: 860px)').matches;

/* ═══ 1. PREUS (euros, IVA inclòs) ═══════════════════════════════ */
const PREUS = {
  // Cada mode: `obra` és €/m² (enderroc, paret i terra), i les claus amb `/m2` es multipliquen pels m².
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
  integral: {
    m2: { esencial: 460, completa: 610, llave: 780 },
    suelo: { espiga: 28, microcemento: 22 },
    bano: 3800,
    setmanes: { esencial: 0, completa: 1, llave: 3 },
  },
};

/* ═══ 2. ESTAT DEL PANELL ════════════════════════════════════════ */
const arrel = $('.pn');
const forms = Object.fromEntries($$('.pn-opcions').map(f => [f.dataset.per, f]));
const st = { mode: 'cocina', integral: { dorm: 2, banos: 1 } };

function valors(mode) {
  const f = forms[mode];
  const v = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
    else v[el.name] = el.type === 'range' ? +el.value : el.value;
  }
  if (mode === 'integral') Object.assign(v, st.integral);
  return v;
}

/* Nom visible d'una opció: el text de l'etiqueta (així el tradueix i18n.js) */
function nomOpcio(mode, nom) {
  const inp = $(`input[name="${nom}"]:checked`, forms[mode]);
  if (!inp) return '';
  const lab = inp.closest('label');
  return ($('b', lab) || $('.visually-hidden', lab) || lab).textContent.trim();
}
function nomGrup(mode, nom) {
  const inp = $(`input[name="${nom}"]`, forms[mode]);
  const lg = inp && $('legend', inp.closest('fieldset'));
  return lg ? lg.firstChild.textContent.trim() : '';
}

function fmtNum(n) { const s = String(n); return document.documentElement.lang === 'en' ? s : s.replace('.', ','); }
function eur(n) {
  const lang = document.documentElement.lang || 'es';
  const sep = lang === 'en' ? ',' : '.';
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return lang === 'en' ? '€' + s : s + ' €';
}

function calcula() {
  const m = st.mode, v = valors(m), P = PREUS[m];
  const linies = [];
  let setmanes = 0;
  if (m === 'integral') {
    const base = v.m2 * P.m2[v.paquete];
    linies.push([`${v.m2} m² · ${nomOpcio(m, 'paquete')}`, base]);
    linies.push([`${$('#pn-banys').textContent} × ${v.banos}`, v.banos * P.bano]);
    const s = (P.suelo[v.suelo] || 0) * v.m2;
    linies.push([`${nomGrup(m, 'suelo')} · ${nomOpcio(m, 'suelo')}`, s]);
    setmanes = Math.ceil(v.m2 / 9) + v.banos + P.setmanes[v.paquete];
  } else {
    linies.push([`${I18N.t('Obra, paredes y suelo')} · ${fmtNum(v.m2)} m²`, Math.round(v.m2 * P.obra)]);
    for (const [clau, taula] of Object.entries(P)) {
      if (clau === 'setmanes' || clau === 'obra') continue;
      const [k, perM2] = clau.split('/');
      const n = (taula[v[k]] || 0) * (perM2 ? v.m2 : 1);
      linies.push([`${nomGrup(m, k)} · ${nomOpcio(m, k)}`, Math.round(n)]);
    }
    setmanes = P.setmanes[v.paquete] + (v.m2 > (m === 'cocina' ? 18 : 8) ? 1 : 0);
  }
  return { total: linies.reduce((a, l) => a + l[1], 0), linies, setmanes, v };
}

/* ── Pintar el panell ── */
const elTotal = $('[data-total]');
let totalVist = null;
function pintaPanell() {
  const r = calcula();
  // Noms triats al costat de cada títol
  $$('output[data-tria]').forEach(o => {
    const [mode, nom] = o.dataset.tria.split('.');
    if (mode !== st.mode || !nom) return;
    if (nom === 'm2') o.textContent = fmtNum(r.v.m2) + ' m²';
    else if (nom === 'dorm' || nom === 'banos') o.textContent = r.v[nom];
    else o.textContent = nomOpcio(mode, nom);
  });
  // Partides
  $('[data-partides]').innerHTML = r.linies
    .map(([t, n]) => `<li><span>${t}</span><span>${n ? eur(n) : I18N.t('Incluido')}</span></li>`).join('');
  // Total, comptant
  animaTotal(r.total);
  pintaEntrega(r.setmanes);
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
  const d = new Date(inp.value + 'T12:00:00'); d.setDate(d.getDate() + setmanes * 7);
  $('[data-entrega]').textContent = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long' }).format(d);
  const out = $('output[data-tria="setmana"]');
  const ini = new Date(inp.value + 'T12:00:00');
  out.textContent = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long' }).format(ini);
}

/* ── Comptadors (dormitoris i banys) amb límit pels m² ── */
function maxDorm(m2, banos) { return Math.max(1, Math.min(5, Math.floor((m2 - 26 - banos * 4.5) / 10))); }
function maxBanos(m2) { return Math.max(1, Math.min(3, Math.floor((m2 - 20) / 30))); }
function ajustaComptadors(avisa) {
  const m2 = +forms.integral.m2.value, s = st.integral;
  const avis = $('[data-avis]', forms.integral);
  let canvi = false;
  const mb = maxBanos(m2); if (s.banos > mb) { s.banos = mb; canvi = true; }
  const md = maxDorm(m2, s.banos); if (s.dorm > md) { s.dorm = md; canvi = true; }
  $$('[data-compta]').forEach(b => {
    const k = b.dataset.compta, p = +b.dataset.pas;
    const max = k === 'dorm' ? maxDorm(m2, s.banos) : maxBanos(m2);
    b.disabled = p < 0 ? s[k] <= 1 : s[k] >= max;
  });
  if (canvi && avisa) {
    avis.textContent = I18N.t('Con {m2} m² no caben tantas habitaciones. Lo hemos ajustado.', { m2 });
    avis.hidden = false;
    clearTimeout(ajustaComptadors.t);
    ajustaComptadors.t = setTimeout(() => { avis.hidden = true; }, 5000);
  }
  return canvi;
}

/* ── Opcions que no caben en pocs m²: l'illa (16 m²) i la banyera (5 m²) ── */
const MINIMS = {
  cocina: ['forma', 'isla', 16, 'l', () => I18N.t('Una isla necesita 16 m² como mínimo. La hemos cambiado por una cocina en L.')],
  bano: ['tipo', 'banera', 5, 'ducha', () => I18N.t('Una bañera necesita 5 m² como mínimo. La hemos cambiado por una ducha.')],
};
function ajustaMinims(mode, avisa) {
  const r = MINIMS[mode]; if (!r) return;
  const [nom, opcio, min, alternativa, clauAvis] = r, f = forms[mode];
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
const elEtiq = $('.pn-etiquetes');
let renderer, scene, camera, controls, sol, maqueta = null, brut = true;
let etiquetes = [];

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
  if (W >= 2.4 && D >= 1.8) planta(W / 2 - .3, D / 2 - .3, p, .8);
}

/* ── Escena: pis sencer (maqueta tallada a 1,1 m, vista des de dalt) ── */
function distribucio(v) {
  const A = v.m2;
  const W = Math.round(Math.sqrt(A * 1.5) * 10) / 10, D = Math.round(A / W * 10) / 10;
  const pass = A >= 70 ? 1.1 : 0;
  const dF = Math.max(2.6, (D - pass) * .46), dB = D - dF - pass;
  const zFront = D / 2 - dF, zBack = -D / 2 + dB;          // límits de les franges
  const kw = Math.min(3.6, Math.max(2.3, W * .3));
  const zones = [
    { tipus: 'salon', x1: -W / 2, x2: W / 2 - kw, z1: zFront, z2: D / 2 },
    { tipus: 'cocina', x1: W / 2 - kw, x2: W / 2, z1: zFront, z2: D / 2 },
  ];
  // Franja del fons: dormitoris i banys alternats
  const seq = [];
  for (let i = 0; i < v.dorm; i++) { seq.push({ tipus: 'dorm', n: i + 1, pes: i === 0 ? 1.3 : 1 }); if ((i === 0 || i === 2) && seq.filter(s => s.tipus === 'bano').length < v.banos) seq.push({ tipus: 'bano', pes: .55 }); }
  while (seq.filter(s => s.tipus === 'bano').length < v.banos) seq.push({ tipus: 'bano', pes: .55 });
  const total = seq.reduce((a, s) => a + s.pes, 0);
  let x = -W / 2, nb = 0;
  for (const s of seq) {
    const w = W * s.pes / total;
    zones.push({ ...s, n: s.tipus === 'bano' ? ++nb : s.n, x1: x, x2: x + w, z1: -D / 2, z2: zBack });
    x += w;
  }
  if (pass) zones.push({ tipus: 'pasillo', x1: -W / 2, x2: W / 2, z1: zBack, z2: zFront });
  return { W, D, zones, zFront, zBack, pass };
}
const HM = 1.1;   // alçada del tall de la maqueta
function escenaPis(v) {
  const g = new THREE.Group(), L = distribucio(v), { W, D } = L;
  const et = [];
  const nomsTxt = { salon: I18N.t('Salón y comedor'), cocina: I18N.t('Cocina'), dorm: I18N.t('Dormitorio'), bano: I18N.t('Baño') };
  for (const z of L.zones) {
    const w = z.x2 - z.x1, d = z.z2 - z.z1, cx = (z.x1 + z.x2) / 2, cz = (z.z1 + z.z2) / 2;
    const mt = z.tipus === 'bano' ? M.terraBany : z.tipus === 'cocina' ? M.terraCuinaPis : M.terraPis;
    const t = caixa(w, .03, d, mt, cx, -.03, cz, g); t.castShadow = false;
    if (z.tipus !== 'pasillo') {
      const nom = nomsTxt[z.tipus] + (z.tipus === 'dorm' || (z.tipus === 'bano' && v.banos > 1) ? ' ' + z.n : '');
      et.push({ pos: new THREE.Vector3(cx, HM + .35, cz), html: `${nom}<small>${(w * d).toFixed(0)} m²</small>` });
    }
    mobleZona(z, w, d, cx, cz, g, L);
  }
  // Parets exteriors amb finestres
  const T = .2;
  paretAmbForats(-W / 2 - T, W / 2 + T, D / 2 + T / 2, 'x', T, g, finestresDe(L, 'davant'));
  paretAmbForats(-W / 2 - T, W / 2 + T, -D / 2 - T / 2, 'x', T, g, finestresDe(L, 'darrere'));
  paretAmbForats(-D / 2, D / 2, -W / 2 - T / 2, 'z', T, g, []);
  paretAmbForats(-D / 2, D / 2, W / 2 + T / 2, 'z', T, g, [[L.zFront + .6, D / 2 - .6]]);
  // Envans interiors amb portes
  const t = .1;
  const fons = L.zones.filter(z => z.z1 === -D / 2);
  paretAmbForats(-W / 2, W / 2, L.zBack + t / 2, 'x', t, g, fons.map(z => [(z.x1 + z.x2) / 2 - .4, (z.x1 + z.x2) / 2 + .4]), true);
  fons.slice(0, -1).forEach(z => paretAmbForats(-D / 2, L.zBack, z.x2, 'z', t, g, [], true));
  if (L.pass) paretAmbForats(-W / 2, W / 2, L.zFront - t / 2, 'x', t, g, [[-W / 2 + .8, W / 2 - L.zones[1].x2 + L.zones[1].x1 - .8]], true);
  paretAmbForats(L.zFront, D / 2, L.zones[1].x1, 'z', t, g, [[L.zFront + .4, L.zFront + 1.6]], true);
  // Cotes: la marca de la casa
  cota(-W / 2, W / 2, D / 2 + .75, 'x', g, et);
  cota(-D / 2, D / 2, W / 2 + .75, 'z', g, et);
  g.userData.etiquetes = et;
  g.userData.mida = Math.max(W, D);
  return g;
}
function finestresDe(L, costat) {
  if (costat === 'davant') {
    const s = L.zones[0], c = L.zones[1], f = [];
    const ws = s.x2 - s.x1;
    f.push([s.x1 + ws * .2, s.x1 + ws * .2 + 1.4]);
    if (ws > 4.5) f.push([s.x2 - ws * .2 - 1.4, s.x2 - ws * .2]);
    f.push([(c.x1 + c.x2) / 2 - .5, (c.x1 + c.x2) / 2 + .5]);
    return f;
  }
  return L.zones.filter(z => z.z1 === -L.D / 2 && z.tipus === 'dorm').map(z => { const c = (z.x1 + z.x2) / 2; return [c - .55, c + .55]; });
}
/* Paret recta de a fins a b al llarg d'un eix, amb forats [ini, fi] */
function paretAmbForats(a, b, pos, eix, gruix, g, forats, envà) {
  const trams = []; let ini = a;
  forats.sort((p, q) => p[0] - q[0]).forEach(([f1, f2]) => { if (f1 > ini) trams.push([ini, f1, 'ple']); trams.push([f1, f2, 'forat']); ini = f2; });
  if (b > ini) trams.push([ini, b, 'ple']);
  for (const [t1, t2, tipus] of trams) {
    const l = t2 - t1, c = (t1 + t2) / 2;
    const h = tipus === 'ple' ? HM : (envà ? 0 : .45);
    if (h > 0) {
      const m = eix === 'x' ? paret(l, h, gruix, c, 0, pos, g) : paret(gruix, h, l, pos, 0, c, g);
      if (tipus === 'forat') m.material = [M.marc, M.marc, M.marc, M.marc, M.marc, M.marc];
    }
    if (tipus === 'forat' && !envà) {
      eix === 'x' ? caixa(l, HM - .45, .03, M.vidre, c, .45, pos, g, false) : caixa(.03, HM - .45, l, M.vidre, pos, .45, c, g, false);
    }
  }
}
function cota(a, b, pos, eix, g, et) {
  const l = b - a, c = (a + b) / 2, h = .015;
  if (eix === 'x') {
    caixa(l, h, .025, M.cota, c, .01, pos, g, false);
    caixa(.025, h, .3, M.cota, a, .01, pos, g, false); caixa(.025, h, .3, M.cota, b, .01, pos, g, false);
    et.push({ pos: new THREE.Vector3(c, .05, pos), html: fmtM(l), cls: 'pn-et-cota' });
  } else {
    caixa(.025, h, l, M.cota, pos, .01, c, g, false);
    caixa(.3, h, .025, M.cota, pos, .01, a, g, false); caixa(.3, h, .025, M.cota, pos, .01, b, g, false);
    et.push({ pos: new THREE.Vector3(pos, .05, c), html: fmtM(l), cls: 'pn-et-cota' });
  }
}
function fmtM(l) { const s = l.toFixed(1); return (document.documentElement.lang === 'en' ? s : s.replace('.', ',')) + ' m'; }

function mobleZona(z, w, d, cx, cz, g, L) {
  if (z.tipus === 'dorm') {
    const doble = z.n === 1 && w > 2.6, bw = doble ? 1.5 : .95, bl = 2.0;
    const zc = z.z1 + .1 + bl / 2;
    caixa(bw + .06, .32, bl, M.fusta, cx, 0, zc, g);
    caixa(bw, .18, bl - .1, M.llencol, cx, .32, zc + .02, g);
    caixa(bw + .02, .06, bl * .62, M.manta, cx, .47, zc + bl * .19, g);
    const coix = doble ? [cx - .38, cx + .38] : [cx];
    coix.forEach(x => caixa(.55, .1, .3, M.llencol, x, .5, z.z1 + .32, g));
    if (w - bw > .9) { caixa(.42, .45, .4, M.fusta, cx - bw / 2 - .3, 0, z.z1 + .3, g); }
    if (w - bw > 1.6) caixa(.6, 1.0, Math.min(1.6, d - .8), M.frente, z.x2 - .35, 0, z.z1 + .2 + Math.min(1.6, d - .8) / 2, g);
  } else if (z.tipus === 'bano') {
    const p = Math.min(.9, w - .3);
    caixa(p, .006, p, new THREE.MeshStandardMaterial({ color: 0x8E8D88, roughness: .5 }), z.x1 + .1 + p / 2, 0, z.z1 + .1 + p / 2, g, false);
    caixa(.02, 1.0, p * .8, M.vidre, z.x1 + .1 + p, 0, z.z1 + .1 + p * .4, g, false);
    caixa(Math.min(.8, w - .4), .4, .45, M.moble, cx, .45, z.z2 - .3, g);
    caixa(Math.min(.8, w - .4) + .02, .05, .47, M.ceramica, cx, .85, z.z2 - .3, g);
    const wc = new THREE.Mesh(new THREE.CylinderGeometry(.18, .15, .4, 24), M.ceramica);
    wc.scale.set(1, 1, 1.35); wc.position.set(z.x2 - .3, .2, z.z1 + .45); wc.castShadow = true; g.add(wc);
  } else if (z.tipus === 'salon') {
    const sx = z.x1 + w * .38, sz = z.z2 - 1.1;
    caixa(1.9, .05, 1.4, M.catifa, sx, 0, sz - .9, g, false);
    caixa(2.2, .42, .9, M.tela, sx, 0, sz, g);
    caixa(2.2, .38, .2, M.tela, sx, .42, sz + .35, g);
    caixa(.18, .2, .9, M.tela, sx - 1.0, .42, sz, g); caixa(.18, .2, .9, M.tela, sx + 1.0, .42, sz, g);
    cilindre(.38, .38, .04, M.fusta, sx, .36, sz - 1.0, g, 40); cilindre(.05, .05, .36, M.tirador, sx, 0, sz - 1.0, g, 10);
    caixa(1.6, .45, .38, M.fusta, sx, 0, z.z1 + .3, g);
    if (w > 4.2 && d > 3.2) {
      const tx = z.x2 - 1.1, tz = (z.z1 + z.z2) / 2;
      caixa(.9, .04, 1.5, M.fusta, tx, .72, tz, g);
      [[-.35, -.6], [.35, -.6], [-.35, .6], [.35, .6]].forEach(([a, b]) => cilindre(.02, .02, .72, M.tirador, tx + a, 0, tz + b, g, 8));
      cadira(tx - .65, tz - .35, Math.PI / 2, g); cadira(tx - .65, tz + .35, Math.PI / 2, g);
      cadira(tx + .65, tz - .35, -Math.PI / 2, g); cadira(tx + .65, tz + .35, -Math.PI / 2, g);
    }
    planta(z.x1 + .35, z.z2 - .35, g, .9);
  } else if (z.tipus === 'cocina') {
    const n = Math.max(3, Math.floor((d - .3) / .6));
    const t = tiradaBaixa(Array.from({ length: n }, (_, i) => i === 1 ? 'placa' : i === n - 1 ? 'pica' : 'porta'));
    t.rotation.y = -Math.PI / 2; t.position.set(z.x2, 0, z.z2 - .2 - n * .6); g.add(t);
  }
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
function creix(obj, dur = 650) {          // la maqueta «s'aixeca» des del terra
  obj.scale.y = QUIET ? 1 : .001;
  tween(dur, k => { obj.scale.y = Math.max(.001, k); });
}

/* ── Vista de càmera per mode ── */
function vista(mode, mida = 0, asp = visor.clientWidth / Math.max(1, visor.clientHeight)) {
  const f = Math.pow(Math.max(1, 1.45 / asp), .75);
  if (mode === 'cocina') return { t: new THREE.Vector3(.05, .8, -.1), r: (mida * 1.3 + 2.4) * f, pol: 1.06, az: .6 };
  if (mode === 'bano') return { t: new THREE.Vector3(0, 1.0, -.1), r: (mida * 1.35 + 2.2) * f, pol: 1.08, az: .6 };
  return { t: new THREE.Vector3(0, 0, .3), r: (mida * 1.4 + 4) * f, pol: .82, az: .42 };
}
function posa(v, dur = 900) {
  const de = camera.position.clone(), deT = controls.target.clone();
  const a = new THREE.Vector3(Math.sin(v.pol) * Math.sin(v.az), Math.cos(v.pol), Math.sin(v.pol) * Math.cos(v.az)).multiplyScalar(v.r).add(v.t);
  controls.minAzimuthAngle = v.az - .75; controls.maxAzimuthAngle = v.az + .75;
  controls.minDistance = v.r * .55; controls.maxDistance = v.r * 1.35;
  controls.minPolarAngle = st.mode === 'integral' ? .25 : .7; controls.maxPolarAngle = st.mode === 'integral' ? 1.15 : 1.38;
  tween(dur, k => { camera.position.lerpVectors(de, a, k); controls.target.lerpVectors(deT, v.t, k); });
}
function ajustaDistancia(v) {     // canvi de m²: mateix angle, nova distància
  const dir = camera.position.clone().sub(controls.target).normalize();
  const de = camera.position.clone(), deT = controls.target.clone();
  const a = dir.multiplyScalar(v.r).add(v.t);
  controls.minDistance = v.r * .55; controls.maxDistance = v.r * 1.35;
  tween(500, k => { camera.position.lerpVectors(de, a, k); controls.target.lerpVectors(deT, v.t, k); });
}
function ombraPer(mida) {
  const c = sol.shadow.camera, s = mida / 2 + 1.5;
  c.left = c.bottom = -s; c.right = c.top = s; c.far = 40; c.updateProjectionMatrix();
}

/* ── Muntar / canviar escenes ── */
function allibera(obj) { obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
function substitueix(nova, anima = true) {
  if (maqueta) { scene.remove(maqueta); allibera(maqueta); }
  maqueta = nova; scene.add(nova);
  if (anima) creix(nova);
  etiquetes = (nova.userData.etiquetes || []).map(e => {
    const el = document.createElement('div'); el.className = 'pn-et' + (e.cls ? ' ' + e.cls : ''); el.innerHTML = e.html;
    return { ...e, el };
  });
  elEtiq.replaceChildren(...etiquetes.map(e => e.el));
  brut = true;
}
function aplicaMaterials(v) {
  if (st.mode === 'cocina') {
    const colors = { blanco: 0xE7E3DA, salvia: 0x8F9B86, noche: 0x2B3446, grafito: 0x3A3C3F };
    if (v.frente === 'roble') { M.frente.map = tex('robleV', .8); M.frente.color.set(0xffffff); }
    else { if (M.frente.map) { M.frente.map = null; } tweenColor(M.frente, colors[v.frente]); }
    M.frente.needsUpdate = true;
    const fosc = v.frente === 'noche' || v.frente === 'grafito' || v.frente === 'salvia';
    M.tirador.color.set(fosc ? 0xB08D57 : 0x1C1D1E); M.tirador.metalness = fosc ? 1 : .6;
    const enc = { roble: ['roble', 1.2, .5], cuarzo: ['cuarzo', 1, .22], marmol: ['marmol', 1.6, .12] }[v.encimera];
    M.encimera.map = tex(enc[0], enc[1]); M.encimera.roughness = enc[2]; M.encimera.needsUpdate = true;
    const ter = { porcelanico: ['porcelanico', 1.2, .45], espiga: ['espiga', 1.4, .6], microcemento: ['microcemento', 2, .55] }[v.suelo];
    M.terra.map = tex(ter[0], ter[1]); M.terra.roughness = ter[2]; M.terra.needsUpdate = true;
    tween(500, k => { M.led.emissiveIntensity = (v.paquete === 'esencial' ? 0 : 2.2) * k + M.led.emissiveIntensity * (1 - k); });
  }
  if (st.mode === 'bano') {
    const az = { blanco: '#ECEAE4', verde: '#9DB4A6', cobalto: '#2C4C9A' }[v.pared];
    M.rajola.map = v.pared === 'micro' ? tex('microcemento', 1.6) : tex('az' + az, .6, azulejo(az));
    M.rajola.roughness = v.pared === 'micro' ? .6 : .28; M.rajola.needsUpdate = true;
    M.terraBany.map = v.pared === 'micro' ? tex('microcemento', 2) : tex('rajolaTerra', .8); M.terraBany.needsUpdate = true;
    if (v.mueble === 'roble') { M.moble.map = tex('robleV', .8); M.moble.color.set(0xffffff); }
    else { M.moble.map = null; tweenColor(M.moble, v.mueble === 'blanco' ? 0xECEAE4 : 0x3A3C3F); }
    M.moble.needsUpdate = true;
  }
  if (st.mode === 'integral') {
    const ter = { porcelanico: ['porcelanico', 1.2, .45], espiga: ['espiga', 1.4, .6], microcemento: ['microcemento', 2, .55] }[v.suelo];
    M.terraPis.map = tex(ter[0], ter[1]); M.terraPis.roughness = ter[2]; M.terraPis.needsUpdate = true;
  }
  brut = true;
}

let ultim = {};
function actualitza3D(motiu) {
  if (!renderer) return;
  const v = valors(st.mode);
  if (motiu === 'mode') {
    const nova = st.mode === 'cocina' ? escenaCuina(v) : st.mode === 'bano' ? escenaBany(v) : escenaPis(v);
    substitueix(nova);
    ombraPer(nova.userData.mida + 2);
    posa(vista(st.mode, nova.userData.mida));
  } else if (st.mode !== 'integral' && v.m2 !== ultim.m2) {
    const nova = st.mode === 'cocina' ? escenaCuina(v) : escenaBany(v);
    substitueix(nova, false);
    ombraPer(nova.userData.mida + 2);
    ajustaDistancia(vista(st.mode, nova.userData.mida));
  } else if (st.mode === 'cocina' && v.forma !== ultim.forma) {
    const m = maqueta.userData.mobles; m.children.slice().forEach(c => { m.remove(c); allibera(c); });
    muntaCuina(m, v.forma, maqueta.userData.mides); creix(m, 550);
  } else if (st.mode === 'bano' && (v.tipo !== ultim.tipo || v.paquete !== ultim.paquete)) {
    const p = maqueta.userData.peces; p.children.slice().forEach(c => { p.remove(c); allibera(c); });
    muntaBany(p, v, maqueta.userData.mides); creix(p, 500);
  } else if (st.mode === 'integral' && (v.m2 !== ultim.m2 || v.dorm !== ultim.dorm || v.banos !== ultim.banos)) {
    const nova = escenaPis(v);
    substitueix(nova, v.m2 === ultim.m2);       // el lliscador no fa «créixer» a cada pas
    ombraPer(nova.userData.mida + 2);
    ajustaDistancia(vista('integral', nova.userData.mida));
  }
  aplicaMaterials(v);
  ultim = { ...v };
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
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .38;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC2, .55));
  sol = new THREE.DirectionalLight(0xFFEFD8, 3.1);
  sol.position.set(-1.5, 8, 6.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(MOBIL ? 1024 : 2048, MOBIL ? 1024 : 2048);
  sol.shadow.bias = -.0004; sol.shadow.normalBias = .02; sol.shadow.radius = 3;
  scene.add(sol, sol.target);
  const terra = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .1 }));
  terra.rotation.x = -Math.PI / 2; terra.position.y = -.031; terra.receiveShadow = true; scene.add(terra);

  camera = new THREE.PerspectiveCamera(30, 1, .1, 200);
  camera.position.set(6, 5, 7);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !QUIET; controls.dampingFactor = .08;
  controls.enablePan = false; controls.rotateSpeed = .55; controls.zoomSpeed = .6;
  controls.addEventListener('start', () => { $('.pn-pista').classList.add('amaga'); });

  preparaMaterials();
  M.terraPis = new THREE.MeshStandardMaterial({ map: tex('porcelanico', 1.2), roughness: .45 });
  M.terraCuinaPis = new THREE.MeshStandardMaterial({ map: tex('porcelanico', 1.2), roughness: .45 });

  new ResizeObserver(() => {
    const w = visor.clientWidth, h = visor.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); brut = true;
  }).observe(visor);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(visor);
  const v3 = new THREE.Vector3();
  renderer.setAnimationLoop(t => {
    if (!visible) return;
    for (const tw of tweens) {
      const k = Math.min(1, (t - tw.t0) / tw.dur);
      tw.fn(ease(k)); if (k >= 1) tweens.delete(tw);
      brut = true;
    }
    if (controls.update()) brut = true;
    if (!brut) return;
    brut = false;
    renderer.render(scene, camera);
    if (etiquetes.length) {
      const w = visor.clientWidth, h = visor.clientHeight;
      const sy = maqueta ? maqueta.scale.y : 1;
      for (const e of etiquetes) {
        v3.copy(e.pos).project(camera);
        e.el.style.transform = `translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px) translate(-50%, -50%)`;
        e.el.style.opacity = sy > .95 ? 1 : 0;
      }
    }
  });
  elEstat.dataset.estat = 'llest';
  return true;
}

/* ═══ 5. PDF I WHATSAPP ══════════════════════════════════════════
   El PDF es fa aquí mateix, sense biblioteca: una pàgina A4 amb la
   captura de la maqueta (JPEG), el que s'ha triat i les partides.
   El servidor (/api/disseny) només desa el correu i dona el WhatsApp. */

function resumDisseny() {
  const m = st.mode, r = calcula(), files = [];
  for (const fs of $$('fieldset', forms[m])) {
    if (fs.classList.contains('pn-grup-comptadors')) {
      $$('.pn-comptador', fs).forEach(c => files.push([$('span', c).textContent.trim(), $('output', c).textContent.trim()]));
      continue;
    }
    const lg = $('legend', fs), out = $('output', lg), triat = $('input:checked', fs);
    const valor = out && out.textContent.trim() ? out.textContent.trim()
      : triat ? ($('b', triat.closest('label')) || triat.closest('label')).textContent.trim() : '';
    files.push([lg.firstChild.textContent.trim(), valor]);
  }
  files.push([I18N.t('Empezamos'), $('output[data-tria="setmana"]').textContent.trim()]);
  files.push([I18N.t('Te la entregamos'), I18N.t('semana del {dia}', { dia: $('[data-entrega]').textContent.trim() })]);
  const modeNom = $(`[data-mode-boto="${m}"]`).textContent.trim();
  return { mode: m, modeNom, files, linies: r.linies, total: r.total, v: r.v };
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
  const vf = vista(st.mode, maqueta ? maqueta.userData.mida : 0, w / h);
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
  text(`${I18N.t('Tu reforma')}: ${r.modeNom}`, M, H - 96, 24, { negreta: true });
  const avui = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  text(`${I18N.t('Diseñada el {dia}', { dia: avui })}${correu ? '  ·  ' + correu : ''}`, M, H - 114, 9.5, { col: '#5F6661' });
  // Imatge
  let y = H - 128;
  let ih = 0;
  if (jpeg) {
    ih = amp * jpeg.h / jpeg.w;
    ops.push(`q ${amp.toFixed(2)} 0 0 ${ih.toFixed(2)} ${M} ${(y - ih).toFixed(2)} cm /Im1 Do Q`);
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

/* ═══ 6. ARRENCADA I ESDEVENIMENTS ═══════════════════════════════ */
function canviaMode(mode, focus) {
  if (!forms[mode] || mode === st.mode && maqueta) return;
  st.mode = mode; arrel.dataset.mode = mode;
  $$('[data-mode-boto]').forEach(b => { const on = b.dataset.modeBoto === mode; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== mode; });
  history.replaceState(null, '', '#' + mode);
  if (mode === 'integral') ajustaComptadors(false); else ajustaMinims(mode, false);
  ultim = {};
  pintaPanell();
  actualitza3D('mode');
}

pintaMostres();
preparaSetmanes();
iniciaWebGL();

$$('[data-mode-boto]').forEach(b => b.addEventListener('click', () => canviaMode(b.dataset.modeBoto)));
$('.pn-modes').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const m = $$('[data-mode-boto]').map(b => b.dataset.modeBoto), i = m.indexOf(st.mode);
  canviaMode(m[(i + (e.key === 'ArrowRight' ? 1 : m.length - 1)) % m.length], true);
});
Object.values(forms).forEach(f => {
  f.addEventListener('submit', e => e.preventDefault());
  f.addEventListener('input', e => {
    if (e.target.name === 'm2') { if (st.mode === 'integral') ajustaComptadors(true); else ajustaMinims(st.mode, true); }
    pintaPanell(); actualitza3D();
  });
});
$$('[data-compta]').forEach(b => b.addEventListener('click', () => {
  st.integral[b.dataset.compta] += +b.dataset.pas;
  ajustaComptadors(true); pintaPanell(); actualitza3D();
}));
elDies.addEventListener('change', () => pintaPanell());

/* Canvi d'idioma: es repinta tot el que escriu el JS (noms, dates, etiquetes de la maqueta) */
document.addEventListener('idioma-canviat', () => {
  const i = $$('input[name="setmana"]', elDies).findIndex(x => x.checked);
  preparaSetmanes();
  const ara = $$('input[name="setmana"]', elDies)[i];
  if (ara && !ara.disabled) ara.checked = true;
  if (renderer && st.mode === 'integral') { substitueix(escenaPis(valors('integral')), false); brut = true; }
  pintaPanell();
});

// Mode d'entrada: #cocina / #bano / #integral, o ?tipo= dels enllaços de les pàgines de servei
const TIPUS = { cocina: 'cocina', bano: 'bano', casa: 'integral', integral: 'integral' };
const inicial = location.hash.slice(1) || TIPUS[new URLSearchParams(location.search).get('tipo')];
st.mode = '';
canviaMode(forms[inicial] ? inicial : 'cocina');
