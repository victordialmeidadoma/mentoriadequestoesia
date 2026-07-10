// Depende de: config.js, auth.js (carregarSessao, usuarioAtual, perfilAtual, esconderLoading, logout)

// ===================== PRINTS: ABA =====================
async function carregarPrints(){
  const { data: meus } = await _supabase
    .from('prints')
    .select('*')
    .eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });
  printsAluno = await Promise.all((meus||[]).map(async p=>{
    let imgUrl = null;
    if(p.storage_path){
      const { data } = await _supabase.storage.from('prints').createSignedUrl(p.storage_path, 86400);
      imgUrl = data?.signedUrl || null;
    }
    return { ...p, img: imgUrl, cor:'#0B6E4F' };
  }));

  const { data: pub } = await _supabase
    .from('prints')
    .select('*, perfis(nome)')
    .eq('publico', true)
    .neq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });
  feedPrints = await Promise.all((pub||[]).map(async p=>{
    let imgUrl2 = null;
    if(p.storage_path){
      const { data } = await _supabase.storage.from('prints').createSignedUrl(p.storage_path, 86400);
      imgUrl2 = data?.signedUrl || null;
    }
    return { ...p, img: imgUrl2, autor: p.perfis?.nome||'Colega', cor:'#2563A8' };
  }));

  renderPrintsChips();
  renderPrintsView();
}

function renderPrintsChips(){
  const materias=[...new Set(printsAluno.map(p=>p.materia))];
  document.getElementById('printsChips').innerHTML =
    `<div class="p-chip ${printsFiltroMateria==='todas'?'active':''}" data-materia="todas">Todas</div>`
    +materias.map(m=>`<div class="p-chip ${printsFiltroMateria===m?'active':''}" data-materia="${m}">${m}</div>`).join('');
}

document.getElementById('printsChips').addEventListener('click',(e)=>{
  const chip=e.target.closest('.p-chip'); if(!chip) return;
  printsFiltroMateria=chip.dataset.materia;
  renderPrintsChips(); renderPrintsView();
});

document.querySelectorAll('.prints-subnav button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.prints-subnav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    printsViewAtual=btn.dataset.pview;
    document.getElementById('abrirUploadPrintsBtn').style.display=printsViewAtual==='meus'?'inline-flex':'none';
    renderPrintsChips(); renderPrintsView();
  });
});

document.getElementById('printsOrdem').addEventListener('change', renderPrintsView);

function thumbHtml(p){
  return p.img
    ?`<img src="${p.img}" alt="print">`
    :`<div class="pc-placeholder" style="background:${p.cor}22;color:${p.cor};">${p.materia}</div>`;
}

function renderPrintsView(){
  const wrap=document.getElementById('printsView');
  const ordem=document.getElementById('printsOrdem').value;
  let lista = printsViewAtual==='meus'
    ? printsAluno.filter(p=>printsFiltroMateria==='todas'||p.materia===printsFiltroMateria)
    : feedPrints.filter(p=>printsFiltroMateria==='todas'||p.materia===printsFiltroMateria);
  lista = lista.slice().sort((a,b)=>ordem==='antigos'
    ? a.created_at.localeCompare(b.created_at)
    : b.created_at.localeCompare(a.created_at));

  if(!lista.length){
    wrap.innerHTML=`<div class="empty"><span class="display">${printsViewAtual==='meus'?'Nenhum print ainda':'Nenhum print público da turma'}</span>${printsViewAtual==='meus'?'Adicione prints durante a resolução de um bloco ou clique em "Adicionar prints".':'Quando colegas tornarem prints públicos, aparecem aqui.'}</div>`;
    return;
  }

  wrap.innerHTML=`<div class="prints-feed">${lista.map((p,i)=>`
    <div class="feed-item" data-idx="${i}">
      ${p.img
        ?`<img src="${p.img}" alt="${p.tag||''}" loading="lazy">`
        :`<div class="feed-placeholder">${p.materia}</div>`}
      <div class="feed-overlay">
        <div class="f-materia">${p.materia}</div>
        <div class="f-tag">${p.tag||'—'}</div>
      </div>
      ${printsViewAtual==='meus'?`<div class="feed-pub-badge">
        <label class="toggle-label-wrap" style="gap:5px;" onclick="event.stopPropagation()">
          <div class="toggle-switch"><input type="checkbox" data-print-publico="${p.id}" ${p.publico?'checked':''}><span class="slider"></span></div>
          <span style="font-size:10px;">Público</span>
        </label>
      </div>`:`<div class="feed-pub-badge">${p.autor||'Colega'}</div>`}
    </div>`).join('')}</div>
  ${printsViewAtual==='feed'?`<div id="feedCompartilharPanel"></div>`:''}`;

  // lightbox click
  wrap.querySelectorAll('.feed-item').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if(e.target.closest('input')||e.target.closest('.toggle-switch')) return;
      abrirLightbox(lista, parseInt(el.dataset.idx));
    });
  });
}

// ===== Lightbox =====
let lbLista = [], lbIdx = 0;
const lb = document.getElementById('lightbox');

function abrirLightbox(lista, idx){
  lbLista=lista; lbIdx=idx;
  lb.style.display='flex';
  renderLb();
}
function fecharLightbox(){ lb.style.display='none'; }
function renderLb(){
  const p=lbLista[lbIdx];
  document.getElementById('lbImg').src = p.img||'';
  document.getElementById('lbImg').style.display = p.img?'block':'none';
  document.getElementById('lbMateria').textContent = p.materia;
  document.getElementById('lbTag').textContent = p.tag||'—';
  document.getElementById('lbCounter').textContent = `${lbIdx+1} / ${lbLista.length}`;
}
document.getElementById('lbClose').onclick=fecharLightbox;
document.getElementById('lbPrev').onclick=()=>{ lbIdx=(lbIdx-1+lbLista.length)%lbLista.length; renderLb(); };
document.getElementById('lbNext').onclick=()=>{ lbIdx=(lbIdx+1)%lbLista.length; renderLb(); };
lb.addEventListener('click',(e)=>{ if(e.target===lb) fecharLightbox(); });
document.addEventListener('keydown',(e)=>{
  if(lb.style.display==='none') return;
  if(e.key==='Escape') fecharLightbox();
  if(e.key==='ArrowRight') document.getElementById('lbNext').click();
  if(e.key==='ArrowLeft') document.getElementById('lbPrev').click();
});

document.getElementById('printsView').addEventListener('change', async (e)=>{
  const chk=e.target.closest('[data-print-publico]'); if(!chk) return;
  await _supabase.from('prints').update({publico:chk.checked}).eq('id',chk.dataset.printPublico);
  const p=printsAluno.find(x=>x.id===chk.dataset.printPublico);
  if(p) p.publico=chk.checked;
});

document.getElementById('printsView').addEventListener('click', async (e)=>{
  const btn=e.target.closest('[data-compartilhar]'); if(!btn) return;
  const original=feedPrints.find(p=>p.id===btn.dataset.compartilhar);
  if(!original) return;
  // copia o registro apontando para o mesmo storage_path
  await _supabase.from('prints').insert({
    aluno_id: usuarioAtual.id,
    materia: original.materia,
    tag: original.tag+' (de '+original.autor+')',
    publico: false,
    storage_path: original.storage_path
  });
  btn.textContent='Salvo ✓'; btn.disabled=true;
  await carregarPrints();
});

// upload geral de prints
const MATERIAS_PADRAO=['Direito Constitucional','Direito Administrativo','Direito Penal','Processo Civil','Processo Penal','Administração Geral e Pública'];

document.getElementById('abrirUploadPrintsBtn').onclick=()=>{
  uploadPrintsArquivos=[];
  document.getElementById('uploadPrintsBody').innerHTML='';
  document.getElementById('uploadPrintsConfirmar').style.display='none';
  document.getElementById('uploadPrintsModalOverlay').style.display='flex';
};
document.getElementById('uploadPrintsCancelar').onclick=()=> document.getElementById('uploadPrintsModalOverlay').style.display='none';
document.getElementById('uploadPrintsDropzone').onclick=()=> document.getElementById('uploadPrintsFileInput').click();
document.getElementById('uploadPrintsFileInput').onchange=(e)=>{ if(e.target.files.length) montarLinhasUpload(Array.from(e.target.files)); };
document.getElementById('uploadPrintsDropzone').addEventListener('dragover',(e)=>{ e.preventDefault(); e.currentTarget.classList.add('dragover'); });
document.getElementById('uploadPrintsDropzone').addEventListener('dragleave',(e)=> e.currentTarget.classList.remove('dragover'));
document.getElementById('uploadPrintsDropzone').addEventListener('drop',(e)=>{ e.preventDefault(); e.currentTarget.classList.remove('dragover'); if(e.dataTransfer.files.length) montarLinhasUpload(Array.from(e.dataTransfer.files)); });

function montarLinhasUpload(files){
  uploadPrintsArquivos=files;
  document.getElementById('uploadPrintsBody').innerHTML=files.map((f,i)=>`
    <div class="print-row" data-idx="${i}">
      <div class="print-thumb" id="uthumb-${i}">···</div>
      <div class="field-col">
        <div class="fname">${f.name}</div>
        <label>Matéria</label>
        <select class="tag-input" id="umateria-${i}" style="margin-bottom:8px;">${MATERIAS_PADRAO.map(m=>`<option>${m}</option>`).join('')}</select>
        <label>Tag</label>
        <input class="tag-input" placeholder="ex: erro recorrente" id="utag-${i}">
      </div>
    </div>`).join('');
  document.getElementById('uploadPrintsConfirmar').style.display='inline-flex';
  files.forEach((f,i)=>{ const r=new FileReader(); r.onload=(ev)=>{ const t=document.getElementById('uthumb-'+i); if(t) t.innerHTML=`<img src="${ev.target.result}">`; }; if(f.type?.startsWith('image/')) r.readAsDataURL(f); });
}

document.getElementById('uploadPrintsConfirmar').onclick=async ()=>{
  for(let i=0;i<uploadPrintsArquivos.length;i++){
    const f=uploadPrintsArquivos[i];
    const materia=document.getElementById('umateria-'+i).value;
    const tag=document.getElementById('utag-'+i).value||'Sem tag';
    const safeName=f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${usuarioAtual.id}/${Date.now()}-${i}-${safeName}`;
    const { error:upErr } = await _supabase.storage.from('prints').upload(path,f,{contentType:f.type});
    if(!upErr) await _supabase.from('prints').insert({aluno_id:usuarioAtual.id,materia,tag,publico:false,storage_path:path});
  }
  document.getElementById('uploadPrintsModalOverlay').style.display='none';
  await carregarPrints();
};


async function init(){
  const ok = await carregarSessao("aluno"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  esconderLoading();
  document.getElementById("appShell").style.display="block";
  await carregarPrints();
}
init();
