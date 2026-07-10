// auth.js — sessão e autenticação compartilhada

let usuarioAtual = null;
let perfilAtual = null;

function esconderLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) el.style.display = 'none';
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = '/login.html';
}

async function carregarSessao(roleEsperado) {
  try {
    const { data: { session }, error: sessErr } = await _supabase.auth.getSession();
    if (sessErr || !session) {
      window.location.href = '/login.html';
      return false;
    }

    usuarioAtual = session.user;

    // Tenta buscar o perfil — com retry caso o RLS esteja causando delay
    let perfil = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { data, error } = await _supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) { perfil = data; break; }
      if (error && error.code !== 'PGRST116') break; // erro que não seja "not found"
      await new Promise(r => setTimeout(r, 400)); // espera 400ms e tenta de novo
    }

    if (!perfil) {
      // Perfil não encontrado — pode ser usuário novo sem perfil ainda
      window.location.href = '/login.html';
      return false;
    }

    if (roleEsperado && perfil.role !== roleEsperado) {
      // Role errado: redireciona para a área certa
      if (perfil.role === 'mentor') window.location.href = '/admin/alunos.html';
      else window.location.href = '/aluno/perfil.html';
      return false;
    }

    perfilAtual = perfil;
    return true;

  } catch (e) {
    console.error('Erro na sessão:', e);
    window.location.href = '/login.html';
    return false;
  }
}