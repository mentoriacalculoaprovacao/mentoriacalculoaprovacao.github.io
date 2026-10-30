const {chromium}=require('playwright');
const SITE='file://'+require('path').resolve(__dirname,'..','index.html');
function sims(base){const o=[];for(let k=0;k<5;k++)o.push({prova:'Simulado '+(k+1),data:'0'+(k+1)+'/10/2026',ordem:k+1,L:base+k*2,H:base-3+k*2,N:base-6+k*3,M:base-8+k*2,R:600+k*60});return o;}
const diag={'Respondido em':'20/10/2026','Aluno':'Aluna Exemplo Um','Prontidão (0–100)':'62','Nível':'Intermediário','Alertas':'• Menor de idade — responsável: Ana\n• Pouca disponibilidade (6 turnos livres)\n• Relata insegurança/pressão','Foco sugerido (1ª conversa)':'• Priorizar Matemática, Física\n• Montar cronograma semanal: cada bloco com teoria + questões do mesmo assunto','Curso desejado':'Medicina','Instituições prioritárias':'Universidade A, Universidade B','Áreas de dificuldade':'Matemática, Física','Descanso e sono':'Durmo 6h','Contato':'(00) 00000-0000','Responsável legal':'Responsável Exemplo','Idade':'17','Metas 30/60/90 dias':'Fazer 3 simulados'};
const lista=[{id:'A1',aluno:'Aluna Exemplo Dois',mentor:'Mentora Exemplo',nSims:2,novo:false},{id:'A2',aluno:'Aluna Exemplo Um',mentor:'Mentor Exemplo',nSims:0,novo:false},{id:'A3',aluno:'Aluno Exemplo Três',mentor:'',nSims:0,novo:true},{id:'P:xyz',aluno:'Aluna Exemplo Quatro',mentor:'',nSims:0,novo:true,semPlanilha:true},{id:'A5',aluno:'Aluna Exemplo Cinco',mentor:'Mentor Exemplo',nSims:5}];
function resposta(req,papel){
  if(req.acao==='entrar') return req.codigo==='ERRA-DOOO'?{ok:false,erro:'codigo'}:{ok:true,sessao:'S1',quem:{nome:'Mentor Exemplo'}};
  if(req.acao==='inicio'){
    if(papel==='aluno') return {ok:true,papel:'aluno',quem:{nome:'Aluna Exemplo Cinco',aluno:true},atualizado:'30/10/2026 18:00',dados:{aluno:'Aluna Exemplo Cinco',primeiro:'Aluna',curso:'Medicina',desde:'out de 2026',mentor:'Mentor Exemplo',simulados:sims(28),erros:[],atualizado:'30/10/2026 18:00'}};
    if(papel==='mentor') return {ok:true,papel:'mentor',quem:{nome:'Mentor Exemplo',mentor:true},atualizado:'30/10/2026 18:00',alunos:lista.filter(x=>x.mentor==='Mentor Exemplo'),mentores:[],meuMentor:'Mentor Exemplo'};
    return {ok:true,papel:'gestor',quem:{nome:'Mentor Exemplo',email:'gestor@exemplo.com',gestor:true,mentor:true},atualizado:'30/10/2026 18:00',alunos:lista,mentores:[{nome:'Mentor Exemplo',email:'mentor@exemplo.com'},{nome:'Mentora Exemplo',email:'mentora@exemplo.com'}],meuMentor:'Mentor Exemplo'};
  }
  if(req.acao==='aluno'){ const l=lista.find(x=>x.id===req.id);
    if(l.semPlanilha) return {ok:true,aluno:{id:l.id,aluno:l.aluno,semPlanilha:true,mentor:'',simulados:[],erros:[],diagnostico:diag}};
    return {ok:true,aluno:{id:l.id,aluno:l.aluno,primeiro:l.aluno.split(' ')[0],curso:'Medicina',desde:'out de 2026',mentor:l.mentor,emailMentor:'',simulados:l.nSims?sims(22):[],erros:[{simulado:'Simulado 5',materia:'Química',parte:'Estequiometria',motivo:'Erro de cálculo'}],codigo:'AB12-CD34',urlAluno:'https://docs.google.com/a',urlMentor:'https://docs.google.com/m',diagnostico:diag}}; }
  if(req.acao==='atribuirMentor') return {ok:true};
  return {ok:true};
}
(async()=>{const b=await chromium.launch();
 for(const [papel,w,h] of [['gestor',1100,1500],['mentor',390,1400],['aluno',1100,900]]){
  const p=await b.newPage({viewport:{width:w,height:h}});const erros=[];const reqs=[];
  p.on('pageerror',e=>erros.push(e.message));p.on('console',m=>{if(m.type()==='error')erros.push(m.text())});
  await p.route('**/accounts.google.com/**',r=>r.abort());
  await p.route('**/script.google.com/**',async r=>{const req=JSON.parse(r.request().postData());reqs.push(req.acao);await new Promise(x=>setTimeout(x,80));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resposta(req,papel))});});
  await p.goto(SITE);await p.waitForTimeout(400);
  if(papel==='gestor'){await p.screenshot({path:__dirname+'/login.png'});
    await p.fill('input[aria-label="Código de acesso"]','ERRA-DOOO');await p.click('text=Entrar com o código');await p.waitForTimeout(400);
    const msg=await p.textContent('.erro');console.log('erro codigo:',msg);}
  await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Entrar com o código');await p.waitForTimeout(900);
  await p.screenshot({path:__dirname+'/'+papel+'_1.png'});
  if(papel!=='aluno'){
    const ops=await p.$$eval('select[aria-label="Escolher aluno"] option',o=>o.map(x=>x.textContent));console.log(papel,'opções',ops);
    if(papel==='gestor'){ const chips=await p.$$eval('.chip',c=>c.map(x=>x.textContent));console.log('chips',chips);
      await p.click('.chip:has-text("Sem mentor")');await p.waitForTimeout(400);
      console.log('sem mentor:',await p.$$eval('select[aria-label="Escolher aluno"] option',o=>o.map(x=>x.textContent)));
      await p.screenshot({path:__dirname+'/gestor_sem.png'});
      await p.click('.chip:has-text("Todos")');await p.selectOption('select[aria-label="Escolher aluno"]','A2');await p.waitForTimeout(400);
    }
    await p.click('button.aba:has-text("Diagnóstico")');await p.waitForTimeout(300);
    await p.screenshot({path:__dirname+'/'+papel+'_diag.png',fullPage:true});
    if(papel==='gestor'){ await p.selectOption('select[aria-label="Mentor responsável"]','1');await p.click('.atribuir button');await p.waitForTimeout(500);
      console.log('toast:',await p.textContent('.toast').catch(()=>null)); console.log('nome atual', await p.textContent('.nome-aluno'));
      const chips=await p.$$eval('.chip',c=>c.map(x=>x.textContent));console.log('chips depois',chips);}
  }
  console.log(papel,'reqs',reqs,'erros',erros);
  await p.close();}
 await b.close();})();
