// Depende de: config.js, auth.js

let alunosMentor = [];
let mentorAlunoIdx = null;

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
    const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
    return s+(dir?.blocos||[]).filter(b=>b.etapa===4).length;
  },0);
  document.getElementById('mTotalBlocos').textContent = totalBlocos;
  const comBlocos = alunosMentor.filter(a=>{
    const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
    return (dir?.blocos||[]).some(b=>b.etapa===4);
  });
  const media = comBlocos.length ? Math.round(comBlocos.reduce((s,a)=>{
    const dir=(a.direcionamentos||[]).find(d=>d.status==='atual');
    const f=(dir?.blocos||[]).filter(b=>b.etapa===4);
    return s+(f.length?f.reduce((x,b)=>x+(b.acertos||0),0)/f.length*10:0);
  },0)/comBlocos.length) : 0;
  document.getElementById('mAprovGeral').innerHTML = media+'<span class="unit">%</span>';

  const list = document.getElementById('alunoListMentor');
  list.innerHTML = '';
  if(!alunosMentor.length){
    list.innerHTML = '<div class="empty"><span class="display">Nenhum aluno ainda</span>Clique em "Cadastrar aluno" para adicionar o primeiro.</div>';
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

  // Popula select de direcionamentos para importação
  const sel = document.getElementById('importarDirecSelect');
  const dirs = a.direcionamentos||[];
  if(dirs.length){
    sel.innerHTML = dirs.map(d=>
      `<option value="${d.id}">Dir. ${d.numero} · ${d.carreira}${d.status==='atual'?' (atual)':''}</option>`
    ).join('');
  } else {
    sel.innerHTML = '<option value="">Nenhum direcionamento</option>';
  }

  renderDetalheBlocoList();
  document.getElementById('detalheAlunoMentor').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderDetalheBlocoList(){
  const a=alunosMentor[mentorAlunoIdx];
  const sel=document.getElementById('importarDirecSelect');
  const direcId=sel?.value;
  const dir=(a.direcionamentos||[]).find(d=>d.id===direcId) || (a.direcionamentos||[])[0];
  const list=document.getElementById('detalheBlocoList');
  if(!(dir?.blocos||[]).length){
    list.innerHTML='<div class="empty">Nenhum bloco importado neste direcionamento.</div>';
    return;
  }
  list.innerHTML='';
  // Ordena por código
  const blocos=[...(dir.blocos||[])].sort((a,b)=>{
    const norm=s=>s.replace(/([0-9]+)([A-Za-z]+)/,(_,n,l)=>n.padStart(4,'0')+l.toUpperCase());
    return norm(a.codigo).localeCompare(norm(b.codigo));
  });
  blocos.forEach(b=>{
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

// Atualiza lista ao trocar direcionamento no select
document.getElementById('importarDirecSelect')?.addEventListener('change', renderDetalheBlocoList);


// Modal importar blocos


document.getElementById('importarBtn').onclick = async () => {
  const raw=document.getElementById('csvInput').value.trim();
  if(!raw||mentorAlunoIdx===null) return;
  const a=alunosMentor[mentorAlunoIdx];
  const direcId=document.getElementById('importarDirecSelect').value;
  const dir=(a.direcionamentos||[]).find(d=>d.id===direcId);
  if(!dir){ alert('Selecione um direcionamento.'); return; }
  const linhas=raw.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.trim());
  // Detecta separador e formato
  const header=linhas[0].toLowerCase();
  const sep=header.includes(';')?';':',';
  // Formato TEC: cabeçalho com "data" e "nome"
  const isTec=header.startsWith('data');
  const start=isTec?1:0;
  const inserts=linhas.slice(start).map(l=>{
    const cols=l.split(sep).map(c=>c.trim().replace(/^"|"$/g,''));
    let codigo,disciplina,link;
    if(isTec){
      // Nome: "Bloco 03A - D05 - Direito Constitucional - ..."
      const parts=(cols[1]||'').split(' - ');
      codigo=(parts[0]||'').replace(/^bloco\s*/i,'').trim();
      disciplina=(parts[2]||parts[1]||'').trim();
      link=(cols[2]||'').trim();
    } else {
      [codigo,disciplina,link]=cols;
    }
    if(!codigo||!disciplina) return null;
    return {direcionamento_id:dir.id,aluno_id:a.id,codigo,disciplina,link:link||'',etapa:0};
  }).filter(Boolean);
  if(!inserts.length){ alert('Nenhuma linha válida encontrada no CSV.'); return; }
  const btn=document.getElementById('importarBtn');
  btn.textContent=`Importando ${inserts.length} blocos...`; btn.disabled=true;
  const {error}=await _supabase.from('blocos').insert(inserts);
  btn.textContent='Importar blocos'; btn.disabled=false;
  if(error){ alert('Erro ao importar: '+error.message); return; }

  // Atualiza meta_blocos com o total real de blocos do direcionamento
  const totalBlocos = (dir.blocos?.length || 0) + inserts.length;
  await _supabase.from('direcionamentos').update({ meta_blocos: totalBlocos }).eq('id', dir.id);

  document.getElementById('importarBlocosModal').style.display='none';
  await carregarAlunos();
  showDetalheAluno(mentorAlunoIdx);
};

// Cadastrar aluno

document.getElementById('cadastrarAlunoConfirmar').onclick = async () => {
  const nome=document.getElementById('novoAlunoNome').value.trim();
  const email=document.getElementById('novoAlunoEmail').value.trim();
  const foco=document.getElementById('novoAlunoFoco').value.trim();
  const erro=document.getElementById('cadastroAlunoErro');
  if(!nome||!email){ erro.textContent='Preencha nome e e-mail.'; erro.style.display='block'; return; }
  const btn=document.getElementById('cadastrarAlunoConfirmar');
  btn.textContent='Cadastrando...'; btn.disabled=true;
  erro.style.display='none';
  const { data:{ session } } = await _supabase.auth.getSession();
  const res=await fetch('https://agxamsmyztmyesctiqkm.supabase.co/functions/v1/cadastrar-aluno',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
    body:JSON.stringify({nome,email,foco})
  });
  const json=await res.json();
  btn.textContent='Cadastrar'; btn.disabled=false;
  if(!res.ok||json.error){ erro.textContent=json.error||'Erro ao cadastrar.'; erro.style.display='block'; return; }
  document.getElementById('cadastrarAlunoModalOverlay').style.display='none';
  await carregarAlunos();
};

async function init(){
  const ok = await carregarSessao('mentor');
  if(!ok){ esconderLoading(); document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:Inter"><h2>Erro de autenticação</h2><p>Verifique o console (F12) e reporte o erro.</p><a href="/admin/alunos.html">Voltar</a></div>'; return; }

  const _lbl = document.getElementById('userEmailLabel'); if(_lbl) _lbl.textContent = perfilAtual?.nome || usuarioAtual.email;

  document.getElementById('fecharDetalheBtn').onclick =
    ()=>document.getElementById('detalheAlunoMentor').style.display='none';

  // Editar perfil do aluno
  document.getElementById('editarPerfilAlunoBtn').onclick = ()=>{
    const a=alunosMentor[mentorAlunoIdx];
    document.getElementById('editNome').value = a.nome||'';
    document.getElementById('editCarreiras').value = (a.carreiras||[]).join(', ');
    document.getElementById('editarPerfilModal').style.display='flex';
  };
  document.getElementById('editarPerfilCancelar').onclick =
    ()=>document.getElementById('editarPerfilModal').style.display='none';
  document.getElementById('editarPerfilConfirmar').onclick = async ()=>{
    const a=alunosMentor[mentorAlunoIdx];
    const nome=document.getElementById('editNome').value.trim();
    const carreiras=document.getElementById('editCarreiras').value.split(',').map(s=>s.trim()).filter(Boolean);
    await _supabase.from('perfis').update({nome,carreiras}).eq('id',a.id);
    document.getElementById('editarPerfilModal').style.display='none';
    await carregarAlunos();
    showDetalheAluno(mentorAlunoIdx);
  };

  document.getElementById('abrirImportarBlocos').onclick=()=>{
    document.getElementById('csvInput').value='';
    document.getElementById('importarBlocosModal').style.display='flex';
  };
  document.getElementById('cancelarImportarBlocos').onclick =
    ()=>document.getElementById('importarBlocosModal').style.display='none';
  document.getElementById('csvFileBtn').onclick =
    ()=>document.getElementById('csvFileInput').click();
  document.getElementById('csvFileInput').onchange=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=(ev)=>{ document.getElementById('csvInput').value=ev.target.result; };
    r.readAsText(file,'utf-8');
  };

  document.getElementById('cadastrarAlunoBtn').onclick=()=>{
    ['novoAlunoNome','novoAlunoEmail','novoAlunoFoco'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cadastroAlunoErro').style.display='none';
    document.getElementById('cadastrarAlunoModalOverlay').style.display='flex';
  };
  document.getElementById('cadastrarAlunoCancelar').onclick =
    ()=>document.getElementById('cadastrarAlunoModalOverlay').style.display='none';

  esconderLoading();
  document.getElementById('appShell').style.display='block';
  await carregarAlunos();
}
init();