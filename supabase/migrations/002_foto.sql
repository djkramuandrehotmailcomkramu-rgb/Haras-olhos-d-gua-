alter table public.chuva_medida add column if not exists foto text;
alter table public.fazendas alter column lat drop not null;
alter table public.fazendas alter column lon drop not null;
