// Depende de: config.js, auth.js

// ===================== STATE =====================
let printsAluno = [];
let feedPrints = [];
let printsViewAtual = 'meus';
let printsFiltroMateria = 'todas';
let printsFiltroImportante = false;
let uploadPrintsArquivos = [];
let materiasDisponiveis = [];
let lbLista = [], lbIdx = 0;

// ===================== MATÉRIAS DOS BLOCOS =====================
async function carregarMaterias() {
  const { data } = await _supabase
    .from('blocos').select('disciplina').eq('aluno_id', usuarioAtual.id);
  materiasDisponiveis = [...new Set((data||[]).map(b=>b.disciplina).filter(Boolean))].sort();
}

// ===================== CARREGAR PRINTS =====================
async function carregarPrints() {
  const { data: meus } = await _supabase
    .from('prints').select('*').eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });

  printsAluno = (meus||[]).map(p => {
    const { data: pub_url } = _supabase.storage.from('prints').getPublicUrl(p.storage_path || '');
    return { ...p, img: p.storage_path ? pub_url.publicUrl : null };
  });

  const { data: pub } = await _supabase
    .from('prints').select('*, perfis(nome)').eq('publico', true)
    .neq('aluno_id', usuarioAtual.id).order('created_at', { ascending: false });

  feedPrints = (pub||[]).map(p => {
    const { data: pub_url2 } = _supabase.storage.from('prints').getPublicUrl(p.storage_path || '');
    return { ...p, img: p.storage_path ? pub_url2.publicUrl : null, autor: p.perfis?.nome || 'Colega' };
  });

  renderPrintsChips();
  renderPrintsView();
}

// ===================== CHIPS =====================
function renderPrintsChips() {
  const lista = printsViewAtual === 'meus' ? printsAluno : feedPrints;
  const materias = [...new Set(lista.map(p=>p.materia).filter(Boolean))].sort();
  const temImportantes = printsAluno.some(p=>p.importante);
  const chips = document.getElementById('printsChips');
  chips.innerHTML =
    `<div class="p-chip ${!printsFiltroImportante && printsFiltroMateria==='todas'?'active':''}" data-materia="todas">Todas</div>` +
    (temImportantes ? `<div class="p-chip p-chip-fogo ${printsFiltroImportante?'active':''}" data-importante="1"><svg width='12' height='12' viewBox='0 0 24 24' fill='${printsFiltroImportante?'currentColor':'none'}' stroke='currentColor' stroke-width='2'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg> Importantes</div>` : '') +
    materias.map(m =>
      `<div class="p-chip ${!printsFiltroImportante && printsFiltroMateria===m?'active':''}" data-materia="${m}">${m}</div>`
    ).join('');
}

document.getElementById('printsChips').addEventListener('click', e => {
  const chip = e.target.closest('.p-chip');
  if(!chip) return;
  if(chip.dataset.importante){
    printsFiltroImportante = !printsFiltroImportante;
    printsFiltroMateria = 'todas';
  } else {
    printsFiltroImportante = false;
    printsFiltroMateria = chip.dataset.materia;
  }
  renderPrintsChips();
  renderPrintsView();
});

document.querySelectorAll('.prints-subnav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.prints-subnav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    printsViewAtual = btn.dataset.pview;
    printsFiltroMateria = 'todas';
    printsFiltroImportante = false;
    document.getElementById('abrirUploadPrintsBtn').style.display =
      printsViewAtual === 'meus' ? 'inline-flex' : 'none';
    renderPrintsChips();
    renderPrintsView();
  });
});

document.getElementById('printsOrdem').addEventListener('change', renderPrintsView);

// ===================== FEED =====================
function renderPrintsView() {
  const wrap = document.getElementById('printsView');
  const ordem = document.getElementById('printsOrdem').value;
  let lista = printsViewAtual === 'meus' ? printsAluno : feedPrints;

  if(printsFiltroImportante){
    lista = lista.filter(p=>p.importante);
  } else if(printsFiltroMateria !== 'todas'){
    lista = lista.filter(p=>p.materia === printsFiltroMateria);
  }

  lista = lista.slice().sort((a,b) => ordem==='antigos'
    ? a.created_at.localeCompare(b.created_at)
    : b.created_at.localeCompare(a.created_at));

  if(!lista.length){
    wrap.innerHTML = `<div class="empty">
      <span class="display">${printsViewAtual==='meus' ? 'Nenhum print' : 'Nenhum print público'}</span>
      ${printsFiltroImportante ? 'Marque prints com  no lightbox para vê-los aqui.' : ''}
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="prints-feed">
    ${lista.map((p,i) => `
      <div class="feed-item" data-idx="${i}">
        ${p.img
          ? `<img src="${p.img}" alt="${p.tag||''}" loading="lazy">`
          : `<div class="feed-placeholder">${p.materia||'—'}</div>`}
        <div class="feed-overlay">
          <div class="f-materia">${p.materia||''}</div>
          <div class="f-tag">${p.tag||'—'}</div>
        </div>
        ${p.importante ? '<div style="position:absolute;top:6px;left:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>' : ''}
        ${printsViewAtual==='meus' ? `
          <div class="feed-pub-badge">
            <label class="toggle-label-wrap" style="gap:5px;" onclick="event.stopPropagation()">
              <div class="toggle-switch">
                <input type="checkbox" data-print-publico="${p.id}" ${p.publico?'checked':''}>
                <span class="slider"></span>
              </div>
              <span style="font-size:10px;color:#fff;">Público</span>
            </label>
          </div>` : ''}
      </div>`).join('')}
  </div>`;

  wrap.querySelectorAll('.feed-item').forEach(el => {
    el.addEventListener('click', e => {
      if(e.target.closest('input') || e.target.closest('.toggle-switch')) return;
      abrirLightbox(lista, parseInt(el.dataset.idx));
    });
  });
}

document.getElementById('printsView').addEventListener('change', async e => {
  const chk = e.target.closest('[data-print-publico]');
  if(!chk) return;
  await _supabase.from('prints').update({publico:chk.checked}).eq('id', chk.dataset.printPublico);
  const p = printsAluno.find(x=>x.id===chk.dataset.printPublico);
  if(p) p.publico = chk.checked;
});

// ===================== LIGHTBOX =====================
function abrirLightbox(lista, idx) {
  lbLista = lista; lbIdx = idx;
  document.getElementById('lightbox').style.display = 'flex';
  renderLb();
  registrarVisualizacao();
}

function fecharLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

async function registrarVisualizacao() {
  const p = lbLista[lbIdx];
  if(!p?.id) return;
  const novasViews = (p.visualizacoes||0) + 1;
  await _supabase.from('prints').update({visualizacoes: novasViews}).eq('id', p.id);
  p.visualizacoes = novasViews;
  document.getElementById('lbVisualizacoes').textContent = novasViews + 'x';
}

function renderLb() {
  const p = lbLista[lbIdx];
  document.getElementById('lbImg').src = p.img || '';
  document.getElementById('lbImg').style.display = p.img ? 'block' : 'none';
  document.getElementById('lbMateria').textContent = p.materia || '';
  document.getElementById('lbTag').textContent = p.tag || '—';
  document.getElementById('lbCounter').textContent = `${lbIdx+1} / ${lbLista.length}`;
  document.getElementById('lbVisualizacoes').textContent = (p.visualizacoes||0) + 'x';
  const fogo = document.getElementById('lbFogo');
  fogo.style.opacity = p.importante ? '1' : '0.3';
  fogo.style.color = p.importante ? '#F59E0B' : 'rgba(255,255,255,.8)';
  fogo.title = p.importante ? 'Remover dos importantes' : 'Marcar como importante';
}

document.getElementById('lbClose').onclick = fecharLightbox;
document.getElementById('lbPrev').onclick = () => {
  lbIdx = (lbIdx - 1 + lbLista.length) % lbLista.length;
  renderLb();
  registrarVisualizacao();
};
document.getElementById('lbNext').onclick = () => {
  lbIdx = (lbIdx + 1) % lbLista.length;
  renderLb();
  registrarVisualizacao();
};
document.getElementById('lightbox').addEventListener('click', e => {
  if(e.target === document.getElementById('lightbox')) fecharLightbox();
});
document.addEventListener('keydown', e => {
  if(document.getElementById('lightbox').style.display === 'none') return;
  if(e.key === 'Escape') fecharLightbox();
  if(e.key === 'ArrowRight') document.getElementById('lbNext').click();
  if(e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
});

// Botão fogo
document.getElementById('lbFogo').onclick = async () => {
  const p = lbLista[lbIdx];
  if(!p?.id) return;
  const novoValor = !p.importante;
  await _supabase.from('prints').update({importante: novoValor}).eq('id', p.id);
  p.importante = novoValor;
  // Atualiza no array printsAluno também
  const orig = printsAluno.find(x=>x.id===p.id);
  if(orig) orig.importante = novoValor;
  renderLb();
  renderPrintsChips();
  renderPrintsView();
};

// ===================== UPLOAD =====================
const MATERIAS_PADRAO = ['Direito Constitucional','Direito Administrativo','Direito Penal','Processo Civil','Processo Penal','Administração Geral e Pública','Direito Civil','Direito Tributário'];

function getMaterias() {
  return [...new Set([...materiasDisponiveis, ...MATERIAS_PADRAO])].sort();
}

document.getElementById('abrirUploadPrintsBtn').onclick = () => {
  uploadPrintsArquivos = [];
  document.getElementById('uploadPrintsBody').innerHTML = '';
  document.getElementById('uploadPrintsConfirmar').style.display = 'none';
  document.getElementById('uploadPrintsModalOverlay').style.display = 'flex';
};
document.getElementById('uploadPrintsCancelar').onclick = () =>
  document.getElementById('uploadPrintsModalOverlay').style.display = 'none';
document.getElementById('uploadPrintsDropzone').onclick = () =>
  document.getElementById('uploadPrintsFileInput').click();
document.getElementById('uploadPrintsFileInput').onchange = e => {
  if(e.target.files.length) montarLinhasUpload(Array.from(e.target.files));
};
document.getElementById('uploadPrintsDropzone').addEventListener('dragover', e => {
  e.preventDefault(); e.currentTarget.classList.add('dragover');
});
document.getElementById('uploadPrintsDropzone').addEventListener('dragleave', e =>
  e.currentTarget.classList.remove('dragover'));
document.getElementById('uploadPrintsDropzone').addEventListener('drop', e => {
  e.preventDefault(); e.currentTarget.classList.remove('dragover');
  if(e.dataTransfer.files.length) montarLinhasUpload(Array.from(e.dataTransfer.files));
});

function montarLinhasUpload(files) {
  uploadPrintsArquivos = files;
  const materias = getMaterias();
  document.getElementById('uploadPrintsBody').innerHTML = files.map((f,i) => `
    <div class="print-row">
      <div class="print-thumb" id="uthumb-${i}" style="cursor:zoom-in;">···</div>
      <div class="field-col">
        <div class="fname">${f.name}</div>
        <label>Matéria</label>
        <select class="tag-input" id="umateria-${i}" style="margin-bottom:8px;">
          ${materias.map(m=>`<option>${m}</option>`).join('')}
        </select>
        <label>Tag</label>
        <input class="tag-input" placeholder="ex: erro recorrente" id="utag-${i}">
      </div>
    </div>`).join('');
  document.getElementById('uploadPrintsConfirmar').style.display = 'inline-flex';
  files.forEach((f,i) => {
    const r = new FileReader();
    r.onload = ev => {
      const t = document.getElementById('uthumb-'+i);
      if(t){
        t.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
        t.onclick = () => {
          document.getElementById('zoomPreviewImg').src = ev.target.result;
          document.getElementById('zoomPreviewNome').textContent = f.name;
          document.getElementById('zoomPreviewOverlay').style.display = 'flex';
        };
      }
    };
    if(f.type?.startsWith('image/')) r.readAsDataURL(f);
  });
}

document.getElementById('zoomPreviewClose').onclick = () =>
  document.getElementById('zoomPreviewOverlay').style.display = 'none';
document.getElementById('zoomPreviewOverlay').addEventListener('click', e => {
  if(e.target === document.getElementById('zoomPreviewOverlay'))
    document.getElementById('zoomPreviewOverlay').style.display = 'none';
});

document.getElementById('uploadPrintsConfirmar').onclick = async () => {
  const btn = document.getElementById('uploadPrintsConfirmar');
  btn.textContent = 'Enviando...'; btn.disabled = true;
  for(let i=0; i<uploadPrintsArquivos.length; i++){
    const f = uploadPrintsArquivos[i];
    const materia = document.getElementById('umateria-'+i)?.value || 'Geral';
    const tag = document.getElementById('utag-'+i)?.value || 'Sem tag';
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `${usuarioAtual.id}/${Date.now()}-${i}-${safeName}`;
    const { error } = await _supabase.storage.from('prints').upload(path, f, {contentType: f.type});
    if(!error){
      await _supabase.from('prints').insert({
        aluno_id: usuarioAtual.id, materia, tag,
        publico: false, storage_path: path,
        visualizacoes: 0, importante: false
      });
    }
  }
  btn.textContent = 'Adicionar à minha revisão'; btn.disabled = false;
  document.getElementById('uploadPrintsModalOverlay').style.display = 'none';
  await carregarPrints();
};

// ===================== INIT =====================
async function init() {
  const ok = await carregarSessao('aluno');
  if(!ok) return;
  document.getElementById('userEmailLabel').textContent = perfilAtual?.nome || usuarioAtual.email;
  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
  await carregarMaterias();
  await carregarPrints();
}
init();