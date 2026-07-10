// Depende de: config.js, auth.js (carregarSessao, usuarioAtual, perfilAtual, esconderLoading, logout)

// ===================== DIRECIONAMENTOS =====================
async function carregarDirecionamentos(){
  loading('direcList','Carregando direcionamentos...');
  const { data, error } = await _supabase
    .from('direcionamentos')
    .select('*, blocos(*)')
    .eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });
  if(error){ console.error(error); return; }
  direcionamentos = data || [];
  renderDirecList();
  renderPerfil();
}

function renderDirecList(){
  document.getElementById('heroSemanas').textContent = direcionamentos.length;
  const todosFeitos = direcionamentos.flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  document.getElementById('heroBlocos').textContent = todosFeitos.length;
  const media = todosFeitos.length
    ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10)
    : 0;
  document.getElementById('heroAprov').textContent = todosFeitos.length ? media+'%' : '—';

  const list = document.getElementById('direcList');
  list.innerHTML = '';
  const R=26, C=2*Math.PI*R;
  if(direcionamentos.length===0){
    list.innerHTML = `<div class="empty"><span class="display">Nenhum direcionamento ainda</span>Seu mentor vai criar o primeiro direcionamento da semana.</div>`;
    return;
  }
  direcionamentos.forEach(d=>{
    const feitos = (d.blocos||[]).filter(b=>b.etapa===4);
    const pct = pctOf(d);
    const offset = C-(C*pct/100);
    const aprov = feitos.length
      ? Math.round(feitos.reduce((s,b)=>s+(b.acertos||0),0)/feitos.length*10)
      : null;
    const disciplinas = [...new Set((d.blocos||[]).map(b=>b.disciplina))];
    const div = document.createElement('div');
    div.className='direc-card '+d.status;
    div.innerHTML = `
      <div class="ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle class="track" cx="32" cy="32" r="${R}"/>
          <circle class="fill" cx="32" cy="32" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
      <div class="info">
        <div class="titulo-row">
          <span class="titulo">Direcionamento ${d.numero}</span>
          <span class="badge-status ${d.status}">${d.status==='atual'?'<span class="pulse"></span>Em andamento':'Encerrado'}</span>
        </div>
        <div class="carreira">${d.carreira}</div>
        <div class="sub">${d.periodo||''} · ${feitos.length} de ${d.meta_blocos||0} blocos concluídos</div>
      </div>
      <div class="stats-mini">
        <span class="aprov">${aprov!==null?`<b>${aprov}%</b> de acerto`:'sem dados'}</span>
      </div>
      <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    `;
    div.onclick = ()=> openDirecionamento(d.id);
    list.appendChild(div);
  });
}

function openDirecionamento(id){
  direcAtivoId = id;
  document.querySelectorAll('#navAluno button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#mainAluno > section').forEach(s=>s.style.display='none');
  document.getElementById('tab-blocos').style.display='block';
  renderBlocos();
}

document.getElementById('voltarDirecBtn').onclick = ()=>{
  document.getElementById('tab-blocos').style.display='none';
  document.getElementById('tab-direcionamentos').style.display='block';
  document.querySelector('#navAluno button[data-tab="direcionamentos"]').classList.add('active');
};

// ===================== BLOCOS =====================
function renderBlocos(){
  const direc = direcionamentos.find(d=>d.id===direcAtivoId);
  if(!direc) return;
  document.getElementById('blocosPeriodoTitulo').textContent = 'Direcionamento '+direc.numero+' · '+(direc.periodo||'');
  document.getElementById('contadorBlocos').textContent =
    `${(direc.blocos||[]).length} blocos · meta de ${direc.meta_blocos||0} na semana`;
  const pct = pctOf(direc);
  document.getElementById('progressoBar').style.width = pct+'%';
  document.getElementById('progressoPctTxt').textContent = pct+'%';

  const list = document.getElementById('blocoList');
  list.innerHTML = '';
  if(!(direc.blocos||[]).length){
    list.innerHTML = `<div class="empty"><span class="display">Nenhum bloco ainda</span>Seu mentor ainda não importou os blocos desta semana.</div>`;
    return;
  }
  direc.blocos.forEach(b=>{
    const statusKey = b.etapa===4?'feito':b.etapa>0?'andamento':b.pre_agendado?'planejado':'pendente';
    const expanded = blocosExpandidos.has(b.id);
    const div = document.createElement('div');
    div.className='bloco'+(expanded?' expanded':'');
    div.innerHTML = `
      <div class="bloco-header" data-toggle="${b.id}">
        <div class="bloco-codigo">Bloco ${b.codigo}</div>
        <div class="bloco-info">
          <div class="nome">${b.disciplina}</div>
          <div class="meta">${b.etapa===4?`${b.acertos||0}/10 acertos`:'10 questões · ~30min'}${b.prints_count?` · ${b.prints_count} print${b.prints_count>1?'s':''}`  :''}</div>
        </div>
        ${b.acertos!==null&&b.etapa===4?`<div class="acertos-circle">${b.acertos}<span class="den">/10</span></div>`:''}
        <div class="bloco-status ${statusKey}">${statusLabel(statusKey)}</div>
        <svg class="bloco-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      ${expanded?renderEtapas(b,direcAtivoId):''}
    `;
    list.appendChild(div);
  });
}

function nodeClass(passo,etapaAtual){
  if(etapaAtual>=passo) return 'done';
  if(etapaAtual===passo-1) return 'active';
  return '';
}

function renderEtapas(b){
  const e=b.etapa;
  const check=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const trophy=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v3a5 5 0 01-10 0V4z" stroke="currentColor" stroke-width="1.8"/><path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3" stroke="currentColor" stroke-width="1.8"/><path d="M12 12v4M9 20h6M10 16h4v4h-4v-4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  let action='';
  if(e===0){
    action=`<div class="step-action center-btn"><button class="btn" data-action="iniciar" data-codigo="${b.id}">Iniciar bloco</button></div>`;
  }else if(e===1){
    const boxes=Array.from({length:11},(_,i)=>i).map(n=>`<div class="acertos-box" data-action="salvar-acertos" data-codigo="${b.id}" data-val="${n}">${n}</div>`).join('');
    action=`<div class="step-action"><div class="ask">Quantas das 10 questões você acertou?</div><div class="acertos-grid">${boxes}</div></div>`;
  }else if(e===2){
    action=`<div class="step-action">
      <div class="dropzone" data-action="abrir-prints" data-codigo="${b.id}">
        <div class="dz-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
        <div class="dz-title">Arraste os prints aqui ou clique para selecionar</div>
        <div class="dz-sub">Já ficam marcados como ${b.disciplina}</div>
      </div>
      <input type="file" id="fileInput-${b.id}" multiple accept="image/*" style="display:none">
    </div>`;
  }else if(e===3){
    action=`<div class="step-action center-btn"><button class="trophy-btn" data-action="finalizar" data-codigo="${b.id}">${trophy} Finalizar bloco</button></div>`;
  }else{
    action=`<div class="step-action"><div class="concluido-msg">${trophy} Bloco concluído</div></div>`;
  }
  return `<div class="etapas">
    <div class="stepper">
      <div class="step-node ${nodeClass(1,e)}"><div class="step-circle">${e>=1?check:'1'}</div><div class="step-label">Iniciar bloco</div></div>
      <div class="step-node ${nodeClass(2,e)}"><div class="step-circle">${e>=2?check:'2'}</div><div class="step-label">Percentual de acertos</div></div>
      <div class="step-node ${nodeClass(3,e)}"><div class="step-circle">${e>=3?check:'3'}</div><div class="step-label">Adicionar prints</div></div>
      <div class="step-node trophy ${nodeClass(4,e)}"><div class="step-circle">${e>=4?check:trophy}</div><div class="step-label">Finalizar</div></div>
    </div>
    ${action}
  </div>`;
}

async function atualizarBloco(blocoId, campos){
  await _supabase.from('blocos').update(campos).eq('id', blocoId);
  // atualiza local
  const direc = direcionamentos.find(d=>d.id===direcAtivoId);
  const bloco = direc.blocos.find(b=>b.id===blocoId);
  Object.assign(bloco, campos);
  renderBlocos();
  renderPerfil();
}

document.getElementById('blocoList').addEventListener('click', async (e)=>{
  const toggle = e.target.closest('[data-toggle]');
  const btn = e.target.closest('[data-action]');
  if(btn){
    const id=btn.dataset.codigo, action=btn.dataset.action;
    const direc=direcionamentos.find(d=>d.id===direcAtivoId);
    const bloco=direc.blocos.find(b=>b.id===id);
    if(action==='iniciar'){ window.open(bloco.link,'_blank'); await atualizarBloco(id,{etapa:1}); }
    if(action==='salvar-acertos'){ await atualizarBloco(id,{acertos:parseInt(btn.dataset.val),etapa:2}); }
    if(action==='abrir-prints'){ document.getElementById('fileInput-'+id).click(); }
    if(action==='finalizar'){ await atualizarBloco(id,{etapa:4}); }
    return;
  }
  if(toggle){
    const key=toggle.dataset.toggle;
    if(blocosExpandidos.has(key)) blocosExpandidos.delete(key);
    else blocosExpandidos.add(key);
    renderBlocos();
  }
});

document.getElementById('blocoList').addEventListener('change', (e)=>{
  if(e.target.matches('input[type=file]')){
    const id=e.target.id.replace('fileInput-','');
    if(e.target.files.length) abrirModalPrints(id, Array.from(e.target.files));
  }
});
document.getElementById('blocoList').addEventListener('dragover',(e)=>{ const dz=e.target.closest('.dropzone'); if(dz){e.preventDefault();dz.classList.add('dragover');} });
document.getElementById('blocoList').addEventListener('dragleave',(e)=>{ const dz=e.target.closest('.dropzone'); if(dz) dz.classList.remove('dragover'); });
document.getElementById('blocoList').addEventListener('drop',(e)=>{
  const dz=e.target.closest('.dropzone');
  if(dz){ e.preventDefault(); dz.classList.remove('dragover');
    const id=dz.dataset.codigo;
    if(e.dataTransfer.files.length) abrirModalPrints(id,Array.from(e.dataTransfer.files));
  }
});

async function init(){
  const ok = await carregarSessao("aluno"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  await carregarDirecionamentos();
  esconderLoading();
  document.getElementById("appShell").style.display="block";
}
init();
