// Depende de: config.js, auth.js

// ===================== STATE =====================
let direcAtivo = null;
let blocosExpandidos = new Set();
let printsModalBlocoId = null;

function pctOf(direc){
  const feitos = (direc.blocos||[]).filter(b=>b.etapa===4).length;
  return Math.min(100, Math.round((feitos/(direc.meta_blocos||1))*100));
}

// ===================== CARREGAR =====================
async function carregarBlocos(){
  const params = new URLSearchParams(window.location.search);
  const direcId = params.get('id');
  const blocoFoco = params.get('bloco');
  if(!direcId){ window.location.href='/aluno/direcionamentos.html'; return; }

  const { data, error } = await _supabase
    .from('direcionamentos')
    .select('*, blocos(*)')
    .eq('id', direcId)
    .single();
  if(error || !data){ window.location.href='/aluno/direcionamentos.html'; return; }
  direcAtivo = data;

  document.getElementById('blocosTitulo').textContent = `Direcionamento ${data.numero} · ${data.carreira}`;
  document.getElementById('blocosSubtitulo').textContent = `${data.periodo||''} · meta de ${data.meta_blocos||0} blocos`;
  const pct = pctOf(data);
  document.getElementById('progressoBar').style.width = pct+'%';
  document.getElementById('progressoPctTxt').textContent = pct+'%';
  document.getElementById('contadorBlocos').textContent = `${(data.blocos||[]).length} blocos`;

  if(blocoFoco) blocosExpandidos.add(blocoFoco);
  renderBlocos();
}

function statusLabel(s){ return s==='feito'?'Feito':s==='planejado'?'Pré-agendado':s==='andamento'?'Em andamento':'Pendente'; }

function renderBlocos(){
  const list = document.getElementById('blocoList');
  if(!(direcAtivo?.blocos||[]).length){
    list.innerHTML = '<div class="empty"><span class="display">Nenhum bloco ainda</span>Seu mentor ainda não importou os blocos desta semana.</div>';
    return;
  }
  list.innerHTML = '';
  direcAtivo.blocos.forEach(b=>{
    const statusKey = b.etapa===4?'feito':b.etapa>0?'andamento':b.pre_agendado?'planejado':'pendente';
    const expanded = blocosExpandidos.has(b.id);
    const div = document.createElement('div');
    div.className = 'bloco'+(expanded?' expanded':'');
    div.innerHTML = `
      <div class="bloco-header" data-toggle="${b.id}">
        <div class="bloco-codigo">Bloco ${b.codigo}</div>
        <div class="bloco-info">
          <div class="nome">${b.disciplina}</div>
          <div class="meta">${b.etapa===4?`${b.acertos||0}/10 acertos`:'10 questões · ~30min'}${b.prints_count?` · ${b.prints_count} print${b.prints_count>1?'s':''}`  :''}</div>
        </div>
        ${b.acertos!==null&&b.etapa===4?`<div class="acertos-circle">${b.acertos}<span class="den">/10</span></div>`:''}
        <div class="bloco-status ${statusKey}">${statusLabel(statusKey)}</div>
        <svg class="bloco-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      ${expanded ? renderEtapas(b) : ''}`;
    list.appendChild(div);
  });
}

function nodeClass(passo, e){ return e>=passo?'done':e===passo-1?'active':''; }

function renderEtapas(b){
  const e = b.etapa;
  const check = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const trophy = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v3a5 5 0 01-10 0V4z" stroke="currentColor" stroke-width="1.8"/><path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3" stroke="currentColor" stroke-width="1.8"/><path d="M12 12v4M9 20h6M10 16h4v4h-4v-4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  let action = '';
  if(e===0){
    action=`<div class="step-action center-btn"><button class="btn" data-action="iniciar" data-id="${b.id}">Iniciar bloco</button></div>`;
  } else if(e===1){
    const boxes = Array.from({length:11},(_,i)=>i).map(n=>`<div class="acertos-box" data-action="salvar-acertos" data-id="${b.id}" data-val="${n}">${n}</div>`).join('');
    action=`<div class="step-action"><div class="ask">Quantas das 10 questões você acertou?</div><div class="acertos-grid">${boxes}</div></div>`;
  } else if(e===2){
    action=`<div class="step-action">
      <div class="dropzone" data-action="abrir-prints" data-id="${b.id}">
        <div class="dz-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
        <div class="dz-title">Arraste os prints aqui ou clique para selecionar</div>
        <div class="dz-sub">Já ficam marcados como ${b.disciplina}</div>
      </div>
      <input type="file" id="fileInput-${b.id}" multiple accept="image/*" style="display:none">
    </div>`;
  } else if(e===3){
    action=`<div class="step-action center-btn"><button class="trophy-btn" data-action="finalizar" data-id="${b.id}">${trophy} Finalizar bloco</button></div>`;
  } else {
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
  const bloco = direcAtivo.blocos.find(b=>b.id===blocoId);
  Object.assign(bloco, campos);
  const pct = pctOf(direcAtivo);
  document.getElementById('progressoBar').style.width = pct+'%';
  document.getElementById('progressoPctTxt').textContent = pct+'%';
  renderBlocos();
}

document.getElementById('blocoList').addEventListener('click', async (e)=>{
  const toggle = e.target.closest('[data-toggle]');
  const btn = e.target.closest('[data-action]');
  if(btn){
    const id=btn.dataset.id, action=btn.dataset.action;
    const bloco = direcAtivo.blocos.find(b=>b.id===id);
    if(action==='iniciar'){ if(bloco.link) window.open(bloco.link,'_blank'); await atualizarBloco(id,{etapa:1}); }
    if(action==='salvar-acertos'){ await atualizarBloco(id,{acertos:parseInt(btn.dataset.val),etapa:2}); }
    if(action==='abrir-prints'){ document.getElementById('fileInput-'+id).click(); }
    if(action==='finalizar'){ await atualizarBloco(id,{etapa:4}); }
    return;
  }
  if(toggle){
    const key = toggle.dataset.toggle;
    if(blocosExpandidos.has(key)) blocosExpandidos.delete(key);
    else blocosExpandidos.add(key);
    renderBlocos();
  }
});

document.getElementById('blocoList').addEventListener('change', (e)=>{
  if(e.target.matches('input[type=file]')){
    const id = e.target.id.replace('fileInput-','');
    if(e.target.files.length) abrirModalPrints(id, Array.from(e.target.files));
  }
});
document.getElementById('blocoList').addEventListener('dragover',(e)=>{ const dz=e.target.closest('.dropzone'); if(dz){e.preventDefault();dz.classList.add('dragover');} });
document.getElementById('blocoList').addEventListener('dragleave',(e)=>{ const dz=e.target.closest('.dropzone'); if(dz) dz.classList.remove('dragover'); });
document.getElementById('blocoList').addEventListener('drop',(e)=>{
  const dz=e.target.closest('.dropzone');
  if(dz){ e.preventDefault(); dz.classList.remove('dragover');
    const id=dz.dataset.id;
    if(e.dataTransfer.files.length) abrirModalPrints(id,Array.from(e.dataTransfer.files));
  }
});

function abrirModalPrints(blocoId, files){
  printsModalBlocoId = blocoId;
  const bloco = direcAtivo.blocos.find(b=>b.id===blocoId);
  const body = document.getElementById('printsModalBody');
  body.innerHTML = files.map((f,i)=>`
    <div class="print-row">
      <div class="print-thumb" id="pthumb-${i}">···</div>
      <div class="field-col">
        <div class="fname">${f.name}</div>
        <label>Tag deste print</label>
        <input class="tag-input" placeholder="ex: erro recorrente" id="ptag-${i}">
      </div>
    </div>`).join('');
  document.getElementById('printsModalCount').textContent = `${files.length} print${files.length>1?'s':''} · ${bloco?.disciplina||''}`;
  document.getElementById('printsModalOverlay').style.display = 'flex';
  document.getElementById('printsModalOverlay')._files = files;
  files.forEach((f,i)=>{
    const r=new FileReader();
    r.onload=(ev)=>{ const t=document.getElementById('pthumb-'+i); if(t) t.innerHTML=`<img src="${ev.target.result}">`; };
    if(f.type?.startsWith('image/')) r.readAsDataURL(f);
  });
}

document.getElementById('printsModalCancelar').onclick = ()=> document.getElementById('printsModalOverlay').style.display='none';
document.getElementById('printsModalConfirmar').onclick = async ()=>{
  const files = document.getElementById('printsModalOverlay')._files||[];
  const bloco = direcAtivo.blocos.find(b=>b.id===printsModalBlocoId);
  let qtd=0;
  for(let i=0;i<files.length;i++){
    const tag = document.getElementById('ptag-'+i)?.value||'Sem tag';
    const safeName = files[i].name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `${usuarioAtual.id}/${Date.now()}-${i}-${safeName}`;
    const { error:upErr } = await _supabase.storage.from('prints').upload(path, files[i], {contentType:files[i].type});
    if(!upErr){
      await _supabase.from('prints').insert({aluno_id:usuarioAtual.id,bloco_id:printsModalBlocoId,materia:bloco?.disciplina||'Geral',tag,publico:false,storage_path:path});
      qtd++;
    }
  }
  if(qtd>0) await atualizarBloco(printsModalBlocoId,{etapa:3,prints_count:(bloco?.prints_count||0)+qtd});
  document.getElementById('printsModalOverlay').style.display='none';
};

// ===================== INIT =====================
async function init(){
  const ok = await carregarSessao('aluno');
  if(!ok) return;
  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;
  await carregarBlocos();
  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
}
init();
