// GET /admin — llista dels contactes de la calculadora (protegida per _middleware.js).

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => (Number(n) || 0).toLocaleString('es-ES', { useGrouping: 'always' }) + ' €';

export async function onRequestGet({ env }) {
  const { results } = await env.LEADS.prepare(
    'SELECT id, creat, correu, idioma, tipo, m2, inclou, acabats, inici, minim, maxim, estat FROM leads ORDER BY id DESC LIMIT 500'
  ).all();

  const files = results.map((l) => `<tr>
    <td>${esc(l.creat)}</td><td><a href="mailto:${esc(l.correu)}">${esc(l.correu)}</a></td>
    <td>${esc(l.tipo)}</td><td>${esc(l.m2)} m²</td><td>${esc(l.inclou)}</td><td>${esc(l.acabats)}</td>
    <td>${esc(l.inici)}</td><td>${euros(l.minim)} – ${euros(l.maxim)}</td><td>${esc(l.idioma)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Contactos · Cota Cero</title>
<style>
  body{margin:0;padding:1.5rem;font:15px/1.45 system-ui,sans-serif;background:#EDEEEA;color:#22262A}
  h1{font-size:1.4rem;margin:0 0 .25rem} p{margin:0 0 1rem;color:#5F6661}
  a{color:#2A4BD7} .taula{overflow-x:auto;background:#fff;border-radius:6px}
  table{border-collapse:collapse;width:100%;min-width:900px} th,td{padding:.55rem .7rem;text-align:left;border-bottom:1px solid #DADDD6;white-space:nowrap}
  th{font-weight:600;background:#DADDD6}
</style></head><body>
<h1>Contactos de la calculadora</h1>
<p>${results.length} registros (máximo 500 en pantalla) · <a href="/admin/leads.csv">Descargar CSV</a></p>
<div class="taula"><table><thead><tr><th>Fecha (UTC)</th><th>Correo</th><th>Obra</th><th>Tamaño</th><th>Distribución</th><th>Acabados</th><th>Empezar</th><th>Estimación</th><th>Idioma</th></tr></thead>
<tbody>${files || '<tr><td colspan="9">Todavía no hay contactos.</td></tr>'}</tbody></table></div>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
