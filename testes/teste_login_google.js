// Testa o login com Google (Google simulado): entrar, primeiro acesso com vinculação, aviso para quem entrou por código
// e o modo "código desligado". Rodar: node testes/teste_login_google.js
const {chromium}=require('playwright');
const SITE='file://'+require('path').resolve(__dirname,'..','index.html');
const GIS=`window.google={accounts:{id:{initialize:function(o){window.__gcb=o.callback;},renderButton:function(el){var b=document.createElement('button');b.textContent='Fazer login com o Google';b.className='gbtn';b.onclick=function(){window.__gcb({credential:window.__contaTeste||'CRED-CONHECIDA'});};el.appendChild(b);},disableAutoSelect:function(){}}}};`;
const aluno={aluno:'Aluna Exemplo',primeiro:'Aluna',curso:'Medicina',desde:'out de 2026',mentor:'Mentor Exemplo',simulados:[],erros:[],atualizado:'31/10/2026'};
function resp(req,cenario,log){
  log.push(req.acao+(req.credencial?':cred':'')+(req.codigo?':cod':'')+(req.sessao&&req.acao==='vincular'?':sess':''));
  if(req.acao==='config') return {ok:true,aceitaCodigo:cenario!=='semCodigo',google:true};
  if(req.acao==='entrar'){
    if(req.credencial==='CRED-CONHECIDA') return {ok:true,sessao:'S-G',quem:{nome:'Aluna Exemplo',via:'google',aluno:true}};
    if(req.credencial) return {ok:false,erro:'naoCadastrado',email:'nova@exemplo.com',podeVincular:cenario!=='semCodigo'};
    if(req.codigo) return cenario==='semCodigo'?{ok:false,erro:'codigoDesligado'}:{ok:true,sessao:'S-C',quem:{nome:'Aluna Exemplo',via:'codigo',aluno:true}};
  }
  if(req.acao==='vincular'){ if(req.codigo==='ERRA-DOOO') return {ok:false,erro:'codigo'}; return {ok:true,sessao:'S-V',vinculou:true,quem:{nome:'Aluna Exemplo',via:'google',aluno:true}}; }
  if(req.acao==='inicio'){ const via=req.sessao==='S-C'?'codigo':'google'; return {ok:true,papel:'aluno',quem:{nome:'Aluna Exemplo',via:via,aluno:true},atualizado:'31/10/2026',dados:aluno}; }
  return {ok:true};
}
(async()=>{const b=await chromium.launch();let falhas=0;const ok=(c,m)=>{console.log((c?'OK   ':'FALHA')+' '+m);if(!c)falhas++;};
 for(const cen of ['conhecida','primeiroAcesso','codigo','semCodigo']){
  const p=await b.newPage({viewport:{width:420,height:900}});const erros=[],log=[];
  p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/accounts.google.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:GIS}));
  await p.route('**/config.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:"window.CONFIG={API_URL:'https://script.google.com/macros/s/TESTE/exec',GOOGLE_CLIENT_ID:'teste.apps.googleusercontent.com'};"}));
  await p.route('**/script.google.com/**',async r=>{const req=JSON.parse(r.request().postData());r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resp(req,cen,log))});});
  await p.goto(SITE);await p.waitForTimeout(700);
  if(cen==='conhecida'){ await p.click('.gbtn');await p.waitForTimeout(600);ok((await p.textContent('h1')).includes('Olá, Aluna'),'conta conhecida entra direto');ok(!(await p.$('.aviso.vincular')),'sem aviso de vincular para quem entrou com Google'); await p.screenshot({path:__dirname+'/login_google.png'});}
  if(cen==='primeiroAcesso'){ await p.evaluate(()=>window.__contaTeste='CRED-NOVA');await p.click('.gbtn');await p.waitForTimeout(500);
    ok((await p.textContent('h1'))==='Primeiro acesso','conta nova cai no primeiro acesso');await p.screenshot({path:__dirname+'/primeiro_acesso.png'});
    await p.fill('input[aria-label="Código de acesso"]','ERRA-DOOO');await p.click('text=Vincular minha conta Google');await p.waitForTimeout(500);
    ok((await p.textContent('.erro')).includes('Código não encontrado'),'código errado avisa e continua na tela');
    await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Vincular minha conta Google');await p.waitForTimeout(700);
    ok((await p.textContent('h1')).includes('Olá, Aluna'),'vinculou e entrou');ok(log.includes('vincular:cred:cod'),'chamou vincular com credencial e código');}
  if(cen==='codigo'){ await p.click('summary');await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Entrar com o código');await p.waitForTimeout(700);
    ok(!!(await p.$('.aviso.vincular')),'quem entra por código vê o aviso para vincular');await p.screenshot({path:__dirname+'/aviso_vincular.png'});
    await p.click('.aviso.vincular .gbtn');await p.waitForTimeout(700);ok(log.includes('vincular:cred:sess'),'vincular pela sessão do código');ok(!(await p.$('.aviso.vincular')),'aviso some depois de vincular');}
  if(cen==='semCodigo'){ ok(!(await p.$('details.alternativa')),'sem opção de código quando desligado');await p.evaluate(()=>window.__contaTeste='CRED-NOVA');await p.click('.gbtn');await p.waitForTimeout(500);
    ok((await p.textContent('.erro')).includes('não está cadastrada'),'conta desconhecida recebe orientação');await p.screenshot({path:__dirname+'/sem_codigo.png'});}
  ok(erros.length===0,cen+': sem erros de JavaScript '+(erros.join(';')));
  await p.close();}
 await b.close();console.log(falhas?falhas+' falha(s)':'TUDO OK');process.exit(falhas?1:0);})();
