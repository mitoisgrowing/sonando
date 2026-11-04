-- Sonando: tablas para los puntos de los espectadores.
-- Pégalo en Supabase → SQL Editor → New query → Run. Solo hace falta una vez.

create table if not exists public.viewers (
  tiktok_id  text primary key,          -- ID numérico de TikTok (no cambia aunque cambie el nombre)
  nick       text,
  handle     text,                      -- @usuario
  avatar     text,
  total      integer not null default 0,
  last_seen  timestamptz
);

create table if not exists public.stream_points (
  stream_id  text not null,             -- fecha y hora del directo
  tiktok_id  text not null references public.viewers (tiktok_id) on delete cascade,
  points     integer not null default 0,
  primary key (stream_id, tiktok_id)
);

-- Sonando escribe con la clave publicable, así que la tabla tiene que permitirlo.
-- Riesgo: quien tenga esa clave podría cambiar puntos. Para evitarlo, usa la clave secreta (sb_secret_...) en Sonando
-- y borra estas dos políticas.
alter table public.viewers enable row level security;
alter table public.stream_points enable row level security;
drop policy if exists "sonando viewers" on public.viewers;
drop policy if exists "sonando stream_points" on public.stream_points;
create policy "sonando viewers" on public.viewers for all to anon, authenticated using (true) with check (true);
create policy "sonando stream_points" on public.stream_points for all to anon, authenticated using (true) with check (true);
