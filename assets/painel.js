// Painel visual do aluno: cálculos (níveis, onde intervir) e desenho (barras de metal, gráfico, cartões).
// Usado pelo app.js nas três visões (aluno, mentor e gestor). Não faz chamadas ao servidor.

window.Painel = (function () {
  var META_ACERTO = 0.6, META_RED = 900, PRECISA = 4;
  var AREAS = [['L', 'Linguagens', '#2F6FDE'], ['H', 'Ciências Humanas', '#E07B39'], ['N', 'Ciências da Natureza', '#1E9E6A'], ['M', 'Matemática', '#8E5BD6'], ['R', 'Redação', '#D6457A']];
  var METAIS = ['Ferro', 'Cobre', 'Prata', 'Ouro', 'Diamante'];
  var SIMB = { Ferro: 'Fe', Cobre: 'Cu', Prata: 'Ag', Ouro: 'Au', Diamante: 'C' };
  var COR = { Ferro: ['#3c4249', '#b3bcc6', '#5d656e', '#f1f4f7'], Cobre: ['#6e3418', '#f4ab7e', '#b4642f', '#fff5ee'], Prata: ['#77808a', '#ffffff', '#b8c0c7', '#2b3238'], Ouro: ['#8a5a0c', '#fff0a8', '#d9a52f', '#4a3000'], Diamante: ['#3fb3e0', '#f5fdff', '#9fe0f5', '#0b4560'] };
  var TEXTO_METAL = { Ferro: '#5d656e', Cobre: '#b4642f', Prata: '#8a939b', Ouro: '#b8861a', Diamante: '#2a9fd0' };
  var ARTIGO = { Ferro: 'ao', Cobre: 'ao', Prata: 'à', Ouro: 'ao', Diamante: 'ao' };
  var CORTE_OBJ = [0, 10, 19, 28, 37], CORTE_RED = [0, 201, 401, 601, 801];
  var ITENS = [['Matemática', 'M'], ['Física', 'N'], ['Química', 'N'], ['Biologia', 'N'], ['História', 'H'], ['Geografia', 'H'], ['Sociologia', 'H'], ['Filosofia', 'H'], ['Linguagens', 'L'], ['Redação', 'R']];
  var GRUPOS = [['Para reforçar', 'var(--ruim)'], ['No caminho', 'var(--aviso)'], ['Fortes', 'var(--bom)'], ['Avaliando', '#AAB3C0']];
  var NS = 'http://www.w3.org/2000/svg';
  var app = document.getElementById('app');

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }
  function sv(tag, attrs, pai) {
    var e = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (pai) pai.appendChild(e);
    return e;
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(new RegExp('[' + String.fromCharCode(768) + '-' + String.fromCharCode(879) + ']', 'g'), '').replace(/[^a-z0-9]+/g, ''); }
  function pct(v, casas) { return (v * 100).toFixed(casas === undefined ? 1 : casas).replace('.', ',') + '%'; }
  function ok(v) { return v !== null && v !== undefined && v !== '' && !isNaN(v); }

  // ---------- Cálculos ----------
  function calcular(d) {
    var sims = d.simulados.slice().sort(function (a, b) { return a.ordem - b.ordem; });
    var obj = ['L', 'H', 'N', 'M'];
    var acerto = function (s) { var v = obj.map(function (k) { return s[k]; }).filter(ok); return v.length ? v.reduce(function (t, x) { return t + x; }, 0) / (45 * v.length) : null; };
    var completos = sims.filter(function (s) { return obj.every(function (k) { return ok(s[k]); }); });
    var ult = sims[sims.length - 1] || null;
    var reds = sims.filter(function (s) { return ok(s.R); });
    var r = {
      sims: sims, ult: ult, acerto: ult ? acerto(ult) : null, areasUlt: ult ? obj.filter(function (k) { return ok(ult[k]); }).length : 0,
      completos: completos.length,
      evol: completos.length >= 2 ? (acerto(completos[completos.length - 1]) - acerto(completos[0])) * 100 : null,
      red: reds.length ? reds[reds.length - 1].R : null, varRed: reds.length >= 2 ? reds[reds.length - 1].R - reds[0].R : null
    };
    var c = {}, m = {};
    d.erros.forEach(function (e) { var k = cap(e.materia); if (k) c[k] = (c[k] || 0) + 1; if (e.motivo) m[e.motivo] = (m[e.motivo] || 0) + 1; });
    r.topMateria = topo(c); r.motivos = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    r.errosUlt = ult ? d.erros.filter(function (e) { return norm(e.simulado) === norm(ult.prova); }).length : 0;
    r.niveis = AREAS.map(function (a) { return nivel(sims, a[0], a[1]); });
    r.intervir = intervir(sims, d.erros);
    return r;
  }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function topo(c) { var k = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }); return k.length ? k[0] : null; }

  function nivel(sims, k, nome) {
    var corte = k === 'R' ? CORTE_RED : CORTE_OBJ;
    var vals = sims.filter(function (s) { return ok(s[k]); }).map(function (s) { return { prova: s.prova, v: Number(s[k]) }; });
    var faixa = function (v) { var f = 0; corte.forEach(function (c, i) { if (v >= c) f = i; }); return f; };
    var n = 0;
    for (var j = 4; j >= 1; j--) if (vals.filter(function (x) { return faixa(x.v) >= j; }).length >= PRECISA) { n = j; break; }
    var piso = corte[n], prox = n < 4 ? n + 1 : null, prog = prox === null ? 1 : 0, naFaixa = 0;
    for (var t = n + 1; t <= 4; t++) {
      var partes = vals.map(function (x) { return Math.max(0, Math.min(1, (x.v - piso) / (corte[t] - piso))); }).sort(function (a, b) { return b - a; }).slice(0, PRECISA);
      var p = partes.reduce(function (s, x) { return s + x; }, 0) / PRECISA;
      if (p > 0 && p >= prog - 1e-9) { prox = t; prog = p; naFaixa = vals.filter(function (x) { return faixa(x.v) >= t; }).length; }
    }
    return { area: nome, metal: METAIS[n], rumo: prox === null ? null : METAIS[prox], corte: prox === null ? null : corte[prox], naFaixa: Math.min(naFaixa, PRECISA), prog: prog, n: vals.length, redacao: k === 'R', hist: vals };
  }

  function intervir(sims, erros) {
    var total = erros.length;
    return ITENS.map(function (it) {
      var k = it[1], com = sims.filter(function (s) { return ok(s[k]); }), s = com[com.length - 1];
      var ac = s ? s[k] / (k === 'R' ? 1000 : 45) : null;
      var meus = erros.filter(function (e) { return norm(e.materia) === norm(it[0]); });
      var partes = {}, mot = {};
      meus.forEach(function (e) { if (e.parte) partes[e.parte] = (partes[e.parte] || 0) + 1; if (e.motivo) mot[e.motivo] = (mot[e.motivo] || 0) + 1; });
      var g = 3;
      if (ac !== null) {
        var b = k === 'R' ? 0.6 : 0.5, a = k === 'R' ? 0.8 : 0.75;
        g = ac < b ? 0 : ac < a ? 1 : 2;
        if (meus.length >= 3 && meus.length / Math.max(1, total) >= 0.2) g = Math.max(0, g - 1);
      }
      return { materia: it[0], area: AREAS.filter(function (x) { return x[0] === k; })[0][1], grupo: g, acerto: ac, prova: s ? s.prova : null, erros: meus.length,
        partes: Object.keys(partes).sort(function (x, y) { return partes[y] - partes[x]; }).slice(0, 4).map(function (x) { return x + ' (' + partes[x] + ')'; }), motivo: topo(mot) };
    });
  }

  // ---------- Desenho: barra de metal (ou diamante) com anel de progresso ----------
  function selo(metal, progresso, metalAnel, idx) {
    var c = COR[metal], id = 'nv' + Math.random().toString(36).slice(2, 8), dia = metal === 'Diamante';
    var svg = sv('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': metal });
    var defs = sv('defs', {}, svg);
    var grad = function (gid, x1, y1, x2, y2, stops) { var g = sv('linearGradient', { id: id + gid, x1: x1, y1: y1, x2: x2, y2: y2 }, defs); stops.forEach(function (s) { sv('stop', { offset: s[0], style: 'stop-color:' + s[1] }, g); }); };
    grad('a', 0, 0, 1, 1, [[0, c[1]], [0.32, c[2]], [0.5, c[0]], [0.68, c[2]], [1, c[1]]]);
    grad('f', 0, 0, 0, 1, [[0, c[2]], [0.45, c[2]], [1, c[0]]]);
    var rg = sv('radialGradient', { id: id + 'c', cx: 0.35, cy: 0.3, r: 0.7 }, defs);
    sv('stop', { offset: 0, style: 'stop-color:rgba(255,255,255,0.55)' }, rg); sv('stop', { offset: 0.6, style: 'stop-color:rgba(255,255,255,0)' }, rg);
    var formaGema = 'M44 34 L76 34 L90 50 L60 92 L30 50 Z', escGema = 'translate(60,63) scale(1.16) translate(-60,-63)';
    var contorno = 'M40 46 L80 46 L86 56 L92 76 L28 76 L34 56 Z', escBarra = 'translate(60,61) scale(1.3) translate(-60,-61)';
    var clip = sv('clipPath', { id: id + 'k' }, defs);
    sv('path', { d: dia ? formaGema : contorno, transform: dia ? escGema : escBarra }, clip);
    if (progresso !== null && progresso !== undefined) {
      var R = 54, C = 2 * Math.PI * R, ca = COR[metalAnel] || c, p = Math.max(0, Math.min(1, progresso));
      sv('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: '#E2E6EE', 'stroke-width': 7 }, svg);
      if (p > 0) sv('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: ca[2], 'stroke-width': 7, 'stroke-linecap': p >= 1 ? 'butt' : 'round', 'stroke-dasharray': (C * p) + ' ' + C, transform: 'rotate(-90 60 60)' }, svg);
      for (var q = 0; q < PRECISA; q++) { var an = -Math.PI / 2 + q * 2 * Math.PI / PRECISA; sv('line', { x1: 60 + (R - 5) * Math.cos(an), y1: 60 + (R - 5) * Math.sin(an), x2: 60 + (R + 5) * Math.cos(an), y2: 60 + (R + 5) * Math.sin(an), stroke: '#FFFFFF', 'stroke-width': 2.2 }, svg); }
      var ang = -Math.PI / 2 + 2 * Math.PI * (p >= 1 ? 0 : p), ex = 60 + R * Math.cos(ang), ey = 60 + R * Math.sin(ang), txt = Math.round(p * 100) + '%', w = txt.length * 6.6 + 9;
      var g = sv('g', { transform: 'translate(' + ex + ',' + ey + ')' }, svg);
      sv('rect', { x: -w / 2, y: -8, width: w, height: 16, rx: 8, fill: p > 0 ? ca[2] : '#FFFFFF', stroke: p > 0 ? '#FFFFFF' : '#D5DAE3', 'stroke-width': 1.5 }, g);
      sv('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.5, style: 'font-size:10px;font-weight:700;fill:' + (p > 0 ? ca[3] : '#5D6B7E'), text: txt }, g);
    }
    sv('ellipse', dia ? { cx: 60, cy: 100, rx: 20, ry: 3, fill: '#000', 'fill-opacity': 0.12 } : { cx: 60, cy: 83, rx: 40, ry: 3.6, fill: '#000', 'fill-opacity': 0.14 }, svg);
    var f = sv('g', { class: 'flutua', style: 'animation-delay:' + (idx || 0) * 0.6 + 's' }, svg);
    if (dia) {
      var gm = sv('g', { transform: escGema }, f);
      [['30,50 44,34 52,50', c[1]], ['44,34 60,34 52,50', '#ffffff'], ['60,34 76,34 68,50', c[1]], ['60,34 52,50 68,50', c[2]], ['76,34 90,50 68,50', c[2]], ['30,50 52,50 60,92', c[2]], ['52,50 68,50 60,92', c[1]], ['68,50 90,50 60,92', c[0]]]
        .forEach(function (x) { sv('polygon', { points: x[0], fill: x[1], stroke: '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, gm); });
      sv('path', { d: formaGema, fill: 'url(#' + id + 'c)', stroke: c[0], 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, gm);
    } else {
      var b = sv('g', { transform: escBarra }, f);
      sv('path', { d: 'M34 56 L86 56 L92 76 L28 76 Z', fill: 'url(#' + id + 'f)', stroke: c[0], 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, b);
      sv('path', { d: 'M40 46 L80 46 L86 56 L34 56 Z', fill: 'url(#' + id + 'a)', stroke: c[0], 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, b);
      sv('path', { d: 'M34.6 56 L85.4 56', stroke: c[1], 'stroke-width': 1, 'stroke-opacity': 0.9 }, b);
      sv('path', { d: 'M40 46 L80 46 L86 56 L34 56 Z', fill: 'url(#' + id + 'c)' }, b);
      sv('text', { x: 60.5, y: 66.6, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-size:14px;font-weight:800;fill:#000;opacity:.25', text: SIMB[metal] }, b);
      sv('text', { x: 60, y: 66, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-size:14px;font-weight:800;fill:' + c[3], text: SIMB[metal] }, b);
    }
    var br = sv('g', { 'clip-path': 'url(#' + id + 'k)' }, f);
    sv('rect', { class: 'brilho', x: 0, y: 0, width: 16, height: 120, fill: '#ffffff', 'fill-opacity': 0.55, style: 'animation-delay:' + (idx || 0) * 0.9 + 's' }, br);
    if (metal === 'Ouro' || dia) [[24, 30, 0], [96, 34, 0.8], [90, 92, 1.6], [28, 86, 2.2]].forEach(function (s, i) {
      sv('path', { class: 'faisca', transform: 'translate(' + s[0] + ',' + s[1] + ') scale(' + (i % 2 ? 0.8 : 1.1) + ')', d: 'M0,-6 L1.4,-1.4 L6,0 L1.4,1.4 L0,6 L-1.4,1.4 L-6,0 L-1.4,-1.4 Z', fill: dia ? '#4cc0ec' : '#f2b315', style: 'animation-delay:' + (s[2] + (idx || 0) * 0.3) + 's' }, svg);
    });
    return svg;
  }

  // ---------- Gráfico de evolução (curvas suaves que passam pelos pontos) ----------
  function curva(pts) {
    if (pts.length < 2) return '';
    var n = pts.length, dx = [], m = [], t = [];
    for (var i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b; if (h > 9) { var s = 3 / Math.sqrt(h); t[i] = s * a * m[i]; t[i + 1] = s * b * m[i]; } }
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (i = 0; i < n - 1; i++) d += ' C' + (pts[i][0] + dx[i] / 3) + ' ' + (pts[i][1] + t[i] * dx[i] / 3) + ' ' + (pts[i + 1][0] - dx[i] / 3) + ' ' + (pts[i + 1][1] - t[i + 1] * dx[i] / 3) + ' ' + pts[i + 1][0] + ' ' + pts[i + 1][1];
    return d;
  }
  function grafico(sims) {
    var W = Math.round(Math.min(960, Math.max(300, app.clientWidth - 34))), H = W < 520 ? 230 : 270, ml = 44, mr = 16, mt = 14, mb = 40;
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Evolução do acerto por área' });
    var n = sims.length, X = function (i) { return n === 1 ? (ml + W - mr) / 2 : ml + 20 + i * (W - ml - mr - 40) / (n - 1); }, Y = function (v) { return mt + (1 - v) * (H - mt - mb); };
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { sv('line', { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), stroke: '#E7EAF0' }, svg); sv('text', { x: ml - 8, y: Y(v) + 4, 'text-anchor': 'end', style: 'font-size:11px;fill:#7A8799', text: (v * 100) + '%' }, svg); });
    sv('line', { x1: ml, x2: W - mr, y1: Y(META_ACERTO), y2: Y(META_ACERTO), stroke: '#9AA6B6', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }, svg);
    sv('text', { x: W - mr, y: Y(META_ACERTO) - 6, 'text-anchor': 'end', style: 'font-size:11px;fill:#7A8799', text: 'meta ' + Math.round(META_ACERTO * 100) + '%' }, svg);
    var passo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - ml - mr) / 90))));
    sims.forEach(function (s, i) { if (i % passo && i !== n - 1) return; var p = String(s.prova); sv('text', { x: X(i), y: H - 14, 'text-anchor': 'middle', style: 'font-size:11px;fill:#7A8799', text: p.length > 14 ? p.slice(0, 13) + '…' : p }, svg); });
    var defs = sv('defs', {}, svg);
    AREAS.forEach(function (a, k) {
      var pts = []; sims.forEach(function (s, i) { if (ok(s[a[0]])) pts.push([X(i), Y(s[a[0]] / (a[0] === 'R' ? 1000 : 45))]); });
      if (pts.length >= 2) {
        var gid = 'g' + k + Math.random().toString(36).slice(2, 6), g = sv('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        [[0, 0.07], [0.5, 0.02], [1, 0]].forEach(function (s) { sv('stop', { offset: s[0], style: 'stop-color:' + a[2] + ';stop-opacity:' + s[1] }, g); });
        sv('path', { d: curva(pts) + ' L' + pts[pts.length - 1][0] + ' ' + Y(0) + ' L' + pts[0][0] + ' ' + Y(0) + ' Z', fill: 'url(#' + gid + ')' }, svg);
        sv('path', { d: curva(pts), fill: 'none', stroke: a[2], 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
      }
      pts.forEach(function (p) { sv('circle', { cx: p[0], cy: p[1], r: 4.5, fill: '#fff', stroke: a[2], 'stroke-width': 2.5 }, svg); });
    });
    return svg;
  }

  // ---------- Montagem da página ----------
  function kpi(cor, fundo, iconePath, rotulo, valor, classe, nota) {
    var ic = sv('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: cor, 'stroke-width': 2 });
    iconePath.forEach(function (d) { sv('path', { d: d }, ic); });
    return el('div', { class: 'card kpi' }, [
      el('div', { class: 'kpi-top' }, [el('span', { class: 'ico', style: 'background:' + fundo }, [ic]), rotulo]),
      el('div', { class: 'kpi-valor ' + (classe || ''), text: valor }),
      el('div', { class: 'kpi-nota', text: nota })
    ]);
  }

  // opts.mentor: visão do mentor (textos na 3ª pessoa, atalhos para as planilhas); opts.raiz: onde desenhar
  function montar(d, opts) {
    opts = opts || {};
    var M = !!opts.mentor, raiz = opts.raiz || app;
    var r = calcular(d);
    if (!M) {
      document.getElementById('atualizado').textContent = d.atualizado ? 'Atualizado em ' + d.atualizado : '';
      app.innerHTML = '';
      raiz.appendChild(el('div', {}, [el('h1', { text: 'Olá, ' + d.primeiro + '!' }), el('p', { class: 'sub' }, [
        el('span', { text: d.curso ? 'Rumo a ' + d.curso : '' }), el('span', { text: d.mentor ? 'Mentor: ' + d.mentor : '' }), el('span', { text: d.desde ? 'Na mentoria desde ' + d.desde : '' })])]));
    } else if (!opts.semCabecalho) {
      var atalhos = el('div', { class: 'atalhos' });
      if (d.urlMentor) atalhos.appendChild(el('a', { class: 'atalho', href: d.urlMentor, target: '_blank', rel: 'noopener', text: 'Planilha do mentor ↗' }));
      if (d.urlAluno) atalhos.appendChild(el('a', { class: 'atalho', href: d.urlAluno, target: '_blank', rel: 'noopener', text: 'Rotina e caderno ↗' }));
      if (d.codigo) atalhos.appendChild(el('span', { class: 'atalho cod', text: 'Código do aluno: ' + d.codigo }));
      raiz.appendChild(el('div', {}, [el('h2', { class: 'nome-aluno', text: d.aluno }), el('p', { class: 'sub' }, [
        el('span', { text: d.curso ? 'Rumo a ' + d.curso : '' }), el('span', { text: d.desde ? 'Na mentoria desde ' + d.desde : '' }),
        opts.mostrarMentor ? el('span', { text: d.mentor ? 'Mentor: ' + d.mentor : 'Sem mentor' }) : null]), atalhos]));
    }

    // Cartões
    var a = r.acerto, aNota = a === null ? (M ? 'nenhum simulado lançado' : 'lance seu primeiro simulado') : (a >= META_ACERTO ? 'meta de 60% batida' : 'faltam ' + ((META_ACERTO - a) * 100).toFixed(1).replace('.', ',') + ' pts para a meta de 60%') + (r.areasUlt && r.areasUlt < 4 ? ' · ' + r.areasUlt + ' de 4 áreas lançadas' : '');
    var evNota = r.completos + (r.completos === 1 ? ' completo' : ' completos') + ' · ' + (r.evol === null ? 'a evolução aparece a partir do 2º completo' : (r.evol > 0 ? '+' : '') + r.evol.toFixed(1).replace('.', ',') + ' pts desde o 1º');
    raiz.appendChild(el('div', { class: 'grade4' }, [
      kpi('#5b5bd6', 'rgba(91,91,214,.12)', ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z'], 'Acerto nas objetivas', a === null ? '—' : pct(a), a === null ? '' : a >= META_ACERTO ? 'bom' : 'ruim', aNota),
      kpi('#5D6B7E', 'rgba(16,32,46,.07)', ['M9 6h11M9 12h11M9 18h11', 'M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2'], 'Simulados lançados', String(r.sims.length), '', evNota),
      kpi('#C2362F', 'rgba(194,54,47,.12)', ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'], 'Última redação', r.red === null ? '—' : String(r.red), r.red === null ? '' : r.red >= META_RED ? 'bom' : 'ruim', r.red === null ? 'nenhuma redação lançada' : 'meta ' + META_RED + (r.varRed === null ? '' : ' · ' + (r.varRed > 0 ? '+' : '') + r.varRed + ' desde a 1ª')),
      kpi('#1E8E5A', 'rgba(30,142,90,.12)', ['M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z', 'M9 8l6 6M15 8l-6 6'], 'Erros no caderno', String(d.erros.length), '', d.erros.length ? 'mais em ' + r.topMateria + (r.ult ? ' · ' + r.errosUlt + ' do último simulado' : '') : (M ? 'caderno de erros ainda vazio' : 'registre os erros de cada simulado'))
    ]));

    // Níveis
    raiz.appendChild(el('div', { class: 'sec', text: M ? 'Níveis por área' : 'Seus níveis por área' }));
    var trilha = el('ul', { class: 'trilha' });
    METAIS.forEach(function (m, k) { var ate = k < 4 ? CORTE_OBJ[k + 1] - 1 : 45; trilha.appendChild(el('li', {}, [selo(m, null, m, k), el('b', { text: m }), ' ' + CORTE_OBJ[k] + '–' + ate])); });
    var gradeNv = el('div', { class: 'niveis' });
    r.niveis.forEach(function (nv, i) {
      var txt = !nv.n ? 'nenhum simulado desta área ainda' : !nv.rumo ? 'nível máximo!' : nv.naFaixa + ' de ' + PRECISA + ' simulados com ' + nv.corte + '+ ' + (nv.redacao ? 'pontos' : 'acertos') + ' rumo ' + ARTIGO[nv.rumo] + ' ' + nv.rumo;
      gradeNv.appendChild(el('div', { class: 'card nv' }, [selo(nv.metal, nv.prog, nv.rumo || nv.metal, i), el('span', { class: 'nv-area', text: nv.area }), el('span', { class: 'nv-metal', style: 'color:' + TEXTO_METAL[nv.metal], text: nv.metal }), el('span', { class: 'nv-prog', text: txt })]));
    });
    raiz.appendChild(el('div', { class: 'card' }, [gradeNv, el('p', { class: 'nota', text: 'Cada metal é uma faixa de 9 acertos (na redação, 200 pontos). ' + (M ? 'O aluno sobe' : 'Você sobe') + ' quando atinge a faixa em 4 simulados, sem precisar ser seguidos, e o nível conquistado não cai. A porcentagem mostra o quanto falta: cada simulado conta pelo quanto chegou perto do próximo metal.' }), el('div', { style: 'margin-top:10px' }, [trilha])]));

    // Evolução
    raiz.appendChild(el('div', { class: 'sec', text: M ? 'Evolução' : 'Sua evolução' }));
    var leg = el('ul', { class: 'legenda' });
    AREAS.forEach(function (x) { leg.appendChild(el('li', {}, [el('span', { class: 'sw', style: 'background:' + x[2] }), x[1]])); });
    raiz.appendChild(el('div', { class: 'card graf' }, r.sims.length ? [grafico(r.sims), leg, el('p', { class: 'nota', text: 'Acerto em cada simulado: acertos ÷ 45 nas objetivas e nota ÷ 1000 na redação.' })] : [el('p', { class: 'vazio', text: M ? 'O gráfico aparece quando o aluno lançar o primeiro simulado.' : 'Seu gráfico aparece quando você lançar o primeiro simulado.' })]));

    // Onde focar
    raiz.appendChild(el('div', { class: 'sec', text: M ? 'Onde intervir' : 'Onde focar' }));
    var cont = [0, 0, 0, 0]; r.intervir.forEach(function (x) { cont[x.grupo]++; });
    var faixa = el('div', { class: 'faixa' }); cont.forEach(function (n, g) { if (n) faixa.appendChild(el('span', { style: 'flex:' + n + ';background:' + GRUPOS[g][1] })); });
    var foco = el('div', { class: 'card' }, [el('p', { class: 'nota', style: 'margin:0', text: 'Cada matéria entra pelo acerto da área dela no último simulado e pelos erros do ' + (M ? 'caderno do aluno.' : 'seu caderno.') }), faixa]);
    GRUPOS.forEach(function (gr, g) {
      var itens = r.intervir.filter(function (x) { return x.grupo === g; });
      var lista = el('div', { class: 'lista' });
      if (!itens.length) lista.appendChild(el('p', { class: 'vazio', text: 'Nenhuma matéria aqui.' }));
      itens.forEach(function (x) {
        var info = (x.acerto === null ? 'sem simulado da área' : pct(x.acerto) + ' no ' + x.prova) + ' · ' + x.erros + (x.erros === 1 ? ' erro' : ' erros') + ' no caderno';
        var box = el('div', { class: 'mat' }, [el('div', { class: 'mat-top' }, [el('span', { class: 'mat-nome', text: x.materia }), el('span', { class: 'mat-info', text: info })])]);
        if (x.acerto !== null) box.appendChild(el('div', { class: 'barra' }, [el('span', { style: 'width:' + Math.round(x.acerto * 100) + '%;background:' + gr[1] })]));
        if (x.partes.length) box.appendChild(el('div', { class: 'tags' }, x.partes.map(function (p) { return el('span', { class: 'tag', text: p }); })));
        if (x.motivo) box.appendChild(el('span', { class: 'nota', style: 'margin:0', text: 'Motivo mais comum: ' + x.motivo }));
        lista.appendChild(box);
      });
      var det = el('details', { class: 'grupo' }, [el('summary', {}, [el('span', { class: 'badge', style: 'background:' + gr[1] + (g === 3 ? ';color:#16202E' : ''), text: String(cont[g]) }), gr[0], el('span', { class: 'seta' })]), lista]);
      if (g === 0 && cont[0]) det.open = true;
      foco.appendChild(det);
    });
    raiz.appendChild(foco);

    // Caderno
    raiz.appendChild(el('div', { class: 'sec', text: M ? 'Por que erra' : 'Por que você erra' }));
    var cad = el('div', { class: 'card' });
    if (!r.motivos.length) cad.appendChild(el('p', { class: 'vazio', text: M ? 'Quando o aluno registrar erros no caderno, os motivos mais frequentes aparecem aqui.' : 'Quando você registrar erros no caderno, os motivos mais frequentes aparecem aqui.' }));
    var maxM = r.motivos.length ? r.motivos[0][1] : 1;
    r.motivos.slice(0, 6).forEach(function (m, i) { cad.appendChild(el('div', { class: 'motivo' }, [el('span', { text: m[0] }), el('div', { class: 'barra' }, [el('span', { style: 'width:' + Math.round(m[1] / maxM * 100) + '%;background:' + (i ? '#AAB3C0' : 'var(--azul)') })]), el('b', { text: String(m[1]) })])); });
    raiz.appendChild(cad);
    raiz.appendChild(el('p', { class: 'rodape', text: M ? 'Dados da planilha de mentoria e dos simulados lançados por este aluno. Você vê só os alunos cadastrados com você como mentor.' : 'Seus dados vêm da sua planilha de mentoria e dos simulados que você lançou. Dúvidas? Fale com seu mentor.' }));
  }


  return { montar: montar, el: el, sv: sv, norm: norm, pct: pct, ok: ok };
})();
