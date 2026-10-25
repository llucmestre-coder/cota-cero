/* ════════════════════════════════════════════════════════════════
   PIS 3D — el que comparteixen el panell (js/panell.js) i la maqueta de la home (js/maqueta-home.js):
   Three.js, les textures dibuixades, els materials, la llum de l'escena, les peces (caixes, parets, mobles
   del pis), la distribució del pis i el seu muntatge. Surt de panell.js tal com era (peça 4, 26/10/2026).
   ════════════════════════════════════════════════════════════════ */
export let THREE, RoomEnvironment, RoundedBoxGeometry;

/* Three.js i els complements del pis (el panell hi afegeix OrbitControls). Es crida quan cal, mai en carregar. */
export async function carregaThree() {
  const [t, re, rb] = await Promise.all([
    import('three'),
    import('../assets/js/three/RoomEnvironment.js'),
    import('../assets/js/three/RoundedBoxGeometry.js'),
  ]);
  THREE = t; RoomEnvironment = re.RoomEnvironment; RoundedBoxGeometry = rb.RoundedBoxGeometry;
  GEO = new THREE.BoxGeometry(1, 1, 1);
  return THREE;
}

/* ═══ TEXTURES DIBUIXADES ═════════════════════════════════════ */
export function aleatori(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const LLENÇ = {};
export function llenc(nom, mida, dibuixa) {
  if (LLENÇ[nom]) return LLENÇ[nom];
  const c = document.createElement('canvas'); c.width = c.height = mida;
  dibuixa(c.getContext('2d'), mida, aleatori(nom.length * 7919 + mida));
  return (LLENÇ[nom] = c);
}
export function to(hex, dl, r) {   // varia la lluminositat d'un color
  const n = parseInt(hex.slice(1), 16);
  const k = 1 + (r() - .5) * dl;
  const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c.join(',')})`;
}
export function veta(g, x, y, w, h, r, vertical) {   // veta de fusta dins d'un rectangle
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
export const DIBUIX = {
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
export function azulejo(color) {          // rajola vertical 7,5 × 15 cm, artesana
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
export function tex(nom, metres, canvas) {   // textura amb UV en metres (vegeu uvMetres)
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

export const M = {};                       // materials compartits
export function mat(nom, o) { return (M[nom] = new THREE.MeshStandardMaterial(o)); }
export function preparaMaterials() {
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
export function uvMetres(geo, w, h, d) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  uv.needsUpdate = true;
}
/* Caixa amb la base a y (no el centre): és com es pensa en obra */
export function caixa(w, h, d, material, x, y, z, pare, ombra = true) {
  const g = new THREE.BoxGeometry(w, h, d); uvMetres(g, w, h, d);
  const m = new THREE.Mesh(g, material);
  m.position.set(x, y + h / 2, z); m.castShadow = ombra; m.receiveShadow = true;
  pare.add(m); return m;
}
export function cilindre(rt, rb, h, material, x, y, z, pare, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; pare.add(m); return m;
}
/* Paret de maqueta: tallada, amb la secció en grafit a dalt */
export function paret(w, h, d, x, y, z, pare, mp = M.paret) {
  const m = caixa(w, h, d, mp, x, y, z, pare);
  m.material = [mp, mp, M.tall, mp, mp, mp];
  return m;
}

export function planta(x, z, pare, esc = 1) {
  cilindre(.16 * esc, .12 * esc, .32 * esc, M.test, x, 0, z, pare);
  const r = aleatori(Math.round(x * 100 + z * 10));
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry((.12 + r() * .1) * esc, 3), M.fulla);
    f.position.set(x + (r() - .5) * .3 * esc, (.42 + r() * .45) * esc, z + (r() - .5) * .3 * esc);
    f.rotation.set(r() * 3, r() * 3, r() * 3); f.castShadow = true; pare.add(f);
  }
}

export function cadira(x, z, rot, pare) {
  const g = new THREE.Group();
  caixa(.42, .03, .42, M.fusta, 0, .44, 0, g);
  caixa(.42, .4, .03, M.fusta, 0, .47, -.2, g);
  [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => cilindre(.015, .015, .44, M.metall, a, 0, b, g, 8));
  g.position.set(x, 0, z); g.rotation.y = rot; pare.add(g);
}

export function caixaR(w, h, d, r, material, x, y, z, pare) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
  pare.add(m); return m;
}

export const HM = 1.1, PASS = 1.05, TE = .2, TI = .1;
export let GEO;   // BoxGeometry(1,1,1), es crea a carregaThree

export function caixaU(material, pare, ombra = true) {
  const m = new THREE.Mesh(GEO, material);
  m.castShadow = ombra; m.receiveShadow = true; pare.add(m); return m;
}
export function posaCaixa(m, x1, x2, y1, y2, z1, z2) {
  const w = x2 - x1, h = y2 - y1, d = z2 - z1;
  if (w < .005 || h < .005 || d < .005) { m.visible = false; return; }
  m.visible = true; m.scale.set(w, h, d); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
}
/* Material de terra amb UV del món: la textura no s'estira quan la peça creix */
export function matMon(nom, metres, rugositat) {
  const m = new THREE.MeshStandardMaterial({ map: tex(nom, metres), roughness: rugositat });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n  vMapUv = ( mapTransform * vec3( ( modelMatrix * vec4( position, 1.0 ) ).xz, 1.0 ) ).xy;');
  };
  return m;
}
export const TERRES = { mantener: ['viejo', 1.6, .5], porcelanico: ['porcelanico', 1.2, .45], espiga: ['espiga', 1.4, .6], microcemento: ['microcemento', 2, .55] };
export function materialsZona(z) {
  if (z.mat) return z.mat;
  z.mat = {
    terra: matMon('porcelanico', 1.2, .45),
    vel: new THREE.MeshBasicMaterial({ color: 0x1B1F22, transparent: true, opacity: .5, depthWrite: false }),
    marc: new THREE.MeshStandardMaterial({ color: 0xF5F4F0, roughness: .6 }),
  };
  return z.mat;
}

/* ── Parets: una línia recta amb forats (finestres o portes) ── */
export let MP;   // materials de paret: secció grafit a dalt
export function novaLinia(pare, nForats, finestres) {
  const L = { trams: [], forats: [] };
  for (let i = 0; i <= nForats; i++) { const m = caixaU(M.paret, pare); m.material = MP; L.trams.push(m); }
  if (finestres) for (let i = 0; i < nForats; i++) {
    const ampit = caixaU(M.paret, pare); ampit.material = MP;
    L.forats.push({ ampit, vidre: caixaU(M.vidrePla, pare, false), marc: caixaU(M.marc, pare) });
  }
  return L;
}
export function posaLinia(L, a, b, pos, eix, g, forats) {
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
export function llit(amp) {
  const g = new THREE.Group();
  caixa(amp + .1, .85, .07, M.fusta, 0, 0, .035, g);
  caixaR(amp + .06, .3, 2.0, .04, M.fusta, 0, 0, 1.07, g);
  caixaR(amp, .2, 1.92, .07, M.llencol, 0, .28, 1.08, g);
  caixaR(amp + .04, .08, 1.25, .05, M.manta, 0, .44, 1.42, g);
  (amp > 1 ? [-amp / 4, amp / 4] : [0]).forEach(x => caixaR(Math.min(.55, amp * .45), .12, .3, .06, M.llencol, x, .46, .3, g));
  return g;
}
export function mobleDorm() {
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
export function mobleSalo() {
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
export function mobleCuina() {
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
export function mobleBany() {
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
export const MOBLES = { dorm: mobleDorm, salon: mobleSalo, cocina: mobleCuina, bano: mobleBany };

/* ═══ L'ESCENA ═══════════════════════════════════════════════════
   Entorn, llum de dia, el terra que rep les ombres i els materials. */
export function iniciaEscena(renderer, mobil) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const entorn = scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .42;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xCFCBC2, .5); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xFFEFD8, 3.0);
  sol.position.set(-3, 9, 6.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(mobil ? 1024 : 2048, mobil ? 1024 : 2048);
  sol.shadow.bias = -.0005; sol.shadow.normalBias = .025; sol.shadow.radius = 4;
  scene.add(sol, sol.target);
  const terra = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: .1 }));
  terra.rotation.x = -Math.PI / 2; terra.position.y = -.201; terra.receiveShadow = true; scene.add(terra);

  preparaMaterials();
  for (const m of [M.mirall, M.aixeta, M.inox, M.llauto, M.tirador, M.electro]) { m.envMap = entorn; m.envMapIntensity = 1; }
  M.base = new THREE.MeshStandardMaterial({ color: 0xF3F2EE, roughness: .9 });
  M.vidrePla = new THREE.MeshStandardMaterial({ color: 0xCFE0E6, roughness: .05, transparent: true, opacity: .45, depthWrite: false });
  M.plat = new THREE.MeshStandardMaterial({ color: 0x8E8D88, roughness: .5 });
  M.coixi = new THREE.MeshStandardMaterial({ color: 0xB9B1A3, roughness: 1 });
  MP = [M.paret, M.paret, M.tall, M.paret, M.paret, M.paret];
  return { scene, sol, hemi, entorn };
}

/* ═══ EL PIS ═════════════════════════════════════════════════════
   Maqueta tallada a 1,1 m, vista des de dalt. */

/* ── Distribució: cada zona fa exactament els seus m² (Z(id)) ──
   Davant: saló i cuina. Darrere: dormitoris i banys (fons, en ordre). Entremig, el passadís. */
export function distribucio(Z, fons) {
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
  return r;
}

/* ── Les peces del pis: es munten un cop per cada combinació de dormitoris i banys ──
   zones: Map id → zona; mobles(z) → { grup, posa(r, opts) } o null. */
export function creaPis({ zones, dorm, fons, mobles }) {
  const g = new THREE.Group();
  const P = { grup: g, zones: {}, linies: {} };
  P.base = caixaU(M.base, g, false);
  P.linies.davant = novaLinia(g, 3, true);
  P.linies.darrere = novaLinia(g, dorm, true);
  P.linies.esq = novaLinia(g, 0); P.linies.dre = novaLinia(g, 0);
  P.linies.fons = novaLinia(g, fons.length);
  P.linies.parts = fons.slice(0, -1).map(() => novaLinia(g, 0));
  P.linies.passadis = novaLinia(g, 1);
  P.linies.cuina = novaLinia(g, 1);
  // Cada finestra porta el material de la seva zona (blanca o grafit si és nova)
  const marcDe = id => materialsZona(zones.get(id)).marc;
  ['salon', 'salon', 'cocina'].forEach((id, i) => { P.linies.davant.forats[i].marc.material = marcDe(id); });
  fons.filter(id => id.startsWith('dorm')).forEach((id, i) => { P.linies.darrere.forats[i].marc.material = marcDe(id); });
  for (const [id, z] of zones) {
    const mt = materialsZona(z);
    const terra = caixaU(mt.terra, g, false);
    const vel = caixaU(mt.vel, g, false); vel.userData.zona = id; vel.renderOrder = 2;
    const mb = mobles(z);
    if (mb) g.add(mb.grup);
    P.zones[id] = { terra, vel, mobles: mb };
  }
  P.marc = [0, 1, 2, 3].map(() => caixaU(M.cota, g, false));
  P.cotes = { x: [0, 1, 2].map(() => caixaU(M.cota, g, false)), z: [0, 1, 2].map(() => caixaU(M.cota, g, false)) };
  return P;
}

/* ── Col·loca les peces a la distribució L (també a mig lliscar). activa: la zona amb el marc; opts(id): les seves
   opcions. Torna on van les cotes, per a les etiquetes del panell. */
export function aplicaPis(P, L, fons, activa, opts) {
  const { W, D, zB, zF } = L, Z = L.zones, s = Z.salon, c = Z.cocina;
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
    if (o.mobles) o.mobles.posa(r, opts(id));
  }
  // Marc blau a la zona que s'edita
  const a = activa && Z[activa], m = P.marc, i = .14, y1 = .004, y2 = .03, g = .05;
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
  return { zc, xc };
}

/* ── Càmera: on mira i des de quina distància (asp: l'aspecte de l'espai lliure del visor) ── */
export function vista(quina, mida, asp) {
  const f = Math.pow(Math.max(1, 1.45 / asp), .75);
  if (quina === 'cocina') return { t: new THREE.Vector3(.05, .8, -.1), r: (mida * 1.3 + 2.4) * f, pol: 1.06, az: .6 };
  if (quina === 'bano') return { t: new THREE.Vector3(0, 1.0, -.1), r: (mida * 1.35 + 2.2) * f, pol: 1.08, az: .6 };
  return { t: new THREE.Vector3(0, 0, .25), r: (mida * 1.5 + 5) * f, pol: .8, az: .38 };
}
export function puntVista(v) {
  return new THREE.Vector3(Math.sin(v.pol) * Math.sin(v.az), Math.cos(v.pol), Math.sin(v.pol) * Math.cos(v.az)).multiplyScalar(v.r).add(v.t);
}
