/* ════════════════════════════════════════════════════════════════
   PANELL «Diseña tu reforma» — el pis en maqueta 3D (Three.js) i una
   forquilla de preu orientativa (peça 16, en Lluc 21/10/2026). S'entra veient el pis apagat: es toquen les zones que
   es volen reformar (a la maqueta o a la llista) i s'encenen; cada
   zona té el seu editor (m², acabats). La cuina i el bany es poden
   veure per dins. El preu i el panell funcionen encara que WebGL falli.
   Res de fotos: tot és geometria i textures dibuixades aquí.
   ════════════════════════════════════════════════════════════════ */
// Three.js es carrega després del primer pintat (carrega3D, al final): el preu i el panell
// funcionen de seguida i la maqueta arriba un moment després (Lighthouse mòbil, 15/10/2026).
let THREE, OrbitControls, RoomEnvironment, RoundedBoxGeometry;

// Textos del JS: I18N.t amb la frase castellana escrita literal (js/i18n.js). Sense i18n, queda el castellà.
const I18N = window.I18N || { t: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (tot, k) => v[k] ?? tot) : s) };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const QUIET = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBIL = matchMedia('(max-width: 860px)').matches;

/* ═══ 1. PREUS (euros, IVA inclòs) ═══════════════════════════════ */
const PREUS = {
  // `obra` és €/m²; les claus amb `/m2` es multipliquen pels m² de la zona.
  // Cada clau és el `name` d'un camp; la part i el grup surten del <fieldset data-part data-grup> on és.
  cocina: {
    obra: 210,
    forma: { lineal: 5800, l: 7400, isla: 9900 },
    frente: { roble: 900 },
    acabado: { satinado: 350, ranurado: 780 },
    encimera: { cuarzo: 1450, marmol: 2900 },
    tiradores: { laton: 120, gola: 450 },
    frontal: { metro: 380, porcelanico: 520 },
    'suelo/m2': { espiga: 95, microcemento: 75 },
    paredes: { arena: 180, humo: 180 },
    lamparas: { laton: 260, cristal: 340 },
    led: { si: 240 },
    grifo: { negro: 140, laton: 290 },
    electro: { inox: 1900, negro: 2100, integrados: 2600 },
    paquete: { completa: 2300, llave: 2600 },
  },
  bano: {
    obra: 380,
    tipo: { ducha: 3400, banera: 3000 },
    mueble: { roble: 350 },
    espejo: { luz: 220, armario: 380 },
    inodoro: { negro: 240 },
    griferia: { negro: 160, laton: 340 },
    'sueloB/m2': { micro: 65, piedra: 85 },
    'pared/m2': { verde: 90, cobalto: 90, micro: 160 },
    luces: { apliques: 190, led: 260 },
    paquete: { completa: 1400, llave: 2300 },
  },
  estancia: {       // dormitoris, saló i passadís
    obra: 15,       // protecció, retirada i neteja
    'suelo/m2': { porcelanico: 55, espiga: 85, microcemento: 75 },
    'paredes/m2': { pintar: 22, alisar: 48 },
    armario: 1400,
    ventana: 900,
  },
};

/* Tres estils d'un clic (noms d'en Lluc, 21/10/2026: «Luz de norte · Casa de pueblo · Noche de piedra») */
const ESTILS = {
  cocina: {
    norte: { frente: 'blanco', acabado: 'mate', tiradores: 'negro', encimera: 'roble', frontal: 'metro', suelo: 'porcelanico', paredes: 'blanco', lamparas: 'cristal', grifo: 'cromo' },
    pueblo: { frente: 'salvia', acabado: 'ranurado', tiradores: 'laton', encimera: 'cuarzo', frontal: 'metro', suelo: 'espiga', paredes: 'arena', lamparas: 'laton', grifo: 'laton' },
    piedra: { frente: 'grafito', acabado: 'mate', tiradores: 'gola', encimera: 'marmol', frontal: 'porcelanico', suelo: 'microcemento', paredes: 'humo', lamparas: 'laton', grifo: 'negro' },
  },
  bano: {
    norte: { mueble: 'roble', espejo: 'redondo', griferia: 'cromo', sueloB: 'rajola', pared: 'blanco', luces: 'focos' },
    pueblo: { mueble: 'blanco', espejo: 'redondo', griferia: 'laton', sueloB: 'rajola', pared: 'verde', luces: 'apliques' },
    piedra: { mueble: 'grafito', espejo: 'luz', griferia: 'negro', sueloB: 'piedra', pared: 'micro', luces: 'led' },
  },
};
/* Forquilla (21/10/2026): del total −5 % al +10 %, arrodonit a 100 €. Gama segons el preu per m². */
/* A les estances (saló, dormitoris, passadís), l'estil del pis només canvia el terra: el de la cuina de cada estil (en Lluc, 25/10/2026) */
ESTILS.estancia = { norte: { suelo: 'porcelanico' }, pueblo: { suelo: 'espiga' }, piedra: { suelo: 'microcemento' } };
const FORQ = [.95, 1.10];
const GAMES = { cocina: [900, 1300], bano: [1200, 1700], estancia: [150, 260] };

/* ═══ 2. EL PIS: zones, m² i opcions ═════════════════════════════ */
const FORM_DE = { salon: 'estancia', pasillo: 'estancia', dorm: 'estancia', cocina: 'cocina', bano: 'bano' };
const RANG = { salon: [14, 40, .5], dorm: [7, 20, .5], cocina: [6, 30, 1], bano: [4, 12, .5] };
const forms = Object.fromEntries($$('.pn-opcions').map(f => [f.dataset.per, f]));
const st = { dorm: 2, banos: 1, zones: new Map(), activa: null, dins: null, tornada: null, vista: 'pis', llum: 'dia', abans: false, gir: false };
/* 'cocina' o 'bano' quan el panell és d'una sola habitació (l'script del <head> ho marca a <html>); si no, null */
const unaSola = () => document.documentElement.dataset.sol || null;

function opcionsInicials(tipus, n) {
  if (tipus === 'cocina') return { m2: 9, forma: 'lineal', ...ESTILS.cocina.norte, led: 'no', electro: 'ninguno', paquete: 'esencial' };
  if (tipus === 'bano') return { m2: 5, tipo: 'ducha', ...ESTILS.bano.norte, inodoro: 'blanco', paquete: 'esencial' };
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
/* Totes les zones comencen marcades (en Lluc, 24/10/2026), també les que s'afegeixen amb «+». El Map es refà
   sempre en l'ordre del pis, perquè la llista i el desglossament no depenguin de l'ordre dels clics. */
/* L'estil del pis que porten totes les zones marcades (o null): el botó marcat i el de les zones noves */
function estilComu() {
  const on = [...st.zones.values()].filter(z => z.on);
  return (on.length && Object.keys(ESTILS.estancia).find(e => on.every(z => Object.entries(ESTILS[FORM_DE[z.tipus]][e]).every(([k, v]) => z.opts[k] === v)))) || null;
}
function sincronitzaZones() {
  const zones = new Map(), estil = estilComu();   // les zones noves («+») prenen l'estil del pis (en Lluc: s'aplica a tot el pis)
  for (const id of idsZones()) {
    const tipus = id.replace(/\d+$/, ''), n = +(id.match(/\d+$/) || [0])[0];
    zones.set(id, st.zones.get(id) || { id, tipus, n, on: true, opts: { ...opcionsInicials(tipus, n), ...(estil ? ESTILS[FORM_DE[tipus]][estil] : {}) } });
  }
  st.zones = zones;
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
  const el = $('b', lab) || $('.visually-hidden', lab) || lab;
  return (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : el).textContent.trim();   // sense el preu de dins
}
function nomGrup(clau, nom) {
  const inp = $(`input[name="${nom}"]`, forms[clau]);
  const sub = inp && $('.pn-sub-titol', inp.closest('.pn-sub') || document.createElement('i'));
  if (sub) return sub.textContent.trim();
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
  let total = m2 * P.obra;
  const detalls = [], parts = [[`${I18N.t('Obra')} · ${fmtNum(m2)} m²`, m2 * P.obra]], grups = { obra: m2 * P.obra };
  if (clau === 'estancia') {
    total += (P['suelo/m2'][o.suelo] || 0) * m2 + (P['paredes/m2'][o.paredes] || 0) * m2;
    detalls.push(`${nomGrup(clau, 'suelo')}: ${nomValor(clau, 'suelo', o.suelo)}`, `${nomGrup(clau, 'paredes')}: ${nomValor(clau, 'paredes', o.paredes)}`);
    if (o.armario && z.tipus === 'dorm') { total += P.armario; detalls.push(nomValor(clau, 'armario')); }
    if (o.ventanas && finestresZona(z)) { total += P.ventana * finestresZona(z); detalls.push(nomValor(clau, 'ventanas')); }
  } else {
    for (const [k, taula] of Object.entries(P)) {
      if (k === 'obra') continue;
      const [nom, perM2] = k.split('/');
      const preu = (taula[o[nom]] || 0) * (perM2 ? m2 : 1);
      total += preu;
      const g = lloc(clau, nom).grup;
      grups[g] = (grups[g] || 0) + preu;
      detalls.push(nomValor(clau, nom, o[nom]));
      if (preu) parts.push([nom === 'paquete' ? nomValor(clau, nom, o[nom]) : `${nomGrup(clau, nom)}: ${nomValor(clau, nom, o[nom])}`, preu]);
    }
  }
  return { total: Math.round(total), detalls, parts, grups };
}
/* La part (data-part) i el grup (data-grup) de cada camp, segons on és a l'HTML */
const LLOCS = {};
function lloc(clau, nom) {
  const k = clau + '.' + nom;
  if (LLOCS[k]) return LLOCS[k];
  const f = $(`input[name="${nom}"]`, forms[clau])?.closest('[data-part]');
  return (LLOCS[k] = { part: f ? f.dataset.part : null, grup: f?.dataset.grup || 'obra' });
}
/* Preu d'una part de la cuina o el bany (la que és oberta al panell) */
function preuPart(z, part) {
  const clau = FORM_DE[z.tipus], P = PREUS[clau], o = z.opts;
  let n = part === 'obra' ? o.m2 * P.obra : 0;
  for (const [k, taula] of Object.entries(P)) {
    const [nom, perM2] = k.split('/');
    if (k !== 'obra' && lloc(clau, nom).part === part) n += (taula[o[nom]] || 0) * (perM2 ? o.m2 : 1);
  }
  return n;
}
/* Forquilla: límits arrodonits a 100 € */
function lims(n, pas = 100) { return [Math.round(n * FORQ[0] / pas) * pas, Math.round(n * FORQ[1] / pas) * pas]; }
function xifra(n) { return eur(n).replace(/\s?€/, ''); }
function rang(n) {
  if (!n) return I18N.t('Incluido');
  const [a, b] = lims(n, n < 3000 ? 10 : 100);
  return document.documentElement.lang === 'en' ? `${eur(a)}–${eur(b)}` : `${xifra(a)} – ${eur(b)}`;
}
function forquilla(n) {
  const [a, b] = lims(n);
  return I18N.t('de {min} a {max}', { min: document.documentElement.lang === 'en' ? eur(a) : xifra(a), max: eur(b) });
}
function signe(d) { return (d > 0 ? '+' : '−') + eur(Math.abs(d)); }
/* Desglossament: per grups si és una sola habitació, per estances si és el pis */
function nomsGrup() {
  return { mob: I18N.t('Muebles y encimera'), llum: I18N.t('Luces'), terra: I18N.t('Suelo y paredes'), aig: I18N.t('Grifo y electrodomésticos'), obra: I18N.t('Obra y montaje') };
}
function desglossa(r) {
  if (r.linies.length === 1 && FORM_DE[r.linies[0][3].tipus] !== 'estancia') {
    const g = r.linies[0][2].grups, noms = nomsGrup();
    return ['mob', 'llum', 'terra', 'aig', 'obra'].map(k => [noms[k], g[k] || 0]);
  }
  return r.linies.map(([t, n]) => [t, n]);
}
function gama(r) {
  const m2 = r.triades.reduce((a, z) => a + z.opts.m2, 0);
  const clau = r.triades.length === 1 ? FORM_DE[r.triades[0].tipus] : 'estancia';
  const [g1, g2] = GAMES[clau], k = m2 ? r.total / m2 : 0;
  return k < g1 ? I18N.t('Gama básica') : k < g2 ? I18N.t('Gama media') : I18N.t('Gama alta');
}
function calcula() {
  const triades = [...st.zones.values()].filter(z => z.on);
  const linies = triades.map(z => { const p = preuZona(z); return [`${nomZona(z)} · ${fmtNum(z.opts.m2)} m²`, p.total, p, z]; });
  return { total: linies.reduce((a, l) => a + l[1], 0), linies, triades };
}

/* ── Pintar el panell ── */
const elTotal = $('[data-total]');
const elZones = $('[data-zones]'), elEditor = $('[data-editor]');
let totalVist = null;
function pintaPanell() {
  const r = calcula();
  // Llista d'espais: la casella el treu o el torna al preu; «Editar ›» hi entra (com tocar-lo a la maqueta)
  elZones.innerHTML = [...st.zones.values()].map(z =>
    `<li class="pn-fila${z.on ? '' : ' off'}"><label class="pn-fila-check"><input type="checkbox" data-check-zona="${z.id}"${z.on ? ' checked' : ''}>`
    + `<span class="pn-fila-nom">${nomZona(z)}</span><span class="pn-fila-m2">${fmtNum(z.opts.m2)} m²</span></label>`
    + `<button type="button" class="pn-fila-edita" data-edita-zona="${z.id}" aria-label="${I18N.t('Editar')}: ${nomZona(z)}">${I18N.t('Editar')} <span aria-hidden="true">›</span></button></li>`).join('');
  // L'estil del pis queda marcat si totes les zones marcades el porten
  const estil = estilComu();
  $$('[data-estil-pis]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.estilPis === estil)));
  $('[data-compte-on]').textContent = I18N.t('{a} de {b}').replace('{a}', r.triades.length).replace('{b}', st.zones.size);
  $('[data-tot]').hidden = r.triades.length === st.zones.size;
  $$('[data-compte]').forEach(o => { o.textContent = st[o.dataset.compte]; });
  pintaTotalM2();
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
  if (z && FORM_DE[z.tipus] !== 'estancia') pintaParts(z);
  // Desglossament, gama, últim canvi i forquilla
  const files = desglossa(r);
  $('[data-partides]').innerHTML = files.length
    ? files.map(([t, n]) => `<li><span>${t}</span><span>${rang(n)}</span></li>`).join('')
    : `<li><span>${I18N.t('Todavía no has elegido ninguna zona.')}</span><span></span></li>`;
  $('[data-gama]').textContent = r.triades.length ? gama(r) : '';
  $('[data-gama]').hidden = !r.triades.length;
  const xip = $('[data-xip]');
  xip.hidden = !ultimCanvi || !ultimCanvi.delta || !r.triades.length;
  if (!xip.hidden) xip.innerHTML = `<span class="pn-xip-et">${I18N.t('Último cambio')}:</span> <b>${signe(ultimCanvi.delta)}</b> · ${ultimCanvi.nom}`;
  animaTotal(r.total);
  $$('[data-obre-pdf], [data-whatsapp]').forEach(b => { b.disabled = !r.triades.length; });
  $('[data-cap-zona]').hidden = !!r.triades.length;
  pintaEtiquetes();
  return r;
}

let ultimCanvi = null;   // { delta, nom }: el xip de la targeta de preu
function animaTotal(nou) {
  const vell = totalVist ?? nou;
  totalVist = nou;
  const mostra = n => { elTotal.textContent = n ? forquilla(n) : '—'; };
  if (vell !== nou) {
    elTotal.classList.toggle('puja', nou > vell);
    clearTimeout(animaTotal.t);
    animaTotal.t = setTimeout(() => elTotal.classList.remove('puja'), 700);
  }
  if (QUIET || vell === nou || !vell || !nou) { mostra(nou); return; }
  const t0 = performance.now(), dur = 420;
  cancelAnimationFrame(animaTotal.raf);
  const pas = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    mostra(vell + (nou - vell) * e);
    if (k < 1) animaTotal.raf = requestAnimationFrame(pas); else mostra(nou);
  };
  animaTotal.raf = requestAnimationFrame(pas);
}

/* ── Parts de la cuina i el bany: graella d'icones i només la part triada oberta ── */
const ICONES = {
  forma: '<path d="M3 6h18v4H3zM7 14h10v4H7z"/>', mobles: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M9 11v2M15 11v2"/>',
  taulell: '<path d="M2 9h20v3H2zM4 12v8M20 12v8"/>', tirador: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M8 10h8"/>',
  frontal: '<rect x="3" y="5" width="18" height="14"/><path d="M3 12h18M9 5v7M15 12v7"/>', terra: '<path d="M2 19 8 8h8l6 11zM5 14h14M10 8l-2 11M14 8l2 11"/>',
  parets: '<path d="M3 4h18v16H3zM3 9h18M3 14h18M9 4v5M15 9v5M9 14v6"/>', llum: '<path d="M12 2v6M7 13a5 5 0 0 1 10 0zM10 16a2 2 0 0 0 4 0"/>',
  aixeta: '<path d="M6 21v-9a4 4 0 0 1 4-4h4M14 6v4M12 6h4M17 13v2"/>', electro: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 9h14M9 6h2M9 13v4"/>',
  dutxa: '<path d="M8 21V7a3 3 0 0 1 6 0M11 10h6M12 14v1M15 14v1M18 14v1M13 18v1M16 18v1"/>', moble: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 14h16M8 6h8M12 4v2"/>',
  mirall: '<rect x="7" y="3" width="10" height="13" rx="5"/><path d="M12 16v5M9 21h6"/>', vater: '<path d="M7 3h6v7H7zM5 10h12a4 4 0 0 1-4 5H9l1 6"/>',
  obra: '<path d="M3 20h18M5 20V9l7-5 7 5v11M10 20v-6h4v6"/>',
};
const PART_INICIAL = { cocina: 'mobles', bano: 'parets' };
const partOberta = {};
function construeixGraella(clau) {
  const f = forms[clau];
  $('[data-graella]', f).innerHTML = $$('[data-part]', f).map(fs => {
    const p = fs.dataset.part;
    return `<button type="button" class="pn-peca" data-peca="${p}"${fs.dataset.grup ? ` data-grup="${fs.dataset.grup}"` : ''} aria-pressed="false">`
      + `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[p] || ''}</svg>${$('legend', fs).textContent.trim().replace(/\S{13,}/g, w => w.slice(0, 7) + '­' + w.slice(7))}</button>`;   // guionet discrecional a les paraules llargues
  }).join('');
  obrePart(clau, partOberta[clau] || PART_INICIAL[clau], false);
}
function obrePart(clau, part, enfoca = true) {
  const f = forms[clau];
  if (!$(`[data-part="${part}"]`, f)) return;
  partOberta[clau] = part;
  $$('[data-part]', f).forEach(fs => { fs.hidden = fs.dataset.part !== part; });
  $$('[data-peca]', f).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.peca === part)));
  if (enfoca) { enfocaPart(part); portaALaVista($(`[data-part="${part}"]`, f)); }
}
/* El preu de cada opció, escrit a partir de PREUS (així sempre quadra amb el càlcul) */
function pintaPreusOpcions() {
  for (const clau of ['cocina', 'bano']) {
    for (const [k, taula] of Object.entries(PREUS[clau])) {
      if (k === 'obra') continue;
      const [nom, perM2] = k.split('/'), base = ['forma', 'tipo'].includes(nom) ? Math.min(...Object.values(taula)) : 0;
      for (const inp of $$(`input[name="${nom}"]`, forms[clau])) {
        const el = $('[data-preu]', inp.closest('label'));
        if (!el) continue;
        const n = (taula[inp.value] || 0) - base;
        el.textContent = n ? `+${eur(n)}${perM2 ? '/m²' : ''}` : I18N.t('Incluido');
      }
    }
  }
}
function pintaParts(z) {
  const clau = FORM_DE[z.tipus], f = forms[clau];
  for (const fs of $$('[data-part]', f)) {
    $('[data-part-preu]', fs).innerHTML = `<span>${I18N.t('Precio de esta parte')}</span><b>${(n => n ? rang(n) : I18N.t('Incluido en el precio base'))(preuPart(z, fs.dataset.part))}</b>`;
  }
  for (const b of $$('[data-estil]', f)) {
    const e = ESTILS[clau][b.dataset.estil];
    b.setAttribute('aria-pressed', String(Object.entries(e).every(([k, v]) => z.opts[k] === v)));
  }
}

function dataLang() { const l = document.documentElement.lang || 'es'; return l === 'ca' ? 'ca-ES' : l === 'en' ? 'en-GB' : 'es-ES'; }

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
  } else { ajustaMinims(clau, false); construeixGraella(clau); }
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
  metro: (g, s, r) => {           // azulejo metro 7,5 × 15 cm, a trencajunts, amb el cantell bisellat
    const w = s / 4, h = s / 8;
    g.fillStyle = '#CFCBC3'; g.fillRect(0, 0, s, s);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0), y = j * h;
      const gr = g.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, '#FBFAF7'); gr.addColorStop(.8, to('#EFEDE8', .04, r)); gr.addColorStop(1, '#D6D3CB');
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
  },
  pedra: (g, s, r) => {           // pedra natural, peces de 60 cm
    const t = s / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = to('#9C978D', .08, r); g.fillRect(i * t, j * t, t, t);
      for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${r() > .5 ? '230,226,216' : '60,56,50'},${r() * .12})`; const d = 1 + r() * 5; g.fillRect(i * t + r() * t, j * t + r() * t, d, d); }
    }
    g.fillStyle = '#7E7A72'; for (let i = 0; i <= 2; i++) { g.fillRect(i * t - 1.5, 0, 3, s); g.fillRect(0, i * t - 1.5, s, 3); }
  },
  gra: (g, s, r) => {             // pintura lacada: un gra molt fi (es multiplica pel color)
    g.fillStyle = '#F4F4F2'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '150,148,144'},${r() * .18})`; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
  },
  estuc: (g, s, r) => {           // paret pintada: taques suaus de corró
    g.fillStyle = '#F2F1EE'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) { const x = r() * s, y = r() * s, rad = 20 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, rad); const c = r() > .5 ? '255,255,255' : '170,166,158'; gr.addColorStop(0, `rgba(${c},${r() * .12})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  },
  ranures: (g, s) => {            // relleu del frontal ranurat (bumpMap)
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#555555'; for (let i = 0; i < 16; i++) g.fillRect(i * s / 16, 0, 5, s);
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
    g.fillStyle = 'rgba(168,164,156,.95)';
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
async function pintaMostres() {
  // Els llenços (512 px, els mateixos que fa servir la maqueta) costen ~40 ms cadascun: se'n dibuixa un
  // per tros de temps lliure, i la mostra es codifica a 192 px (el JPEG de 512 px eren 33 ms més per mostra).
  const petit = document.createElement('canvas'); petit.width = petit.height = 192;
  const px = petit.getContext('2d');
  const mini = c => { px.drawImage(c, 0, 0, 192, 192); return petit.toDataURL('image/jpeg', .82); };
  const respira = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 300 }) : setTimeout(r, 16)));
  for (const el of $$('.pn-mat')) {
    // Mostres dibuixades petites (192 px, ~1/7 del cost): els llenços de 512 només els fa la maqueta quan cal
    await respira();
    el.style.backgroundImage = `url(${mini(llenc(el.dataset.mat + '@m', 192, DIBUIX[el.dataset.mat]))})`;
  }
  await respira();
  document.documentElement.style.setProperty('--fusta', `url(${mini(llenc('robleV', 512, DIBUIX.robleV))})`);
  const dib = {
    lineal: '<rect x="8" y="6" width="112" height="12"/>',
    l: '<rect x="8" y="6" width="112" height="12"/><rect x="8" y="18" width="12" height="34"/>',
    isla: '<rect x="8" y="6" width="112" height="12"/><rect x="40" y="32" width="54" height="14"/>',
    ducha: '<rect x="8" y="6" width="44" height="44" fill="none" stroke-dasharray="3 3"/><line x1="52" y1="6" x2="52" y2="40" stroke-width="2.5"/><circle cx="30" cy="28" r="2.5"/>',
    banera: '<rect x="8" y="6" width="84" height="26" rx="10"/><line x1="92" y1="6" x2="92" y2="30" stroke-width="2.5"/>',
  };
  $$('.pn-dib').forEach(el => {
    el.innerHTML = `<svg viewBox="0 0 128 56" aria-hidden="true" fill="#16191B" stroke="#16191B" stroke-width="1.5"><rect x="2" y="2" width="124" height="52" fill="none" stroke="#C4C8CC"/>${dib[el.dataset.dib]}</svg>`;
  });
}

/* ═══ 4. MAQUETA 3D ══════════════════════════════════════════════ */
const visor = $('.pn-visor');
const canvas = $('.pn-canvas');
const elEstat = $('.pn-estat');
let renderer, scene, camera, controls, sol, brut = true, pinta = false;


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
  mat('ceramica', { color: 0xF6F6F3, roughness: .18 });          // amb vernís (vernisBany) només quan s'obre el bany
  mat('pica', { color: 0xF6F6F3, roughness: .18, side: THREE.DoubleSide });
  mat('vidre', { color: 0xCFE0E2, roughness: .03, metalness: .1, transparent: true, opacity: .3, depthWrite: false });
  mat('mirall', { color: 0xF2F5F6, roughness: .02, metalness: 1 });
  mat('llauto', { color: 0xB08D57, roughness: .3, metalness: 1 });
  mat('tela', { color: 0xCBC5BA, roughness: 1 });
  mat('llencol', { color: 0xEDEAE3, roughness: .95 });
  mat('manta', { color: 0x8F9B86, roughness: 1 });
  mat('catifa', { color: 0xD9D3C7, roughness: 1 });
  mat('test', { color: 0xC9B8A0, roughness: .85 });
  mat('fulla', { color: 0x5D7255, roughness: .75 });
  mat('bombeta', { color: 0xFFF4E0, emissive: 0xFFE7BF, emissiveIntensity: 1.6 });
  mat('rajola', { map: tex('az#ECEAE4', .6, azulejo('#ECEAE4')), roughness: .3 });
  mat('moble', { map: tex('robleV', .8), roughness: .55 });
  mat('terraBany', { map: tex('rajolaTerra', .8), roughness: .4 });
  M.cota = new THREE.MeshBasicMaterial({ color: 0x622F26 });
  // Peça 16: parets de dins (es pinten), frontal, forn, electrodomèstics, aixetes i detalls
  mat('paretInt', { color: 0xE8E6E0, roughness: .92 });
  mat('frontal', { color: 0xE8E6E0, roughness: .85 });
  mat('forn', { color: 0x141516, roughness: .08, metalness: .3 });
  mat('electro', { color: 0xB9BCBE, roughness: .3, metalness: 1 });
  mat('aixeta', { color: 0xC9CDD0, roughness: .14, metalness: 1 });
  mat('metall', { color: 0x1C1D1E, roughness: .35, metalness: .6 });
  mat('vidreLlum', { color: 0x4E453D, roughness: .2, metalness: .1, transparent: true, opacity: .92, emissive: 0xFFC982, emissiveIntensity: 0 });   // vidre fumat
  mat('tovallola', { color: 0xE9E4DA, roughness: 1 });
  mat('catifaB', { color: 0xB9B3A6, roughness: 1 });
  mat('llimona', { color: 0xE2BE3F, roughness: .5 });
  mat('wc', { color: 0xF6F6F3, roughness: .18, side: THREE.DoubleSide });
  mat('aiguaBany', { color: 0xE4E7E6, roughness: .15 });
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
function paret(w, h, d, x, y, z, pare, mp = M.paret) {
  const m = caixa(w, h, d, mp, x, y, z, pare);
  m.material = [mp, mp, M.tall, mp, mp, mp];
  return m;
}

/* ── Peces de cuina (en local: la tirada va per +x, el frontal mira a +z) ──
   Cada malla porta la seva part (userData.part): clicar-la obre la part al panell (peça 16). Les peces
   que són opcions noves (llums, campana, forn) porten userData.nou: amb «Antes» s'amaguen. */
function marca(obj, part, nou) { obj.traverse(o => { o.userData.part = part; if (nou) o.userData.nou = true; }); return obj; }
let OPC = {};   // opcions de l'habitació que es munta (les llegeixen les peces)
function tirador(x, y, z, pare, vertical, llarg = .26) {   // barra rodona separada del frontal amb dos peus
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(.0065, .0065, llarg, 12), M.tirador);
  if (!vertical) b.rotation.z = Math.PI / 2;
  b.position.z = .028; b.castShadow = true; g.add(b);
  for (const k of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .028, 8), M.tirador);
    p.rotation.x = Math.PI / 2; p.position.set(vertical ? 0 : k * (llarg / 2 - .02), vertical ? k * (llarg / 2 - .02) : 0, .014); g.add(p);
  }
  g.position.set(x, y, z); pare.add(marca(g, 'tirador')); return g;
}
function tiradaBaixa(tipus, ambFrontal) {
  const g = new THREE.Group(); let x = 0;
  const electro = OPC.electro && OPC.electro !== 'ninguno';
  for (const t of tipus) {
    const w = .6, cx = x + w / 2;
    marca(caixa(w - .004, .1, .5, M.socol, cx, 0, .25, g), 'mobles');
    marca(caixa(w - .004, .76, .56, M.cos, cx, .1, .28, g), 'mobles');
    if (t === 'placa' && electro) {             // forn sota la placa, amb un calaix a sota
      marca(caixa(w - .008, .2, .02, M.frente, cx, .102, .57, g), 'mobles');
      tirador(cx, .256, .58, g);
      marca(caixa(w - .02, .5, .02, M.forn, cx, .32, .575, g), 'electro', true);
      marca(caixa(w - .1, .015, .025, M.electro, cx, .78, .6, g), 'electro', true);
    } else if (t === 'calaixos') {
      [0, 1, 2].forEach(i => {
        marca(caixa(w - .008, .245, .02, M.frente, cx, .102 + i * .253, .57, g), 'mobles');
        tirador(cx, .102 + i * .253 + .211, .58, g);
      });
    } else {
      marca(caixa(w - .008, .755, .02, M.frente, cx, .102, .57, g), 'mobles');
      tirador(cx, .796, .58, g);
    }
    if (t === 'placa') marca(caixa(.56, .008, .5, M.vitro, cx, .9, .3, g), 'electro');
    if (t === 'pica') {
      marca(caixa(.5, .006, .4, M.inox, cx, .9, .3, g), 'aixeta');
      marca(cilindre(.014, .014, .34, M.aixeta, cx, .9, .08, g), 'aixeta');
      const b = marca(caixa(.02, .02, .2, M.aixeta, cx, 1.22, .17, g), 'aixeta'); b.rotation.x = .25;
    }
    x += w;
  }
  marca(caixa(x + .02, .04, .63, M.encimera, x / 2, .86, .305, g), 'taulell');
  if (ambFrontal) marca(caixa(x, .58, .012, M.frontal, x / 2, .9, .006, g, false), 'frontal');
  g.userData.llarg = x;
  return g;
}
function tiradaAlta(n, placa) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const cx = i * .6 + .3;
    marca(caixa(.596, .72, .33, M.cos, cx, 1.48, .165, g), 'mobles');
    marca(caixa(.592, .716, .02, M.frente, cx, 1.482, .34, g), 'mobles');
    tirador(cx, 1.526, .35, g);
  }
  marca(caixa(n * .6, .012, .02, M.led, n * .6 / 2, 1.466, .29, g, false), 'llum');   // tira de llum sota els mobles
  if (placa != null && placa < n && OPC.electro && OPC.electro !== 'ninguno' && OPC.electro !== 'integrados') {
    marca(caixa(.58, .045, .34, M.electro, placa * .6 + .3, 1.43, .2, g), 'electro', true);   // campana extraïble
  }
  return g;
}
function columna() {
  const g = new THREE.Group(), nevera = ['inox', 'negro'].includes(OPC.electro);
  const fr = nevera ? M.electro : M.frente, part = OPC.electro && OPC.electro !== 'ninguno' ? 'electro' : 'mobles';
  marca(caixa(.596, .1, .5, M.socol, .3, 0, .25, g), part);
  marca(caixa(.596, 2.1, .58, M.cos, .3, .1, .29, g), part);
  marca(caixa(.592, 1.25, .02, fr, .3, .102, .59, g), part);
  marca(caixa(.592, .84, .02, fr, .3, 1.362, .59, g), part);
  const t1 = tirador(.54, 1.0, .6, g, true, .5), t2 = tirador(.54, 1.57, .6, g, true, .3);
  if (nevera) for (const t of [t1, t2]) t.traverse(o => { if (o.isMesh) o.material = M.inox; o.userData.part = 'electro'; });
  return g;
}
/* Llum penjant: de llautó (campana) o de vidre (globus) */
function penjant(x, z, pare, alt = 1.8) {
  if (OPC.lamparas === 'focos') return;
  const g = new THREE.Group();
  cilindre(.004, .004, 2.62 - alt, M.metall, 0, alt + .17, 0, g, 6).castShadow = false;
  if (OPC.lamparas === 'cristal') {        // globus de vidre fumat amb casquet de llautó
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.12, 28, 18), M.vidreLlum); gl.position.y = alt + .05; g.add(gl);
    cilindre(.035, .035, .05, M.llauto, 0, alt + .15, 0, g, 16);
  } else { cilindre(.05, .17, .18, M.llauto, 0, alt, 0, g); cilindre(.05, .05, .03, M.llauto, 0, alt + .18, 0, g, 16); }
  const b = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 8), M.bombeta);
  b.position.set(0, alt + .03, 0); g.add(b);
  g.position.set(x, 0, z); pare.add(marca(g, 'llum', true));
}
function planta(x, z, pare, esc = 1) {
  cilindre(.16 * esc, .12 * esc, .32 * esc, M.test, x, 0, z, pare);
  const r = aleatori(Math.round(x * 100 + z * 10));
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry((.12 + r() * .1) * esc, 3), M.fulla);
    f.position.set(x + (r() - .5) * .3 * esc, (.42 + r() * .45) * esc, z + (r() - .5) * .3 * esc);
    f.rotation.set(r() * 3, r() * 3, r() * 3); f.castShadow = true; pare.add(f);
  }
}
function cadira(x, z, rot, pare) {
  const g = new THREE.Group();
  caixa(.42, .03, .42, M.fusta, 0, .44, 0, g);
  caixa(.42, .4, .03, M.fusta, 0, .47, -.2, g);
  [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => cilindre(.015, .015, .44, M.metall, a, 0, b, g, 8));
  g.position.set(x, 0, z); g.rotation.y = rot; pare.add(g);
}
/* Detalls que fan la cuina habitada: un bol amb llimones i una post de tallar */
function detallsTaulell(x, z, pare) {
  const bol = cilindre(.13, .08, .07, M.ceramica, x, .9, z, pare, 24);
  [[0, 0], [.05, .03], [-.04, .04]].forEach(([a, b], i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(.04, 14, 10), M.llimona);
    l.scale.set(1.15, 1, 1); l.position.set(x + a, .98 + (i ? .01 : .02), z + b); l.castShadow = true; pare.add(l);
  });
  const post = caixa(.32, .42, .022, M.fusta, x + .42, .9, z - .2, pare); post.rotation.x = -.18;
  return bol;
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
/* Saló i dormitoris de prop (en Lluc, 25/10/2026): la sala sola a escala real, amb dues parets tallades com la cuina,
   la finestra (marc de la zona: grafit si són noves) i els mateixos mobles del pis. Les mides surten de la distribució. */
function escenaEstancia(z) {
  const r0 = plaObj.zones[z.id], W = r0.x2 - r0.x1, D = r0.z2 - r0.z1, H = 2.6, T = .12, x0 = -W / 2, z0 = -D / 2;
  const g = new THREE.Group(), P = M.paretInt, mt = materialsZona(z);
  caixa(W, .03, D, mt.terra, 0, -.03, 0, g).castShadow = false;
  paret(T, H, D + T, x0 - T / 2, 0, -T / 2, g, P);
  const zb = z0 - T / 2;
  if (finestresZona(z)) {
    const { wx1, wx2, wy1, wy2 } = finestraCuina(W);
    paret(wx1 - x0 + T, H, T, (x0 - T + wx1) / 2, 0, zb, g, P);
    paret(W / 2 - wx2, H, T, (wx2 + W / 2) / 2, 0, zb, g, P);
    paret(wx2 - wx1, wy1, T, (wx1 + wx2) / 2, 0, zb, g, P);
    paret(wx2 - wx1, H - wy2, T, (wx1 + wx2) / 2, wy2, zb, g, P);
    caixa(wx2 - wx1, wy2 - wy1, .02, M.finestra, (wx1 + wx2) / 2, wy1, z0 - T * .7, g, false);
    caixa(wx2 - wx1 + .08, .03, .16, mt.marc, (wx1 + wx2) / 2, wy1 - .03, z0 + .02, g);
  } else paret(W + T, H, T, -T / 2, 0, zb, g, P);
  const mb = MOBLES[z.tipus]();
  g.add(mb.grup); mb.posa({ x1: x0, x2: -x0, z1: z0, z2: -z0 }, z.opts);
  g.userData = { mides: { W, D, H, T }, mida: Math.max(W, D) };
  return g;
}
const escenaDe = z => z.tipus === 'cocina' ? escenaCuina(z.opts) : z.tipus === 'bano' ? escenaBany(z.opts) : escenaEstancia(z);
function escenaCuina(v) {
  const g = new THREE.Group(), mi = midesCuina(v.m2), { W, D, H, T } = mi, x0 = -W / 2, z0 = -D / 2;
  marca(caixa(W, .03, D, M.terra, 0, -.03, 0, g), 'terra').castShadow = false;
  const P = M.paretInt;
  marca(paret(T, H, D + T, x0 - T / 2, 0, -T / 2, g, P), 'parets');
  const { wx1, wx2, wy1, wy2 } = finestraCuina(W), zb = z0 - T / 2;
  marca(paret(wx1 - x0 + T, H, T, (x0 - T + wx1) / 2, 0, zb, g, P), 'parets');
  marca(paret(W / 2 - wx2, H, T, (wx2 + W / 2) / 2, 0, zb, g, P), 'parets');
  marca(paret(wx2 - wx1, wy1, T, (wx1 + wx2) / 2, 0, zb, g, P), 'parets');
  marca(paret(wx2 - wx1, H - wy2, T, (wx1 + wx2) / 2, wy2, zb, g, P), 'parets');
  caixa(wx2 - wx1, wy2 - wy1, .02, M.finestra, (wx1 + wx2) / 2, wy1, z0 - T * .7, g, false);
  caixa(.04, wy2 - wy1, .06, M.marc, (wx1 + wx2) / 2, wy1, z0 - .05, g);
  caixa(wx2 - wx1 + .08, .03, .16, M.marc, (wx1 + wx2) / 2, wy1 - .03, z0 + .02, g);
  const mobles = new THREE.Group(); g.add(mobles);
  g.userData = { mobles, mides: mi, mida: Math.max(W, D) };
  muntaCuina(mobles, v, mi);
  return g;
}
/* Tipus de cada mòdul d'una tirada: la pica a sota la finestra, la placa separada */
function tipusTirada(n, pica, placa) {
  return Array.from({ length: n }, (_, i) => i === pica ? 'pica' : i === placa ? 'placa' : i % 2 ? 'porta' : 'calaixos');
}
function muntaCuina(m, v, { W, D }) {
  OPC = v;
  const forma = v.forma;
  const x0 = -W / 2, z0 = -D / 2, { wx1, wx2 } = finestraCuina(W), wc = (wx1 + wx2) / 2;
  const limita = (i, n) => Math.max(0, Math.min(n - 1, i));
  let llumsFets = false, bolX;
  if (forma === 'l') {
    const n = Math.max(3, Math.floor((W - .05) / .6));
    const nl = Math.max(1, Math.floor((D - 1.3) / .6));
    const pica = limita(Math.round((wc - x0 - .3) / .6), n);
    const placaAlFons = nl < 2;
    const placa = placaAlFons ? limita(pica - 2, n) : -1;
    const b = tiradaBaixa(tipusTirada(n, pica, placa), true); b.position.set(x0, 0, z0); m.add(b);
    const na = Math.floor((wx1 - .1 - x0 - .35) / .6);
    if (na > 0) { const a = tiradaAlta(na, placa >= 0 ? Math.round((placa * .6 - .35) / .6) : null); a.position.set(x0 + .35, 0, z0); m.add(a); }
    const zFi = z0 + .6 + nl * .6;
    const e = tiradaBaixa(tipusTirada(nl, -1, placaAlFons ? -1 : 1), true); e.rotation.y = Math.PI / 2; e.position.set(x0, 0, zFi); m.add(e);
    const ea = tiradaAlta(nl, placaAlFons ? null : 1); ea.rotation.y = Math.PI / 2; ea.position.set(x0, 0, zFi); m.add(ea);
    if (D / 2 - zFi >= .65) { const c = columna(); c.rotation.y = Math.PI / 2; c.position.set(x0, 0, zFi + .6); m.add(c); }
    bolX = x0 + Math.min(n - 1, pica + 1) * .6 + .1;
  } else {
    const col = W >= 3.4;
    const xs = x0 + (col ? .6 : 0);
    if (col) { const c = columna(); c.position.set(x0, 0, z0); m.add(c); }
    const n = Math.max(3, Math.min(9, Math.floor((W / 2 - xs - .05) / .6)));
    const pica = limita(Math.round((wc - xs - .3) / .6), n);
    const placa = pica >= 2 ? pica - 2 : limita(pica + 2, n) === pica ? (pica + 1) % n : limita(pica + 2, n);
    const b = tiradaBaixa(tipusTirada(n, pica, placa), true); b.position.set(xs, 0, z0); m.add(b);
    const na = Math.floor((wx1 - .1 - xs) / .6);
    if (na > 0) { const a = tiradaAlta(na, placa); a.position.set(xs, 0, z0); m.add(a); }
    bolX = xs + (placa < pica ? placa + 1 : Math.max(0, placa - 1)) * .6 + .15;
  }
  detallsTaulell(bolX, z0 + .3, m);
  let taula = null;
  if (forma === 'isla') {
    const ni = Math.min(4, Math.max(2, Math.floor((W - 1.6) / .6))), len = ni * .6;
    const il = tiradaBaixa(Array.from({ length: ni }, (_, i) => i % 2 ? 'porta' : 'calaixos'));
    il.children[il.children.length - 1].visible = false;          // el taulell de l'illa és més fondo
    marca(caixa(len + .1, .04, .98, M.encimera, len / 2, .86, .15, il), 'taulell');
    marca(caixa(len, .86, .02, M.frente, len / 2, 0, -.01, il), 'mobles');   // costat dels tamborets, del color dels mobles
    const px = len / 2, pz = z0 + 2.22;
    il.rotation.y = Math.PI; il.position.set(px, 0, pz); m.add(il);
    const k = ni - 1;
    for (let i = 0; i < k; i++) {
      const x = (i - (k - 1) / 2) * .72;
      cilindre(.17, .17, .05, M.fusta, x, .62, pz + .7, m);
      cilindre(.018, .018, .62, M.metall, x, 0, pz + .7, m, 8);
      cilindre(.16, .16, .015, M.metall, x, 0, pz + .7, m);
    }
    penjant(-len / 4, pz - .1, m); penjant(len / 4, pz - .1, m);
    llumsFets = true;
  } else if (D >= 2.9 && W >= 3.3) {
    const tx = W / 2 - 1.0, tz = D / 2 - 1.0;
    cilindre(.45, .45, .035, M.fusta, tx, .72, tz, m, 48);
    cilindre(.05, .05, .72, M.metall, tx, 0, tz, m, 12);
    cilindre(.22, .25, .02, M.metall, tx, 0, tz, m);
    cadira(tx, tz + .65, Math.PI, m); cadira(tx + .65, tz, -Math.PI / 2, m);
    penjant(tx, tz, m, 1.55);
    taula = true; llumsFets = true;
  }
  if (!llumsFets) { penjant(-W * .12, z0 + .95, m, 1.8); penjant(W * .18, z0 + .95, m, 1.8); }
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
  marca(caixa(W, .03, D, M.terraBany, 0, -.03, 0, g), 'terra').castShadow = false;
  // Paret: obra + rajola per dins
  marca(paret(T, H, D + T, x0 - T / 2, 0, -T / 2, g, M.paretInt), 'parets');
  marca(paret(W + T, H, T, -T / 2, 0, z0 - T / 2, g, M.paretInt), 'parets');
  marca(caixa(.01, H - .002, D, M.rajola, x0 + .005, 0, 0, g, false), 'parets');
  marca(caixa(W, H - .002, .01, M.rajola, 0, 0, z0 + .005, g, false), 'parets');
  const peces = new THREE.Group(); g.add(peces);
  g.userData = { peces, mides: mi, mida: Math.max(W, D) };
  muntaBany(peces, v, mi);
  return g;
}
function muntaBany(p, v, { W, D }) {
  OPC = v;
  const x0 = -W / 2, z0 = -D / 2, banera = v.tipo === 'banera';
  let fiX, fonsZ;                     // fins on arriba la dutxa o la banyera
  const dutxa = new THREE.Group(); p.add(dutxa);
  if (banera) {
    const len = Math.min(1.7, W - 1.0), fons = .72;
    caixa(len, .55, fons, M.ceramica, x0 + len / 2, 0, z0 + fons / 2, dutxa);
    caixa(len - .14, .01, fons - .14, M.aiguaBany, x0 + len / 2, .545, z0 + fons / 2, dutxa, false);
    caixa(.02, 1.4, .7, M.vidre, x0 + len - .01, .56, z0 + .35, dutxa, false);
    caixa(.025, .025, .7, M.aixeta, x0 + len - .01, 1.95, z0 + .35, dutxa);
    marca(cilindre(.012, .012, .7, M.aixeta, x0 + .2, .9, z0 + .03, p, 8), 'aixeta');
    marca(caixa(.12, .02, .12, M.aixeta, x0 + .2, 1.6, z0 + .08, p), 'aixeta');
    fiX = x0 + len; fonsZ = z0 + fons;
  } else {
    const s = Math.max(.7, Math.min(1.0, D - .9, W * .42));
    caixa(s - .08, .02, s - .08, M.plat, x0 + s / 2, 0, z0 + s / 2, dutxa, false);          // plat, amb una vora més alta
    for (const [w, d, x, z] of [[s, .04, x0 + s / 2, z0 + .02], [s, .04, x0 + s / 2, z0 + s - .02], [.04, s, x0 + .02, z0 + s / 2], [.04, s, x0 + s - .02, z0 + s / 2]]) caixa(w, .035, d, M.ceramica, x, 0, z, dutxa, false);
    caixa(.012, 2.0, .02, M.aixeta, x0 + s, 0, z0 + s * .9 - .01, dutxa);     // perfil de la mampara
    caixa(s * .7, .004, .05, M.inox, x0 + s / 2, .021, z0 + s - .1, dutxa, false);     // desguàs lineal
    caixa(.02, 2.0, s * .9, M.vidre, x0 + s, 0, z0 + s * .45, dutxa, false);
    caixa(.025, .025, s * .9, M.aixeta, x0 + s, 2.0, z0 + s * .45, dutxa);
    marca(cilindre(.012, .012, 1.0, M.aixeta, x0 + s / 2, 1.1, z0 + .03, p, 8), 'aixeta');
    marca(cilindre(.13, .13, .015, M.aixeta, x0 + s / 2, 2.1, z0 + .15, p), 'aixeta');
    marca(caixa(.02, .02, .14, M.aixeta, x0 + s / 2, 2.1, z0 + .08, p), 'aixeta');
    if (v.luces === 'led') {          // fornícula amb tira de llum a la paret de la dutxa
      caixa(s * .6, .32, .015, M.paretInt, x0 + s / 2, 1.15, z0 + .012, dutxa, false);
      marca(caixa(s * .6, .012, .02, M.led, x0 + s / 2, 1.46, z0 + .03, p, false), 'llum', true);
    }
    fiX = x0 + s; fonsZ = z0 + s;
  }
  marca(dutxa, 'dutxa');
  // Lavabo suspès, a l'altra punta de la paret del fons
  const vw = Math.max(.5, Math.min(.9, W / 2 - fiX - .2)), xl = W / 2 - .1 - vw / 2, rm = Math.min(.34, vw / 2 - .02);
  marca(caixa(vw, .42, .46, M.moble, xl, .42, z0 + .23, p), 'moble');
  marca(caixa(vw + .02, .03, .48, M.fusta, xl, .84, z0 + .24, p), 'moble');
  const bol = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.13, 0], [.19, .03], [.205, .12], [.19, .125], [.172, .045], [.11, .02], [0, .018]].map(([x, y]) => new THREE.Vector2(x, y)), 40), M.pica);
  bol.scale.set(Math.min(1, vw / .5), 1, .82); bol.position.set(xl, .87, z0 + .27); bol.castShadow = bol.receiveShadow = true; p.add(marca(bol, 'moble'));
  marca(cilindre(.012, .012, .006, M.inox, xl, .888, z0 + .27, p, 16), 'moble');      // desguàs
  marca(cilindre(.012, .012, .3, M.aixeta, xl, .87, z0 + .05, p, 12), 'aixeta');
  const broc = marca(caixa(.018, .018, .15, M.aixeta, xl, 1.15, z0 + .12, p), 'aixeta'); broc.rotation.x = .12;
  cilindre(.035, .035, .14, M.test, xl + vw / 2 - .1, .9, z0 + .1, p, 16);    // sabó i un gerro petit
  const tb = new THREE.Group();     // tovalloler de barra amb una tovallola, a la paret del costat del lavabo
  caixa(.02, .02, .45, M.aixeta, 0, 1.12, 0, tb); caixa(.05, .5, .38, M.tovallola, -.03, .64, 0, tb);
  {   // a la paret del fons entre la dutxa i el lavabo si hi cap; si no, a la de l'esquerra, passat l'inodor
    const g1 = fiX + .05, g2 = xl - vw / 2 - .05, ze = fonsZ + 1.05;
    if (g2 - g1 >= .45) { tb.rotation.y = -Math.PI / 2; tb.position.set((g1 + g2) / 2, 0, z0 + .03); p.add(marca(tb, 'aixeta')); }
    else if (ze + .25 < D / 2) { tb.rotation.y = Math.PI; tb.position.set(x0 + .03, 0, ze); p.add(marca(tb, 'aixeta')); }
  }
  caixa(.7, .012, .45, M.catifaB, fiX + .45, 0, fonsZ + .32, p, false);
  // Mirall: rodó de llautó, amb llum o armari
  const mi = new THREE.Group();
  if (v.espejo === 'luz') {
    caixa(rm * 2, .8, .02, M.mirall, xl, 1.22, z0 + .012, mi);
    marca(caixa(rm * 2 + .03, .015, .025, M.bombeta, xl, 2.03, z0 + .02, mi, false), 'mirall', true);
    marca(caixa(rm * 2 + .03, .015, .025, M.bombeta, xl, 1.2, z0 + .02, mi, false), 'mirall', true);
  } else if (v.espejo === 'armario') {
    caixa(Math.min(vw, .8), .7, .14, M.moble, xl, 1.25, z0 + .07, mi);
    caixa(Math.min(vw, .8) - .01, .69, .01, M.mirall, xl, 1.255, z0 + .145, mi);
  } else {
    const mirall = new THREE.Mesh(new THREE.CylinderGeometry(rm, rm, .015, 48), M.mirall);
    mirall.rotation.x = Math.PI / 2; mirall.position.set(xl, 1.6, z0 + .012); mi.add(mirall);
    const vora = new THREE.Mesh(new THREE.TorusGeometry(rm + .005, .012, 8, 64), M.llauto);
    vora.position.set(xl, 1.6, z0 + .02); mi.add(vora);
  }
  p.add(marca(mi, 'mirall'));
  if (v.luces === 'apliques') {       // dos apliques de llautó als costats del mirall
    for (const dx of [-1, 1]) {
      const a = new THREE.Group();
      caixa(.03, .03, .1, M.llauto, 0, 0, .05, a);
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .16, 20), M.vidreLlum); gl.position.set(0, .02, .12); a.add(gl);
      const b = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), M.bombeta); b.position.set(0, .02, .12); a.add(b);
      a.position.set(xl + dx * (rm + .14), 1.62, z0); p.add(marca(a, 'llum', true));
    }
  }
  // Inodor suspès, a la paret de l'esquerra, davant de la dutxa o la banyera
  const zw = fonsZ + .45;
  const wc = new THREE.Group();
  const tassa = new THREE.Mesh(new THREE.LatheGeometry([[0, .28], [.1, .28], [.17, .32], [.2, .4], [.205, .48], [.185, .485], [.16, .43], [.07, .37], [0, .36]].map(([x, y]) => new THREE.Vector2(x, y)), 40), M.wc);
  tassa.scale.set(1, 1, 1.32); tassa.position.z = .33; tassa.castShadow = tassa.receiveShadow = true; wc.add(tassa);
  caixa(.3, .2, .16, M.wc, 0, .3, .08, wc);                                     // part que entra a la paret
  const seient = new THREE.Mesh(new THREE.TorusGeometry(.155, .024, 12, 40), M.wc);
  seient.rotation.x = Math.PI / 2; seient.scale.set(1, 1.3, .7); seient.position.set(0, .5, .34); seient.castShadow = true; wc.add(seient);
  caixa(.24, .16, .012, M.aixeta, 0, 1.0, .006, wc);                            // polsador
  for (const dx of [-.05, .05]) { const b = cilindre(.035, .035, .006, M.wc, dx, 0, 0, wc, 20); b.rotation.x = Math.PI / 2; b.position.set(dx, 1.08, .014); }
  wc.rotation.y = Math.PI / 2; wc.position.set(x0, 0, zw); p.add(marca(wc, 'vater'));
  if (v.paquete === 'llave') {      // tovalloler elèctric, on hi hagi paret lliure
    const tv = new THREE.Group();
    for (let i = 0; i < 7; i++) caixa(.5, .02, .02, M.aixeta, 0, .62 + i * .12, .06, tv);
    caixa(.02, .84, .02, M.aixeta, -.25, .56, .06, tv); caixa(.02, .84, .02, M.aixeta, .25, .56, .06, tv);
    caixa(.42, .5, .03, M.tela, 0, .8, .09, tv);     // una tovallola penjada
    const g1 = fiX + .05, g2 = xl - vw / 2 - .05;
    if (g2 - g1 >= .55) { tv.position.set((g1 + g2) / 2, 0, z0); p.add(marca(tv, 'obra')); }
    else if (D / 2 - (zw + .3) >= .6) { tv.rotation.y = Math.PI / 2; tv.position.set(x0, 0, (zw + .3 + D / 2) / 2); p.add(marca(tv, 'obra')); }
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
let GEO;   // BoxGeometry(1,1,1), es crea a carrega3D
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
  const tauleta = new THREE.Group(); cilindre(.36, .36, .04, M.fusta, 0, .34, 0, tauleta, 40); cilindre(.05, .05, .34, M.metall, 0, 0, 0, tauleta, 10);
  const tv = new THREE.Group(); caixaR(.42, .45, 1.6, .03, M.fusta, 0, 0, 0, tv); caixa(.06, .45, 1.1, M.vitro, -.1, .45, 0, tv);
  const taula = new THREE.Group();
  caixaR(.9, .04, 1.5, .015, M.fusta, 0, .72, 0, taula);
  [[-.35, -.6], [.35, -.6], [-.35, .6], [.35, .6]].forEach(([a, b]) => cilindre(.02, .02, .72, M.metall, a, 0, b, taula, 8));
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
    o.et.el.classList.toggle('pn-et-fora', !!st.dins && st.dins !== id);
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
    const z = st.zones.get(id), boira = !!st.dins && st.dins !== id && z.on, mt = o.vel.material;
    const obj = boira ? .62 : z.on ? 0 : hover === id ? .3 : .5;
    mt.color.setHex(boira ? 0xF3F2EE : 0x1B1F22);
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
function vista(quina, mida = 0, asp = aspUtil()) {
  const f = Math.pow(Math.max(1, 1.45 / asp), .75);
  if (quina === 'cocina') return { t: new THREE.Vector3(.05, .8, -.1), r: (mida * 1.3 + 2.4) * f, pol: 1.06, az: .6 };
  if (quina === 'bano') return { t: new THREE.Vector3(0, 1.0, -.1), r: (mida * 1.35 + 2.2) * f, pol: 1.08, az: .6 };
  return { t: new THREE.Vector3(0, 0, .25), r: (mida * 1.5 + 5) * f, pol: .8, az: .38 };
}
/* El passadís no té vista de prop (en Lluc, 25/10/2026): la càmera s'hi acosta dins del pis */
function vistaSala(id, asp = aspUtil()) {
  const r = plaObj.zones[id], f = Math.pow(Math.max(1, 1.45 / asp), .75), mida = Math.max(r.x2 - r.x1, r.z2 - r.z1);
  return { t: new THREE.Vector3((r.x1 + r.x2) / 2, .35, (r.z1 + r.z2) / 2), r: (mida * 1.6 + 5) * f, pol: .8, az: .38 };
}
/* Saló i dormitoris de prop: la distància surt de l'esfera que envolta la sala (terra i parets), perquè hi càpiga
   sencera a l'espai lliure, també amb el panell al costat o a 390 (jutge, 25/10/2026) */
function vistaProp({ W, D, H }, asp = aspUtil()) {
  const R = Math.hypot(W, D, H) / 2, v = THREE.MathUtils.degToRad(camera.fov) / 2;
  const mitja = Math.min(v, Math.atan(Math.tan(v) * asp));
  return { t: new THREE.Vector3(0, H * .38, 0), r: R / Math.sin(mitja) * 1.04, pol: 1.0, az: .6 };
}
function puntVista(v) {
  return new THREE.Vector3(Math.sin(v.pol) * Math.sin(v.az), Math.cos(v.pol), Math.sin(v.pol) * Math.cos(v.az)).multiplyScalar(v.r).add(v.t);
}
function vistaActual(asp) {
  if (st.dins && st.vista === 'pis') return vistaSala(st.dins, asp);
  if (interior && FORM_DE[st.vista] === 'estancia') return vistaProp(interior.userData.mides, asp);
  const mida = st.vista === 'pis' ? (plaObj ? Math.max(plaObj.W, plaObj.D) : 10) : interior ? interior.userData.mida : 5;
  return vista(st.vista, mida, asp);
}
function posa(v, dur = 900) {
  const de = camera.position.clone(), deT = controls.target.clone();
  const a = puntVista(v);
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
const COLORS_FRENTE = { blanco: 0xE7E3DA, salvia: 0x8F9B86, noche: 0x2B3446, grafito: 0x3A3C3F };
const ACABATS = { mate: .62, satinado: .26, ranurado: .55 };
const TIRADORS = { negro: [0x1C1D1E, .6, .35], laton: [0xB08D57, 1, .3], gola: [0x1C1D1E, .6, .35] };
const AIXETES = { cromo: [0xC9CDD0, 1, .14], negro: [0x1C1D1E, .35, .45], laton: [0xB08D57, 1, .28] };
const ELECTRO = { inox: [0xB9BCBE, 1, .3], negro: [0x141516, .3, .12], integrados: [0x141516, .3, .12], ninguno: [0x141516, .3, .12] };
const PINTURA = { blanco: 0xE8E6E0, arena: 0xD8CBB5, humo: 0xA9ADAE };
const TERRES_BANY = { rajola: ['rajolaTerra', .8, .4], micro: ['microcemento', 2, .55], piedra: ['pedra', 1.2, .5] };
function posaMap(m, t, rug, bump = 0) {
  m.map = t; m.bumpMap = bump && !MOBIL ? t : null; m.bumpScale = bump; m.color.set(0xffffff);   // relleu només a l'escriptori
  if (rug != null) m.roughness = rug;
  m.needsUpdate = true;
}
function metall(m, [c, met, rug]) { m.color.set(c); m.metalness = met; m.roughness = rug; }
function allibera(obj) { obj.traverse(o => { if (o.geometry && o.geometry !== GEO) o.geometry.dispose(); }); }
function aplicaMaterials() {
  if (!renderer) return;
  st.abans = false; $('[data-abans]').setAttribute('aria-pressed', 'false');
  if (interior) interior.traverse(o => { if (o.userData.nou) o.visible = true; });
  for (const z of st.zones.values()) {
    const mt = materialsZona(z), o = z.opts, aqui = !!interior && st.vista === z.tipus;   // el que només es veu per dins
    if (z.tipus === 'cocina') {
      const fusta = o.frente === 'roble', ran = o.acabado === 'ranurado';
      M.frente.map = fusta ? tex('robleV', .8) : aqui ? tex('gra', .5) : null;   // el gra només es veu per dins
      M.frente.bumpMap = ran ? tex('ranures', .6) : fusta && !MOBIL ? tex('robleV', .8) : null;
      M.frente.bumpScale = ran ? 2.5 : .5;
      M.frente.roughness = ACABATS[o.acabado] ?? .62;
      if (fusta) M.frente.color.set(0xffffff); else if (M.frente.color.getHex() !== COLORS_FRENTE[o.frente]) tweenColor(M.frente, COLORS_FRENTE[o.frente]);
      M.frente.needsUpdate = true;
      metall(M.tirador, TIRADORS[o.tiradores] || TIRADORS.negro);
      M.tirador.visible = o.tiradores !== 'gola';
      const enc = { roble: ['roble', 1.2, .5], cuarzo: ['cuarzo', 1, .22], marmol: ['marmol', 1.6, .12] }[o.encimera];
      posaMap(M.encimera, tex(enc[0], enc[1]), enc[2], enc[0] === 'roble' ? .4 : 0);
      const ter = TERRES[o.suelo] || TERRES.porcelanico;
      posaMap(M.terra, tex(ter[0], ter[1]), ter[2], .35);
      mt.terra.map = tex(ter[0], ter[1]); mt.terra.roughness = ter[2];
      if (aqui) {
        M.paretInt.color.set(PINTURA[o.paredes] || PINTURA.blanco); M.paretInt.map = tex('estuc', 1.2); M.paretInt.needsUpdate = true;
        if (o.frontal === 'metro') posaMap(M.frontal, tex('metro', .6), .22, .6);
        else if (o.frontal === 'porcelanico') posaMap(M.frontal, tex('cuarzo', 1.2), .16);
        else { M.frontal.map = M.frontal.bumpMap = null; M.frontal.color.set(PINTURA[o.paredes] || PINTURA.blanco); M.frontal.roughness = .85; M.frontal.needsUpdate = true; }
        metall(M.aixeta, AIXETES[o.grifo] || AIXETES.cromo);
        metall(M.electro, ELECTRO[o.electro] || ELECTRO.inox);
        M.led.userData.on = o.led === 'si';
      }
    } else if (z.tipus === 'bano') {
      if (st.activa === z.id || !st.activa || z.n === 1) {     // els banys comparteixen materials: mana el que s'edita
        const az = { blanco: '#ECEAE4', verde: '#9DB4A6', cobalto: '#2C4C9A' }[o.pared];
        if (o.pared === 'micro') posaMap(M.rajola, tex('microcemento', 1.6), .6);
        else posaMap(M.rajola, tex('az' + az, .6, azulejo(az)), .22, 1.2);
        const tb = TERRES_BANY[o.sueloB] || TERRES_BANY.rajola;
        posaMap(M.terraBany, tex(tb[0], tb[1]), tb[2], .35);
        if (o.mueble === 'roble') posaMap(M.moble, tex('robleV', .5), .5, 1);
        else { M.moble.map = M.moble.bumpMap = null; M.moble.color.set(o.mueble === 'blanco' ? 0xECEAE4 : 0x3A3C3F); M.moble.needsUpdate = true; }
        M.wc.color.set(o.inodoro === 'negro' ? 0x2A2C2E : 0xF6F6F3); M.wc.roughness = o.inodoro === 'negro' ? .4 : .18;
        if (aqui) {
          M.paretInt.color.set(PINTURA.blanco);
          metall(M.aixeta, AIXETES[o.griferia] || AIXETES.cromo);
          M.led.userData.on = o.luces === 'led';
        }
      }
      const tb = TERRES_BANY[o.sueloB] || TERRES_BANY.rajola;
      mt.terra.map = tex(tb[0], tb[1]);
    } else {
      const ter = TERRES[o.suelo] || TERRES.porcelanico;
      mt.terra.map = tex(ter[0], ter[1]); mt.terra.roughness = ter[2];
      mt.marc.color.set(o.ventanas ? 0x34383B : 0xF5F4F0);
    }
    mt.terra.needsUpdate = true;
  }
  if (plaAra) plaAra._brut = true;     // els mobles (armari, illa, banyera) depenen de les opcions
  aplicaLlum();
}

/* ── Dia i nit (peça 16): de nit, el sol baixa i s'encenen els llums de dins (penjants, apliques, LED) ── */
const LLUM = { dia: { sol: 3.0, hemi: .5, env: .55, exp: .95 }, nit: { sol: .1, hemi: .05, env: .08, exp: 1.1 } };
let hemi, entorn, llumsInt = [];
function aplicaLlum() {
  $('.pn').dataset.llum = st.llum;
  if (!renderer) return;
  const nit = st.llum === 'nit', L = LLUM[st.llum];
  sol.intensity = L.sol; sol.color.set(nit ? 0x9DB0D6 : 0xFFEFD8);
  hemi.intensity = L.hemi; scene.environmentIntensity = L.env; renderer.toneMappingExposure = L.exp;
  M.finestra.color.set(nit ? 0x23324A : 0xE8EEF2); M.finestra.emissive.set(nit ? 0x1A263A : 0xEAF1F6);
  const ledOn = !!M.led.userData.on && !st.abans;
  M.led.emissiveIntensity = ledOn ? (nit ? 3.2 : .6) : 0;
  M.bombeta.emissiveIntensity = st.abans || !nit ? 0 : 3.4;
  M.vidreLlum.emissiveIntensity = nit && !st.abans ? .9 : 0;
  for (const m of [M.aixeta, M.inox, M.llauto, M.tirador, M.electro]) m.envMapIntensity = nit ? .35 : 1;
  // Tres llums puntuals fixes (sense canviar-ne el nombre: res de recompilar shaders); de nit van on hi ha bombetes
  const punts = [];
  // Es creen la primera vegada que es fa de nit: de dia no cal compilar-los a cada material
  if (nit && !llumsInt.length) llumsInt = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xFFD9A0, 0, 0, 2); scene.add(l); return l; });
  if (interior && nit && !st.abans) {
    interior.updateMatrixWorld();
    interior.traverse(o => {
      if (!o.isMesh || !o.parent.visible || !(o.material === M.bombeta || (o.material === M.led && ledOn))) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      punts.push(o.material === M.led ? p.add(new THREE.Vector3(0, -.1, 0)) : p.add(new THREE.Vector3(0, -.12, 0)));
    });
    if (!punts.length) { const s = interior.userData.mides; punts.push(new THREE.Vector3(-s.W * .15, 2.3, 0), new THREE.Vector3(s.W * .2, 2.3, -s.D * .15)); }
  }
  const pas = Math.max(1, punts.length / llumsInt.length);
  llumsInt.forEach((l, i) => {
    const p = punts[Math.floor(i * pas)];
    l.intensity = p && i < punts.length ? (punts.length > 2 ? 2 : 2.8) : 0;
    if (p) l.position.copy(p);
  });
  reflexMirall(nit);   // al final: el mirall ja veu els llums de nit encesos
  brut = true;
}

let cubCam = null;
function reflexMirall(nit) {
  if (MOBIL || !interior || st.vista !== 'bano') { M.mirall.envMap = entorn; M.mirall.envMapIntensity = nit ? .35 : 1; return; }
  if (!cubCam) { cubCam = new THREE.CubeCamera(.05, 30, new THREE.WebGLCubeRenderTarget(256)); scene.add(cubCam); }
  const miralls = [];
  interior.updateMatrixWorld();
  interior.traverse(o => { if (o.isMesh && o.material === M.mirall) miralls.push(o); });
  if (!miralls.length) return;
  miralls[0].getWorldPosition(cubCam.position); cubCam.position.z += .12;
  miralls.forEach(m => { m.visible = false; });
  // La maqueta està tallada: per a la foto del mirall es tanquen un moment les dues parets que falten (i el sostre),
  // així el mirall reflecteix rajola i llum, no el buit.
  const { W, D, H } = interior.userData.mides, tanca = new THREE.Group();
  caixa(W, H, .01, M.rajola, 0, 0, D / 2, tanca, false); caixa(.01, H, D, M.rajola, W / 2, 0, 0, tanca, false);
  caixa(W, .01, D, M.paretInt, 0, H, 0, tanca, false);
  interior.add(tanca);
  scene.background = nit ? new THREE.Color(0x1B1E22) : entorn;
  cubCam.update(renderer, scene);
  scene.background = null;
  interior.remove(tanca); allibera(tanca);
  miralls.forEach(m => { m.visible = true; });
  M.mirall.envMap = cubCam.renderTarget.texture; M.mirall.envMapIntensity = 1; brut = true;
  if (tweens.size) { clearTimeout(reflexMirall.t); reflexMirall.t = setTimeout(() => reflexMirall(st.llum === 'nit'), 750); }   // l'escena encara creix
}

/* ── «Antes»: mentre es prem, l'habitació com estava (fusta envernissada, rajola vella, terratzo) ── */
function posaAbans(on) {
  if (!renderer || !interior || st.abans === on) return;
  if (!on) { aplicaMaterials(); return; }
  st.abans = true;
  $('[data-abans]').setAttribute('aria-pressed', 'true');
  interior.traverse(o => { if (o.userData.nou) o.visible = false; });
  const vell = (m, c, t) => { m.map = t || null; m.bumpMap = null; m.color.set(t ? 0xffffff : c); m.roughness = .7; m.needsUpdate = true; };
  M.aixeta.color.set(0xBFC3C6);
  if (st.vista === 'cocina') {
    vell(M.frente, 0x9A6B3F); vell(M.encimera, 0xCDBF9F); vell(M.terra, 0, tex('viejo', 1.6));
    vell(M.frontal, 0, tex('az#D9CFA9', .6, azulejo('#D9CFA9')));
    M.paretInt.color.set(0xE6DBBE); M.tirador.color.set(0xB89A6A); M.tirador.visible = true;
  } else {
    vell(M.rajola, 0, tex('az#C8D3BC', .6, azulejo('#C8D3BC'))); vell(M.terraBany, 0, tex('viejo', 1.2));
    vell(M.moble, 0x9A6B3F); M.wc.color.set(0xF0EEE6);
  }
  aplicaLlum();
}

/* ── Girar sola i tornar a la vista inicial ── */
function posaGir(on) {
  st.gir = !!on && !QUIET && !!controls;
  $('[data-gir]').setAttribute('aria-pressed', String(st.gir));
  if (st.gir) { st.girT0 = performance.now(); st.girAz = controls.getAzimuthalAngle(); }
  brut = true;
}
function reinicia() {
  posaGir(false); posaAbans(false);
  if (renderer) posa(vistaActual());
  $('[data-tota]').hidden = true;
}

/* ── Acostar la càmera a una part (clicada al 3D o triada a la graella) ── */
function enfocaPart(part, punt) {
  if (!renderer || !interior) return;
  const caixaP = new THREE.Box3();
  interior.updateMatrixWorld();
  interior.traverse(o => { if (o.isMesh && o.userData.part === part) caixaP.expandByObject(o); });
  if (caixaP.isEmpty()) return;
  const c = punt ? punt.clone() : caixaP.getCenter(new THREE.Vector3());
  const mida = Math.min(3.2, caixaP.getSize(new THREE.Vector3()).length());
  const r = Math.max(1.5, Math.min(vistaActual().r * .78, mida * 1.1 + 1.1)) * Math.max(1, 1.3 / aspUtil());
  posaGir(false);
  const deT = controls.target.clone(), de = camera.position.clone();
  const a = c.clone().add(de.clone().sub(deT).normalize().multiplyScalar(r));
  controls.minDistance = r * .6;
  radiObjectiu = null;
  tween(800, k => { camera.position.lerpVectors(de, a, k); controls.target.lerpVectors(deT, c, k); });
  $('[data-tota]').hidden = false;
}
/* La part sota el punter (dins de la cuina o el bany); el decorat (planta, bol, cadires) no obre res */
function partSota(e) {
  if (!interior) return null;
  const r = canvas.getBoundingClientRect();
  punter.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(punter, camera);
  for (const h of ray.intersectObject(interior, true)) {
    const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (!h.object.visible || !h.object.parent.visible || m.visible === false) continue;
    return h.object.userData.part ? { part: h.object.userData.part, punt: h.point } : null;
  }
  return null;
}

/* ── El 3D ocupa tota la pantalla, però el centre de la vista és l'espai que deixa el panell ── */
const elPanell = $('.pn-panell');
function despla() {   // escriptori: el panell; mòbil: la columna de controls de la dreta
  return innerWidth > 860 ? elPanell.offsetWidth + 2 * (parseFloat(getComputedStyle(elPanell).right) || 0) : 64;
}
function aspUtil() { return Math.max(.5, (visor.clientWidth - despla()) / Math.max(1, visor.clientHeight)); }
function encaixa() {
  const w = visor.clientWidth, h = visor.clientHeight, d = despla();
  renderer.setSize(w, h, false); camera.aspect = w / h;
  if (d) camera.setViewOffset(w, h, d / 2, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); brut = true;
}

/* ── Veure la cuina o el bany per dins ── */
/* Ceràmica amb vernís (clearcoat): es crea en obrir el bany, perquè la vista del pis no compili aquest shader
   (Lighthouse mòbil, 21/10/2026). Les peces del bany es munten després, ja amb aquests materials. */
function vernisBany() {
  if (M.ceramica.isMeshPhysicalMaterial) return;
  const v = { roughness: .22, clearcoat: 1, clearcoatRoughness: .06 };
  M.ceramica = new THREE.MeshPhysicalMaterial({ color: 0xF6F6F3, ...v });
  M.pica = new THREE.MeshPhysicalMaterial({ color: 0xF6F6F3, ...v, side: THREE.DoubleSide });
  M.wc = new THREE.MeshPhysicalMaterial({ color: M.wc.color.getHex(), ...v, side: THREE.DoubleSide });
}
function obreInterior() {
  const z = st.zones.get(st.activa);
  if (!z || !renderer) return;
  st.vista = z.tipus;
  if (z.tipus === 'bano') vernisBany();
  if (interior) { scene.remove(interior); allibera(interior); }
  interior = escenaDe(z);
  interior.userData.ultim = { ...z.opts };
  scene.add(interior); creix(interior, 600);
  pla.grup.visible = false; elEtiq.hidden = true;
  $('[data-torna]').hidden = false;
  $('[data-tota]').hidden = true; $('[data-abans]').hidden = FORM_DE[z.tipus] === 'estancia';   // les estances no tenen «Antes»
  $$('[data-tota-sol]').forEach(el => { el.hidden = el.dataset.totaSol !== st.vista; });
  ombraPer(interior.userData.mida + 2);
  posa(vistaActual());
  aplicaMaterials();
  $('.pn-pista').textContent = I18N.t(FORM_DE[z.tipus] === 'estancia' ? 'Arrastra para girarla.' : 'Toca cualquier cosa de la maqueta para cambiarla. Arrastra para girarla.');
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
    if (v.m2 !== u.m2 || (FORM_DE[z.tipus] === 'estancia' && (v.armario !== u.armario || v.ventanas !== u.ventanas))) {
      scene.remove(interior); allibera(interior);
      interior = escenaDe(z);
      scene.add(interior);
      radiObjectiu = vistaActual().r;
    } else if (z.tipus === 'cocina' && ['forma', 'lamparas', 'electro'].some(k => v[k] !== u[k])) {
      const m = interior.userData.mobles; m.children.slice().forEach(c => { m.remove(c); allibera(c); });
      muntaCuina(m, v, interior.userData.mides); creix(m, 550);
    } else if (z.tipus === 'bano' && ['tipo', 'paquete', 'espejo', 'luces'].some(k => v[k] !== u[k])) {
      const p = interior.userData.peces; p.children.slice().forEach(c => { p.remove(c); allibera(c); });
      muntaBany(p, v, interior.userData.mides); creix(p, 500);
    }
    interior.userData.ultim = { ...v };
    aplicaMaterials();
  });
}

/* ── Tocar la maqueta ── */
let ray, punter;   // Raycaster i Vector2, es creen a carrega3D
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
  renderer.shadowMap.type = MOBIL ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = entorn = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .42;
  hemi = new THREE.HemisphereLight(0xffffff, 0xCFCBC2, .5); scene.add(hemi);
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
  controls.addEventListener('start', () => { radiObjectiu = null; if (st.gir) posaGir(false); });

  preparaMaterials();
  for (const m of [M.mirall, M.aixeta, M.inox, M.llauto, M.tirador, M.electro]) { m.envMap = entorn; m.envMapIntensity = 1; }
  M.base = new THREE.MeshStandardMaterial({ color: 0xF3F2EE, roughness: .9 });
  M.vidrePla = new THREE.MeshStandardMaterial({ color: 0xCFE0E6, roughness: .05, transparent: true, opacity: .45, depthWrite: false });
  M.plat = new THREE.MeshStandardMaterial({ color: 0x8E8D88, roughness: .5 });
  M.coixi = new THREE.MeshStandardMaterial({ color: 0xB9B1A3, roughness: 1 });
  MP = [M.paret, M.paret, M.tall, M.paret, M.paret, M.paret];

  new ResizeObserver(encaixa).observe(visor);

  let visible = true, tAbans = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(visor);
  const v3 = new THREE.Vector3();
  renderer.setAnimationLoop(t => {
    const dt = Math.min(.05, (t - tAbans) / 1000); tAbans = t;
    if (!visible || !pinta) return;
    for (const tw of tweens) {
      const k = Math.min(1, (t - tw.t0) / tw.dur);
      tw.fn(ease(k)); if (k >= 1) tweens.delete(tw);
      brut = true;
    }
    if (st.vista === 'pis' && avancaPla(dt)) brut = true;
    if (st.gir) {          // gira sola: va i ve davant de l'habitació
      const off = camera.position.clone().sub(controls.target), sph = new THREE.Spherical().setFromVector3(off);
      sph.theta = st.girAz + Math.sin((t - st.girT0) * .00035) * .55;
      camera.position.copy(controls.target).add(off.setFromSpherical(sph));
      brut = true;
    }
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
    if (interior) {        // dins de la cuina o el bany: clicar una cosa obre la seva part i s'hi acosta
      const h = partSota(e);
      if (h) obrePartDes3D(FORM_DE[st.vista], h.part, h.punt);
      return;
    }
    const id = zonaSota(e);
    if (id && id !== st.dins) entraZona(id);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || baixa) return;
    if (interior) { canvas.style.cursor = partSota(e) ? 'pointer' : ''; return; }
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
   El servidor (/api/disseny) l'envia al correu, desa el contacte i dona el WhatsApp. */

function filesPerPart(z) {
  const clau = FORM_DE[z.tipus], f = forms[clau];
  return [[I18N.t('Superficie'), fmtNum(z.opts.m2) + ' m²'], ...$$('[data-part]', f).map(fs => {
    const noms = [...new Set($$('input', fs).map(i => i.name).filter(Boolean))];
    return [$('legend', fs).textContent.trim(), noms.map(n => nomValor(clau, n, z.opts[n])).join(' · ')];
  })];
}
function resumDisseny() {
  const r = calcula(), files = [];
  const sola = unaSola() && r.triades.length === 1 && FORM_DE[r.triades[0].tipus] !== 'estancia';
  if (sola) files.push(...filesPerPart(r.triades[0]));
  else for (const [nom, , p] of r.linies) files.push([nom, p.detalls.join(' · ')]);
  const desg = desglossa(r).map(([t, n]) => [t, rang(n)]), forq = r.total ? forquilla(r.total) : '';
  const totes = r.triades.length === st.zones.size;
  const modeNom = totes ? I18N.t('Todo el piso') : r.triades.map(nomZona).join(', ');
  const m2 = r.triades.reduce((a, z) => a + z.opts.m2, 0);
  const una = unaSola() && r.triades[0];
  if (una) return { mode: unaSola(), modeNom: nomZona(una), files, linies: desg, forq, total: r.total, v: { m2, paquete: una.opts.paquete } };
  return { mode: 'integral', modeNom, files, linies: desg, forq, total: r.total, v: { m2, paquete: '' } };
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
  camera.clearViewOffset(); camera.updateProjectionMatrix();
  camera.position.sub(controls.target).normalize().multiplyScalar(vf.r * .92).add(controls.target);
  renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const fons = g.createRadialGradient(w * .4, h * .3, 0, w * .4, h * .3, w * .9);
  fons.addColorStop(0, '#F9FAFC'); fons.addColorStop(1, '#DBDEE1');
  g.fillStyle = fons; g.fillRect(0, 0, w, h);
  g.drawImage(renderer.domElement, 0, 0, w, h);
  const v3 = new THREE.Vector3();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const e of st.vista === 'pis' ? etiquetes : []) {   // dins de la cuina o el bany, les del pis no hi pinten res
    v3.copy(e.pos).project(camera);
    const x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * h;
    const nom = e.el.firstChild.textContent, sub = ($('small', e.el) || {}).textContent || '';
    const cota = !!e.cls;
    g.font = `600 ${cota ? 20 : 22}px "Bricolage Grotesque", Arial, sans-serif`;
    const amp = Math.max(g.measureText(nom).width, sub ? g.measureText(sub).width : 0) + 22;
    const alt = sub ? 54 : 32;
    g.fillStyle = cota ? '#622F26' : 'rgba(255,255,255,.88)';
    g.beginPath(); g.roundRect(x - amp / 2, y - alt / 2, amp, alt, 6); g.fill();
    g.fillStyle = cota ? '#FFFFFF' : '#16191B';
    g.fillText(nom, x, sub ? y - 10 : y);
    if (sub) { g.font = '500 18px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#52565A'; g.fillText(sub, x, y + 13); }
  }
  camera.position.copy(posAbans);
  renderer.setPixelRatio(pr); encaixa();
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
  const text = (s, x, y, mida, { negreta = false, col = '#16191B', dreta = false } = {}) => {
    const xx = dreta ? x - amplada(s, mida, negreta) : x;
    ops.push(`BT ${color(col)} rg /${negreta ? 'F2' : 'F1'} ${mida} Tf ${xx.toFixed(2)} ${y.toFixed(2)} Td ${cadenaPdf(s)} Tj ET`);
  };
  const linia = (x1, y1, x2, y2, col = '#C4C8CC', g = .6) => ops.push(`${color(col)} RG ${g} w ${x1} ${y1} m ${x2} ${y2} l S`);

  // Capçalera
  text('Cota Cero Reformas', M, H - 50, 12, { negreta: true });
  text('cota-cero.pages.dev  ·  600 000 000', W - M, H - 50, 9, { col: '#52565A', dreta: true });
  linia(M, H - 62, W - M, H - 62);
  // Títol
  const titol = trenca(`${I18N.t('Tu reforma')}: ${r.modeNom}`, 22, amp, true).slice(0, 2);
  titol.forEach((l, i) => text(l, M, H - 96 - i * 26, 22, { negreta: true }));
  const extra = (titol.length - 1) * 26;
  const avui = new Intl.DateTimeFormat(dataLang(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  text(`${I18N.t('Diseñada el {dia}', { dia: avui })}${correu ? '  ·  ' + correu : ''}`, M, H - 114 - extra, 9.5, { col: '#52565A' });
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
    text(nom, M, ye, 8.5, { col: '#52565A' }); ye -= 12.5;
    for (const l of trenca(valor, 10.5, ampCol, true)) { text(l, M, ye, 10.5, { negreta: true }); ye -= 13.5; }
    ye -= 5;
  }
  // Columna dreta: partides i total
  let yd = y;
  text(I18N.t('Partidas'), cx2, yd, 11, { negreta: true }); yd -= 20;
  for (const [nom, n] of r.linies) {
    const ls = trenca(nom, 9.5, ampCol - 70);
    ls.forEach((l, i) => { text(l, cx2, yd - i * 12, 9.5); });
    text(typeof n === 'string' ? n : n ? eur(n) : I18N.t('Incluido'), W - M, yd, 9.5, { negreta: true, dreta: true });
    yd -= ls.length * 12 + 4;
    linia(cx2, yd + 1, W - M, yd + 1, '#DBDEE1', .5); yd -= 13;
  }
  yd -= 6;
  text(I18N.t('Precio orientativo, IVA incluido'), cx2, yd, 9, { col: '#52565A' }); yd -= 26;
  text(r.forq, cx2, yd, 20, { negreta: true, col: '#622F26' });
  // Peu
  linia(M, 74, W - M, 74);
  trenca(I18N.t('Precio orientativo. Antes de firmar venimos a tu casa a medir y te damos el precio final por escrito.'), 8.5, amp).forEach((l, i) => text(l, M, 60 - i * 11, 8.5, { col: '#52565A' }));

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

function preparaPdf(correu) {
  const r = resumDisseny();
  const url = capturaMaqueta();
  let jpeg = null;
  if (url) {
    const bin = atob(url.split(',')[1]);
    jpeg = { w: 1600, h: 1000, bytes: Uint8Array.from(bin, c => c.charCodeAt(0)) };
  }
  return { r, blob: fesPdf(r, jpeg, correu) };
}
function enBase64(blob) {
  return new Promise((ok, ko) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] || '');
    lector.onerror = () => ko(lector.error);
    lector.readAsDataURL(blob);
  });
}

/* ── L'enllaç al disseny: presupuesto.html#d=<base64url d'un JSON versionat>. Només les tries (cap dada
   personal). Format v1: { v, t: 'casa'|'cocina'|'bano', d: dormitoris, b: banys, l: 'dia'|'nit',
   a: zona oberta, e: [zones al preu], z: { zona: { opció: valor } } } — de cada zona,
   només el que difereix de l'inici. Les peces següents hi afegeixen camps i els vells s'ignoren; una versió
   que no coneixem no es restaura. El camp «w» (setmana d'inici) va existir fins al 25/10/2026 i ara s'ignora (en Lluc: cap termini al 3D). Si l'URL passa de ~2.000 caràcters, les opcions s'abreugen amb ENLLAC_CLAUS
   (només s'hi poden afegir noms al final: l'ordre és part del format). ── */
const ENLLAC_V = 1, ENLLAC_MAX = 2000;
const ENLLAC_CLAUS = ['m2', 'forma', 'tipo', 'frente', 'acabado', 'tiradores', 'encimera', 'frontal', 'suelo', 'paredes', 'lamparas',
  'grifo', 'led', 'electro', 'paquete', 'mueble', 'espejo', 'griferia', 'sueloB', 'pared', 'luces', 'inodoro', 'armario', 'ventanas'];
const enB64u = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

function estatEnllac(compacte) {
  const z = {};
  for (const zona of st.zones.values()) {
    const ini = opcionsInicials(zona.tipus, zona.n), dif = {};
    for (const k of Object.keys(zona.opts)) if (zona.opts[k] !== ini[k]) dif[compacte && ENLLAC_CLAUS.includes(k) ? ENLLAC_CLAUS.indexOf(k) : k] = zona.opts[k];
    if (Object.keys(dif).length) z[zona.id] = dif;
  }
  return {
    v: ENLLAC_V, ...(compacte ? { c: 1 } : {}), t: unaSola() || 'casa', d: st.dorm, b: st.banos, l: st.llum,
    ...(st.activa ? { a: st.activa } : {}),
    e: [...st.zones.values()].filter(x => x.on).map(x => x.id), z,
  };
}
function enllacDisseny() {
  const base = location.origin + '/presupuesto.html#d=';
  const llarg = base + enB64u(JSON.stringify(estatEnllac(false)));
  return llarg.length <= ENLLAC_MAX ? llarg : base + enB64u(JSON.stringify(estatEnllac(true)));
}
/* Llegeix #d= i torna l'estat, o null si falta, està mal format o és d'una versió que no coneixem */
function llegeixEnllac() {
  const m = /^#d=([A-Za-z0-9_-]{1,6000})$/.exec(location.hash);
  if (!m) return null;
  try {
    const e = JSON.parse(deB64u(m[1]));
    return e && typeof e === 'object' && e.v === ENLLAC_V ? e : null;
  } catch { return null; }
}
/* Posa l'estat llegit al panell. Cada valor es valida contra el que el formulari ofereix; el que no quadra es deixa com a l'inici. */
function restauraEnllac(e) {
  const compta = (n, max) => Number.isInteger(n) ? Math.max(1, Math.min(max, n)) : null;
  st.dorm = compta(e.d, 5) ?? st.dorm; st.banos = compta(e.b, 3) ?? st.banos;
  sincronitzaZones();
  const on = Array.isArray(e.e) ? e.e : [];
  for (const z of st.zones.values()) z.on = on.includes(z.id);
  const zs = e.z && typeof e.z === 'object' ? e.z : {};
  for (const id of Object.keys(zs)) {
    const z = st.zones.get(id), dif = zs[id];
    if (!z || !dif || typeof dif !== 'object') continue;
    const ini = opcionsInicials(z.tipus, z.n), clau = FORM_DE[z.tipus];
    for (const kk of Object.keys(dif)) {
      const k = e.c ? (ENLLAC_CLAUS[kk] || kk) : kk, v = dif[kk];
      if (!Object.hasOwn(ini, k)) continue;
      if (k === 'm2') {
        const [mn, mx, pas] = RANG[z.tipus] || [];
        if (typeof v === 'number' && pas) z.opts.m2 = Math.min(mx, Math.max(mn, Math.round(v / pas) * pas));
      } else if (typeof ini[k] === 'boolean') { if (typeof v === 'boolean') z.opts[k] = v; }
      else if (typeof v === 'string' && $$(`input[name="${k}"]`, forms[clau]).some(i => i.value === v)) z.opts[k] = v;
    }
    const mn = MINIMS[clau];
    if (mn && z.opts[mn[0]] === mn[1] && z.opts.m2 < mn[2]) z.opts[mn[0]] = mn[3];
  }
  if (e.l === 'nit' || e.l === 'dia') {
    st.llum = e.l;
    $$('[data-llum]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.llum === st.llum)));
  }
  if (typeof e.a === 'string' && st.zones.has(e.a)) { if (unaSola()) obreEditor(e.a); else entraZona(e.a); }
}

function dadesServidor(r, extra) {
  return {
    ...extra, mode: r.mode, m2: r.v.m2, total: r.total, paquete: r.v.paquete,
    idioma: document.documentElement.lang || 'es', files: r.files,
  };
}
function envia(dades) {
  return fetch('/api/disseny', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dades),
  }).then(async res => {
    const d = await res.json().catch(() => ({}));
    return res.ok ? d : Promise.reject({ status: res.status, error: d.error || '' });
  });
}

/* ── Finestra del correu: el PDF es fa aquí i el servidor l'envia (acció «correu») amb l'enllaç al disseny.
   Si l'enviament falla, la finestra ensenya l'enllaç i un botó per copiar-lo. ── */
const dialeg = $('[data-dialeg-pdf]'), formPdf = $('[data-form-pdf]');
const botoPdf = $('[data-baixa-pdf]'), errPdf = $('[data-error-pdf]'), fetPdf = $('[data-fet-pdf]');
const caixaEnllac = $('[data-enllac]'), campEnllac = $('[data-enllac-url]'), botoCopia = $('[data-copia]');
const textBotoPdf = botoPdf.textContent, textErrPdf = errPdf.textContent, textCopia = botoCopia.textContent;
$('[data-obre-pdf]').addEventListener('click', () => {
  errPdf.hidden = true; fetPdf.hidden = true; caixaEnllac.hidden = true; formPdf.correu.removeAttribute('aria-invalid');
  dialeg.showModal(); formPdf.correu.focus();
});
$('[data-tanca]').addEventListener('click', () => dialeg.close());
dialeg.addEventListener('click', e => { if (e.target === dialeg) dialeg.close(); });
function ensenyaEnllac(url) {
  campEnllac.value = url; botoCopia.textContent = textCopia; caixaEnllac.hidden = false;
}
botoCopia.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(campEnllac.value); }
  catch { campEnllac.focus(); campEnllac.select(); if (!document.execCommand?.('copy')) return; }
  botoCopia.textContent = I18N.t('Copiado');
  clearTimeout(botoCopia.t); botoCopia.t = setTimeout(() => { botoCopia.textContent = textCopia; }, 2200);
});
campEnllac.addEventListener('focus', () => campEnllac.select());
function errorEnviament(e) {
  const codi = e && e.error;
  if (codi === 'adreca') return I18N.t('Ya te lo hemos mandado a este correo hace un rato. Míralo en la bandeja de entrada o en el correo no deseado.');
  if (codi === 'limit') return I18N.t('Has pedido varios envíos seguidos. Vuelve a probar dentro de una hora o guarda este enlace a tu diseño.');
  return I18N.t('No hemos podido mandarlo. Guarda este enlace y podrás volver a tu diseño cuando quieras.');
}
formPdf.addEventListener('submit', async e => {
  e.preventDefault();
  if (botoPdf.disabled) return;
  const correu = formPdf.correu.value.trim();
  fetPdf.hidden = true; caixaEnllac.hidden = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correu)) {
    errPdf.textContent = textErrPdf;
    errPdf.hidden = false; formPdf.correu.setAttribute('aria-invalid', 'true'); formPdf.correu.focus(); return;
  }
  errPdf.hidden = true; formPdf.correu.removeAttribute('aria-invalid');
  botoPdf.setAttribute('aria-busy', 'true'); botoPdf.disabled = true; botoPdf.textContent = I18N.t('Preparando el PDF…');
  const enllac = enllacDisseny();
  try {
    const feta = preparaPdf(correu);
    const pdf = await enBase64(feta.blob);
    botoPdf.textContent = I18N.t('Enviando…');
    await envia(dadesServidor(feta.r, { accio: 'correu', correu, pdf, enllac }));
    fetPdf.textContent = I18N.t('Enviado a {correu}. Si en unos minutos no lo ves, mira en el correo no deseado.', { correu });
    fetPdf.hidden = false;
  } catch (err) {
    if (err && err.error === 'correu') {
      errPdf.textContent = textErrPdf; formPdf.correu.setAttribute('aria-invalid', 'true');
    } else {
      errPdf.textContent = errorEnviament(err);
      if (!(err && err.error === 'adreca')) ensenyaEnllac(enllac);
    }
    errPdf.hidden = false;
  } finally {
    botoPdf.removeAttribute('aria-busy'); botoPdf.disabled = false; botoPdf.textContent = textBotoPdf;
  }
});

/* ── WhatsApp: el número és un secret del servidor ── */
const errWa = $('[data-error-wa]');
function missatgeWhatsApp(r = resumDisseny()) {
  return I18N.t('Hola, he diseñado mi reforma en vuestra web: {obra}. {detall}. Precio orientativo: {preu}. ¿Podemos hablar?',
    { obra: r.modeNom, detall: r.files.map(f => `${f[0]}: ${f[1]}`).join('; '), preu: r.forq });
}
$$('[data-whatsapp]').forEach(boto => boto.addEventListener('click', async () => {
  errWa.hidden = true;
  const r = resumDisseny();
  const missatge = missatgeWhatsApp(r);
  if (boto.classList.contains('pn-wa-mini')) obrePreu(true);
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
}));
/* La línia del preu: plegada per defecte; la fletxa (botó, Enter/Espai) obre el desglossament,
   la nota, el correu i WhatsApp. Esc la torna a plegar. */
const elPreu = $('[data-preu]'), botoPreu = $('[data-preu-obre]'), elPreuMes = $('#pn-preu-mes'), velPreu = $('[data-preu-vel]');
function obrePreu(obert) {
  elPreu.classList.toggle('obert', obert);
  elPreuMes.hidden = !obert;
  velPreu.hidden = !obert;   // al mòbil, el vel darrere del full
  botoPreu.setAttribute('aria-expanded', String(obert));
}
botoPreu.addEventListener('click', () => obrePreu(elPreuMes.hidden));
velPreu.addEventListener('click', () => obrePreu(false));
elPreu.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !elPreuMes.hidden) { obrePreu(false); botoPreu.focus(); }
});


/* ═══ 7. ARRENCADA I ESDEVENIMENTS ═══════════════════════════════ */
/* La casella de la llista: treu la zona del preu (a la maqueta es torna fosca) o l'hi torna */
function marcaZona(id, on) {
  const z = st.zones.get(id);
  if (z.on === on) return;
  z.on = on;
  if (on && pla && pla.zones[id].mobles) creix(pla.zones[id].mobles.grup, 520);
  refresca();
}
/* Entrar a una zona (clic a la maqueta o «Editar ›»; en Lluc, 25/10/2026): s'obre de prop d'un sol pas, menys el
   passadís, que s'edita dins del pis amb boira a la resta. Si era fosca, es torna a marcar. Es desa on era la
   càmera perquè «Volver al piso» hi torni. */
function entraZona(id) {
  const z = st.zones.get(id);
  if (!z.on) marcaZona(id, true);
  if (renderer && !st.dins) st.tornada = { p: camera.position.clone(), t: controls.target.clone() };
  st.dins = id;
  obreEditor(id);
  elCos.classList.add('dins'); elCos.scrollTop = 0;
  if (innerWidth <= 860) scrollTo({ top: elCos.getBoundingClientRect().top + scrollY - visor.offsetHeight, behavior: 'auto' });
  $('[data-torna]').hidden = false;
  if (renderer) {
    if (z.tipus !== 'pasillo') obreInterior();
    else {
      if (interior) { scene.remove(interior); allibera(interior); interior = null; }
      st.vista = 'pis'; pla.grup.visible = true; elEtiq.hidden = false; $('[data-abans]').hidden = true;
      ombraPer(Math.max(plaObj.W, plaObj.D) + 2); aplicaLlum();
      posa(vistaSala(id));
      $('.pn-pista').textContent = I18N.t('Arrastra para girar. Toca otro espacio para entrar en él.');
    }
  }
  refresca();
}
function tornaPis() {
  st.dins = null; st.activa = null; elEditor.hidden = true;
  elCos.classList.remove('dins');
  $('[data-torna]').hidden = true;
  if (renderer) {
    if (interior) { scene.remove(interior); allibera(interior); interior = null; }
    st.vista = 'pis'; pla.grup.visible = true; elEtiq.hidden = false;
    $('[data-tota]').hidden = true; $('[data-abans]').hidden = true;
    ombraPer(Math.max(plaObj.W, plaObj.D) + 2); aplicaLlum();
    posa(vista('pis', Math.max(plaObj.W, plaObj.D)));          // els límits de la vista del pis
    if (st.tornada) {                                          // i la càmera, on era abans d'entrar
      const { p, t } = st.tornada, de = camera.position.clone(), deT = controls.target.clone();
      tweens.clear();
      tween(900, k => { camera.position.lerpVectors(de, p, k); controls.target.lerpVectors(deT, t, k); });
    }
  }
  st.tornada = null;
  $('.pn-pista').textContent = I18N.t('Toca un espacio para verlo de cerca. Arrastra para girar el piso.');
  refresca();
}
const elCos = $('.pn-cos');
function refresca() { if (plaAra) plaAra._brut = true; pintaPanell(); brut = true; }

// Les mostres de material (llenços de 512 px) es dibuixen quan el fil queda lliure: abans era 1 s de bloqueig en mòbil
pintaMostres();
pintaPreusOpcions();
sincronitzaZones();
/* La maqueta: Three.js i l'escena es preparen quan la pàgina ja s'ha pintat. Mentrestant (i si WebGL
   falla) el panell va com sense 3D: totes les crides a la maqueta comproven `renderer`. */
async function carrega3D() {
  try {
    const [t, oc, re, rb] = await Promise.all([
      import('three'),
      import('../assets/js/three/OrbitControls.js'),
      import('../assets/js/three/RoomEnvironment.js'),
      import('../assets/js/three/RoundedBoxGeometry.js'),
    ]);
    THREE = t; OrbitControls = oc.OrbitControls; RoomEnvironment = re.RoomEnvironment; RoundedBoxGeometry = rb.RoundedBoxGeometry;
  } catch (e) { return; }
  GEO = new THREE.BoxGeometry(1, 1, 1);
  ray = new THREE.Raycaster(); punter = new THREE.Vector2();
  await new Promise(r => setTimeout(r));   // cedeix el fil entre carregar i muntar l'escena
  if (!iniciaWebGL()) return;
  muntaPla(true);
  ombraPer(Math.max(plaObj.W, plaObj.D) + 2);
  // Des de «Diseña tu cocina/baño» (?tipo=cocina|bano) el panell és només d'aquella habitació: la maqueta
  // en ensenya l'interior i el pis no surt mai (en Lluc, 16/10/2026).
  const dins = !!unaSola();
  const vPis = vista('pis', Math.max(plaObj.W, plaObj.D));
  if (!dins) posa(vPis, QUIET ? 0 : 1600);
  aplicaMaterials();
  if (st.activa) obreEditor(st.activa);
  if (dins) obreInterior();
  else if (st.dins) { const id = st.dins; st.dins = null; entraZona(id); st.tornada = { p: puntVista(vPis), t: vPis.t.clone() }; }
  // Proves automàtiques (?prova): l'estat i la càmera, per comparar-los des de Playwright. Sense ?prova no hi ha res.
  if (new URLSearchParams(location.search).has('prova')) window.__panell = { st, pla: () => pla, camera, controls, preuZona, calcula, enllacDisseny, resumDisseny, missatgeWhatsApp };
  refresca();
  pinta = true; brut = true;
}
const quanLliure = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 700 }) : f => setTimeout(f, 200);
if (document.readyState === 'complete') quanLliure(carrega3D);
else addEventListener('load', () => quanLliure(carrega3D), { once: true });

elZones.addEventListener('change', e => {
  const c = e.target.closest('[data-check-zona]');
  if (c) { marcaZona(c.dataset.checkZona, c.checked); $(`[data-check-zona="${c.dataset.checkZona}"]`, elZones)?.focus(); }
});
elZones.addEventListener('click', e => {
  const b = e.target.closest('[data-edita-zona]');
  if (b) { entraZona(b.dataset.editaZona); $('[data-torna-panell]').focus({ preventScroll: true }); }
});
/* Un estil per a tot el pis (en Lluc, 24/10/2026): s'aplica a les zones marcades; les fosques es queden com eren */
$$('[data-estil-pis]').forEach(b => b.addEventListener('click', () => {
  const e = b.dataset.estilPis;
  for (const z of st.zones.values()) if (z.on) Object.assign(z.opts, ESTILS[FORM_DE[z.tipus]][e]);
  ultimCanvi = null;
  aplicaMaterials(); refresca();
}));
$('[data-torna-panell]').addEventListener('click', tornaPis);
$('[data-tot]').addEventListener('click', () => {
  for (const z of st.zones.values()) z.on = true;
  if (pla) Object.values(pla.zones).forEach(o => { if (o.mobles) creix(o.mobles.grup, 520); });
  refresca();
});
$$('[data-compta]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.compta;
  st[k] = Math.max(1, Math.min(k === 'dorm' ? 5 : 3, st[k] + +b.dataset.pas));
  sincronitzaZones();
  if (st.dins && !st.zones.has(st.dins)) tornaPis();
  obreEditor(st.activa);
  if (renderer) { muntaPla(true); nouObjectiu(); }
  pintaPanell();
}));
/* ── Superficie total: reparteix els m² entre les estances (el passadís surt sol) ── */
const elM2Total = $('[data-m2-slider]');
function zonesM2() { return [...st.zones.values()].filter(z => z.tipus !== 'pasillo'); }
function pintaTotalM2() {
  const zs = zonesM2(), suma = zs.reduce((a, z) => a + z.opts.m2, 0);
  elM2Total.min = Math.ceil(zs.reduce((a, z) => a + RANG[z.tipus][0], 0));
  elM2Total.max = Math.floor(zs.reduce((a, z) => a + RANG[z.tipus][1], 0));
  if (document.activeElement !== elM2Total) elM2Total.value = Math.round(suma);
  $('[data-m2-total]').textContent = fmtNum(suma) + ' m²';
}
elM2Total.addEventListener('input', () => {
  const zs = zonesM2(), objectiu = +elM2Total.value;
  for (let ronda = 0; ronda < 3; ronda++) {
    const suma = zs.reduce((a, z) => a + z.opts.m2, 0);
    if (Math.abs(suma - objectiu) < 1) break;
    const f = objectiu / suma;
    zs.forEach(z => {
      const [mn, mx, pas] = RANG[z.tipus];
      z.opts.m2 = Math.min(mx, Math.max(mn, Math.round(z.opts.m2 * f / pas) * pas));
    });
  }
  zs.forEach(z => {
    if (z.tipus === 'cocina' && z.opts.m2 < 16 && z.opts.forma === 'isla') z.opts.forma = 'l';
    if (z.tipus === 'bano' && z.opts.m2 < 5 && z.opts.tipo === 'banera') z.opts.tipo = 'ducha';
  });
  if (st.activa) obreEditor(st.activa);
  if (renderer) { muntaPla(true); nouObjectiu(); }
  refrescaInterior();
  refresca();
});
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
    const totalAbans = calcula().total;
    const v = llegeixForm(clau), abans = z.opts.m2;
    if (z.tipus === 'pasillo') delete v.m2;
    z.opts = { ...z.opts, ...v };
    z.on = true;
    if (z.opts.m2 !== abans) nouObjectiu();
    aplicaMaterials();
    refrescaInterior();
    const nom = e.target.name === 'm2' ? `${I18N.t('Superficie')}: ${fmtNum(z.opts.m2)} m²`
      : `${nomGrup(clau, e.target.name)}: ${nomValor(clau, e.target.name, z.opts[e.target.name])}`;
    if (nom) ultimCanvi = { delta: calcula().total - totalAbans, nom };
    refresca();
  });
  f.addEventListener('click', e => {
    const peca = e.target.closest('[data-peca]');
    if (peca) { obrePart(clau, peca.dataset.peca); return; }
    const b = e.target.closest('[data-estil]');
    const z = b && st.zones.get(st.activa);
    if (!z) return;
    const totalAbans = calcula().total;
    z.opts = { ...z.opts, ...ESTILS[clau][b.dataset.estil] };
    escriuForm(clau, z.opts);
    aplicaMaterials();
    refrescaInterior();
    ultimCanvi = { delta: calcula().total - totalAbans, nom: $('b', b).textContent.trim() };
    refresca();
  });
});
/* Controls sobre el 3D (peça 16): dia/nit, «Antes» mentre es prem, girar sola, vista inicial i «Ver toda…» */
$$('[data-llum]').forEach(b => b.addEventListener('click', () => {
  st.llum = b.dataset.llum;
  $$('[data-llum]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  aplicaLlum();
}));
const elAbans = $('[data-abans]');
elAbans.addEventListener('pointerdown', e => { e.preventDefault(); elAbans.setPointerCapture?.(e.pointerId); posaAbans(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => elAbans.addEventListener(t, () => posaAbans(false)));
elAbans.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); posaAbans(true); } });
elAbans.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') posaAbans(false); });
elAbans.addEventListener('contextmenu', e => e.preventDefault());
$('[data-gir]').addEventListener('click', () => posaGir(!st.gir));
$('[data-reinicia]').addEventListener('click', reinicia);
$('[data-tota]').addEventListener('click', () => { if (renderer) posa(vistaActual()); $('[data-tota]').hidden = true; });
if (QUIET) $('[data-gir]').hidden = true;
/* Clicar al 3D: obre la part al panell; al mòbil, el panell baixa fins a la part */
function obrePartDes3D(clau, part, punt) {
  obrePart(clau, part, false);
  enfocaPart(part, punt);
  portaALaVista($(`[data-part="${part}"]`, forms[clau]));
}
/* La part oberta, a la vista: al mòbil, sota el 3D enganxat; a l'escriptori, dins del panell */
function portaALaVista(fs) {
  if (!fs) return;
  if (innerWidth <= 860) scrollTo({ top: fs.getBoundingClientRect().top + scrollY - visor.offsetHeight - 12, behavior: QUIET ? 'auto' : 'smooth' });
  else fs.scrollIntoView({ block: 'nearest', behavior: QUIET ? 'auto' : 'smooth' });
}
$('[data-torna]').addEventListener('click', tornaPis);

/* Canvi d'idioma: es repinta tot el que escriu el JS (noms, dates, etiquetes de la maqueta) */
document.addEventListener('idioma-canviat', () => {
  if (plaAra) plaAra._brut = true;
  pintaPreusOpcions();
  for (const clau of ['cocina', 'bano']) if (!forms[clau].hidden) construeixGraella(clau);
  pintaPanell();
  brut = true;
});

/* ── Només una habitació: el selector Cocina | Baño de damunt la maqueta ── */
function triaSol(tipus) {
  document.documentElement.dataset.sol = tipus;
  const id = tipus === 'cocina' ? 'cocina' : 'bano1';
  for (const z of st.zones.values()) z.on = z.id === id;
  obreEditor(id);
  $$('[data-sol-boto]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.solBoto === tipus)));
  const url = new URL(location.href); url.searchParams.set('tipo', tipus); url.hash = '';
  history.replaceState(null, '', url);
  if (renderer) { aplicaMaterials(); obreInterior(); }
  refresca();
}
$$('[data-sol-boto]').forEach(b => b.addEventListener('click', () => { if (b.dataset.solBoto !== unaSola()) triaSol(b.dataset.solBoto); }));

// Entrada des de les pàgines de servei: ?tipo=cocina|bano (l'script del <head> ja ho ha marcat a <html>), ?tipo=casa
// Un enllaç #d= (el del correu) ho restaura tot; un de mal format o d'una versió desconeguda s'ignora i el panell arrenca com sempre.
const enllacRestaurat = llegeixEnllac();
const entrada = enllacRestaurat ? '' : location.hash.slice(1) || new URLSearchParams(location.search).get('tipo');
if (unaSola()) {
  triaSol(unaSola());
  $('.pn-pista').textContent = I18N.t('Toca cualquier cosa de la maqueta para cambiarla. Arrastra para girarla.');
  if (enllacRestaurat) { restauraEnllac(enllacRestaurat); refresca(); }
} else if (enllacRestaurat) { restauraEnllac(enllacRestaurat); refresca(); }
else if (entrada === 'casa' || entrada === 'integral') { for (const z of st.zones.values()) z.on = true; refresca(); }
else pintaPanell();
if (/^#d=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);   // l'estat ja és al panell: l'URL no ha de quedar desfasada
