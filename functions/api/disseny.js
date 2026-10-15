// POST /api/disseny — el panell «Diseña tu reforma».
//  · accio "pdf": desa el correu com a contacte (D1, taula leads) i avisa el negoci.
//    El PDF el fa el navegador; si això falla, l'usuari té el PDF igualment.
//  · accio "whatsapp": torna el número (secret WHATSAPP) per obrir el xat amb el disseny.
// Límit per IP a KV (CODIS): que un robot no en pugui treure el número a cops de petició.
// Secrets (mai al repo, que és públic): BREVO_API_KEY, BREVO_SENDER, WHATSAPP.

const FINESTRA = 3600; // 1 hora
const MAX_PER_IP = 20;

function json(dades, status = 200) {
  return new Response(JSON.stringify(dades), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const net = (s, max = 300) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'json' }, 400); }

  const ip = request.headers.get('CF-Connecting-IP') || 'desconeguda';
  const clau = 'disseny:' + ip;
  const fets = Number(await env.CODIS.get(clau)) || 0;
  if (fets >= MAX_PER_IP) return json({ ok: false, error: 'limit' }, 429);
  await env.CODIS.put(clau, String(fets + 1), { expirationTtl: FINESTRA });

  if (d.accio === 'whatsapp') return json({ ok: true, whatsapp: env.WHATSAPP });
  if (d.accio !== 'pdf') return json({ ok: false, error: 'accio' }, 400);

  const correu = net(d.correu, 254).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(correu)) return json({ ok: false, error: 'correu' }, 400);
  const mode = ['cocina', 'bano', 'integral'].includes(d.mode) ? d.mode : 'cocina';
  const m2 = Math.max(0, Math.min(500, Number(d.m2) || 0));
  const total = Math.max(0, Math.min(1e7, Math.round(Number(d.total) || 0)));
  const idioma = ['es', 'ca', 'en'].includes(d.idioma) ? d.idioma : 'es';
  const files = Array.isArray(d.files) ? d.files.slice(0, 20).map((f) => [net(f && f[0], 80), net(f && f[1], 160)]) : [];
  const resum = files.map((f) => f[0] + ': ' + f[1]).join(' | ').slice(0, 1500);

  // Lead (D1). Al panell el preu és tancat: mínim = màxim.
  try {
    await env.LEADS.prepare(
      'INSERT INTO leads (correu, idioma, tipo, m2, inclou, acabats, inici, minim, maxim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(correu, idioma, 'panel-' + mode, m2, net(d.paquete, 40), resum, net(d.inici, 40), total, total).run();
  } catch (e) {
    console.error('D1 leads:', e && e.message);
  }

  const euros = (n) => n.toLocaleString('es-ES', { useGrouping: 'always' }) + ' €';
  const NOMS = { cocina: 'Cocina', bano: 'Baño', integral: 'Piso entero' };
  waitUntil(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Panel Cota Cero', email: env.BREVO_SENDER },
      to: [{ email: env.BREVO_SENDER }],
      replyTo: { email: correu },
      subject: 'Nuevo diseño: ' + NOMS[mode] + ' ' + m2 + ' m² · ' + euros(total),
      textContent: [
        'Alguien ha descargado su diseño en PDF desde el panel de Cota Cero.',
        '',
        'Correo: ' + correu,
        ...files.map((f) => f[0] + ': ' + f[1]),
        'Precio mostrado: ' + euros(total),
        'Idioma de la web: ' + idioma,
      ].join('\n'),
    }),
  }).catch(() => {}));

  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: 'metode' }, 405);
}
