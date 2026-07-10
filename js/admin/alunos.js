// Depende de: config.js, auth.js

// ===================== STATE =====================
let usuarioAtual = null;
let alunosMentor = [];
let mentorAlunoIdx = null;
let mDirecAlunoIdx = null;
let mDirecExpandido = null;
let editais = [];
let editalTopicosImportados = null;
let vincularEditalId = null;
let freqEditalId = null, freqAlunoIdx = null;

// ===================== EDITAL CSV parse =====================
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
  if(!linhas.length) return [];
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

// ===================== HELPERS =====================
function statusLabel(s){ return s==='feito'?'Feito':s==='planejado'?'Pré-agendado':'Pendente'; }

// ===================== NAV MENTOR =====================
document.querySelectorAll('#navMentor button[data-mtab]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#navMentor button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('#mainMentor > section').forEach(s=>s.style.display='none');
    document.getElementById('mtab-'+btn.dataset.mtab).style.display='block';
    if(btn.dataset.mtab==='direcionamentos') renderMDirecAlunoList();
    if(btn.dataset.mtab==='edital') carregarEditalListMentor();
  });
});

// ===================== ABA ALUNOS =====================
async function carregarAlunos(){
  const { data, error } = await _supabase
    .from('perfis')
    .select('*, direcionamentos(*, blocos(*))')
    .eq('role','aluno')
    .order('nome');
  if(error){ console.error(error); return; }
  alunosMentor = data||[];
  renderMentor();
}

function renderMentor(){
  document.getElementById('mTotalAlunos').textContent = alunosMentor.length;
  const totalBlocos = alunosMentor.reduce((s,a)=>{
    const dir = (a.direcionamentos||[]).find(d=>d.status==='atual');
    return s + (dir?.blocos||[]).filter(b=>b.etapa===4).length;
  },0);
  document.getElementById('mTotalBlocos').textContent = totalBlocos;
  const alunosComBlocos = alunosMentor.filter(a=>{
    const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
    return (dir?.blocos||[]).some(b=>b.etapa===4);
  });
  const mediaGeral = alunosComBlocos.length
    ? Math.round(alunosComBlocos.reduce((s,a)=>{
        const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
        const feitos=(dir?.blocos||[]).filter(b=>b.etapa===4);
        return s+(feitos.length?feitos.reduce((x,b)=>x+(b.acertos||0),0)/feitos.length*10:0);
      },0)/alunosComBlocos.length)
    : 0;
  document.getElementById('mAproveitamentoGeral').innerHTML = mediaGeral+'<span class="unit">%</span>';

  const list = document.getElementById('alunoListMentor');
  list.innerHTML='';
  if(!alunosMentor.length){
    list.innerHTML=`<div class="empty"><span class="display">Nenhum aluno ainda</span>Convide alunos via Supabase Auth e defina role = 'aluno' na tabela perfis.</div>`;
    return;
  }
  alunosMentor.forEach((a,idx)=>{
    const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
    const feitos=(dir?.blocos||[]).filter(b=>b.etapa===4).length;
    const meta=dir?.meta_blocos||0;
    const pct=meta?Math.min(100,Math.round((feitos/meta)*100)):0;
    const div=document.createElement('div');
    div.className='aluno-pill';
    div.innerHTML=`
      <div>
        <div class="nome">${a.nome}</div>
        <div class="foco">${(a.carreiras||[]).join(', ')||'—'} · ${feitos}/${meta} blocos</div>
      </div>
      <div class="pct">${pct}%</div>`;
    div.onclick=()=>showDetalheAluno(idx);
    list.appendChild(div);
  });
}

function showDetalheAluno(idx){
  mentorAlunoIdx=idx;
  const a=alunosMentor[idx];
  document.getElementById('detalheAlunoMentor').style.display='block';
  document.getElementById('detalheNome').textContent=a.nome;
  const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
  const feitos=(dir?.blocos||[]).filter(b=>b.etapa===4);
  const meta=dir?.meta_blocos||0;
  const pct=meta?Math.min(100,Math.round((feitos.length/meta)*100)):0;
  const aprov=feitos.length?Math.round(feitos.reduce((s,b)=>s+(b.acertos||0),0)/feitos.length*10):0;
  document.getElementById('dPct').innerHTML=pct+'<span class="unit">%</span>';
  document.getElementById('dBlocosFeitos').innerHTML=`${feitos.length}<span class="unit">/ ${meta}</span>`;
  document.getElementById('dAproveitamento').innerHTML=aprov+'<span class="unit">%</span>';
  renderDetalheBlocoList();
  document.getElementById('detalheAlunoMentor').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderDetalheBlocoList(){
  const a=alunosMentor[mentorAlunoIdx];
  const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
  const list=document.getElementById('detalheBlocoList');
  list.innerHTML='';
  if(!(dir?.blocos||[]).length){
    list.innerHTML=`<div class="empty">Nenhum bloco importado ainda.</div>`;
    return;
  }
  dir.blocos.forEach(b=>{
    const div=document.createElement('div');
    div.className='bloco';
    div.innerHTML=`
      <div class="bloco-header" style="cursor:default;">
        <div class="bloco-codigo">Bloco ${b.codigo}</div>
        <div class="bloco-info">
          <div class="nome">${b.disciplina}</div>
          <div class="meta">10 questões</div>
        </div>
        ${b.acertos!==null&&b.etapa===4?`<div class="acertos-circle">${b.acertos}<span class="den">/10</span></div>`:''}
        <div class="bloco-status ${b.etapa===4?'feito':b.pre_agendado?'planejado':'pendente'}">${b.etapa===4?'Feito':b.pre_agendado?'Pré-agendado':'Pendente'}</div>
      </div>`;
    list.appendChild(div);
  });
}

// Importar CSV de blocos para um aluno (dentro do detalhe)
document.getElementById('importarBtn').onclick = async () => {
  const raw=document.getElementById('csvInput').value.trim();
  if(!raw||mentorAlunoIdx===null) return;
  const a=alunosMentor[mentorAlunoIdx];
  const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
  if(!dir){ alert('Este aluno não tem direcionamento ativo.'); return; }
  const linhas=raw.split('\n').filter(l=>l.trim());
  const inserts=linhas.map(l=>{
    const [codigo,disciplina,link]=l.split(',');
    if(!codigo||!disciplina) return null;
    return { direcionamento_id:dir.id, aluno_id:a.id, codigo:codigo.trim(), disciplina:disciplina.trim(), link:(link||'').trim(), etapa:0 };
  }).filter(Boolean);
  if(!inserts.length) return;
  await _supabase.from('blocos').insert(inserts);
  document.getElementById('csvInput').value='';
  await carregarAlunos();
  showDetalheAluno(mentorAlunoIdx);
};

document.getElementById('fecharDetalheBtn').onclick=()=> document.getElementById('detalheAlunoMentor').style.display='none';

// ===================== CADASTRAR ALUNO =====================
document.getElementById('cadastrarAlunoBtn').onclick = ()=>{
  ['novoAlunoNome','novoAlunoEmail','novoAlunoFoco'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('cadastroAlunoErro').style.display='none';
  document.getElementById('cadastrarAlunoModalOverlay').style.display='flex';
};
document.getElementById('cadastrarAlunoCancelar').onclick = ()=> document.getElementById('cadastrarAlunoModalOverlay').style.display='none';

document.getElementById('cadastrarAlunoConfirmar').onclick = async ()=>{
  const nome  = document.getElementById('novoAlunoNome').value.trim();
  const email = document.getElementById('novoAlunoEmail').value.trim();
  const foco  = document.getElementById('novoAlunoFoco').value.trim();
  const erro  = document.getElementById('cadastroAlunoErro');

  if(!nome || !email){ erro.textContent='Preencha nome e e-mail.'; erro.style.display='block'; return; }

  const btn = document.getElementById('cadastrarAlunoConfirmar');
  btn.textContent='Cadastrando...'; btn.disabled=true;
  erro.style.display='none';

  // Pega o token do mentor logado para autenticar a Edge Function
  const { data: { session } } = await _supabase.auth.getSession();

  const res = await fetch(
    'https://agxamsmyztmyesctiqkm.supabase.co/functions/v1/cadastrar-aluno',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({ nome, email, foco })
    }
  );

  const json = await res.json();
  btn.textContent='Cadastrar'; btn.disabled=false;

  if(!res.ok || json.error){
    erro.textContent = json.error || 'Erro ao cadastrar.';
    erro.style.display='block';
    return;
  }

  document.getElementById('cadastrarAlunoModalOverlay').style.display='none';
  await carregarAlunos();
};

async function init(){
  const ok = await carregarSessao("mentor"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  esconderLoading();
  document.getElementById("appShell").style.display="block";
  carregarAlunos();
}
init();
