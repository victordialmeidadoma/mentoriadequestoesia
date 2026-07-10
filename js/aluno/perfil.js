// Depende de: config.js, auth.js (carregarSessao, usuarioAtual, perfilAtual, esconderLoading, logout)

// ===================== STATE =====================
function calcMeta(h){ return Math.round((h*60)/30); }
let horasSemanais = 20;
let direcionamentos = [];
let direcAtivoId = null;
let blocosExpandidos = new Set();
let editais = [];
let editalTopicosImportados = null;
let printsAluno = [];
let feedPrints = [];
let printIdCounter = 1;
let printsViewAtual = 'meus';
let printsFiltroMateria = 'todas';
let uploadPrintsArquivos = [];
let usuarioAtual = null;
let perfilAtual = null;

// ===================== EDITAL (parse CSV — mantido) =====================
function parseLinhaCSV(linha, delim){
  const out=[]; let cur=''; let dentroAspas=false;
  for(let i=0;i<linha.length;i++){
    const c=linha[i];
    if(c==='"'){dentroAspas=!dentroAspas;continue;}
    if(c===delim&&!dentroAspas){out.push(cur);cur='';continue;}
    cur+=c;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}
function parseEditalCSV(texto){
  const linhas=texto.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.trim());
  if(linhas.length===0) return [];
  const header=parseLinhaCSV(linhas[0],';').map(h=>h.toLowerCase());
  const start=header[0]==='materia'?1:0;
  const topicos=[];
  for(let i=start;i<linhas.length;i++){
    const cols=parseLinhaCSV(linhas[i],';');
    if(!cols[0]||!cols[1]) continue;
    topicos.push({materia:cols[0].trim(),assunto:cols[1].trim()});
  }
  return topicos;
}

let modalBlocoId = null;
let mentorAlunoIdx = null;

// ===================== HELPERS =====================
function statusLabel(s){ return s==='feito'?'Feito':s==='planejado'?'Pré-agendado':s==='andamento'?'Em andamento':'Pendente'; }

function pctOf(direc){
  const feitos = (direc.blocos||[]).filter(b=>b.etapa===4).length;
  return Math.min(100, Math.round((feitos/(direc.meta_blocos||1))*100));
}

function loading(id, msg='Carregando...'){
  const el = document.getElementById(id);
  if(el) el.innerHTML = `<div class="empty">${msg}</div>`;
}

// ===================== CARREGA PERFIL DO SUPABASE =====================
async function carregarPerfil(){
  const { data: perfil, error } = await _supabase
    .from('perfis')
    .select('*')
    .eq('id', usuarioAtual.id)
    .single();
  if(error || !perfil) return;
  perfilAtual = perfil;
  horasSemanais = perfil.horas_semanais || 20;
  renderPerfil();
}

function renderPerfil(){
  if(!perfilAtual) return;
  const nome = perfilAtual.nome || usuarioAtual.email;
  const iniciais = nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  // hero
  const avatarEl = document.querySelector('.profile-hero .avatar') || document.querySelector('.avatar');
  if(avatarEl) avatarEl.textContent = iniciais;
  const nomeHero = document.querySelector('.profile-hero .nome');
  if(nomeHero) nomeHero.textContent = nome;
  const focoHero = document.querySelector('.profile-hero .foco');
  if(focoHero) focoHero.textContent = perfilAtual.carreiras?.length ? 'Foco: '+perfilAtual.carreiras.join(', ') : '';
  // ids do card de informações
  const nomeEl = document.getElementById('perfilNome');
  const focoEl = document.getElementById('perfilFoco');
  const nomeInfoEl = document.getElementById('perfilNomeInfo');
  const inicioEl = document.getElementById('perfilInicio');
  if(nomeEl) nomeEl.textContent = nome;
  if(focoEl) focoEl.textContent = perfilAtual.carreiras?.length ? 'Foco: '+perfilAtual.carreiras.join(', ') : '';
  if(nomeInfoEl) nomeInfoEl.textContent = nome;
  if(inicioEl) inicioEl.textContent = perfilAtual.created_at
    ? new Date(perfilAtual.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})
    : '—';
  // stats
  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;
  const atual = direcionamentos.find(d=>d.status==='atual');
  document.getElementById('pPct').innerHTML = atual ? pctOf(atual)+'<span class="unit">%</span>' : '—';
  const todosFeitos = direcionamentos.flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  document.getElementById('pTotalBlocos').textContent = todosFeitos.length;
  const media = todosFeitos.length ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById('pAprov').innerHTML = todosFeitos.length ? media+'<span class="unit">%</span>' : '—';
}

async function init(){
  const ok = await carregarSessao("aluno"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  // Carrega estatísticas
  const {data:dirs} = await _supabase.from("direcionamentos").select("*,blocos(*)").eq("aluno_id",usuarioAtual.id);
  const atual = (dirs||[]).find(d=>d.status==="atual");
  const todosFeitos = (dirs||[]).flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  const pct = atual ? Math.min(100,Math.round((todosFeitos.filter(b=>dirs.find(d=>d.id===atual.id)?.blocos?.some(bb=>bb.id===b.id)).length/(atual.meta_blocos||1))*100)) : 0;
  document.getElementById("pPct").innerHTML = pct+'<span class="unit">%</span>';
  document.getElementById("pTotalBlocos").textContent = todosFeitos.length;
  const aprov = todosFeitos.length ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById("pAprov").innerHTML = todosFeitos.length ? aprov+'<span class="unit">%</span>' : "—";
  // Perfil
  document.getElementById("perfilAvatar").textContent = (perfilAtual.nome||"?").split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase();
  document.getElementById("perfilNome").textContent = perfilAtual.nome||usuarioAtual.email;
  document.getElementById("perfilFoco").textContent = perfilAtual.carreiras?.length ? "Foco: "+perfilAtual.carreiras.join(", ") : "";
  document.getElementById("infoNome").textContent = perfilAtual.nome||"—";
  document.getElementById("infoCarreiras").textContent = (perfilAtual.carreiras||[]).join(", ")||"—";
  document.getElementById("infoInicio").textContent = perfilAtual.created_at ? new Date(perfilAtual.created_at).toLocaleDateString("pt-BR",{month:"short",year:"numeric"}) : "—";
  esconderLoading();
  document.getElementById("appShell").style.display="block";
}
init();
