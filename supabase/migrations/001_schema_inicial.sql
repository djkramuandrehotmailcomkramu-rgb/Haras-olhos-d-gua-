-- Aplicado no projeto Supabase "chuva-pro". RLS ligado em todas as tabelas.
-- ATENÇÃO: as políticas de escrita são abertas porque o app usa link aberto (sem login);
-- a chave do banco fica só no servidor (Vercel). Para endurecer: usar service_role e remover as políticas abertas.
create extension if not exists pgcrypto;
create table public.fazendas (id text primary key, nome text not null, fuso text not null, lat double precision, lon double precision);
create table public.talhoes (id uuid primary key default gen_random_uuid(), fazenda_id text not null references public.fazendas(id) on delete cascade, nome text not null, ha numeric(10,1), geom jsonb not null, lat double precision not null, lon double precision not null, unique (fazenda_id, nome));
create table public.previsoes (id bigint generated always as identity primary key, fazenda_id text not null references public.fazendas(id) on delete cascade, rodada timestamptz not null, modelo text not null, alvo date not null, mm numeric(6,1), prob smallint, unique (fazenda_id, rodada, modelo, alvo));
create index on public.previsoes (fazenda_id, alvo, modelo);
create table public.chuva_medida (id uuid primary key default gen_random_uuid(), fazenda_id text not null references public.fazendas(id) on delete cascade, talhao_id uuid references public.talhoes(id) on delete set null, data date not null, mm numeric(6,1) not null check (mm >= 0 and mm < 500), origem text not null default 'pluviometro', obs text, criado_em timestamptz not null default now(), foto text);
create index on public.chuva_medida (fazenda_id, data);
create table public.erro_modelo (fazenda_id text not null references public.fazendas(id) on delete cascade, modelo text not null, horizonte smallint not null, n_dias int not null, mae numeric(6,2), vies numeric(6,3), acerto numeric(4,3), atualizado_em timestamptz not null default now(), primary key (fazenda_id, modelo, horizonte));
create table public.limites_operacao (fazenda_id text primary key references public.fazendas(id) on delete cascade, cfg jsonb not null);
create table public.push_subs (endpoint text primary key, fazenda_id text not null references public.fazendas(id) on delete cascade, sub jsonb not null, criado_em timestamptz not null default now());
create table public.alertas_enviados (fazenda_id text not null, tipo text not null, dia date not null, primary key (fazenda_id, tipo, dia));
-- RLS + políticas: ver o histórico de migrações do projeto (select aberto; insert/update abertos nas tabelas de escrita da API).
