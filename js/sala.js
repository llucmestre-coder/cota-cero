/* =========================================================================
   COTA CERO — escena de la sala (home). PLA-ESCENES.md.
   Sense GSAP o amb moviment reduït no fa res: el CSS ja ensenya el hero sobre
   la sala acabada i la llista de passos. Aquí només s'hi afegeix:
   - Lenis (scroll suavitzat) lligat al rellotge de GSAP;
   - el zoom dins de la «o» de Cero (SVG amb els contorns reals de la lletra) cap a la sala en runes;
   - els passos (16/10/2026): un fons blanc fix on la línia i els 7 passos apareixen d'esquerra a dreta;
     quan el blanc puja, a sota hi ha la sala acabada;
   - el contracte i el carril de projectes.
   ========================================================================= */
(function () {
  'use strict';

  var html = document.documentElement;
  var sala = document.querySelector('.sala');
  if (!sala) return;
  // El <head> ja ha posat .sala-moviment si no hi ha moviment reduït; sense GSAP, es treu i queda l'estat quiet.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap || !window.ScrollTrigger) {
    html.classList.remove('sala-moviment', 'intro-activa', 'intro-bloqueja');
    return;
  }
  html.classList.add('sala-moviment', 'intro-activa');
  requestAnimationFrame(function () { requestAnimationFrame(function () { html.classList.add('sala-llesta'); }); });
  gsap.registerPlugin(ScrollTrigger);

  /* ── Lenis ─────────────────────────────────────────────────────────── */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var escenari = sala.querySelector('.sala-escenari');
  var fotos = sala.querySelector('.sala-fotos');
  var capaFinal = sala.querySelector('.sala-capa[data-fase="6"]');   // la sala acabada
  var svg = sala.querySelector(".zoom-o");
  var g = sala.querySelector('.zoom-o-g');
  var hero = sala.querySelector('.sala-hero');
  var passos = sala.querySelector('.obra');

  /* ── Zoom dins de la «o» ───────────────────────────────────────────────
     Centre i radi del forat en unitats del viewBox (PLA-eines/sortida/contorn-o.json).
     El grup s'escala al voltant del forat i el porta al centre de la pantalla; l'escala
     final és la que fa que el forat cobreixi la diagonal sencera. */
  var O = { x: 3960.2, y: -259.7 }, RADI = 111.6;
  var vb = svg.viewBox.baseVal;
  var C = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
  var escalaMax = 40;
  function calculaEscala() {
    // En vertical el nom ocupa gairebé tota l'amplada; en horitzontal, un 70 %.
    var vertical = innerWidth < innerHeight;
    svg.setAttribute('viewBox', vertical ? '-300 -1150 4842 1500' : '-880 -1150 6000 1500');
    C = { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
    // L'SVG ocupa l'escenari (100svh, mínim 34rem): es calcula amb la finestra i no es llegeix el layout
    // just després d'haver canviat el viewBox (era un reflow forçat a l'arrencada).
    var w = innerWidth, h = Math.max(innerHeight, 34 * 16);
    var k = Math.min(w / vb.width, h / vb.height); // px per unitat (meet)
    var semidiagonal = Math.hypot(w, h) / 2;
    var s = (semidiagonal / (RADI * k)) * 1.25;
    escalaMax = isFinite(s) && s > 1 ? s : 60;
  }
  calculaEscala();
  ScrollTrigger.addEventListener('refreshInit', calculaEscala);

  function zoom(t) {
    var s = Math.exp(t * Math.log(escalaMax));       // ritme constant a l'ull
    var m = t * t * (3 - 2 * t);                      // el forat va cap al centre
    var px = O.x + (C.x - O.x) * m, py = O.y + (C.y - O.y) * m;
    g.setAttribute('transform', 'translate(' + px + ' ' + py + ') scale(' + s + ') translate(' + (-O.x) + ' ' + (-O.y) + ')');
    svg.style.visibility = t > 0.995 ? 'hidden' : 'visible';
    html.classList.toggle('intro-activa', t < 0.9);
  }
  zoom(0);

  /* ── Intro automàtica (en Lluc, 15/10/2026): es fa sola fins a la sala, amb temps per veure-ho.
     1,4 s el nom quiet → 2,8 s de zoom → el titular entra. L'scroll espera; qualsevol roda, toc o
     tecla l'accelera fins al final (no s'hi queda ningú atrapat). Si la pàgina ja carrega avall, no surt. ── */
  /* El titular és visible des del primer pintat, tapat pel vel del nom (Lighthouse: era l'LCP i no es
     pintava fins als 4 s). El forat de la «o», en créixer, el destapa; mentrestant puja els seus 28 px. */
  var estat = { t: 0 };
  gsap.set(hero, { y: 28 });
  if (lenis) lenis.stop();
  html.classList.add('intro-bloqueja');
  var intro = gsap.timeline({ delay: 0.2, onComplete: alliberaScroll })
    .to(estat, { t: 1, ease: 'power2.inOut', duration: 2.8, onUpdate: function () { zoom(estat.t); } }, 1.4)
    .fromTo(fotos, { scale: 1.3 }, { scale: 1, ease: 'power2.out', duration: 2.8 }, 1.4)
    .to(hero, { y: 0, ease: 'power2.out', duration: 1.1 }, 3.4);
  function alliberaScroll() {
    html.classList.remove('intro-bloqueja');
    if (lenis) lenis.start();
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { removeEventListener(ev, accelera); });
    removeEventListener('scroll', saltaIntro);
  }
  function accelera() { intro.timeScale(5); }
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { addEventListener(ev, accelera, { passive: true }); });
  // Si la pàgina carrega avall, no surt. El navegador restaura l'scroll (recàrrega, enrere) després d'aquest
  // script: per això també s'escolta el scroll (durant la intro, l'usuari no pot fer scroll; només el navegador).
  function saltaIntro() { if (scrollY > 10 && intro.progress() < 1) intro.progress(1); }
  saltaIntro();
  addEventListener('scroll', saltaIntro, { passive: true });
  // Xarxa de seguretat: si el rellotge no avança (pestanya en segon pla), la intro s'acaba igualment i l'scroll queda lliure.
  setTimeout(function () { if (intro.progress() < 1) intro.progress(1); }, 8000);

  /* ── El titular marxa quan puja la primera targeta. Un sol lloc en mana l'opacitat un cop acabada la intro
     (dues animacions sobre la mateixa propietat es trepitjaven i el titular es quedava a sobre de les fases). ── */
  var heroFora = null;  // el crea muntaEscena()
  // Rep el trigger com a argument: si la pàgina carrega avall, ScrollTrigger crida onRefresh dins de create(),
  // abans que heroFora existeixi (i l'error aturava la resta de l'escena).
  function pintaHero(self) {
    self = self || heroFora;
    if (!self || intro.progress() < 1) return;
    var p = self.progress;
    gsap.set(hero, { autoAlpha: 1 - p, y: -24 * p });
  }
  intro.eventCallback('onComplete', function () { alliberaScroll(); pintaHero(); });

  /* ── La sala es reforma: cada fase escombra el seu estat de dalt a baix ── */
  /* ── Amb moviment, la sala comença en runes: l'acabada s'ensenya quan el blanc dels passos la tapa ── */
  gsap.set(capaFinal, { autoAlpha: 0 });

  /* ── Els ScrollTrigger es munten després del primer pintat (Lighthouse: la seva mesura era una tasca llarga
     a l'arrencada i endarreria el titular). Durant la intro l'scroll està aturat: ningú no els troba a faltar.
     Doble rAF per esperar el pintat; el setTimeout, per si la pestanya és en segon pla i el rAF no corre. ── */
  var muntada = false;
  function arrenca() { if (muntada) return; muntada = true; muntaEscena(); }
  requestAnimationFrame(function () { requestAnimationFrame(arrenca); });
  setTimeout(arrenca, 300);

  function muntaEscena() {
    heroFora = ScrollTrigger.create({ trigger: passos, start: 'top 95%', end: 'top 55%', onUpdate: pintaHero, onRefresh: pintaHero });

    /* ── Els passos (en Lluc, 16/10/2026): el fons blanc tapa la sala en runes i s'hi queda fix; la línia es
       dibuixa d'esquerra a dreta (de dalt a baix al mòbil) i cada pas apareix quan la línia hi arriba. Mentre el
       blanc tapa la sala, la sala passa a l'estat acabat: quan el blanc puja, el que hi ha a sota ja és la reforma feta. ── */
    var llista = passos.querySelector('.obra-llista');
    var pas = gsap.utils.toArray('.obra-pas', passos);
    var vertical = function () { return innerWidth < 900; };
    gsap.set(pas, { autoAlpha: 0.08, y: 14 });
    var tlPassos = gsap.timeline({
      scrollTrigger: { trigger: passos, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
      defaults: { ease: 'none' }
    });
    tlPassos.fromTo(llista, { '--linia': 0 }, { '--linia': 1, duration: 1 }, 0);
    pas.forEach(function (p, i) {
      tlPassos.to(p, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.02 + i * (0.9 / pas.length));
    });
    tlPassos.to({}, { duration: 0.15 });   // tots junts, quiets, una estona abans que el blanc pugi
    // El fons dels passos és de vidre (en Lluc, 16/10/2026): a través seu, la sala passa a poc a poc de les runes
    // a la reforma feta mentre avancen els passos, en lloc de canviar de cop amagada.
    tlPassos.fromTo(capaFinal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.85, ease: 'power1.inOut' }, 0.05);
    // Mentre la sala en runes és a la vista, la càmera hi avança una mica (com entrar a l'habitació)
    gsap.fromTo(sala.querySelector('.sala-camera'), { scale: 1 }, {
      scale: 1.06, ease: 'none',
      scrollTrigger: { trigger: passos, start: 'top bottom', end: 'top top', scrub: true }
    });

    /* ── Contracte: el full puja, les partides apareixen, la firma es dibuixa i cau el segell ── */
    var contracte = document.querySelector('.fase-contracte');   // des del 16/10, fora de la sala (secció pròpia)
    if (contracte) {
      var full = contracte.querySelector('.contracte');
      var partides = contracte.querySelectorAll('.contracte-partides li, .contracte-total, .contracte-clausula');
      var traç = contracte.querySelector('.contracte-firma path');
      var segell = contracte.querySelector('.contracte-segell');
      var explica = contracte.querySelector('.contracte-explica');
      gsap.set(traç, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(partides, { opacity: 0, y: 14 });
      gsap.set(segell, { opacity: 0, scale: 1.8 });
      // En Lluc (16/10/2026): la sala acabada no es mou; quan les portes marxen, l'explicació apareix a l'esquerra
      // i el full entra des de la dreta. Comença quan les portes ja deixen veure la sala.
      gsap.timeline({
        scrollTrigger: { trigger: '.portes', start: 'bottom 45%', endTrigger: contracte, end: 'bottom bottom', scrub: true },
        defaults: { ease: 'none' }
      })
        .fromTo(explica, { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.16, ease: 'power2.out' }, 0)
        .fromTo(full, { x: function () { return innerWidth * 0.6; }, rotate: 4, autoAlpha: 0 }, { x: 0, rotate: 0, autoAlpha: 1, duration: 0.26, ease: 'power2.out' }, 0.06)
        .to(partides, { opacity: 1, y: 0, stagger: 0.04, duration: 0.08 }, 0.32)
        .to(traç, { strokeDashoffset: 0, duration: 0.2 }, 0.6)
        .to(segell, { opacity: 0.88, scale: 1, duration: 0.05, ease: 'power4.in' }, 0.82);
    }

    /* ── Carril de projectes: les fotos van de dreta a esquerra i les del mig creixen ── */
    var carril = document.querySelector('.galeria-carril');
    if (carril) {
      var pista = carril.querySelector('.galeria');
      var targetes = gsap.utils.toArray('figure', pista);
      var fixe = carril.querySelector('.carril-fixe');
      var fotosCarril = targetes.map(function (t) { return t.querySelector('img'); });
      var recorregut = 0, x0 = 0, centres = [];
      // Les mides es llegeixen aquí (en el refresh) i no a cada fotograma: llegir offsetLeft just després
      // d'escriure els transforms forçava un reflow per foto (Lighthouse). Els transforms no les canvien.
      var mesura = function () {
        x0 = innerWidth * 0.62;                                  // la primera foto entra per la dreta
        recorregut = x0 + pista.scrollWidth - innerWidth * 0.38; // l'última s'atura una mica passat el mig
        centres = targetes.map(function (t) { return t.offsetLeft + t.offsetWidth / 2; });
      };
      var pintaCarril = function (p) {
        var x = x0 - recorregut * p;
        pista.style.transform = 'translate3d(' + x + 'px,0,0)';
        var mig = innerWidth / 2;
        targetes.forEach(function (t, i) {
          var d = Math.min(1, Math.abs(x + centres[i] - mig) / (innerWidth * 0.5));
          var e = 1 - d * d * (3 - 2 * d);                        // 1 al centre, 0 a les vores
          t.style.transform = 'scale(' + (0.72 + 0.4 * e).toFixed(3) + ')';
          // Només la foto s'apaga: si s'apagava la figura sencera, la llegenda baixava a 2:1 de contrast
          fotosCarril[i].style.opacity = (0.45 + 0.55 * e).toFixed(3);
        });
      };
      mesura(); pintaCarril(0);
      var stCarril = ScrollTrigger.create({
        trigger: fixe, pin: true, start: 'top top', end: function () { mesura(); return '+=' + recorregut; },
        scrub: true, invalidateOnRefresh: true, onRefresh: function (s) { pintaCarril(s.progress); },
        onUpdate: function (s) { pintaCarril(s.progress); }
      });
      // Teclat: en enfocar una foto, l'scroll porta el carril fins a ella
      pista.addEventListener('focusin', function (ev) {
        var t = ev.target.closest('figure'); if (!t) return;
        var p = (x0 - (innerWidth / 2 - centres[targetes.indexOf(t)])) / recorregut;
        window.scrollTo(0, stCarril.start + Math.max(0, Math.min(1, p)) * (stCarril.end - stCarril.start));
      });
    }
  }  // muntaEscena
})();
