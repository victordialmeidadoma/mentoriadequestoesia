-- ============================================================
-- MENTORIA — Setup do banco Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. PERFIS (espelha auth.users, define role)
create table if not exists perfis (
  id          uuid references auth.users on delete cascade primary key,
  nome        text not null,
  role        text not null check (role in ('mentor', 'aluno')),
  carreiras   text[],
  horas_semanais numeric default 20,
  mentor_id   uuid references perfis(id),
  created_at  timestamptz default now()
);

-- Cria o perfil automaticamente quando um usuário é criado no Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'aluno')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. DIRECIONAMENTOS
create table if not exists direcionamentos (
  id          uuid default gen_random_uuid() primary key,
  aluno_id    uuid references perfis(id) on delete cascade,
  numero      text not null,
  carreira    text not null,
  periodo     text,
  status      text default 'atual' check (status in ('atual', 'encerrado')),
  meta_blocos int default 0,
  created_at  timestamptz default now()
);


-- 3. BLOCOS
create table if not exists blocos (
  id                 uuid default gen_random_uuid() primary key,
  direcionamento_id  uuid references direcionamentos(id) on delete cascade,
  aluno_id           uuid references perfis(id) on delete cascade,
  codigo             text not null,   -- ex: 01A, 01B
  disciplina         text not null,
  link               text,
  etapa              int default 0,   -- 0=pendente, 1=iniciado, 2=acertos, 3=prints, 4=finalizado
  pre_agendado       boolean default false,
  acertos            int,
  prints_count       int default 0,
  created_at         timestamptz default now()
);


-- 4. PRINTS
create table if not exists prints (
  id           uuid default gen_random_uuid() primary key,
  aluno_id     uuid references perfis(id) on delete cascade,
  bloco_id     uuid references blocos(id) on delete set null,
  materia      text not null,
  tag          text,
  publico      boolean default false,
  storage_path text not null,   -- caminho no Supabase Storage (bucket: prints)
  created_at   timestamptz default now()
);


-- 5. EDITAIS
create table if not exists editais (
  id          uuid default gen_random_uuid() primary key,
  concurso    text not null,
  cargo       text,
  banca       text,
  data_prova  date,
  criado_por  uuid references perfis(id),
  created_at  timestamptz default now()
);

create table if not exists edital_topicos (
  id        uuid default gen_random_uuid() primary key,
  edital_id uuid references editais(id) on delete cascade,
  materia   text not null,
  assunto   text not null
);

create table if not exists edital_vinculos (
  edital_id uuid references editais(id) on delete cascade,
  aluno_id  uuid references perfis(id) on delete cascade,
  primary key (edital_id, aluno_id)
);

create table if not exists edital_topico_progresso (
  id         uuid default gen_random_uuid() primary key,
  topico_id  uuid references edital_topicos(id) on delete cascade,
  aluno_id   uuid references perfis(id) on delete cascade,
  frequencia int default 0,
  updated_at timestamptz default now(),
  unique(topico_id, aluno_id)   -- garante upsert correto (soma, não duplica)
);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada aluno só vê os próprios dados. Mentor vê tudo.
-- ============================================================

alter table perfis               enable row level security;
alter table direcionamentos      enable row level security;
alter table blocos               enable row level security;
alter table prints               enable row level security;
alter table editais              enable row level security;
alter table edital_topicos       enable row level security;
alter table edital_vinculos      enable row level security;
alter table edital_topico_progresso enable row level security;

-- Helper: retorna true se o usuário logado é mentor
create or replace function is_mentor()
returns boolean language sql security definer
as $$ select exists (select 1 from perfis where id = auth.uid() and role = 'mentor'); $$;

-- PERFIS
create policy "Usuário vê o próprio perfil" on perfis
  for select using (id = auth.uid() or is_mentor());
create policy "Usuário atualiza o próprio perfil" on perfis
  for update using (id = auth.uid());
create policy "Mentor insere perfis" on perfis
  for insert with check (is_mentor());

-- DIRECIONAMENTOS
create policy "Aluno vê os próprios direcionamentos" on direcionamentos
  for select using (aluno_id = auth.uid() or is_mentor());
create policy "Mentor cria/edita direcionamentos" on direcionamentos
  for all using (is_mentor());

-- BLOCOS
create policy "Aluno vê os próprios blocos" on blocos
  for select using (aluno_id = auth.uid() or is_mentor());
create policy "Aluno atualiza os próprios blocos" on blocos
  for update using (aluno_id = auth.uid() or is_mentor());
create policy "Mentor insere blocos" on blocos
  for insert with check (is_mentor());

-- PRINTS
create policy "Aluno vê os próprios prints ou públicos" on prints
  for select using (aluno_id = auth.uid() or publico = true or is_mentor());
create policy "Aluno insere e atualiza os próprios prints" on prints
  for all using (aluno_id = auth.uid() or is_mentor());

-- EDITAIS
create policy "Mentor gerencia editais" on editais
  for all using (is_mentor());
create policy "Aluno vê editais vinculados a si" on editais
  for select using (
    exists (select 1 from edital_vinculos where edital_id = editais.id and aluno_id = auth.uid())
    or is_mentor()
  );

-- EDITAL TÓPICOS
create policy "Leitura de tópicos" on edital_topicos
  for select using (true);
create policy "Mentor gerencia tópicos" on edital_topicos
  for all using (is_mentor());

-- VINCULOS
create policy "Mentor gerencia vínculos" on edital_vinculos
  for all using (is_mentor());
create policy "Aluno vê os próprios vínculos" on edital_vinculos
  for select using (aluno_id = auth.uid() or is_mentor());

-- PROGRESSO
create policy "Aluno vê o próprio progresso" on edital_topico_progresso
  for select using (aluno_id = auth.uid() or is_mentor());
create policy "Mentor atualiza progresso" on edital_topico_progresso
  for all using (is_mentor());


-- ============================================================
-- STORAGE: bucket para prints dos alunos
-- Configure em Storage > New Bucket no dashboard do Supabase
-- Nome: prints
-- Public: NÃO (acesso via RLS / signed URLs)
-- ============================================================

-- ============================================================
-- COMO CRIAR O PRIMEIRO MENTOR:
-- 1. Crie o usuário normalmente pelo Auth (invite ou signUp)
-- 2. No SQL Editor, rode:
--    update perfis set role = 'mentor' where id = '<uuid do usuário>';
-- ============================================================
