/* =========================================================================
   COTA CERO — recorregut per l'habitació acabada (pàgines de servei). PLA-ESCENES.md.
   Sense GSAP o amb moviment reduït no fa res: el CSS ja ensenya el hero amb vel i
   les parades en llista. Aquí només s'hi afegeix:
   - Lenis (scroll suavitzat) lligat al rellotge de GSAP, com a la home;
   - la foto fixa i la càmera que s'hi passeja: a cada .parada, l'element (data-x, data-y,
     en fracció de la foto) va al costat del text, amb el zoom de data-s (només transform);
   - la cota de plànol: punt sobre l'element, línia amb colze i el nom, que es dibuixa
     quan la càmera hi arriba i s'apaga quan en marxa.
   ========================================================================= */
(function () {
  'use strict';

  var html = document.documentElement;
  var ruta = document.querySelector('.ruta');
  if (!ruta) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap || !window.ScrollTrigger) {
    html.classList.remove('ruta-moviment');
    return;
  }
  html.classList.add('ruta-moviment');
  gsap.registerPlugin(ScrollTrigger);

  /* ── Lenis ─────────────────────────────────────────────────────────── */
  if (window.Lenis) {
    var lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var escenari = ruta.querySelector('.ruta-escenari');
  var camera = ruta.querySelector('.ruta-camera');
  var foto = ruta.querySelector('.ruta-foto');
  var hero = ruta.querySelector('.ruta-hero');
  var obertura = ruta.querySelector('.ruta-obertura');
  var final = ruta.querySelector('.ruta-final');
  var parades = gsap.utils.toArray('.parada', ruta);
  var linia = ruta.querySelector('.cota-linia');
  var punt = ruta.querySelector('.cota-punt');
  var noms = gsap.utils.toArray('.cota-nom', ruta);
  var textos = gsap.utils.toArray('.ruta-parades h2, .ruta-parades h3, .ruta-parades p, .ruta-parades .botons, .ruta-hero h1, .ruta-hero .hero-sub, .ruta-hero .botons', ruta);

  // Mida natural de la foto (els atributs width/height de l'HTML)
  var FW = Number(foto.getAttribute('width')) || 1280, FH = Number(foto.getAttribute('height')) || 720;
  var OBERT = { x: 0.5, y: 0.5, s: 1 };   // la vista sencera: hero, obertura i final
  var parada = parades.map(function (p) {
    return { x: Number(p.dataset.x), y: Number(p.dataset.y), s: Number(p.dataset.s) || 1.2 };
  });
  // Al mòbil la foto ja surt ampliada: a cada parada, un zoom petit i igual per a totes
  // (el just perquè es noti l'enrere-endavant sense que la foto de 1280 px es vegi tova)
  var ZOOM_MOBIL = 1.2;
  // A l'escriptori, les parades s'apropen una mica més del que diu data-s: així sempre queda marge de foto
  // per fer el pas enrere entre parada i parada (si no, les que toquen la vora no es podrien allunyar)
  var ZOOM_MARGE = 1.1;

  var W = 0, H = 0, mobil = false, coberta = { k: 1, ox: 0, oy: 0 }, vistes = [], vistaObert = null;
  function mesura() {
    W = escenari.clientWidth || innerWidth; H = escenari.clientHeight || innerHeight;
    mobil = W < 961;
    var k = Math.max(W / FW, H / FH);                 // object-fit: cover
    coberta = { k: k, ox: (W - FW * k) / 2, oy: (H - FH * k) / 2 };
    // La foto, sencera i centrada (no amb object-fit, que la retalla a la caixa i la càmera no podria
    // arribar a les vores): el mateix enquadrament de cover, però amb tota la imatge a l'abast.
    foto.style.width = FW * k + 'px'; foto.style.height = FH * k + 'px';
    foto.style.left = coberta.ox + 'px'; foto.style.top = coberta.oy + 'px';
    vistaObert = enquadra(OBERT);
    vistes = parada.map(function (v) { return enquadra(v); });
    // Al mòbil, si l'element queda a la part de baix de la pantalla, el text de la parada puja a dalt
    // perquè la cota no hi caigui a sobre.
    parades.forEach(function (p, i) {
      p.classList.toggle('parada-dalt', mobil && aPantalla(vistes[i], parada[i].x, parada[i].y).y > H * 0.75);
    });
  }

  // On ha de quedar l'element: a l'esquerra del text (escriptori) o a sobre (mòbil)
  function diana() { return mobil ? { x: W * 0.5, y: H * 0.34 } : { x: W * 0.36, y: H * 0.5 }; }

  // La foto sempre cobreix la pantalla: el desplaçament es limita segons el zoom
  function limita(tx, ty, s) {
    var c = coberta;
    return {
      tx: Math.min(-s * c.ox, Math.max(W - s * (c.ox + FW * c.k), tx)),
      ty: Math.min(-s * c.oy, Math.max(H - s * (c.oy + FH * c.k), ty)), s: s
    };
  }
  // Una parada → transform de la càmera, amb l'element a la diana
  function enquadra(v) {
    var s = v === OBERT ? 1 : (mobil ? ZOOM_MOBIL : v.s * ZOOM_MARGE), c = coberta, d = diana();
    var px = c.ox + v.x * FW * c.k, py = c.oy + v.y * FH * c.k;
    return limita(d.x - s * px, d.y - s * py, s);
  }
  function aPantalla(cam, x, y) {
    var c = coberta;
    return { x: cam.tx + cam.s * (c.ox + x * FW * c.k), y: cam.ty + cam.s * (c.oy + y * FH * c.k) };
  }

  /* D'una vista a la següent, UN sol moviment (en Lluc, 16/10/2026): el centre de l'enquadrament va en
     línia recta d'un punt a l'altre, sense desviar-se, i el zoom fa un sol arc suau (una mica enrere al mig,
     endavant en arribar). L'arc es calcula perquè mai topi amb la vora de la foto: si hi topés, el zoom
     quedaria aplanat un moment i el moviment es partiria en dos. */
  var MOSTRES = 32;
  function trajecte(a, b, u) {
    var ca = { x: (W / 2 - a.tx) / a.s, y: (H / 2 - a.ty) / a.s };
    var cb = { x: (W / 2 - b.tx) / b.s, y: (H / 2 - b.ty) / b.s };
    var base = function (v) { return Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * v); };
    var dist = Math.hypot((cb.x - ca.x) / W, (cb.y - ca.y) / H);
    // Quant enrere: com més lluny, més; des de la vista sencera o cap a ella, gens (ja és tot zoom)
    var desitjat = Math.min(a.s, b.s) <= 1.001 ? 0 : Math.min(0.2, 0.08 + dist * 0.4);
    var MIN = Math.min(desitjat, 0.06);
    // Camí: recte. Només si les dues parades toquen la mateixa vora de la foto (i la recta no deixa
    // marge per allunyar-se), es corba una mica cap a dins, en un sol arc suau (Bézier quadràtica).
    // L'arc es doblega de costat (perpendicular al camí) cap a on hi ha més foto: així la càmera sempre
    // avança en el mateix sentit, també en els trams curts.
    var mc = { x: coberta.ox + FW * coberta.k / 2, y: coberta.oy + FH * coberta.k / 2 };
    var mig = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
    var llarg = Math.hypot(cb.x - ca.x, cb.y - ca.y);
    var n = llarg > 1 ? { x: -(cb.y - ca.y) / llarg, y: (cb.x - ca.x) / llarg } : { x: 0, y: 0 };
    if (n.x * (mc.x - mig.x) + n.y * (mc.y - mig.y) < 0) n = { x: -n.x, y: -n.y };
    var enrere = -Infinity, punt = null;
    for (var desvia = 0; desvia <= Math.min(120, llarg * 0.35); desvia += 8) {
      // el punt de control a 2× la desviació fa que el camí passi a «desvia» px de la recta, al mig
      var ctl = { x: mig.x + n.x * desvia * 2, y: mig.y + n.y * desvia * 2 };
      var prova = (function (q) {
        return function (v) { var w = 1 - v; return { x: w * w * ca.x + 2 * v * w * q.x + v * v * cb.x, y: w * w * ca.y + 2 * v * w * q.y + v * v * cb.y }; };
      })(ctl);
      var e = desitjat;
      for (var k = 1; k < MOSTRES; k++) {
        var v = k / MOSTRES, p = prova(v);
        e = Math.min(e, (1 - minim(p.x, p.y) / base(v)) / Math.sin(Math.PI * v));
      }
      // ens quedem la corba més petita que arriba al mínim; si cap hi arriba, la que s'hi acosta més
      if (e > enrere + 0.01 || !punt) { enrere = e; punt = prova; }
      if (e >= MIN - 1e-4) break;
    }
    // Si la recta passa per una zona que demana més zoom que els extrems, l'arc va endavant (enrere < 0):
    // continua sent un sol moviment, sense aturades
    enrere = Math.max(-0.3, enrere);
    var c = punt(u);
    var s = base(u) * (1 - enrere * Math.sin(Math.PI * u));
    return limita(W / 2 - s * c.x, H / 2 - s * c.y, s);
  }
  // El zoom mínim amb què el punt (cx, cy) de la foto pot ser al centre de la pantalla
  function minim(cx, cy) {
    var c = coberta;
    var mx = Math.min(cx - c.ox, c.ox + FW * c.k - cx), my = Math.min(cy - c.oy, c.oy + FH * c.k - cy);
    return Math.max(1, W / (2 * Math.max(1, mx)), H / (2 * Math.max(1, my)));
  }

  var suau = function (t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  var suauLlarg = function (t) { t = Math.min(1, Math.max(0, t)); return 0.5 - 0.5 * Math.cos(Math.PI * t); };
  // Escriptori: 0 quan el bloc treu el cap per baix; 1 quan la seva vora de dalt arriba al 45 % de la pantalla.
  // Mòbil (el text va a baix del bloc): la càmera es mou quan la vora de dalt passa del 60 % a dalt de tot, i
  // així arriba quan el text de la parada anterior ja ha sortit i el nou apareix a baix.
  var entrada = function (el) {
    var top = el.getBoundingClientRect().top, h = innerHeight;
    return Math.min(1, Math.max(0, mobil ? (0.6 * h - top) / (0.6 * h) : (h - top) / (h * 0.55)));
  };

  /* ── La cota: punt, línia amb colze i nom. Cap a dalt a l'esquerra; cap a la dreta si no hi cap;
     al mòbil, recta cap amunt i el nom centrat. ── */
  function pintaCota(i, a, cam, visible) {
    noms.forEach(function (n, k) { if (k !== i) n.style.opacity = 0; });
    if (i < 0 || visible <= 0 || a <= 0) {
      linia.setAttribute('d', ''); punt.setAttribute('r', 0); if (i >= 0) noms[i].style.opacity = 0;
      return;
    }
    var p = aPantalla(cam, parada[i].x, parada[i].y), nom = noms[i];
    var w = nom.offsetWidth, h = nom.offsetHeight, d, nx, ny;
    if (mobil) {
      // Cap amunt; si l'element és tocant a la capçalera, cap avall
      var baixa = p.y < 220, llarg = 64;
      d = 'M' + p.x + ' ' + p.y + 'V' + (p.y + (baixa ? llarg : -llarg));
      nx = Math.min(W - w - 12, Math.max(12, p.x - w / 2));
      ny = baixa ? p.y + llarg + 8 : p.y - llarg - h - 8;
    } else {
      var dreta = p.x - 112 - w < 16, avall = p.y < 150;
      var sx = dreta ? 1 : -1, sy = avall ? 1 : -1;
      var ex = p.x + sx * 56, ey = p.y + sy * 56, lx = ex + sx * 48;
      d = 'M' + p.x + ' ' + p.y + 'L' + ex + ' ' + ey + 'H' + lx;
      nx = dreta ? lx + 10 : lx - 10 - w; ny = ey - h / 2;
    }
    // La cota mai trepitja un text: si n'hi ha un que s'hi acosta (el de la parada, que puja, o l'anterior,
    // que marxa), s'esvaeix, i torna quan queda lliure.
    var caixa = {
      l: Math.min(nx, p.x) - 8, r: Math.max(nx + w, p.x) + 8,
      t: Math.min(ny, p.y) - 8, b: Math.max(ny + h, p.y) + 8
    };
    var lliure = Infinity;
    var heroVisible = Number(hero.style.opacity || 1) > 0.02;
    textos.forEach(function (el) {
      if (!heroVisible && hero.contains(el)) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.right < caixa.l || r.left > caixa.r) return;
      lliure = Math.min(lliure, Math.max(r.top - caixa.b, caixa.t - r.bottom));
    });
    visible *= suau(lliure / 36);
    linia.setAttribute('d', d);
    linia.style.strokeDashoffset = 1 - a;
    linia.style.opacity = visible;
    punt.setAttribute('cx', p.x); punt.setAttribute('cy', p.y); punt.setAttribute('r', 5 * Math.min(1, a * 3));
    punt.style.opacity = visible;
    nom.style.transform = 'translate3d(' + nx + 'px,' + (ny + (1 - suau((a - 0.6) / 0.4)) * 8) + 'px,0)';
    nom.style.opacity = suau((a - 0.6) / 0.4) * visible;
  }

  /* ── Un sol lloc pinta l'escena a cada scroll: càmera, cota i hero ── */
  function pinta() {
    var actiu = -1, dibuix = 0, visible = 0;
    var tObertura = entrada(obertura);
    var t = parada.map(function (_, i) { return entrada(parades[i]); });
    var tFinal = entrada(final);
    // Vistes en ordre: obert → parades → obert. Es pinta el tram on som.
    var cam = vistaObert;
    for (var i = 0; i < parada.length && t[i] > 0; i++) {
      cam = t[i] < 1 ? trajecte(i ? vistes[i - 1] : vistaObert, vistes[i], suauLlarg(t[i])) : vistes[i];
      actiu = i;
    }
    if (tFinal > 0) cam = tFinal < 1 ? trajecte(vistes[parada.length - 1], vistaObert, suauLlarg(tFinal)) : vistaObert;
    if (actiu >= 0) {
      var seguent = actiu + 1 < parada.length ? t[actiu + 1] : tFinal;
      dibuix = suau((t[actiu] - 0.7) / 0.3);           // es dibuixa quan la càmera arriba
      visible = 1 - suau(seguent / 0.25);              // i s'apaga quan en marxa
    }
    camera.style.transform = 'translate3d(' + cam.tx + 'px,' + cam.ty + 'px,0) scale(' + cam.s + ')';
    pintaCota(actiu, dibuix, cam, visible);
    var fora = suau(tObertura / 0.6);
    gsap.set(hero, { autoAlpha: 1 - fora, y: -24 * fora });
    tinta(cam);
  }

  /* ── Color del text segons la foto (en Lluc, 16/10/2026): sense fons ni halos, cada línia de text mira
     la foto que té just darrere i va en grafit si és clara o en blanc si és fosca, el que contrasti més.
     La foto es llegeix un sol cop, petita, en un canvas; a cada pas es mostregen uns punts sota cada text. ── */
  var MOSTRA_W = 320, MOSTRA_H = 180, pixels = null;
  function llegeixFoto() {
    try {
      var cv = document.createElement('canvas');
      cv.width = MOSTRA_W; cv.height = MOSTRA_H;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(foto, 0, 0, MOSTRA_W, MOSTRA_H);
      pixels = cx.getImageData(0, 0, MOSTRA_W, MOSTRA_H).data;
    } catch (e) { pixels = null; return; }   // sense lectura de la foto, el text es queda en grafit
    if (vistaObert) pinta();                  // si l'escena ja està mesurada; si no, ja la pintarà mesura()
  }
  if (foto.complete && foto.naturalWidth) llegeixFoto(); else foto.addEventListener('load', llegeixFoto);

  var lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  var LUM_GRAFIT = 0.019;   // luminància relativa de --grafit (#22262A)
  var textosTinta = gsap.utils.toArray('.ruta-hero .molla, .ruta-hero h1, .ruta-hero .hero-sub, .ruta-hero .botons, .ruta-parades h2, .ruta-parades h3, .ruta-parades p, .cota-nom', ruta);
  function tinta(cam) {
    if (!pixels) return;
    var esc = escenari.getBoundingClientRect(), c = coberta;
    textosTinta.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < esc.top || r.top > esc.bottom || r.width === 0) return;
      var blanc = [], grafit = [];
      for (var i = 0; i < 6; i++) for (var j = 0; j < 4; j++) {
        var sx = r.left + r.width * (i + 0.5) / 6, sy = r.top + r.height * (j + 0.5) / 4 - esc.top;
        var u = (((sx - cam.tx) / cam.s) - c.ox) / (FW * c.k), v = (((sy - cam.ty) / cam.s) - c.oy) / (FH * c.k);
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        var k = (Math.min(MOSTRA_H - 1, v * MOSTRA_H | 0) * MOSTRA_W + Math.min(MOSTRA_W - 1, u * MOSTRA_W | 0)) * 4;
        var L = 0.2126 * lin(pixels[k]) + 0.7152 * lin(pixels[k + 1]) + 0.0722 * lin(pixels[k + 2]);
        blanc.push(1.05 / (L + 0.05)); grafit.push((L + 0.05) / (LUM_GRAFIT + 0.05));
      }
      if (!blanc.length) return;
      // El que mana és la pitjor part del text (el 20 % de punts amb menys contrast), no la mitjana
      var pitjor = function (a) { a.sort(function (x, y) { return x - y; }); return a[Math.floor(a.length * 0.2)]; };
      var cb = pitjor(blanc), cg = pitjor(grafit), ara = el.classList.contains('sobre-fosc');
      // Marge perquè no canviï d'anada i tornada quan els dos colors s'hi llegeixen igual
      if (!ara && cb > cg * 1.15) el.classList.add('sobre-fosc');
      else if (ara && cg > cb * 1.15) el.classList.remove('sobre-fosc');
    });
  }

  /* ── Profunditat del text (com a la home): sense fons, cada línia puja a una velocitat; el títol,
     més a prop, va més de pressa. Només transform. ── */
  var CAPA = { H2: 56, H3: 56, P: 26 };
  gsap.utils.toArray('.ruta-obertura, .parada, .ruta-final', ruta).forEach(function (bloc) {
    gsap.utils.toArray(bloc.children).forEach(function (peca) {
      var d = CAPA[peca.tagName] || 14;
      gsap.fromTo(peca, { y: d }, {
        y: -d, ease: 'none',
        scrollTrigger: { trigger: bloc, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  });

  mesura();
  linia.setAttribute('pathLength', '1');
  linia.style.strokeDasharray = '1';
  ScrollTrigger.create({
    trigger: ruta, start: 'top bottom', end: 'bottom top',
    onUpdate: pinta, onRefresh: function () { mesura(); pinta(); }
  });
  ScrollTrigger.addEventListener('refreshInit', mesura);
  // El canvi d'idioma canvia l'amplada dels noms: es recol·loquen
  document.addEventListener('idioma-canviat', pinta);
  pinta();
})();
