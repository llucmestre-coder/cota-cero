// POST /api/disseny — el panell «Diseña tu reforma».
//  · accio "correu": el navegador fa el PDF i l'envia en base64; aquí s'envia per Brevo a l'adreça escrita
//    (adjunt cota-cero-reforma.pdf), es desa el contacte (D1, taula leads) i s'avisa el negoci.
//    Al cos del correu no hi va cap text de l'usuari: només frases fixes, la forquilla calculada aquí i l'enllaç al
//    disseny (`enllac`, presupuesto.html#d=…), que només s'accepta si és d'aquest mateix origen i té el format esperat.
//  · accio "whatsapp": torna el número (secret WHATSAPP) per obrir el xat amb el disseny.
// Límits a KV (CODIS): per IP a totes les accions, un de més estricte per IP a "correu" i un
// enviament per adreça cada hora (la clau és un hash del correu, no el correu).
// Secrets (mai al repo, que és públic): BREVO_API_KEY, BREVO_SENDER, WHATSAPP.

const FINESTRA = 3600; // 1 hora
const MAX_PER_IP = 20;
const MAX_CORREUS_PER_IP = 5;
const MAX_PDF = 3 * 1024 * 1024;                    // 3 MB de PDF
const MAX_B64 = Math.ceil(MAX_PDF / 3) * 4;         // el mateix, en base64
const FORQ = [0.95, 1.10];                          // la forquilla del panell (js/panell.js)
const MAX_ENLLAC = 2500;                            // mida màxima de l'enllaç al disseny (el panell el limita a ~2.000)

// L'enllaç al disseny: del mateix origen que la petició, /presupuesto.html i un #d= en base64url. Es torna a
// muntar a partir de les parts validades; qualsevol altra cosa, o massa llarga, és ''.
function enllacValid(brut, request) {
  if (typeof brut !== 'string' || brut.length > MAX_ENLLAC) return '';
  let u, propi;
  try { u = new URL(brut); propi = new URL(request.url).origin; } catch { return ''; }
  const m = /^#d=([A-Za-z0-9_-]{1,2300})$/.exec(u.hash);
  if (u.origin !== propi || u.pathname !== '/presupuesto.html' || u.search || u.username || u.password || !m) return '';
  return propi + '/presupuesto.html#d=' + m[1];
}

function json(dades, status = 200) {
  return new Response(JSON.stringify(dades), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const net = (s, max = 300) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Suma 1 al comptador de la clau; false si ja era al màxim
async function compta(env, clau, max) {
  const fets = Number(await env.CODIS.get(clau)) || 0;
  if (fets >= max) return false;
  await env.CODIS.put(clau, String(fets + 1), { expirationTtl: FINESTRA });
  return true;
}

// Imports com al panell: «31.400 €» (es, ca) i «€31,400» (en); la forquilla, arrodonida a 100 €
function xifra(n, idioma) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, idioma === 'en' ? ',' : '.'); }
function euros(n, idioma) { return idioma === 'en' ? '€' + xifra(n, 'en') : xifra(n, idioma) + ' €'; }
function forquilla(total, idioma) {
  const [a, b] = FORQ.map((k) => Math.round((total * k) / 100) * 100);
  return idioma === 'en' ? euros(a, 'en') + ' to ' + euros(b, 'en') : 'de ' + xifra(a, idioma) + ' a ' + euros(b, idioma);
}

// El correu a l'usuari, per idioma: frases fixes i la forquilla
const CORREU = {
  es: {
    obra: { cocina: 'la reforma de tu cocina', bano: 'la reforma de tu baño', integral: 'la reforma de tu piso' },
    assumpte: (f) => 'Tu reforma con Cota Cero: ' + f,
    text: (obra, f, enllac) => [
      'Hola:',
      '',
      'Aquí tienes en PDF ' + obra + ', tal como la has diseñado en nuestra web.',
      'Precio orientativo: ' + f + ', IVA incluido. El precio final te lo damos por escrito después de ver tu casa.',
      ...(enllac ? ['', 'Vuelve a tu diseño cuando quieras, con todo lo que elegiste:', enllac] : []),
      '',
      'Si quieres comentarlo, responde a este correo.',
      '',
      'Cota Cero Reformas',
    ],
  },
  ca: {
    obra: { cocina: 'la reforma de la teva cuina', bano: 'la reforma del teu bany', integral: 'la reforma del teu pis' },
    assumpte: (f) => 'La teva reforma amb Cota Cero: ' + f,
    text: (obra, f, enllac) => [
      'Hola,',
      '',
      'Aquí tens en PDF ' + obra + ', tal com l\'has dissenyada a la nostra web.',
      'Preu orientatiu: ' + f + ', IVA inclòs. El preu final te\'l donem per escrit després de veure casa teva.',
      ...(enllac ? ['', 'Torna al teu disseny quan vulguis, amb tot el que vas triar:', enllac] : []),
      '',
      'Si ho vols comentar, respon aquest correu.',
      '',
      'Cota Cero Reformas',
    ],
  },
  en: {
    obra: { cocina: 'your kitchen renovation', bano: 'your bathroom renovation', integral: 'your home renovation' },
    assumpte: (f) => 'Your renovation with Cota Cero: ' + f,
    text: (obra, f, enllac) => [
      'Hi,',
      '',
      'Here is ' + obra + ' as a PDF, just as you designed it on our website.',
      'Approximate price: ' + f + ', VAT included. We give you the final price in writing after we visit your home.',
      ...(enllac ? ['', 'Come back to your design any time, with everything you picked:', enllac] : []),
      '',
      'If you want to talk it over, just reply to this email.',
      '',
      'Cota Cero Reformas',
    ],
  },
};

function brevo(env, cos) {
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(cos),
  });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (Number(request.headers.get('Content-Length')) > MAX_B64 + 64 * 1024) return json({ ok: false, error: 'mida' }, 413);
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400); }

  const ip = request.headers.get('CF-Connecting-IP') || 'desconeguda';
  if (!(await compta(env, 'disseny:' + ip, MAX_PER_IP))) return json({ ok: false, error: 'limit' }, 429);

  if (d.accio === 'whatsapp') return json({ ok: true, whatsapp: env.WHATSAPP });
  if (d.accio !== 'correu') return json({ ok: false, error: 'accio' }, 400);

  const correu = net(d.correu, 254).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(correu)) return json({ ok: false, error: 'correu' }, 400);
  const mode = ['cocina', 'bano', 'integral'].includes(d.mode) ? d.mode : 'cocina';
  const m2 = Math.max(0, Math.min(500, Number(d.m2) || 0));
  const total = Math.max(0, Math.min(1e7, Math.round(Number(d.total) || 0)));
  const idioma = ['es', 'ca', 'en'].includes(d.idioma) ? d.idioma : 'es';
  const files = Array.isArray(d.files) ? d.files.slice(0, 20).map((f) => [net(f && f[0], 80), net(f && f[1], 160)]) : [];
  const resum = files.map((f) => f[0] + ': ' + f[1]).join(' | ').slice(0, 1500);
  const enllac = enllacValid(d.enllac, request);

  // Correu a l'usuari. L'adjunt ha de ser un PDF («%PDF» = «JVBER» en base64) de 3 MB com a molt.
  let enviat = false;
  {
    const pdf = typeof d.pdf === 'string' ? d.pdf.replace(/\s/g, '') : '';
    if (pdf.length > MAX_B64) return json({ ok: false, error: 'mida' }, 413);
    if (!pdf.startsWith('JVBER') || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return json({ ok: false, error: 'pdf' }, 400);
    if (!total) return json({ ok: false, error: 'total' }, 400);
    if (!(await compta(env, 'correu-ip:' + ip, MAX_CORREUS_PER_IP))) return json({ ok: false, error: 'limit' }, 429);
    const clauAdreca = 'correu-a:' + (await hash(correu));
    if (await env.CODIS.get(clauAdreca)) return json({ ok: false, error: 'adreca' }, 429);
    await env.CODIS.put(clauAdreca, '1', { expirationTtl: FINESTRA });

    const T = CORREU[idioma], f = forquilla(total, idioma);
    try {
      const res = await brevo(env, {
        sender: { name: 'Cota Cero Reformas', email: env.BREVO_SENDER },
        to: [{ email: correu }],
        subject: T.assumpte(f),
        textContent: T.text(T.obra[mode], f, enllac).join('\n'),
        attachment: [{ name: 'cota-cero-reforma.pdf', content: pdf }],
      });
      enviat = res.ok;
      if (!enviat) console.error('Brevo:', res.status);
    } catch (e) {
      console.error('Brevo:', e && e.message);
    }
    if (!enviat) await env.CODIS.delete(clauAdreca);   // que ho pugui tornar a provar
  }

  // Lead (D1). L'enllaç al disseny va al final de «acabats» (és TEXT, sense límit): no cal cap migració. Es desa el total del panell (mínim = màxim); la forquilla que veu l'usuari (−5 % / +10 %) surt d'aquest total.
  try {
    await env.LEADS.prepare(
      'INSERT INTO leads (correu, idioma, tipo, m2, inclou, acabats, inici, minim, maxim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(correu, idioma, 'panel-' + mode, m2, net(d.paquete, 40), resum + (enllac ? '\nEnlace: ' + enllac : ''), net(d.inici, 40), total, total).run();
  } catch (e) {
    console.error('D1 leads:', e && e.message);
  }

  // Avís al negoci (el de sempre)
  const NOMS = { cocina: 'Cocina', bano: 'Baño', integral: 'Piso entero' };
  const que = enviat ? 'Alguien ha pedido su diseño en PDF por correo y se lo hemos mandado.'
    : 'Alguien ha pedido su diseño en PDF por correo, pero Brevo no lo ha enviado (en la web se le ofrece el enlace a su diseño).';
  waitUntil(brevo(env, {
    sender: { name: 'Panel Cota Cero', email: env.BREVO_SENDER },
    to: [{ email: env.BREVO_SENDER }],
    replyTo: { email: correu },
    subject: 'Nuevo diseño: ' + NOMS[mode] + ' ' + m2 + ' m² · ' + euros(total, 'es'),
    textContent: [
      que,
      '',
      'Correo: ' + correu,
      ...files.map((f) => f[0] + ': ' + f[1]),
      'Precio mostrado: ' + euros(total, 'es'),
      ...(enllac ? ['Enlace al diseño: ' + enllac] : []),
      'Idioma de la web: ' + idioma,
    ].join('\n'),
  }).catch(() => {}));

  if (!enviat) return json({ ok: false, error: 'enviament' }, 502);
  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: 'metode' }, 405);
}
