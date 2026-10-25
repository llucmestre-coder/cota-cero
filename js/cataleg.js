/* ════════════════════════════════════════════════════════════════
   CATÀLEG de les estances (peça 3, en Lluc 24–25/10/2026): al saló, als dormitoris i al passadís, «Obra» (amb
   preu: mou la forquilla) i «Muebles» (sense preu). Els objectes s'arrosseguen pel terra amb imà a les parets i una
   graella de 10 cm, sense sortir de la sala ni travessar-se; triats, es giren 90°, es treuen o es confirmen.
   Coordenades de la sala: metres, origen al centre, x cap a la dreta i z cap a davant. Parets: 0 el fons (z = −D/2),
   1 l'esquerra (x = −W/2), 2 davant, 3 la dreta. Un objecte és {t, x, z, r}: tipus, centre de la planta i gir en
   quarts de volta (r = n vol dir l'esquena a la paret n). La geometria és de la mateixa família que la del pis.
   ════════════════════════════════════════════════════════════════ */
const I18N = window.I18N || { t: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (tot, k) => v[k] ?? tot) : s) };
const $ = (s, el = document) => el.querySelector(s);
const QUIET = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const GRAELLA = .1, IMA = .15;

/* capa: 'terra' (per defecte) xoquen entre ells; 'catifa', per sota dels mobles; 'mur' (endolls, split) i 'sostre'
   (punts de llum) només xoquen amb els de la seva capa. paret: l'esquena sempre enganxada a una paret.
   Preus d'obra proposats a en Lluc el 25/10/2026 (inventats, de demo). 8–12 objectes per tipus de sala. */
export const OBJECTES = {
  armario:    { grup: 'obra', preu: 1400, nom: 'Armario empotrado', sales: ['salon', 'dorm', 'pasillo'], mida: [1.8, .62], paret: true },
  luz:        { grup: 'obra', preu: 95, nom: 'Punto de luz', sales: ['salon', 'dorm', 'pasillo'], mida: [.4, .4], capa: 'sostre' },
  enchufe:    { grup: 'obra', preu: 65, nom: 'Enchufe', sales: ['salon', 'dorm', 'pasillo'], mida: [.3, .05], paret: true, capa: 'mur' },
  radiador:   { grup: 'obra', preu: 420, nom: 'Radiador', sales: ['salon', 'dorm', 'pasillo'], mida: [.8, .12], paret: true },
  split:      { grup: 'obra', preu: 1150, nom: 'Aire acondicionado', sales: ['salon', 'dorm'], mida: [.9, .24], paret: true, capa: 'mur' },
  estanteria: { grup: 'obra', preu: 520, nom: 'Estantería de obra', sales: ['salon', 'pasillo'], mida: [1.2, .36], paret: true },
  corredera:  { grup: 'obra', preu: 690, nom: 'Puerta corredera', sales: ['pasillo'], mida: [1.0, .08], paret: true },
  sofa:       { grup: 'moble', nom: 'Sofá', sales: ['salon'], mida: [2.2, .9] },
  tele:       { grup: 'moble', nom: 'Mueble de la tele', sales: ['salon'], mida: [1.6, .42] },
  mesa:       { grup: 'moble', nom: 'Mesa y sillas', sales: ['salon'], mida: [1.5, 1.72] },
  centro:     { grup: 'moble', nom: 'Mesa de centro', sales: ['salon'], mida: [.72, .72] },
  alfombra:   { grup: 'moble', nom: 'Alfombra', sales: ['salon', 'dorm', 'pasillo'], mida: [1.6, 2.2], capa: 'catifa' },
  planta:     { grup: 'moble', nom: 'Planta', sales: ['salon', 'pasillo'], mida: [.45, .45] },
  cama:       { grup: 'moble', nom: 'Cama de matrimonio', sales: ['dorm'], mida: [1.6, 2.1] },
  camaS:      { grup: 'moble', nom: 'Cama individual', sales: ['dorm'], mida: [1.05, 2.1] },
  mesita:     { grup: 'moble', nom: 'Mesita de noche', sales: ['dorm'], mida: [.42, .4] },
  escritorio: { grup: 'moble', nom: 'Escritorio y silla', sales: ['dorm'], mida: [1.1, .95] },
  comoda:     { grup: 'moble', nom: 'Cómoda', sales: ['dorm'], mida: [1.0, .46] },
  lampara:    { grup: 'moble', nom: 'Lámpara de pie', sales: ['dorm', 'pasillo'], mida: [.4, .4] },
  entrada:    { grup: 'moble', nom: 'Mueble de entrada', sales: ['pasillo'], mida: [1.1, .36] },
};
export const nomObjecte = t => I18N.t(OBJECTES[t].nom);
export const esObra = o => OBJECTES[o.t]?.grup === 'obra';

/* ── Preu i resum: només l'obra afegida (els mobles no hi entren) ── */
export function preuObjectes(z) { return (z.objs || []).reduce((a, o) => a + (esObra(o) ? OBJECTES[o.t].preu : 0), 0); }
/* «Radiador ×2»: per al desglossament, el PDF i el WhatsApp */
export function obraDe(z) {
  const n = {};
  for (const o of (z.objs || []).filter(esObra)) n[o.t] = (n[o.t] || 0) + 1;
  return Object.entries(n).map(([t, k]) => nomObjecte(t) + (k > 1 ? ` ×${k}` : ''));
}

/* ── Planta i xocs ── */
export function petjada(o) { const [w, d] = OBJECTES[o.t].mida; return o.r % 2 ? [d, w] : [w, d]; }
function caixaDe(o, x = o.x, z = o.z) { const [w, d] = petjada(o); return { x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 }; }
const capa = o => OBJECTES[o.t].capa || 'terra';
const EPS = 1e-6;
const solapen = (a, b) => a.x1 < b.x2 - EPS && a.x2 > b.x1 + EPS && a.z1 < b.z2 - EPS && a.z2 > b.z1 + EPS;
function xoca(o, x, z, altres) { const c = caixaDe(o, x, z); return altres.some(b => b !== o && capa(b) === capa(o) && solapen(c, caixaDe(b))); }
const dins = (o, x, z, { W, D }) => { const c = caixaDe(o, x, z); return c.x1 >= -W / 2 - EPS && c.x2 <= W / 2 + EPS && c.z1 >= -D / 2 - EPS && c.z2 <= D / 2 + EPS; };

/* Graella i imà en un eix: la vora de l'objecte cau a la graella comptada des de la paret; a menys d'IMA d'una
   paret, s'hi enganxa; mai en surt */
function eix(c, mida, L) {
  let a = -L / 2 + Math.round((c - mida / 2 + L / 2) / GRAELLA) * GRAELLA;
  if (a + L / 2 < IMA) a = -L / 2;
  if (L / 2 - (a + mida) < IMA) a = L / 2 - mida;
  a = Math.max(-L / 2, Math.min(L / 2 - mida, a));
  return a + mida / 2;
}
/* Peces de paret: la paret més propera de les que la sala permet, i la posició enganxada a ella */
function paretMesPropera(x, z, { W, D, parets }) {
  const dist = [z + D / 2, x + W / 2, D / 2 - z, W / 2 - x];
  return parets.reduce((a, p) => (dist[p] < dist[a] ? p : a), parets[0]);
}
function aParet(o, x, z, r, { W, D }) {
  const [w, d] = petjada({ ...o, r });
  if (r === 0) return { x: eix(x, w, W), z: -D / 2 + d / 2 };
  if (r === 2) return { x: eix(x, w, W), z: D / 2 - d / 2 };
  if (r === 1) return { x: -W / 2 + w / 2, z: eix(z, d, D) };
  return { x: W / 2 - w / 2, z: eix(z, d, D) };
}
/* Lliscar en un eix des de la posició bona fins a l'objectiu: s'atura tocant el primer objecte del camí */
function llisca(o, de, fins, k, altres) {
  const c = caixaDe(o, de.x, de.z), [w, d] = petjada(o), mida = k === 'x' ? w : d;
  let v = fins;
  for (const b of altres) {
    if (b === o || capa(b) !== capa(o)) continue;
    const q = caixaDe(b);
    const creua = k === 'x' ? c.z1 < q.z2 - EPS && c.z2 > q.z1 + EPS : c.x1 < q.x2 - EPS && c.x2 > q.x1 + EPS;
    if (!creua) continue;
    const [a1, a2, b1, b2] = k === 'x' ? [c.x1, c.x2, q.x1, q.x2] : [c.z1, c.z2, q.z1, q.z2];
    if (fins > de[k] && b1 >= a2 - EPS) v = Math.min(v, b1 - mida / 2);
    if (fins < de[k] && b2 <= a1 + EPS) v = Math.max(v, b2 + mida / 2);
  }
  return v;
}
/* On queda un objecte que volem portar a (x, z): sala, graella, imà i xocs. Torna {x, z, r} */
export function resol(o, x, z, sala, altres) {
  altres = altres.filter(b => b !== o);
  if (OBJECTES[o.t].paret) {
    const r = paretMesPropera(x, z, sala), p = { ...o, r }, q = aParet(o, x, z, r, sala);
    if (r !== o.r) return xoca(p, q.x, q.z, altres) ? { x: o.x, z: o.z, r: o.r } : { ...q, r };
    const k = r % 2 ? 'z' : 'x', v = llisca(p, o, q[k], k, altres);
    return { ...q, [k]: v, r };
  }
  x = eix(x, petjada(o)[0], sala.W); z = eix(z, petjada(o)[1], sala.D);
  if (xoca(o, o.x, o.z, altres)) return xoca(o, x, z, altres) ? { x: o.x, z: o.z, r: o.r } : { x, z, r: o.r };
  const nx = llisca(o, o, x, 'x', altres);
  return { x: nx, z: llisca(o, { x: nx, z: o.z }, z, 'z', altres), r: o.r };
}
/* El lloc lliure més proper a un punt (afegir, girar, la sala que canvia de mida): recorre la graella */
export function lliure(o, x0, z0, sala, altres, r0, filtre) {
  const { W, D } = sala, objs = altres.filter(b => b !== o);
  let millor = null, dist = Infinity;
  const nx = Math.round(W / GRAELLA), nz = Math.round(D / GRAELLA);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const px = -W / 2 + i * GRAELLA, pz = -D / 2 + j * GRAELLA;
    let r = o.r, q;
    if (OBJECTES[o.t].paret) { r = r0 ?? paretMesPropera(px, pz, sala); q = aParet(o, px, pz, r, sala); }
    else q = { x: eix(px, petjada(o)[0], W), z: eix(pz, petjada(o)[1], D) };
    const p = { ...o, r }, dd = (q.x - x0) ** 2 + (q.z - z0) ** 2;
    if (dd < dist - EPS && dins(p, q.x, q.z, sala) && !xoca(p, q.x, q.z, objs) && (!filtre || filtre(p, q))) { dist = dd; millor = { ...q, r }; }
  }
  return millor;
}
/* La sala ha canviat de mida o ve d'un enllaç: cada objecte on era si hi cap, o al lloc lliure més proper */
export function reubica(objs, sala) {
  const fets = [];
  for (const o of objs) {
    if (!OBJECTES[o.t]) continue;
    const bo = dins(o, o.x, o.z, sala) && !xoca(o, o.x, o.z, fets) && (!OBJECTES[o.t].paret || sala.parets.includes(o.r));
    const p = bo ? { x: o.x, z: o.z, r: o.r } : lliure(o, o.x, o.z, sala, fets, OBJECTES[o.t].paret && sala.parets.includes(o.r) ? o.r : undefined) || lliure(o, o.x, o.z, sala, fets);
    if (p) fets.push({ t: o.t, ...p });
  }
  return fets;
}

/* ── Distribució de bon començament: la del pis per al saló; el dormitori, moblat com la cuina (peça 3) ── */
export function perDefecte(tipus, sala, opts = {}) {
  const { W, D } = sala, objs = [];
  const posa = (t, x, z, r = 0) => { const o = { t, x, z, r }; const p = lliure(o, x, z, sala, objs, OBJECTES[t].paret ? r : undefined); if (p) objs.push({ ...o, ...p }); return !!p; };
  // Un moble amb l'esquena a la paret r (si no hi cap, prova les altres en l'ordre donat)
  const contra = (t, rs, x, z) => rs.some(r => {
    const o = { t, x, z, r }, toca = (p, q) => { const c = caixaDe(p, q.x, q.z); return [c.z1 + D / 2, c.x1 + W / 2, D / 2 - c.z2, W / 2 - c.x2][r] < EPS; };
    const p = lliure(o, x, z, sala, objs, undefined, toca); if (p) objs.push({ ...o, ...p }); return !!p;
  });
  if (tipus === 'salon') {
    const x1 = -W / 2, sx = x1 + Math.min(3.0, Math.max(2.2, W * .5)), cx = (x1 + .6 + sx - .5) / 2;
    posa('tele', x1 + .21, 0, 1);
    posa('alfombra', cx, 0, 1);
    posa('sofa', sx, 0, 3);
    posa('centro', cx, 0);
    if (W > 4.8) posa('mesa', W / 2 - 1.2, 0);
    if (D > 3.2) posa('planta', x1 + .35, D / 2 - .35);
  } else if (tipus === 'dorm') {
    // El llit amb el capçal al fons, una tauleta a cada costat si hi caben, la catifa als peus, la calaixera a
    // l'esquerra, l'escriptori a la dreta i una làmpada de peu al racó que quedi
    const amb = !!opts.armario, doble = W - (amb ? 1.0 : 0) >= 2.6, llit = doble ? 'cama' : 'camaS', bw = doble ? 1.6 : 1.05;
    if (amb) posa('armario', -W / 2 + .9, -D / 2, 0);
    const cx = (amb ? .5 : 0) + (doble ? 0 : -W * .12);
    posa(llit, cx, -D / 2 + 1.05);
    posa('mesita', cx - bw / 2 - .21, -D / 2 + .2);
    if (doble) posa('mesita', cx + bw / 2 + .21, -D / 2 + .2);
    posa('alfombra', cx, -D / 2 + 1.7, 1);
    posa('comoda', -W / 2 + .23, D / 2 - .9, 1);
    // L'escriptori, amb l'esquena a una paret dibuixada (l'esquerra o el fons); la dreta, només si no hi cap (jutge, 26/10/2026)
    contra('escritorio', [1, 0, 3], -W / 2 + .48, -D / 2 + .55);
    posa('lampara', W / 2 - .2, -D / 2 + .2);
  }
  return objs;
}

/* ═══ El catàleg viu: geometria, selecció, arrossegar i el panell ═══ */
export function creaCataleg(ctx) {
  let C = null;                 // THREE, materials i peces de panell.js (arriben amb inicia, quan hi ha 3D)
  let zona = null, sala = null, grup = null, sel = null, drag = null, quadre = null, malla = null;
  const elBarra = $('[data-sel]'), elAvis = $('[data-cat-avis]'), elObjs = $('[data-objectes]');
  let pestanya = 'obra';
  const miniatures = {};

  /* Geometria: origen al centre de la planta, a terra, el davant cap a +z (l'esquena, a −z) */
  function fes(t) {
    const { THREE, M, caixa, caixaR, cilindre, planta, cadira, llit } = C, g = new THREE.Group();
    const [w, d] = OBJECTES[t].mida;
    const tirador = (x, y, z, llarg = .42) => cilindre(.0065, .0065, llarg, M.tirador, x, y, z, g, 12);
    const toca = (sw, sh, sd, y) => {          // zona tocable invisible per a les peces petites
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), M.toca); m.position.y = y + sh / 2; g.add(m);
    };
    if (t === 'armario') {
      const n = Math.round(w / .6), pw = w / n;
      caixa(w, 2.3, d - .02, M.cos, 0, .08, -.01, g);
      caixa(w - .04, .08, d - .06, M.socol, 0, 0, -.02, g);
      for (let i = 0; i < n; i++) {
        const cx = -w / 2 + pw * (i + .5);
        caixa(pw - .006, 2.28, .02, M.frente, cx, .09, d / 2 - .01, g);
        tirador(cx + (i % 2 ? -1 : 1) * (pw / 2 - .05), .95, d / 2 + .02);
      }
    } else if (t === 'luz') {          // llum penjant de llautó; al pis, un punt a terra (fesPis)
      cilindre(.004, .004, .62, M.metall, 0, 1.98, 0, g, 6).castShadow = false;
      cilindre(.05, .17, .18, M.llauto, 0, 1.8, 0, g); cilindre(.05, .05, .03, M.llauto, 0, 1.98, 0, g, 16);
      const b = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 8), M.bombeta); b.position.y = 1.83; g.add(b);
    } else if (t === 'enchufe') {
      caixa(.085, .085, .012, M.marc, 0, .3, -d / 2 + .006, g);
      caixa(.06, .06, .006, M.marc, 0, .312, -d / 2 + .015, g);
      [-.012, .012].forEach(x => { const f = cilindre(.004, .004, .004, M.socol, x, .341, -d / 2 + .018, g, 8); f.rotation.x = Math.PI / 2; });
      toca(.3, .45, .3, .1);
    } else if (t === 'radiador') {
      for (let i = 0; i < 10; i++) caixa(.07, .58, .08, M.marc, -.36 + i * .08, .16, 0, g);
      caixa(.8, .03, .03, M.marc, 0, .2, -.02, g); caixa(.8, .03, .03, M.marc, 0, .68, -.02, g);
      cilindre(.01, .01, .16, M.inox, -.36, 0, -.02, g, 10); cilindre(.01, .01, .16, M.inox, .36, 0, -.02, g, 10);
    } else if (t === 'split') {
      caixaR(.9, .3, .22, .04, M.marc, 0, 2.0, -.01, g);
      caixa(.78, .025, .01, M.socol, 0, 2.03, .1, g);
      caixa(.03, .01, .01, M.bombeta, .36, 2.24, .1, g);
      toca(.9, .5, .3, 1.9);
    } else if (t === 'estanteria') {   // fornícula d'obra amb lleixes de roure, llibres i un gerro
      caixa(.05, 2.2, d, M.paretInt, -w / 2 + .025, 0, 0, g); caixa(.05, 2.2, d, M.paretInt, w / 2 - .025, 0, 0, g);
      caixa(w, .06, d, M.paretInt, 0, 2.14, 0, g); caixa(w - .1, .1, d - .02, M.paretInt, 0, 0, 0, g);
      caixa(w - .1, 2.04, .02, M.frontal, 0, .1, -d / 2 + .01, g);
      const llibre = [M.tela, M.manta, M.catifaB, M.cos, M.llencol];
      [.55, 1.0, 1.45, 1.9].forEach((y, k) => {
        caixa(w - .1, .03, d - .04, M.fusta, 0, y - .03, .01, g);
        let x = -w / 2 + .1;
        for (let i = 0; i < 6 + (k % 2) * 3 && x < w * (k % 2 ? .35 : .1); i++) {
          const lw = .03 + (i * 7 % 5) * .008, lh = .2 + (i * 3 % 4) * .025;
          caixa(lw, lh, .2, llibre[(i + k) % llibre.length], x + lw / 2, y, -.03, g); x += lw + .004;
        }
      });
      cilindre(.06, .045, .2, M.ceramica, w / 2 - .25, 1.0, 0, g, 20);
    } else if (t === 'corredera') {    // porta corredissa de roure penjada d'una guia
      caixa(w, .04, .05, M.metall, 0, 2.12, -d / 2 + .025, g);
      caixa(.9, 2.06, .035, M.fusta, .02, .04, 0, g);
      caixa(.025, .3, .02, M.metall, -.36, .92, .03, g);
    } else if (t === 'sofa') {
      caixaR(2.2, .42, .9, .06, M.tela, 0, 0, 0, g);
      caixaR(2.2, .4, .22, .06, M.tela, 0, .42, -.34, g);
      caixaR(.2, .22, .9, .05, M.tela, -1.0, .42, 0, g); caixaR(.2, .22, .9, .05, M.tela, 1.0, .42, 0, g);
      [-.5, .5].forEach(x => caixaR(.95, .12, .66, .06, M.coixi, x, .42, .06, g));
    } else if (t === 'tele') {
      caixaR(1.6, .45, .42, .03, M.fusta, 0, 0, 0, g); caixa(1.1, .62, .05, M.vitro, 0, .45, -.08, g);
    } else if (t === 'mesa') {
      caixaR(1.5, .04, .9, .015, M.fusta, 0, .72, 0, g);
      [[-.6, -.35], [.6, -.35], [-.6, .35], [.6, .35]].forEach(([a, b]) => cilindre(.02, .02, .72, M.metall, a, 0, b, g, 8));
      cadira(-.35, -.65, 0, g); cadira(.35, -.65, 0, g); cadira(-.35, .65, Math.PI, g); cadira(.35, .65, Math.PI, g);
    } else if (t === 'centro') {
      cilindre(.36, .36, .04, M.fusta, 0, .34, 0, g, 40); cilindre(.05, .05, .34, M.metall, 0, 0, 0, g, 10);
    } else if (t === 'alfombra') caixa(w, .015, d, M.catifa, 0, 0, 0, g, false);
    else if (t === 'planta') planta(0, 0, g, .9);
    else if (t === 'cama' || t === 'camaS') { const l = llit(t === 'cama' ? 1.5 : .95); l.position.z = -1.05; g.add(l); }
    else if (t === 'mesita') {
      caixaR(.42, .45, .4, .03, M.fusta, 0, 0, 0, g); caixa(.38, .006, .01, M.socol, 0, .3, .2, g);
      cilindre(.07, .09, .03, M.llauto, 0, .45, 0, g, 20); cilindre(.008, .008, .2, M.llauto, 0, .48, 0, g, 8);
      cilindre(.07, .11, .14, M.tela, 0, .62, 0, g, 24);
    } else if (t === 'escritorio') {
      caixaR(1.1, .03, .55, .01, M.fusta, 0, .72, -d / 2 + .275, g);
      [[-.52, -d / 2 + .04], [.52, -d / 2 + .04], [-.52, -d / 2 + .51], [.52, -d / 2 + .51]].forEach(([a, b]) => cilindre(.015, .015, .72, M.metall, a, 0, b, g, 8));
      caixa(.32, .015, .22, M.vitro, -.15, .75, -d / 2 + .25, g);
      caixa(.2, .03, .27, M.manta, .3, .75, -d / 2 + .3, g);
      cadira(0, d / 2 - .25, Math.PI, g);
    } else if (t === 'comoda') {
      caixaR(1.0, .8, .44, .02, M.fusta, 0, .06, -.01, g);
      caixa(.96, .06, .4, M.socol, 0, 0, -.01, g);
      for (let i = 0; i < 3; i++) { caixa(.94, .235, .02, M.frente, 0, .085 + i * .25, .21, g); caixa(.22, .015, .02, M.tirador, 0, .26 + i * .25, .23, g); }
      cilindre(.07, .05, .22, M.ceramica, .3, .86, 0, g, 20);
      caixa(.25, .04, .18, M.manta, -.22, .86, 0, g);
    } else if (t === 'lampara') {
      cilindre(.14, .14, .025, M.metall, 0, 0, 0, g, 24); cilindre(.012, .012, 1.42, M.metall, 0, .02, 0, g, 8);
      cilindre(.15, .2, .26, M.tela, 0, 1.4, 0, g, 28);
      const b = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), M.bombeta); b.position.y = 1.44; g.add(b);
    } else if (t === 'entrada') {
      caixaR(1.1, .78, .34, .02, M.fusta, 0, .06, 0, g);
      [-.5, .5].forEach(x => cilindre(.015, .015, .06, M.metall, x, 0, 0, g, 8));
      caixa(.6, .9, .02, M.mirall, 0, 1.2, -d / 2 + .01, g); caixa(.64, .94, .015, M.llauto, 0, 1.18, -d / 2 + .005, g);
      cilindre(.11, .08, .06, M.ceramica, .3, .84, 0, g, 24);
    }
    return g;
  }
  /* A la maqueta del pis, el punt de llum és un punt de llautó a terra (el sostre no hi és) */
  function fesPis(t) {
    if (t !== 'luz') return fes(t);
    const g = new C.THREE.Group(); C.cilindre(.13, .13, .012, C.M.llauto, 0, .005, 0, g, 24); return g;
  }
  const posaMalla = (m, o) => { m.position.set(o.x, 0, o.z); m.rotation.y = o.r * Math.PI / 2; };

  /* La sala oberta: munta els objectes (la distribució de bon començament si encara no se n'ha fet cap).
     lloc: {x, z} del centre dins del pare i parets on van les peces de paret (de prop només es veuen el fons i l'esquerra) */
  function munta(pare, z, mides, lloc = {}) {
    zona = z; sala = { W: mides.W, D: mides.D, parets: lloc.parets || [0, 1] };
    sel = null; drag = null; amagaBarra();
    if (!z.objs) {
      z.objs = perDefecte(z.tipus, sala, z.opts);
      z.opts.armario = false;          // l'armari de l'enllaç antic ja és un objecte
    } else z.objs = reubica(z.objs, sala);
    grup = new C.THREE.Group(); grup.position.set(lloc.x || 0, 0, lloc.z || 0); pare.add(grup);
    quadre = null; malla = null;
    for (const o of z.objs) afegeixMalla(o);
    pintaPanell(z);
  }
  const canvia = () => { zona.tocat = true; zona.ver = (zona.ver || 0) + 1; return zona.objs; };
  function afegeixMalla(o, anima) {
    const m = fes(o.t); m.userData.obj = o; posaMalla(m, o); grup.add(m);
    if (anima && ctx.creix) ctx.creix(m, 420);
    return m;
  }
  const mallaDe = o => grup.children.find(m => m.userData.obj === o);

  /* Els objectes d'una sala a la maqueta del pis (fora d'edició): es refan quan canvia la llista i es col·loquen
     dins del rectangle de la zona, sense tocar-ne les parets */
  function posaPis(cg, z, r, marge = .1) {
    if (!C) return;
    const editant = !!grup && zona === z;
    cg.visible = !editant;
    if (editant) return;
    if (cg.userData.llista !== z.objs || cg.userData.ver !== z.ver) {
      cg.children.slice().forEach(m => cg.remove(m));
      for (const o of z.objs) { const m = fesPis(o.t); m.userData.obj = o; cg.add(m); }
      cg.userData.llista = z.objs; cg.userData.ver = z.ver;
    }
    const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2, mx = (r.x2 - r.x1) / 2 - marge, mz = (r.z2 - r.z1) / 2 - marge;
    for (const m of cg.children) {
      const o = m.userData.obj, [w, d] = petjada(o);
      const x = Math.max(-mx + w / 2, Math.min(mx - w / 2, o.x)), zz = Math.max(-mz + d / 2, Math.min(mz - d / 2, o.z));
      m.position.set(cx + x, 0, cz + zz); m.rotation.y = o.r * Math.PI / 2;
    }
  }

  /* ── Selecció: el contorn d'argila a terra i la pastilla d'icones a sobre ── */
  function contorn() {
    const { THREE } = C, g = new THREE.Group();
    const mt = new THREE.MeshBasicMaterial({ color: 0x622F26, depthWrite: false });
    const mf = new THREE.MeshBasicMaterial({ color: 0xCA6E5E, transparent: true, opacity: .16, depthWrite: false });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mf); fill.rotation.x = -Math.PI / 2; g.add(fill);
    const vores = [0, 1, 2, 3].map(() => { const v = new THREE.Mesh(new THREE.BoxGeometry(1, .006, 1), mt); g.add(v); return v; });
    g.userData = { fill, vores }; g.renderOrder = 2; g.position.y = .02;
    return g;
  }
  function pintaContorn() {
    if (!sel) { if (quadre) quadre.visible = false; return; }
    if (!quadre) { quadre = contorn(); grup.add(quadre); }
    const [w, d] = petjada(sel), e = .03, { fill, vores } = quadre.userData;
    quadre.visible = true; quadre.position.x = sel.x; quadre.position.z = sel.z;
    fill.scale.set(w, d, 1);
    [[0, -d / 2, w + e, e], [0, d / 2, w + e, e], [-w / 2, 0, e, d + e], [w / 2, 0, e, d + e]].forEach(([x, z, sw, sd], i) => { vores[i].position.set(x, 0, z); vores[i].scale.set(sw, 1, sd); });
  }
  function selecciona(o) {
    sel = o || null; pintaContorn(); ctx.redibuixa();
    if (!sel) { amagaBarra(); return; }
    elBarra.hidden = false;
    posaNom();
    posaBarra();
  }
  /* Només icones (en Lluc, 26/10/2026): el nom de l'objecte va a l'aria-label i al title de la pastilla */
  function posaNom() { const n = nomObjecte(sel.t); elBarra.setAttribute('aria-label', n); elBarra.title = n; }
  function amagaBarra() { if (elBarra) elBarra.hidden = true; }
  /* La pastilla segueix l'objecte: a sobre de la seva planta, dins de l'espai lliure del visor */
  function posaBarra() {
    if (!sel || !elBarra || elBarra.hidden || !C || !grup) return;
    const m = mallaDe(sel); if (!m) return;
    const b = new C.THREE.Box3().setFromObject(m), p = new C.THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
    p.project(C.camera);
    const vis = ctx.visor.getBoundingClientRect(), bw = elBarra.offsetWidth, bh = elBarra.offsetHeight;
    const x = Math.max(bw / 2 + 8, Math.min(vis.width - ctx.despla() - bw / 2 - 8, (p.x + 1) / 2 * vis.width));
    const dalt = innerWidth <= 860 ? 64 : 8;    // al mòbil, per sota del logotip i l'idioma
    const y = Math.max(bh + dalt, Math.min(vis.height - 8, (1 - p.y) / 2 * vis.height - 14));
    elBarra.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  /* ── Tocar i arrossegar ── */
  let raig = null;
  function apunta(e) {
    const r = ctx.canvas.getBoundingClientRect();
    raig ||= new C.THREE.Raycaster();
    raig.setFromCamera(new C.THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), C.camera);
    return raig;
  }
  function objecteSota(e) {
    if (!grup) return null;
    const h = apunta(e).intersectObjects(grup.children.filter(m => m.userData.obj), true)[0];
    if (!h) return null;
    let m = h.object; while (m.parent && m.parent !== grup) m = m.parent;
    return m.userData.obj || null;
  }
  function puntTerra(e) {
    grup.updateMatrixWorld();
    const p = new C.THREE.Vector3(), pla = new C.THREE.Plane(new C.THREE.Vector3(0, 1, 0), 0).applyMatrix4(grup.matrixWorld);
    return apunta(e).ray.intersectPlane(pla, p) ? grup.worldToLocal(p) : null;
  }
  function graella(on) {
    if (on && !malla) {
      const { THREE } = C, { W, D } = sala, pts = [];
      for (let x = -W / 2; x <= W / 2 + EPS; x += GRAELLA) pts.push(x, .004, -D / 2, x, .004, D / 2);
      for (let z = -D / 2; z <= D / 2 + EPS; z += GRAELLA) pts.push(-W / 2, .004, z, W / 2, .004, z);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      malla = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x52565A, transparent: true, opacity: .22, depthWrite: false }));
      grup.add(malla);
    }
    if (malla) malla.visible = on;
  }
  function mou(o, x, z) {
    const p = resol(o, x, z, sala, zona.objs);
    if (p.x === o.x && p.z === o.z && p.r === o.r) return false;
    Object.assign(o, p); canvia();
    posaMalla(mallaDe(o), o); pintaContorn(); posaBarra(); ctx.redibuixa();
    return true;
  }
  function baixa(e) {
    if (!grup || !zona || e.button > 0) return;
    if (drag && !drag.tap && e.pointerId !== drag.id) { deixa(drag); return; }   // un segon dit (pessic): l'objecte es queda on és
    const o = objecteSota(e);
    // Primer es tria (clic o toc) i després s'arrossega, també amb el ratolí (en Lluc, 25/10/2026): arrossegar un objecte
    // que no és el triat fa girar la càmera, com arrossegar el buit
    if (!o || o !== sel) { drag = { tap: true, o, x: e.clientX, y: e.clientY }; return; }
    e.stopImmediatePropagation(); e.preventDefault();
    const p = puntTerra(e);
    drag = { o, dx: p ? o.x - p.x : 0, dz: p ? o.z - p.z : 0, x: e.clientX, y: e.clientY, mogut: false, id: e.pointerId };
    C.controls.enabled = false;
    ctx.canvas.setPointerCapture?.(e.pointerId);
    selecciona(o);
  }
  function arrossega(e) {
    if (!drag || drag.tap || e.pointerId !== drag.id) {
      if (!drag && e.pointerType === 'mouse' && grup) { const o = objecteSota(e); ctx.canvas.style.cursor = !o ? '' : o === sel ? 'move' : 'pointer'; }
      return;
    }
    if (!drag.mogut && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    if (!drag.mogut) { drag.mogut = true; graella(true); elBarra.classList.add('mou'); }
    const p = puntTerra(e);
    if (p) mou(drag.o, p.x + drag.dx, p.z + drag.dz);
  }
  function deixa(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.tap) { if (grup && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) selecciona(d.o); return; }
    C.controls.enabled = true;
    graella(false); elBarra.classList.remove('mou');
    try { ctx.canvas.releasePointerCapture(d.id); } catch { /* ja alliberat */ }
    ctx.redibuixa();
  }

  /* ── Girar, treure, confirmar i afegir ── */
  function avisa(txt) {
    if (!elAvis) return;
    elAvis.textContent = txt; elAvis.hidden = !txt;
    clearTimeout(avisa.t); if (txt) avisa.t = setTimeout(() => { elAvis.hidden = true; }, 3200);
  }
  function gira() {
    if (!sel) return;
    const o = sel;
    let p;
    if (OBJECTES[o.t].paret) {                   // les peces de paret passen a la paret següent
      const ps = sala.parets, r = ps[(ps.indexOf(o.r) + 1) % ps.length];
      p = r === o.r ? null : lliure({ ...o, r }, o.x, o.z, sala, zona.objs, r);
    } else p = lliure({ ...o, r: (o.r + 1) % 4 }, o.x, o.z, sala, zona.objs);
    if (!p) { avisa(I18N.t('Girado no cabe en esta sala.')); return; }
    Object.assign(o, p); canvia();
    posaMalla(mallaDe(o), o); pintaContorn(); posaBarra(); ctx.redibuixa();
  }
  function treu() {
    if (!sel) return;
    const o = sel, preu = esObra(o) ? OBJECTES[o.t].preu : 0;
    zona.objs.splice(zona.objs.indexOf(o), 1); canvia();
    grup.remove(mallaDe(o));
    selecciona(null);
    ctx.canvi(-preu, `${I18N.t('Quitado')}: ${nomObjecte(o.t)}`);
  }
  const confirma = () => selecciona(null);     // la peça es queda on és
  function afegeix(t) {
    if (!grup) return;
    const o = { t, x: 0, z: 0, r: 0 };
    const p = OBJECTES[t].paret ? lliure(o, -sala.W / 2, -sala.D / 2 + sala.D * .3, sala, zona.objs) : lliure(o, 0, 0, sala, zona.objs);
    if (!p) { avisa(I18N.t('No queda sitio en esta sala para: {o}.', { o: nomObjecte(t) })); return; }
    Object.assign(o, p); zona.objs.push(o); canvia();
    afegeixMalla(o, !QUIET);
    selecciona(o);
    ctx.canvi(esObra(o) ? OBJECTES[t].preu : 0, `${I18N.t('Añadido')}: ${nomObjecte(t)}`);
  }
  /* Teclat: amb un objecte triat, les fletxes el mouen 10 cm, R el gira, Supr el treu i Esc o Retorn el confirmen */
  function tecla(e) {
    if (!sel || drag) return;
    const pas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (pas) { e.preventDefault(); mou(sel, sel.x + pas[0] * GRAELLA, sel.z + pas[1] * GRAELLA); }
    else if (e.key === 'r' || e.key === 'R') gira();
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); treu(); }
    else if (e.key === 'Escape' || (e.key === 'Enter' && !e.target.closest('button'))) confirma();
  }

  /* ── Panell: dues pestanyes i les fitxes de la sala oberta ── */
  function pintaPanell(z) {
    if (!elObjs || !z) return;
    if (sel) posaNom();
    if (C && !miniatures.fetes) { miniatures.fetes = true; try { fesMiniatures(); } catch { /* sense miniatures, només el nom */ } }
    document.querySelectorAll('[data-pestanya]').forEach(b => {
      const on = b.dataset.pestanya === pestanya; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    $('[data-cat-nota]').textContent = pestanya === 'obra' ? I18N.t('Entra en el precio. Tócalo para ponerlo en la sala.') : I18N.t('No cuenta en el precio: es para que veas cómo queda.');
    elObjs.replaceChildren(...Object.entries(OBJECTES).filter(([, d]) => d.sales.includes(z.tipus) && d.grup === pestanya).map(([t, d]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pn-objecte'; b.dataset.afegeix = t;
      const im = document.createElement('span'); im.className = 'pn-objecte-img';
      if (miniatures[t]) { const i = new Image(); i.src = miniatures[t]; i.alt = ''; im.append(i); }
      const nom = document.createElement('b'); nom.textContent = nomObjecte(t);
      const preu = document.createElement('small'); preu.textContent = d.grup === 'obra' ? '+' + ctx.eur(d.preu) : '';
      b.append(im, nom, preu); return b;
    }));
  }
  /* Miniatures: cada objecte pintat amb els mateixos materials que la maqueta, un sol cop */
  function fesMiniatures() {
    const { THREE } = C, r = C.renderer, w = 240, h = 180;
    const esc = new THREE.Scene(); esc.environment = C.scene.environment; esc.environmentIntensity = .5;
    esc.add(new THREE.HemisphereLight(0xffffff, 0xCFCBC2, .9));
    const s = new THREE.DirectionalLight(0xFFEFD8, 2.2); s.position.set(-3, 6, 5); esc.add(s);
    const cam = new THREE.PerspectiveCamera(28, w / h, .05, 50);
    const abans = new THREE.Vector2(); r.getSize(abans);
    const pr = r.getPixelRatio(), ombres = r.shadowMap.enabled, talls = r.clippingPlanes;
    r.setPixelRatio(1); r.setSize(w, h, false); r.shadowMap.enabled = false; r.clippingPlanes = [];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    for (const t of Object.keys(OBJECTES)) {
      const m = fes(t); esc.add(m);
      const b = new THREE.Box3(); m.traverse(o => { if (o.isMesh && o.material !== C.M.toca) b.expandByObject(o); });
      const cen = b.getCenter(new THREE.Vector3()), R = b.getSize(new THREE.Vector3()).length() / 2;
      cam.position.copy(cen).add(new THREE.Vector3(.62, .55, 1).normalize().multiplyScalar(Math.max(R, .08) / Math.sin(THREE.MathUtils.degToRad(14)) * .95));
      cam.lookAt(cen);
      r.render(esc, cam);
      g.clearRect(0, 0, w, h); g.drawImage(r.domElement, 0, 0, w, h);
      miniatures[t] = c.toDataURL('image/png');
      esc.remove(m);
    }
    r.setPixelRatio(pr); r.setSize(abans.x, abans.y, false); r.shadowMap.enabled = ombres; r.clippingPlanes = talls;
    ctx.encaixa();
  }

  /* Escoltes del canvas en captura: un objecte agafat no fa girar la maqueta */
  function inicia(c) {
    C = c;
    C.M.toca = new C.THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    ctx.canvas.addEventListener('pointerdown', baixa, { capture: true });
    ctx.canvas.addEventListener('pointermove', arrossega);
    ctx.canvas.addEventListener('pointerup', deixa);
    ctx.canvas.addEventListener('pointercancel', deixa);
    addEventListener('keydown', e => {
      const a = document.activeElement;
      if (sel && (!a || a === document.body || a === ctx.canvas || a.closest('[data-sel]'))) tecla(e);
    });
  }
  const tabs = [...document.querySelectorAll('[data-pestanya]')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => { pestanya = b.dataset.pestanya; pintaPanell(zona || ctx.zona()); });
    b.addEventListener('keydown', e => {             // fletxes entre pestanyes (patró de tablist)
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); const n = tabs[(i + 1) % tabs.length]; n.click(); n.focus();
    });
  });
  elObjs?.addEventListener('click', e => { const b = e.target.closest('[data-afegeix]'); if (b) afegeix(b.dataset.afegeix); });
  $('[data-gira]')?.addEventListener('click', gira);
  $('[data-treu]')?.addEventListener('click', treu);
  $('[data-confirma]')?.addEventListener('click', confirma);

  return {
    inicia, munta, posaPis, pintaPanell, posaBarra, afegeix, gira, treu, confirma, selecciona,
    surt() {
      selecciona(null);
      if (grup?.parent) { grup.parent.remove(grup); grup.traverse(o => o.geometry?.dispose()); }
      grup = null; zona = null; ctx.redibuixa();
    },
    estat: () => ({ zona: zona?.id, sel, sala, objs: zona ? zona.objs : [] }),
  };
}
