/* =========================================================================
   COTA CERO — les dues portes de la home (en Lluc, 16/10/2026).
   Sense JS, cada porta és un enllaç a la pàgina del servei. Amb JS, obre la seva
   habitació (<dialog>) a pantalla completa: la foto creix des del forat de la porta
   fins a omplir la pantalla i el full amb el text entra després. Tancar (botó, Esc)
   fa el camí al revés i torna el focus a la porta. Amb moviment reduït, sense zoom.
   ========================================================================= */
(function () {
  'use strict';

  var portes = document.querySelectorAll('[data-porta]');
  if (!portes.length || !window.HTMLDialogElement) return;
  var quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ENTRA = 'cubic-bezier(0.22, 1, 0.36, 1)';

  // El rectangle de la porta, com a retall de la pantalla sencera
  function forat(porta) {
    var r = porta.querySelector('.porta-marc').getBoundingClientRect();
    return 'inset(' + r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px)';
  }

  function obre(porta, hab) {
    hab.showModal();
    document.documentElement.classList.add('habitacio-oberta');
    if (quiet) return;
    var foto = hab.querySelector('.habitacio-foto');
    foto.animate([{ clipPath: forat(porta), transform: 'scale(1.08)' }, { clipPath: 'inset(0px)', transform: 'scale(1)' }],
      { duration: 950, easing: ENTRA });
    [hab.querySelector('.habitacio-text'), hab.querySelector('[data-tanca]')].forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, delay: 600 + i * 90, easing: ENTRA, fill: 'backwards' });
    });
  }

  function tanca(porta, hab) {
    if (!hab.open) return;
    var acaba = function () {
      hab.close();
      document.documentElement.classList.remove('habitacio-oberta');
      porta.focus({ preventScroll: true });
    };
    if (quiet) { acaba(); return; }
    var text = [hab.querySelector('.habitacio-text'), hab.querySelector('[data-tanca]')];
    var fosa = text.map(function (el) { return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }); });
    var a = hab.querySelector('.habitacio-foto').animate(
      [{ clipPath: 'inset(0px)', transform: 'scale(1)' }, { clipPath: forat(porta), transform: 'scale(1.08)' }],
      { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
    a.onfinish = function () { acaba(); a.cancel(); fosa.forEach(function (f) { f.cancel(); }); };
  }

  portes.forEach(function (porta) {
    var hab = document.getElementById(porta.getAttribute('data-porta'));
    if (!hab) return;
    hab.setAttribute('data-lenis-prevent', '');   // la roda no mou la pàgina de sota (Lenis)
    porta.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;   // obrir en una pestanya nova continua funcionant
      e.preventDefault();
      obre(porta, hab);
    });
    hab.querySelector('[data-tanca]').addEventListener('click', function () { tanca(porta, hab); });
    hab.addEventListener('cancel', function (e) { e.preventDefault(); tanca(porta, hab); });
    // Clic fora del full i del botó (a la foto) també tanca
    hab.addEventListener('click', function (e) { if (e.target === hab || e.target.classList.contains('habitacio-foto')) tanca(porta, hab); });
  });
})();
