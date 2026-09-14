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

export async function onRequestPost({ request, env, waitUntil }) {
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
  const min = arrodoneix((p[0] + p[1] * m2) * factor);
  const max = arrodoneix((p[2] + p[3] * m2) * factor);
  const idioma = ['es', 'ca', 'en'].includes(dades.idioma) ? dades.idioma : 'es';

  // Lead per al seguiment (D1). Si la base de dades falla, l'usuari veu igualment el preu.
  try {
    await env.LEADS.prepare(
      'INSERT INTO leads (correu, idioma, tipo, m2, inclou, acabats, inici, minim, maxim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(correu, idioma, r.tipo, m2, r.inclou, r.acabats, r.inici, min, max).run();
  } catch (e) {
    console.error('D1 leads:', e && e.message);
  }

  // Avís al negoci per correu (no bloqueja la resposta).
  const euros = (n) => n.toLocaleString('es-ES', { useGrouping: 'always' }) + ' €';
  const resum = [
    'Nuevo contacto desde la calculadora de Cota Cero',
    '',
    'Correo: ' + correu,
    'Obra: ' + NOMS.tipo[r.tipo] + ' · ' + m2 + ' m²',
    'Distribución: ' + NOMS.inclou[r.inclou],
    'Acabados: ' + NOMS.acabats[r.acabats],
    'Empezar: ' + NOMS.inici[r.inici],
    'Estimación mostrada: ' + euros(min) + ' – ' + euros(max),
    'Idioma de la web: ' + idioma,
  ].join('\n');
  waitUntil(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Calculadora Cota Cero', email: env.BREVO_SENDER },
      to: [{ email: env.BREVO_SENDER }],
      replyTo: { email: correu },
      subject: 'Nuevo presupuesto: ' + NOMS.tipo[r.tipo] + ' ' + m2 + ' m² · ' + euros(min) + '–' + euros(max),
      textContent: resum,
    }),
  }).catch(() => {}));

  // Resum per a l'usuari, en l'idioma de la web (demo: text senzill; un negoci real el treballarà més).
  const t = RESUM[idioma];
  const eurosIdioma = (n) => n.toLocaleString(t.locale, { useGrouping: 'always' }) + ' €';
  const rang = eurosIdioma(min) + ' – ' + eurosIdioma(max);
  const files = [
    [t.obra, t.tipo[r.tipo]],
    [t.mida, m2 + ' m²'],
    [t.distribucio, t.inclou[r.inclou]],
    [t.acabats, t.acabatsNoms[r.acabats]],
    [t.inici, t.iniciNoms[r.inici]],
  ];
  const missatgeWa = encodeURIComponent(t.wa.replace('{resum}', files.map((f) => f[1]).join(' · ')).replace('{rang}', rang));
  const enllacWa = 'https://wa.me/' + String(env.WHATSAPP || '').replace(/\D/g, '') + '?text=' + missatgeWa;
  const html = `<div style="font-family:Arial,sans-serif;color:#22262A;max-width:520px;line-height:1.5">
  <p style="font-size:16px">${t.hola}</p>
  <p style="font-size:14px;color:#5F6661;margin:18px 0 4px">${t.estimacio}</p>
  <p style="font-size:30px;font-weight:700;margin:0 0 6px">${rang}</p>
  <p style="font-size:13px;color:#5F6661;margin:0 0 18px">${t.nota}</p>
  <table style="border-collapse:collapse;width:100%;font-size:15px">${files.map((f) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #DADDD6;color:#5F6661">${f[0]}</td><td style="padding:8px 0;border-bottom:1px solid #DADDD6;text-align:right;font-weight:600">${f[1]}</td></tr>`).join('')}</table>
  <p style="margin:24px 0"><a href="${enllacWa}" style="background:#1F8F4E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;display:inline-block">${t.botoWa}</a></p>
  <p style="font-size:14px">${t.seguent}</p>
  <p style="font-size:14px;color:#5F6661">Cota Cero Reformas · 600 000 000</p></div>`;
  waitUntil(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Cota Cero Reformas', email: env.BREVO_SENDER },
      to: [{ email: correu }],
      subject: t.assumpte + ' · ' + rang,
      textContent: `${t.hola}\n\n${t.estimacio}: ${rang}\n${t.nota}\n\n${files.map((f) => f[0] + ': ' + f[1]).join('\n')}\n\n${t.botoWa}: ${enllacWa}\n\n${t.seguent}\n\nCota Cero Reformas · 600 000 000`,
      htmlContent: html,
    }),
  }).catch(() => {}));

  return json({ ok: true, min, max, whatsapp: env.WHATSAPP });
}

const RESUM = {
  es: {
    locale: 'es-ES',
    assumpte: 'Tu estimación de reforma',
    hola: 'Hola, este es el resumen de la reforma que has calculado en nuestra web.',
    estimacio: 'Estimación orientativa',
    nota: 'IVA no incluido. El presupuesto cerrado lo hacemos después de ver la vivienda.',
    obra: 'Obra', mida: 'Tamaño', distribucio: 'Distribución', acabats: 'Acabados', inici: 'Empezar',
    tipo: { cocina: 'Cocina', bano: 'Baño', casa: 'Toda la casa' },
    inclou: { mantener: 'Mantener la distribución', mover: 'Cambiar la distribución' },
    acabatsNoms: { basicos: 'Básicos', medios: 'Medios', altos: 'Altos' },
    iniciNoms: { ya: 'Lo antes posible', meses: 'En 1 a 3 meses', mirando: 'Solo estoy mirando precios' },
    botoWa: 'Hablar por WhatsApp',
    wa: 'Hola, me interesa una reforma. He usado la calculadora de la web: {resum}. Estimación: {rang}. ¿Podemos concretar una visita?',
    seguent: 'Si quieres seguir adelante, responde a este correo o escríbenos por WhatsApp y concretamos una visita sin compromiso.',
  },
  ca: {
    locale: 'ca-ES',
    assumpte: 'La teva estimació de reforma',
    hola: 'Hola, aquest és el resum de la reforma que has calculat a la nostra web.',
    estimacio: 'Estimació orientativa',
    nota: 'IVA no inclòs. El pressupost tancat el fem després de veure l\'habitatge.',
    obra: 'Obra', mida: 'Mida', distribucio: 'Distribució', acabats: 'Acabats', inici: 'Començar',
    tipo: { cocina: 'Cuina', bano: 'Bany', casa: 'Tota la casa' },
    inclou: { mantener: 'Mantenir la distribució', mover: 'Canviar la distribució' },
    acabatsNoms: { basicos: 'Bàsics', medios: 'Mitjans', altos: 'Alts' },
    iniciNoms: { ya: 'Com més aviat millor', meses: 'D\'aquí a 1–3 mesos', mirando: 'Només miro preus' },
    botoWa: 'Parlar per WhatsApp',
    wa: 'Hola, m\'interessa una reforma. He fet servir la calculadora de la web: {resum}. Estimació: {rang}. Podem concretar una visita?',
    seguent: 'Si vols tirar endavant, respon aquest correu o escriu-nos per WhatsApp i concretem una visita sense compromís.',
  },
  en: {
    locale: 'en-GB',
    assumpte: 'Your renovation estimate',
    hola: 'Hi, here is the summary of the renovation you calculated on our website.',
    estimacio: 'Rough estimate',
    nota: 'VAT not included. We give you a fixed quote after seeing the property.',
    obra: 'Work', mida: 'Size', distribucio: 'Layout', acabats: 'Finishes', inici: 'Start',
    tipo: { cocina: 'Kitchen', bano: 'Bathroom', casa: 'Whole home' },
    inclou: { mantener: 'Keep the layout', mover: 'Change the layout' },
    acabatsNoms: { basicos: 'Basic', medios: 'Mid-range', altos: 'High-end' },
    iniciNoms: { ya: 'As soon as possible', meses: 'In 1 to 3 months', mirando: 'Just checking prices' },
    botoWa: 'Chat on WhatsApp',
    wa: 'Hi, I\'m interested in a renovation. I used the calculator on your website: {resum}. Estimate: {rang}. Can we arrange a visit?',
    seguent: 'If you want to go ahead, reply to this email or message us on WhatsApp and we\'ll arrange a visit with no obligation.',
  },
};

const NOMS = {
  tipo: { cocina: 'Cocina', bano: 'Baño', casa: 'Toda la casa' },
  inclou: { mantener: 'mantener', mover: 'cambiar la distribución' },
  acabats: { basicos: 'básicos', medios: 'medios', altos: 'altos' },
  inici: { ya: 'lo antes posible', meses: 'en 1 a 3 meses', mirando: 'solo mirando precios' },
};

export function onRequest() {
  return json({ ok: false, error: 'metode' }, 405);
}
