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
  return new Promise((resolve) => {
    // Aguarda o Supabase restaurar a sessão via onAuthStateChange
    // (mais confiável que getSession na navegação entre páginas)
    let resolvido = false;

    const { data: { subscription } } = _supabase.auth.onAuthStateChange(async (event, session) => {
      if (resolvido) return;

      if (event === 'SIGNED_OUT' || !session) {
        resolvido = true;
        subscription.unsubscribe();
        window.location.href = '/login.html';
        resolve(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        resolvido = true;
        subscription.unsubscribe();

        usuarioAtual = session.user;

        const { data: perfil } = await _supabase
          .from('perfis')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!perfil) {
          window.location.href = '/login.html';
          resolve(false);
          return;
        }

        if (roleEsperado && perfil.role !== roleEsperado) {
          const destino = perfil.role === 'mentor' ? '/admin/alunos.html' : '/aluno/perfil.html';
          window.location.href = destino;
          resolve(false);
          return;
        }

        perfilAtual = perfil;
        resolve(true);
      }
    });

    // Fallback: se onAuthStateChange demorar mais de 5s, tenta getSession
    setTimeout(async () => {
      if (resolvido) return;
      resolvido = true;
      subscription.unsubscribe();

      const { data: { session } } = await _supabase.auth.getSession();
      if (!session) { window.location.href = '/login.html'; resolve(false); return; }

      usuarioAtual = session.user;
      const { data: perfil } = await _supabase.from('perfis').select('*').eq('id', session.user.id).maybeSingle();
      if (!perfil) { window.location.href = '/login.html'; resolve(false); return; }
      if (roleEsperado && perfil.role !== roleEsperado) {
        window.location.href = perfil.role === 'mentor' ? '/admin/alunos.html' : '/aluno/perfil.html';
        resolve(false); return;
      }
      perfilAtual = perfil;
      resolve(true);
    }, 5000);
  });
}