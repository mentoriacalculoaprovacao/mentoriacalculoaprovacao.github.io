// Regras das faixas e graus (painel.js), sem navegador. Rodar: node testes/teste_faixas.js
const fs=require('fs'),vm=require('vm');
const ctx={window:{},document:{createElementNS(){return{setAttribute(){},appendChild(){}}},createElement(){return{}},getElementById(){return null}},console};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../assets/painel.js','utf8'),ctx);
const nivel=ctx.Painel.nivel;let falhas=0;const ok=(c,m)=>{console.log((c?'OK   ':'FALHA')+' '+m);if(!c)falhas++;};
// simulados de 7 em 7 dias a partir de 01/09/2026
const sims=v=>v.map((x,i)=>{const d=new Date(Date.UTC(2026,11,1+7*i));return {ordem:i+1,data:('0'+d.getUTCDate()).slice(-2)+'/'+('0'+(d.getUTCMonth()+1)).slice(-2)+'/'+d.getUTCFullYear(),M:x};});
const n=v=>{const r=nivel(sims(v),'M','Matemática');return r.faixa.nome+' '+r.graus+'g';};
ok(n([30,30,30,30])==='Branca 4g','menos de 5 simulados: continua branca (graus no máximo)');
ok(n([22,22,22,22,22])==='Azul 1g','5 seguidos com 21+ conquistam a azul; 22 de média = 1 grau');
ok(n([22,22,22,22,22,30])==='Azul 2g','média sobe para 23,6: 2 graus (1 acerto inteiro = 1 grau)');
ok(n([22,22,22,22,22,30,30])==='Azul 4g','média 25,2: 4 graus');
ok(n([22,22,22,22,22,30,30,30,30,30])==='Roxa 4g','5 seguidos com 26+: roxa');
ok(n([22,22,22,22,22,30,30,30,30,24])==='Azul 4g','um simulado fraco no meio impede a roxa (4 graus da azul esperando)');
ok(n([22,22,22,22,25,25,22])==='Azul 2g','grau conquistado fica mesmo com a média caindo um pouco');
const r1=nivel(sims([27,27,27,27,27,23,24]),'M','x');
ok(r1.faixa.nome==='Roxa'&&r1.risco&&r1.risco.para.nome==='Azul','abaixo há 1 semana: segue roxa, com aviso de risco ('+(r1.risco&&r1.risco.para.nome)+')');
ok(n([27,27,27,27,27,23,24,23])==='Roxa 1g','abaixo há 2 semanas: ainda roxa');
ok(n([27,27,27,27,27,23,24,23,22])==='Azul 2g','abaixo por 3 semanas: desce para a azul; graus recomeçam pela média atual (23,8)');
ok(n([27,27,27,27,27,23,24,27,22,22])==='Roxa 1g','um simulado no nível no meio zera a contagem das 3 semanas');
ok(n([40,40,40,40,40])==='Preta 4g','preta: 37…40 = 4 graus');
ok(n([43,44,45,43,43])==='Vermelha 0g','vermelha com 43+ em 5 seguidos, sem graus');
ok(n([16,17,18,19,20])==='Branca 2g','branca: 18 de média = 2 graus');
const red=nivel(sims([900,920,940,960,980]).map(s=>({...s,R:s.M,M:null})),'R','Redação');
ok(red.faixa.nome==='Preta'&&red.seguidos===2,'redação: 900+ em 5 seguidos = preta; 2 seguidos com 960+ rumo à vermelha');
// simulados que já estavam no sistema (até 27/11/2026) definem a faixa de partida pela média
const antigos=v=>v.map((x,i)=>({ordem:i+1,data:'0'+(i+1)+'/10/2026',M:x}));
const n2=(a,b)=>{const r=nivel(antigos(a).concat(sims(b).map((s,i)=>({...s,ordem:a.length+i+1}))),'M','x');return r.faixa.nome+' '+r.graus+'g';};
ok(n2([29,41,40,38,10,42],[])==='Marrom 3g','antes das regras: média dos últimos 5 (34,2) = marrom, 3 graus');
ok(n2([38,40,20],[])==='Marrom 1g','antes das regras: menos de 5 simulados contam pela média (32,7)');
ok(n2([29,41,40,38,10,42],[20])==='Marrom 3g','depois: um simulado abaixo não derruba (precisa de 3 semanas)');
ok(n2([29,41,40,38,40,42],[40,40,40,40,40])==='Preta 4g','depois: 5 seguidos com 36+ conquistam a preta');
// base do ENEM: é a faixa de partida; simulados antigos não contam; subir pede 5 novos seguidos no nível
const nb=(base,a,b)=>{const r=nivel(antigos(a).concat(sims(b).map((s,i)=>({...s,ordem:a.length+i+1}))),'M','x',{M:base});return r.faixa.nome+' '+r.graus+'g'+(r.sims?'':' (só ENEM)');};
ok(nb(18,[38,40,39],[])==='Branca 2g (só ENEM)','ENEM 18: branca, 2 graus; simulados antigos não contam');
ok(nb(36,[],[])==='Preta 0g (só ENEM)','ENEM 36: preta');
ok(nb(18,[],[30,30,30,30])==='Branca 4g','4 simulados novos com 30: ainda branca (graus no máximo)');
ok(nb(18,[],[30,30,30,30,27])==='Roxa 3g','5 seguidos com 26+: roxa (média 29,4 = 3 graus)');
ok(nb(27,[],[20])==='Roxa 1g','ENEM 27 (roxa) e um simulado fraco: não cai');
const vazio=nivel([], 'L','x',{L:36});ok(vazio.n===1&&vazio.faixa.nome==='Preta','só com a base, sem simulados, já mostra a faixa');
console.log(falhas?falhas+' falha(s)':'TUDO OK');process.exit(falhas?1:0);
