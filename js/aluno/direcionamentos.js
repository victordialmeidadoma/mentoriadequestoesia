// Depende de: config.js, auth.js

// ===================== STATE =====================
function calcMeta(h){ return Math.round((h*60)/30); }
let direcionamentos = [];

function pctOf(direc){
  const feitos = (direc.blocos||[]).filter(b=>b.etapa===4).length;
  return Math.min(100, Math.round((feitos/(direc.meta_blocos||1))*100));
}

// ===================== CARREGAR =====================
async function carregarDirecionamentos(){
  document.getElementById('direcList').innerHTML = '<div class="empty">Carregando...</div>';
  const { data, error } = await _supabase
    .from('direcionamentos')
    .select('*, blocos(*)')
    .eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });
  if(error){ console.error(error); return; }
  direcionamentos = data || [];
  renderDirecList();
}

function renderDirecList(){
  document.getElementById('heroSemanas').textContent = direcionamentos.length;
  const todosFeitos = direcionamentos.flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  document.getElementById('heroBlocos').textContent = todosFeitos.length;
  const media = todosFeitos.length
    ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById('heroAprov').textContent = todosFeitos.length ? media+'%' : '—';

  const list = document.getElementById('direcList');
  if(!direcionamentos.length){
    list.innerHTML = '<div class="empty"><span class="display">Nenhum direcionamento ainda</span>Seu mentor vai criar o primeiro direcionamento da semana.</div>';
    return;
  }

  const R=26, C=2*Math.PI*R;
  list.innerHTML = '';
  direcionamentos.forEach(d=>{
    const feitos = (d.blocos||[]).filter(b=>b.etapa===4);
    const pct = pctOf(d);
    const offset = C-(C*pct/100);
    const aprov = feitos.length
      ? Math.round(feitos.reduce((s,b)=>s+(b.acertos||0),0)/feitos.length*10) : null;

    const div = document.createElement('div');
    div.className = 'direc-card clicavel';
    div.innerHTML = `
      <div class="ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle fill="none" stroke="#E8F7EF" stroke-width="6" cx="32" cy="32" r="${R}"/>
          <circle fill="none" stroke="#0B6E4F" stroke-width="6" stroke-linecap="round"
            cx="32" cy="32" r="${R}"
            stroke-dasharray="${C}" stroke-dashoffset="${offset}"
            style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset .5s"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
      <div class="info" style="flex:1;">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="opacity:.4;flex-shrink:0;">
        <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    div.onclick = () => window.location.href = `/aluno/blocos.html?id=${d.id}`;
    list.appendChild(div);
  });
}

// ===================== DIA DE ESTUDOS =====================
let diaEtapa = 1;

document.getElementById('iniciarDiaBtn').onclick = () => {
  diaEtapa = 1; renderDiaModal();
  document.getElementById('diaModalOverlay').style.display = 'flex';
};
document.getElementById('diaModalFechar').onclick = () => {
  document.getElementById('diaModalOverlay').style.display = 'none';
};

async function renderDiaModal(){
  const direc = direcionamentos.find(d=>d.status==='atual');
  document.getElementById('diaStep2').className = 'dia-step'+(diaEtapa<2?' locked':'');
  document.getElementById('diaCheck1').className = 'dia-step-num'+(diaEtapa>1?' done':'');
  document.getElementById('diaCheck2').className = 'dia-step-num'+(diaEtapa>2?' done':'');

  const body1 = document.getElementById('diaBody1');

  if(!direc){
    body1.innerHTML = '<div class="empty-step">Nenhum direcionamento ativo.</div>';
  } else {
    const idxAtual = direcionamentos.findIndex(d=>d.status==='atual');
    const anterior = direcionamentos[idxAtual + 1] || null;

    // Busca prints do direcionamento anterior ordenados do mais antigo para o mais recente
    let blocsComPrints = [];
    if(anterior){
      const { data: prints } = await _supabase
        .from('prints')
        .select('*, blocos!inner(direcionamento_id)')
        .eq('aluno_id', usuarioAtual.id)
        .eq('blocos.direcionamento_id', anterior.id)
        .order('created_at', { ascending: true }); // mais antigos primeiro

      // Agrupa por bloco para exibição
      const porBloco = {};
      (prints||[]).forEach(p=>{
        const key = p.bloco_id||'sem-bloco';
        if(!porBloco[key]) porBloco[key]={ disciplina: (anterior.blocos||[]).find(b=>b.id===p.bloco_id)?.disciplina||'Geral', count:0 };
        porBloco[key].count++;
      });
      blocsComPrints = Object.values(porBloco);
    }

    if(!anterior){
      body1.innerHTML = '<div class="empty-step">Este é o primeiro direcionamento — nenhum print anterior para revisar.</div>'
        + '<button class="btn small" id="diaAvancar1" style="margin-top:12px;">Pular e ir para os blocos</button>';
    } else if(blocsComPrints.length===0){
      body1.innerHTML = `<div class="empty-step">Nenhum print salvo no Direcionamento ${anterior.numero}.</div>`
        + '<button class="btn small" id="diaAvancar1" style="margin-top:12px;">Pular e ir para os blocos</button>';
    } else {
      body1.innerHTML = `
        <div style="font-size:12px;color:var(--text-soft);margin-bottom:10px;">
          Revisando prints do <b>Direcionamento ${anterior.numero}</b> — do mais antigo ao mais recente.
          <a href="/aluno/prints.html" style="color:var(--g1);font-weight:600;margin-left:6px;">Abrir prints →</a>
        </div>
        ${blocsComPrints.map(b=>`
          <div class="dia-print-mini">
            <div class="print-thumb" style="background:var(--g-soft);color:var(--g1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">P</div>
            <div>
              <div class="tag">${b.disciplina}</div>
              <div class="disc">${b.count} print${b.count>1?'s':''}</div>
            </div>
          </div>`).join('')}
        <button class="btn small" id="diaAvancar1" style="margin-top:12px;">Marcar revisão como concluída</button>`;
    }
    document.getElementById('diaAvancar1').onclick = async ()=>{ diaEtapa=2; await renderDiaModal(); };
  }

  const body2 = document.getElementById('diaBody2');
  if(diaEtapa<2){ body2.innerHTML=''; return; }
  if(!direc){ body2.innerHTML='<div class="empty-step">Nenhum direcionamento ativo.</div>'; return; }
  const pre = (direc.blocos||[]).filter(b=>b.pre_agendado&&b.etapa===0);
  body2.innerHTML = pre.length===0
    ? '<div class="empty-step">Nenhum bloco pré-agendado para hoje.<br><small style="color:var(--text-soft);">Vá até os blocos e clique em "Pré-agendar para amanhã" nos que quer fazer hoje.</small></div>'
    : pre.map(b=>`<div class="dia-bloco-mini"><span class="l"><span class="cod">${b.codigo}</span>${b.disciplina}</span><a class="btn small" href="/aluno/blocos.html?id=${direc.id}&bloco=${b.id}">Iniciar bloco</a></div>`).join('');
}

// ===================== INIT =====================
async function init(){
  const ok = await carregarSessao('aluno');
  if(!ok) return;
  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;
  await carregarDirecionamentos();
  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
}
init();