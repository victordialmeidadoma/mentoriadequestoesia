// Depende de: config.js, auth.js

// ===================== STATE =====================
let printsAluno = [];
let feedPrints = [];
let printsViewAtual = 'meus';
let printsFiltroMateria = 'todas';
let uploadPrintsArquivos = [];
let materiasDisponiveis = [];
let lbLista = [], lbIdx = 0;

// ===================== CARREGAR MATÉRIAS DOS BLOCOS =====================
async function carregarMaterias() {
  // Busca disciplinas dos blocos do aluno (já concluídos ou em andamento)
  const { data } = await _supabase
    .from('blocos')
    .select('disciplina')
    .eq('aluno_id', usuarioAtual.id);
  const unicas = [...new Set((data||[]).map(b => b.disciplina).filter(Boolean))].sort();
  materiasDisponiveis = unicas;
}

// ===================== CARREGAR PRINTS =====================
async function carregarPrints() {
  const { data: meus } = await _supabase
    .from('prints')
    .select('*')
    .eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });

  printsAluno = await Promise.all((meus||[]).map(async p => {
    let img = null;
    if (p.storage_path) {
      const { data } = await _supabase.storage.from('prints').createSignedUrl(p.storage_path, 86400);
      img = data?.signedUrl || null;
    }
    return { ...p, img };
  }));

  const { data: pub } = await _supabase
    .from('prints')
    .select('*, perfis(nome)')
    .eq('publico', true)
    .neq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });

  feedPrints = await Promise.all((pub||[]).map(async p => {
    let img = null;
    if (p.storage_path) {
      const { data } = await _supabase.storage.from('prints').createSignedUrl(p.storage_path, 86400);
      img = data?.signedUrl || null;
    }
    return { ...p, img, autor: p.perfis?.nome || 'Colega' };
  }));

  renderPrintsChips();
  renderPrintsView();
}

// ===================== CHIPS DE MATÉRIA =====================
function renderPrintsChips() {
  const lista = printsViewAtual === 'meus' ? printsAluno : feedPrints;
  const materias = [...new Set(lista.map(p => p.materia).filter(Boolean))].sort();
  const chips = document.getElementById('printsChips');
  chips.innerHTML =
    `<div class="p-chip ${printsFiltroMateria === 'todas' ? 'active' : ''}" data-materia="todas">Todas</div>` +
    materias.map(m =>
      `<div class="p-chip ${printsFiltroMateria === m ? 'active' : ''}" data-materia="${m}">${m}</div>`
    ).join('');
}

document.getElementById('printsChips').addEventListener('click', e => {
  const chip = e.target.closest('.p-chip');
  if (!chip) return;
  printsFiltroMateria = chip.dataset.materia;
  renderPrintsChips();
  renderPrintsView();
});

document.querySelectorAll('.prints-subnav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.prints-subnav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    printsViewAtual = btn.dataset.pview;
    printsFiltroMateria = 'todas';
    document.getElementById('abrirUploadPrintsBtn').style.display =
      printsViewAtual === 'meus' ? 'inline-flex' : 'none';
    renderPrintsChips();
    renderPrintsView();
  });
});

document.getElementById('printsOrdem').addEventListener('change', renderPrintsView);

// ===================== FEED INSTAGRAM =====================
function renderPrintsView() {
  const wrap = document.getElementById('printsView');
  const ordem = document.getElementById('printsOrdem').value;
  const lista = (printsViewAtual === 'meus' ? printsAluno : feedPrints)
    .filter(p => printsFiltroMateria === 'todas' || p.materia === printsFiltroMateria)
    .slice().sort((a, b) => ordem === 'antigos'
      ? a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at));

  if (!lista.length) {
    wrap.innerHTML = `<div class="empty">
      <span class="display">${printsViewAtual === 'meus' ? 'Nenhum print ainda' : 'Nenhum print público'}</span>
      ${printsViewAtual === 'meus' ? 'Adicione prints durante a resolução de um bloco ou clique em "+ Adicionar prints".' : 'Quando colegas tornarem prints públicos, aparecem aqui.'}
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="prints-feed">
    ${lista.map((p, i) => `
      <div class="feed-item" data-idx="${i}">
        ${p.img
          ? `<img src="${p.img}" alt="${p.tag || ''}" loading="lazy">`
          : `<div class="feed-placeholder">${p.materia || '—'}</div>`}
        <div class="feed-overlay">
          <div class="f-materia">${p.materia || ''}</div>
          <div class="f-tag">${p.tag || '—'}</div>
          ${printsViewAtual === 'feed' ? `<div class="f-tag" style="opacity:.7;font-size:10px;">${p.autor}</div>` : ''}
        </div>
        ${printsViewAtual === 'meus' ? `
          <div class="feed-pub-badge">
            <label class="toggle-label-wrap" style="gap:5px;" onclick="event.stopPropagation()">
              <div class="toggle-switch">
                <input type="checkbox" data-print-publico="${p.id}" ${p.publico ? 'checked' : ''}>
                <span class="slider"></span>
              </div>
              <span style="font-size:10px;color:#fff;">Público</span>
            </label>
          </div>` : ''}
      </div>`).join('')}
  </div>`;

  // Lightbox click
  wrap.querySelectorAll('.feed-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('input') || e.target.closest('.toggle-switch')) return;
      abrirLightbox(lista, parseInt(el.dataset.idx));
    });
  });
}

// Toggle público
document.getElementById('printsView').addEventListener('change', async e => {
  const chk = e.target.closest('[data-print-publico]');
  if (!chk) return;
  await _supabase.from('prints').update({ publico: chk.checked }).eq('id', chk.dataset.printPublico);
  const p = printsAluno.find(x => x.id === chk.dataset.printPublico);
  if (p) p.publico = chk.checked;
});

// ===================== LIGHTBOX =====================
function abrirLightbox(lista, idx) {
  lbLista = lista;
  lbIdx = idx;
  const lb = document.getElementById('lightbox');
  lb.style.display = 'flex';
  renderLb();
}

function fecharLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

function renderLb() {
  const p = lbLista[lbIdx];
  const img = document.getElementById('lbImg');
  img.src = p.img || '';
  img.style.display = p.img ? 'block' : 'none';
  document.getElementById('lbMateria').textContent = p.materia || '';
  document.getElementById('lbTag').textContent = p.tag || '—';
  document.getElementById('lbCounter').textContent = `${lbIdx + 1} / ${lbLista.length}`;
}

document.getElementById('lbClose').onclick = fecharLightbox;
document.getElementById('lbPrev').onclick = () => { lbIdx = (lbIdx - 1 + lbLista.length) % lbLista.length; renderLb(); };
document.getElementById('lbNext').onclick = () => { lbIdx = (lbIdx + 1) % lbLista.length; renderLb(); };
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) fecharLightbox(); });
document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').style.display === 'none') return;
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'ArrowRight') document.getElementById('lbNext').click();
  if (e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
});

// ===================== UPLOAD DE PRINTS =====================
const MATERIAS_PADRAO = ['Direito Constitucional','Direito Administrativo','Direito Penal','Processo Civil','Processo Penal','Administração Geral e Pública','Direito Civil','Direito Tributário'];

function getMaterias() {
  // Usa matérias dos blocos do aluno + padrão, sem duplicatas
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
  if (e.target.files.length) montarLinhasUpload(Array.from(e.target.files));
};

document.getElementById('uploadPrintsDropzone').addEventListener('dragover', e => {
  e.preventDefault(); e.currentTarget.classList.add('dragover');
});
document.getElementById('uploadPrintsDropzone').addEventListener('dragleave', e =>
  e.currentTarget.classList.remove('dragover'));
document.getElementById('uploadPrintsDropzone').addEventListener('drop', e => {
  e.preventDefault(); e.currentTarget.classList.remove('dragover');
  if (e.dataTransfer.files.length) montarLinhasUpload(Array.from(e.dataTransfer.files));
});

function montarLinhasUpload(files) {
  uploadPrintsArquivos = files;
  const materias = getMaterias();
  document.getElementById('uploadPrintsBody').innerHTML = files.map((f, i) => `
    <div class="print-row" data-idx="${i}">
      <div class="print-thumb" id="uthumb-${i}" style="cursor:zoom-in;" data-idx="${i}">···</div>
      <div class="field-col">
        <div class="fname">${f.name}</div>
        <label>Matéria</label>
        <select class="tag-input" id="umateria-${i}" style="margin-bottom:8px;">
          ${materias.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <label>Tag</label>
        <input class="tag-input" placeholder="ex: erro recorrente, súmula 473" id="utag-${i}">
      </div>
    </div>`).join('');

  document.getElementById('uploadPrintsConfirmar').style.display = 'inline-flex';

  files.forEach((f, i) => {
    const r = new FileReader();
    r.onload = ev => {
      const t = document.getElementById('uthumb-' + i);
      if (t) {
        t.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
        // Zoom ao clicar na miniatura
        t.onclick = () => abrirZoomPreview(ev.target.result, f.name);
      }
    };
    if (f.type?.startsWith('image/')) r.readAsDataURL(f);
  });
}

// Zoom preview no modal de upload
function abrirZoomPreview(src, nome) {
  const overlay = document.getElementById('zoomPreviewOverlay');
  document.getElementById('zoomPreviewImg').src = src;
  document.getElementById('zoomPreviewNome').textContent = nome;
  overlay.style.display = 'flex';
}
document.getElementById('zoomPreviewClose').onclick = () =>
  document.getElementById('zoomPreviewOverlay').style.display = 'none';
document.getElementById('zoomPreviewOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('zoomPreviewOverlay'))
    document.getElementById('zoomPreviewOverlay').style.display = 'none';
});

document.getElementById('uploadPrintsConfirmar').onclick = async () => {
  const btn = document.getElementById('uploadPrintsConfirmar');
  btn.textContent = 'Enviando...'; btn.disabled = true;

  for (let i = 0; i < uploadPrintsArquivos.length; i++) {
    const f = uploadPrintsArquivos[i];
    const materia = document.getElementById('umateria-' + i)?.value || 'Geral';
    const tag = document.getElementById('utag-' + i)?.value || 'Sem tag';
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${usuarioAtual.id}/${Date.now()}-${i}-${safeName}`;
    const { error: upErr } = await _supabase.storage.from('prints').upload(path, f, { contentType: f.type });
    if (!upErr) {
      await _supabase.from('prints').insert({
        aluno_id: usuarioAtual.id,
        materia, tag, publico: false,
        storage_path: path
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
  if (!ok) return;
  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;
  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
  await carregarMaterias();
  await carregarPrints();
}
init();