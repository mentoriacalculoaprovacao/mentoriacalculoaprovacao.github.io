// Painel visual do aluno: cálculos (faixas, onde intervir) e desenho (faixas, gráfico, cartões).
// Usado pelo app.js nas três visões (aluno, mentor e gestor). Não faz chamadas ao servidor.

window.Painel = (function () {
  var META_ACERTO = 0.6, META_RED = 900;
  var AREAS = [['L', 'Linguagens', '#2F6FDE'], ['H', 'Ciências Humanas', '#E07B39'], ['N', 'Ciências da Natureza', '#1E9E6A'], ['M', 'Matemática', '#8E5BD6'], ['R', 'Redação', '#D6457A']];
  // Faixas por área: média de acertos dos últimos 5 simulados que têm a área. Sobe e desce com o momento do aluno.
  // Objetivas: branca até 20 · azul 21–25 · roxa 26–30 · marrom 31–35 · preta 36–45.
  // Redação: mesma proporção sobre 1000 (21/45, 26/45, 31/45 e 36/45), arredondada para a escala de 40 em 40 pontos.
  var JANELA = 5;
  var FAIXAS = [
    { nome: 'Branca', cor: '#F6F6F2', borda: '#B9C1CC', ponta: '#202226', texto: '#6B7480', costura: 'rgba(16,32,46,.14)' },
    { nome: 'Azul', cor: '#2F6BDE', borda: '#1F52B5', ponta: '#202226', texto: '#2F6BDE', costura: 'rgba(255,255,255,.35)' },
    { nome: 'Roxa', cor: '#7E3BC9', borda: '#6129A6', ponta: '#202226', texto: '#7E3BC9', costura: 'rgba(255,255,255,.35)' },
    { nome: 'Marrom', cor: '#7B4A2B', borda: '#5C351E', ponta: '#202226', texto: '#7B4A2B', costura: 'rgba(255,255,255,.3)' },
    { nome: 'Preta', cor: '#24262B', borda: '#0F1013', ponta: '#D62828', texto: '#24262B', costura: 'rgba(255,255,255,.22)' }
  ];
  var MIN_OBJ = [0, 21, 26, 31, 36], MIN_RED = [0, 480, 600, 720, 800], BASE_OBJ = 15, BASE_RED = 320;
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
    var c = {};
    d.erros.forEach(function (e) { var k = cap(e.materia); if (k) c[k] = (c[k] || 0) + 1; });
    r.topMateria = topo(c);
    r.temas = temas(d.erros);
    r.errosUlt = ult ? d.erros.filter(function (e) { return norm(e.simulado) === norm(ult.prova); }).length : 0;
    r.niveis = AREAS.map(function (a) { return nivel(sims, a[0], a[1]); });
    r.intervir = intervir(sims, d.erros);
    return r;
  }
  function cap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function topo(c) { var k = Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }); return k.length ? k[0] : null; }

  // Temas do caderno de erros como "Matéria – Tema", juntando grafias parecidas (acentos, maiúsculas); fica a grafia mais usada
  function temas(erros) {
    var g = {};
    erros.forEach(function (e) {
      var mat = cap(e.materia), t = String(e.parte || '').replace(/\s+/g, ' ').trim();
      if (!mat || !t) return;
      var k = norm(mat) + '|' + norm(t), x = g[k] = g[k] || { materia: mat, n: 0, grafias: {} };
      x.n++; x.grafias[t] = (x.grafias[t] || 0) + 1;
    });
    return Object.keys(g).map(function (k) { var x = g[k], t = topo(x.grafias); return { materia: x.materia, tema: t, rotulo: x.materia + ' – ' + t, n: x.n }; })
      .sort(function (a, b) { return b.n - a.n || a.rotulo.localeCompare(b.rotulo, 'pt-BR'); });
  }

  function indiceFaixa(v, mins) { var f = 0; mins.forEach(function (m, i) { if (v >= m - 1e-9) f = i; }); return f; }
  function media(l) { return l.reduce(function (t, x) { return t + x; }, 0) / l.length; }
  function nivel(sims, k, nome) {
    var red = k === 'R', mins = red ? MIN_RED : MIN_OBJ;
    var vals = sims.filter(function (s) { return ok(s[k]); }).map(function (s) { return Number(s[k]); });
    if (!vals.length) return { area: nome, n: 0, redacao: red };
    var janela = vals.slice(-JANELA), m = media(janela), i = indiceFaixa(m, mins), prox = i < FAIXAS.length - 1 ? i + 1 : null;
    var base = i === 0 ? (red ? BASE_RED : BASE_OBJ) : mins[i];
    var prog = prox === null ? 1 : Math.max(0, Math.min(1, (m - base) / (mins[prox] - base)));
    // Comparação com a média de antes do último simulado: mostra se subiu ou desceu de faixa
    var antes = vals.length >= 2 ? indiceFaixa(media(vals.slice(0, -1).slice(-JANELA)), mins) : i;
    return { area: nome, n: janela.length, total: vals.length, media: m, idx: i, faixa: FAIXAS[i], prox: prox === null ? null : FAIXAS[prox],
      falta: prox === null ? 0 : mins[prox] - m, prog: prog, mudou: i - antes, de: FAIXAS[antes], redacao: red };
  }

  function intervir(sims, erros) {
    var total = erros.length;
    return ITENS.map(function (it) {
      var k = it[1], com = sims.filter(function (s) { return ok(s[k]); }), s = com[com.length - 1];
      var ac = s ? s[k] / (k === 'R' ? 1000 : 45) : null;
      var meus = erros.filter(function (e) { return norm(e.materia) === norm(it[0]); });
      var mot = {};
      meus.forEach(function (e) { if (e.motivo) mot[e.motivo] = (mot[e.motivo] || 0) + 1; });
      var g = 3;
      if (ac !== null) {
        var b = k === 'R' ? 0.6 : 0.5, a = k === 'R' ? 0.8 : 0.75;
        g = ac < b ? 0 : ac < a ? 1 : 2;
        if (meus.length >= 3 && meus.length / Math.max(1, total) >= 0.2) g = Math.max(0, g - 1);
      }
      return { materia: it[0], area: AREAS.filter(function (x) { return x[0] === k; })[0][1], grupo: g, acerto: ac, prova: s ? s.prova : null, erros: meus.length,
        temas: temas(meus).slice(0, 4), motivo: topo(mot) };
    });
  }

  // ---------- Desenho: faixa amarrada (nó e duas pontas; a ponta é preta, e vermelha na faixa preta) ----------
  function faixaSvg(f, pequena) {
    var svg = sv('svg', { viewBox: '0 0 140 92', role: 'img', 'aria-label': 'Faixa ' + f.nome.toLowerCase(), class: pequena ? 'faixa-mini' : 'faixa-svg' });
    var lerp = function (p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
    var ponta = function (A, B, C, D) {
      sv('polygon', { points: [A, B, C, D].map(function (p) { return p.join(','); }).join(' '), fill: f.cor, stroke: f.borda, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, svg);
      var t1 = 0.58, t2 = 0.8;
      sv('polygon', { points: [lerp(A, D, t1), lerp(B, C, t1), lerp(B, C, t2), lerp(A, D, t2)].map(function (p) { return p.join(','); }).join(' '), fill: f.ponta }, svg);
    };
    ponta([60, 40], [71, 40], [55, 86], [42, 83]);
    ponta([70, 40], [81, 40], [99, 83], [86, 86]);
    sv('rect', { x: 5, y: 22, width: 130, height: 19, rx: 4, fill: f.cor, stroke: f.borda, 'stroke-width': 1.4 }, svg);
    sv('line', { x1: 11, x2: 129, y1: 27, y2: 27, stroke: f.costura, 'stroke-width': 1, 'stroke-dasharray': '3 2.5' }, svg);
    sv('line', { x1: 11, x2: 129, y1: 36, y2: 36, stroke: f.costura, 'stroke-width': 1, 'stroke-dasharray': '3 2.5' }, svg);
    sv('rect', { x: 5, y: 22, width: 130, height: 8, rx: 4, fill: '#fff', 'fill-opacity': 0.13 }, svg);
    sv('rect', { x: 56, y: 15, width: 29, height: 32, rx: 6, fill: f.cor, stroke: f.borda, 'stroke-width': 1.4 }, svg);
    sv('path', { d: 'M60 20 L81 42', stroke: f.borda, 'stroke-width': 1.3, 'stroke-opacity': 0.55 }, svg);
    sv('rect', { x: 56, y: 15, width: 29, height: 12, rx: 6, fill: '#fff', 'fill-opacity': 0.12 }, svg);
    return svg;
  }
  function num(v, red) { return red ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',').replace(',0', ''); }

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
      if (raiz === app) app.innerHTML = '';
      if (!opts.semCabecalho) raiz.appendChild(cabecalhoAluno(d));
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
      kpi('#1E8E5A', 'rgba(30,142,90,.12)', ['M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z', 'M9 8l6 6M15 8l-6 6'], 'Erros no caderno', String(d.erros.length), '', d.erros.length ? 'mais em ' + (r.temas.length ? r.temas[0].rotulo : r.topMateria) + (r.ult ? ' · ' + r.errosUlt + ' do último simulado' : '') : (M ? 'caderno de erros ainda vazio' : 'registre os erros de cada simulado'))
    ]));

    // Faixas
    raiz.appendChild(el('div', { class: 'sec', text: M ? 'Faixas por área' : 'Suas faixas por área' }));
    var gradeNv = el('div', { class: 'niveis' });
    r.niveis.forEach(function (nv) {
      if (!nv.n) { gradeNv.appendChild(el('div', { class: 'card nv vazio-nv' }, [faixaSvg(FAIXAS[0]), el('span', { class: 'nv-area', text: nv.area }), el('span', { class: 'nv-metal', style: 'color:#9AA4B2', text: 'Sem faixa' }), el('span', { class: 'nv-prog', text: 'nenhum simulado desta área ainda' })])); return; }
      var un = nv.redacao ? 'pontos' : 'acertos';
      var med = 'média ' + num(nv.media, nv.redacao) + (nv.n === 1 ? ' no último simulado' : ' nos últimos ' + nv.n);
      var barra = nv.prox ? el('div', { class: 'nv-barra', title: Math.round(nv.prog * 100) + '% do caminho até a faixa ' + nv.prox.nome.toLowerCase() }, [el('span', { style: 'width:' + Math.round(nv.prog * 100) + '%;background:' + nv.prox.cor + (nv.prox.nome === 'Branca' ? ';box-shadow:inset 0 0 0 1px #B9C1CC' : '') })]) : null;
      var falta = nv.prox ? 'faltam ' + num(nv.falta, nv.redacao) + ' ' + un + ' de média para a ' + nv.prox.nome.toLowerCase() : 'faixa máxima!';
      var mudou = nv.mudou > 0 ? el('span', { class: 'nv-mudou sobe', text: '↑ subiu da ' + nv.de.nome.toLowerCase() }) : nv.mudou < 0 ? el('span', { class: 'nv-mudou desce', text: '↓ desceu da ' + nv.de.nome.toLowerCase() }) : null;
      gradeNv.appendChild(el('div', { class: 'card nv' }, [faixaSvg(nv.faixa), el('span', { class: 'nv-area', text: nv.area }),
        el('span', { class: 'nv-metal', style: 'color:' + nv.faixa.texto, text: 'Faixa ' + nv.faixa.nome.toLowerCase() }), mudou,
        el('span', { class: 'nv-prog', text: med }), barra, el('span', { class: 'nv-prog', text: falta })]));
    });
    var trilha = el('ul', { class: 'trilha' });
    FAIXAS.forEach(function (f, k) { var ate = k < 4 ? MIN_OBJ[k + 1] - 1 : 45; trilha.appendChild(el('li', {}, [faixaSvg(f, true), el('b', { text: f.nome }), ' ' + (k ? MIN_OBJ[k] + '–' + ate : 'até ' + ate)])); });
    raiz.appendChild(el('div', { class: 'card' }, [gradeNv, el('p', { class: 'nota', text: 'A faixa é a média de acertos ' + (M ? 'do aluno' : 'dos seus') + ' nos últimos 5 simulados de cada área: ela sobe e desce com o momento ' + (M ? 'dele' : 'em que você está') + '. Na redação, a mesma proporção sobre 1000 (azul a partir de 480, roxa 600, marrom 720, preta 800).' }), el('div', { style: 'margin-top:10px' }, [trilha])]));

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
        var info = (x.acerto === null ? 'sem simulado da área' : pct(x.acerto) + ' no ' + x.prova) + ' · ' + x.erros + (x.erros === 1 ? ' erro' : ' erros') + ' no caderno' +
          (x.temas.length && x.temas[0].n < x.erros ? ' (' + x.temas[0].n + ' neste tema)' : '');
        // Título com o tema que mais aparece no caderno ("Física – Eletrodinâmica"); os outros temas vêm logo abaixo
        var box = el('div', { class: 'mat' }, [el('div', { class: 'mat-top' }, [el('span', { class: 'mat-nome', text: x.temas.length ? x.temas[0].rotulo : x.materia }), el('span', { class: 'mat-info', text: info })])]);
        if (x.acerto !== null) box.appendChild(el('div', { class: 'barra' }, [el('span', { style: 'width:' + Math.round(x.acerto * 100) + '%;background:' + gr[1] })]));
        if (x.temas.length > 1) box.appendChild(el('div', { class: 'tags' }, x.temas.slice(1).map(function (t) { return el('span', { class: 'tag', text: t.rotulo + ' · ' + t.n + (t.n === 1 ? ' erro' : ' erros') }); })));
        if (x.motivo) box.appendChild(el('span', { class: 'nota', style: 'margin:0', text: 'Motivo mais comum: ' + x.motivo }));
        lista.appendChild(box);
      });
      var det = el('details', { class: 'grupo' }, [el('summary', {}, [el('span', { class: 'badge', style: 'background:' + gr[1] + (g === 3 ? ';color:#16202E' : ''), text: String(cont[g]) }), gr[0], el('span', { class: 'seta' })]), lista]);
      if (g === 0 && cont[0]) det.open = true;
      foco.appendChild(det);
    });
    raiz.appendChild(foco);

    // Caderno: temas com mais erros
    raiz.appendChild(el('div', { class: 'sec', text: 'Temas com mais erros' }));
    var cad = el('div', { class: 'card' });
    if (!r.temas.length) cad.appendChild(el('p', { class: 'vazio', text: M ? 'Quando o aluno registrar erros no caderno, os temas em que ele mais erra aparecem aqui.' : 'Quando você registrar erros no caderno, os temas em que você mais erra aparecem aqui.' }));
    var maxT = r.temas.length ? r.temas[0].n : 1;
    r.temas.slice(0, 8).forEach(function (t, i) { cad.appendChild(el('div', { class: 'motivo' }, [el('span', { text: t.rotulo }), el('div', { class: 'barra' }, [el('span', { style: 'width:' + Math.round(t.n / maxT * 100) + '%;background:' + (i ? '#AAB3C0' : 'var(--azul)') })]), el('b', { text: String(t.n) })])); });
    if (r.temas.length > 8) cad.appendChild(el('p', { class: 'nota', style: 'margin:8px 0 0', text: 'Mais ' + (r.temas.length - 8) + (r.temas.length - 8 === 1 ? ' tema' : ' temas') + ' no caderno de erros.' }));
    raiz.appendChild(cad);
    raiz.appendChild(el('p', { class: 'rodape', text: M ? 'Dados da planilha de mentoria e dos simulados lançados por este aluno. Você vê só os alunos cadastrados com você como mentor.' : 'Seus dados vêm da sua planilha de mentoria e dos simulados que você lançou. Dúvidas? Fale com seu mentor.' }));
  }


  function cabecalhoAluno(d) {
    return el('div', {}, [el('h1', { text: 'Olá, ' + d.primeiro + '!' }), el('p', { class: 'sub' }, [
      el('span', { text: d.curso ? 'Rumo a ' + d.curso : '' }), el('span', { text: d.mentor ? 'Mentor: ' + d.mentor : '' }), el('span', { text: d.desde ? 'Na mentoria desde ' + d.desde : '' })])]);
  }

  return { montar: montar, cabecalhoAluno: cabecalhoAluno, el: el, sv: sv, norm: norm, pct: pct, ok: ok };
})();
