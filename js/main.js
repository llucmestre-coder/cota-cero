/* =========================================================================
   COTA CERO — comportament
   - Sense JS o amb prefers-reduced-motion: tot el contingut és visible i el
     plànol surt sencer. GSAP només afegeix el traç; no amaga res per defecte.
   - Textos escrits des del JS: sempre passen per I18N.t amb la frase escrita
     dins, perquè el verificador i l'extractor d'idiomes els trobin.
   ========================================================================= */
(function () {
  'use strict';

  if (!window.I18N) window.I18N = { t: function (s) { return s; } };
  var redueix = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsapOk = !redueix && window.gsap && window.ScrollTrigger;
  var html = document.documentElement;

  /* ── Menú mòbil ─────────────────────────────────────────────────────── */
  var obre = document.querySelector('.nav-obre');
  var nav = document.getElementById('nav');
  if (obre && nav) {
    var tanca = function () {
      obre.setAttribute('aria-expanded', 'false');
      nav.classList.remove('obert');
    };
    obre.addEventListener('click', function () {
      var obert = obre.getAttribute('aria-expanded') === 'true';
      obre.setAttribute('aria-expanded', String(!obert));
      nav.classList.toggle('obert', !obert);
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) tanca(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && obre.getAttribute('aria-expanded') === 'true') { tanca(); obre.focus(); }
    });
  }

  /* ── Estances del plànol ↔ panells (funciona sense GSAP) ────────────── */
  var plano = document.querySelector('.plano');
  if (plano) {
    var panells = plano.querySelectorAll('.plano-panell');
    var activa = function (nom) {
      plano.querySelectorAll('[data-estancia]').forEach(function (el) {
        if (el.classList.contains('plano-panell')) return;
        el.classList.toggle('activa', el.getAttribute('data-estancia') === nom);
      });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entrades) {
        entrades.forEach(function (en) {
          if (en.isIntersecting) activa(en.target.getAttribute('data-estancia'));
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      panells.forEach(function (p) { io.observe(p); });
    }
    plano.querySelectorAll('.estancia').forEach(function (el) {
      var ves = function () {
        var p = plano.querySelector('.plano-panell[data-estancia="' + el.getAttribute('data-estancia') + '"]');
        if (!p) return;
        p.scrollIntoView({ behavior: redueix ? 'auto' : 'smooth', block: 'center' });
        var enllac = p.querySelector('a');
        if (enllac) enllac.focus({ preventScroll: true });
      };
      el.addEventListener('click', ves);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ves(); }
      });
    });
    if (panells[0]) activa(panells[0].getAttribute('data-estancia'));
  }

  /* ── Comparadors antes/después ──────────────────────────────────────── */
  document.querySelectorAll('.comparador').forEach(function (c) {
    var rang = c.querySelector('.comparador-rang');
    if (!rang) return;
    var posa = function () {
      c.style.setProperty('--pos', rang.value + '%');
      rang.setAttribute('aria-valuetext', rang.value + '% ' + I18N.t('después'));
    };
    rang.addEventListener('input', posa);
    posa();
  });

  /* ── Formulari de pressupost (Formspree, enviament real) ────────────── */
  var form = document.getElementById('form-presupuesto');
  if (form) {
    var estat = form.querySelector('.form-estat');
    var boto = form.querySelector('button[type="submit"]');
    var textBoto = boto ? boto.textContent : '';
    var mostra = function (tipus, missatge) {
      estat.hidden = false;
      estat.setAttribute('data-tipus', tipus);
      estat.textContent = missatge;
      estat.focus();
    };
    var marca = function (camp, error) {
      var caixa = camp.closest('.camp');
      var msg = caixa && caixa.querySelector('.camp-error');
      camp.setAttribute('aria-invalid', error ? 'true' : 'false');
      if (msg) msg.textContent = error || '';
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nom = form.elements['nombre'];
      var email = form.elements['email'];
      var comentario = form.elements['comentario'];
      var errors = 0;
      marca(nom, nom.value.trim() ? '' : I18N.t('Escribe tu nombre.'));
      if (!nom.value.trim()) errors++;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      marca(email, emailOk ? '' : I18N.t('Escribe un correo válido.'));
      if (!emailOk) errors++;
      marca(comentario, comentario.value.trim() ? '' : I18N.t('Cuéntanos qué necesitas.'));
      if (!comentario.value.trim()) errors++;
      if (errors) {
        var primer = form.querySelector('[aria-invalid="true"]');
        if (primer) primer.focus();
        return;
      }

      boto.disabled = true;
      boto.textContent = I18N.t('Enviando…');
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        form.reset();
        mostra('ok', I18N.t('Recibido. Te contestamos en breve.'));
      }).catch(function () {
        mostra('error', I18N.t('No se ha podido enviar. Llámanos al 600 000 000 y te atendemos directamente.'));
      }).finally(function () {
        boto.disabled = false;
        boto.textContent = textBoto;
      });
    });
  }

  /* ── Moviment (només amb GSAP i sense reduced motion) ───────────────── */
  if (!gsapOk) return;
  gsap.registerPlugin(ScrollTrigger);
  html.classList.add('amb-moviment');

  var preparaTraç = function (els) {
    els.forEach(function (el) {
      el.setAttribute('pathLength', '1');
      el.style.strokeDasharray = '1';
      el.style.strokeDashoffset = '1';
    });
  };

  /* 1. Hero: el plànol es traça un sol cop en carregar (únic moviment del hero). */
  var heroSvg = document.querySelector('.hero-plano');
  if (heroSvg) {
    var traces = heroSvg.querySelectorAll('.traza, .traza-fina');
    preparaTraç(traces);
    gsap.set(heroSvg.querySelectorAll('text, .punt'), { opacity: 0 });
    gsap.timeline({ delay: 0.25 })
      .to(heroSvg.querySelectorAll('.traza'), { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.12 })
      .to(heroSvg.querySelectorAll('.traza-fina'), { strokeDashoffset: 0, duration: 0.6, ease: 'none', stagger: 0.05 }, '-=0.3')
      .to(heroSvg.querySelectorAll('text, .punt'), { opacity: 1, duration: 0.4, stagger: 0.04 }, '-=0.2');
  }

  /* 2. Signatura: les parets del plànol es dibuixen amb l'scroll. */
  var planoSvg = document.querySelector('.plano-svg');
  if (planoSvg && plano) {
    var parets = planoSvg.querySelectorAll('.muro, .tabic');
    var detalls = planoSvg.querySelectorAll('.porta, .moble, .cota-l');
    preparaTraç(parets);
    preparaTraç(detalls);
    gsap.set(planoSvg.querySelectorAll('.cota-t, .nom'), { opacity: 0 });
    gsap.timeline({
      scrollTrigger: { trigger: plano.querySelector('.plano-in'), start: 'top 75%', end: 'center center', scrub: 0.6 }
    })
      .to(parets, { strokeDashoffset: 0, ease: 'none', stagger: 0.08 })
      .to(detalls, { strokeDashoffset: 0, ease: 'none', stagger: 0.02 }, '-=0.3')
      .to(planoSvg.querySelectorAll('.cota-t, .nom'), { opacity: 1, stagger: 0.03 }, '-=0.2');
  }

  /* 3. Procés: la línia s'omple un sol cop. */
  var linia = document.querySelector('.proceso-linia i');
  if (linia) {
    var vertical = window.matchMedia('(max-width: 960px)').matches;
    gsap.fromTo(linia, vertical ? { scaleY: 0, scaleX: 1 } : { scaleX: 0 },
      { scaleX: 1, scaleY: 1, duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: linia, start: 'top 80%', once: true } });
  }

  /* Aparicions d'un sol tret, discretes (no a cada secció: només on hi ha .aparicio). */
  gsap.utils.toArray('.aparicio').forEach(function (el) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
})();
