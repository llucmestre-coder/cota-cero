// POST /api/verifica — comprova el codi i, només si és correcte, calcula la
// forquilla orientativa (PLA.md §«Calculadora v2») i retorna el WhatsApp.
// El preu i el número no són mai al codi del navegador abans d'aquest pas.
// Secrets: WHATSAPP. Binding KV: CODIS.

const MAX_INTENTS = 5;

const ESCALA = { cocina: [3, 30], bano: [2, 15], casa: [30, 250] };
// [mínim fix, mínim per m², màxim fix, màxim per m²] — forquilles inventades per a la demo.
const PREU = {
  cocina: [3000, 750, 4500, 1100],
  bano: [2500, 550, 3500, 800],
  casa: [5000, 420, 7000, 620],
};
const ACABATS = { basicos: 0.85, medios: 1, altos: 1.45 };
const INCLOU = { mantener: 1, mover: 1.2 };
const INICI = ['ya', 'meses', 'mirando'];

function json(dades, status = 200) {
  return new Response(JSON.stringify(dades), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const te = (obj, clau) => Object.prototype.hasOwnProperty.call(obj, clau);

export async function onRequestPost({ request, env }) {
  let dades;
  try { dades = await request.json(); } catch { return json({ ok: false, error: 'dades' }, 400); }

  const correu = String(dades.correu || '').trim().toLowerCase();
  const codi = String(dades.codi || '');
  const r = dades.respostes || {};
  if (!correu || !/^\d{6}$/.test(codi)) return json({ ok: false, error: 'codi' }, 400);

  const clau = 'codi:' + (await sha256(correu));
  const desat = await env.CODIS.get(clau, 'json');
  if (!desat || desat.caduca < Date.now()) return json({ ok: false, error: 'caducat' }, 400);
  if (desat.intents >= MAX_INTENTS) {
    await env.CODIS.delete(clau);
    return json({ ok: false, error: 'intents' }, 429);
  }

  if ((await sha256(codi + ':' + correu)) !== desat.hash) {
    desat.intents += 1;
    const queda = Math.max(60, Math.ceil((desat.caduca - Date.now()) / 1000));
    await env.CODIS.put(clau, JSON.stringify(desat), { expirationTtl: queda });
    return json({ ok: false, error: 'codi' }, 400);
  }

  const m2 = Number(r.mida);
  const escala = te(ESCALA, r.tipo) ? ESCALA[r.tipo] : null;
  if (!escala || !Number.isFinite(m2) || m2 < escala[0] || m2 > escala[1] ||
      !te(INCLOU, r.inclou) || !te(ACABATS, r.acabats) || !INICI.includes(r.inici)) {
    return json({ ok: false, error: 'respostes' }, 400);
  }

  await env.CODIS.delete(clau); // un codi, un pressupost

  const p = PREU[r.tipo];
  const factor = INCLOU[r.inclou] * ACABATS[r.acabats];
  const arrodoneix = (x) => Math.round(x / 100) * 100;
  return json({
    ok: true,
    min: arrodoneix((p[0] + p[1] * m2) * factor),
    max: arrodoneix((p[2] + p[3] * m2) * factor),
    whatsapp: env.WHATSAPP,
  });
}

export function onRequest() {
  return json({ ok: false, error: 'metode' }, 405);
}
