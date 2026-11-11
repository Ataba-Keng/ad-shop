-- Schéma initial du site de presse sportive.
-- À exécuter dans le SQL Editor d'un projet Supabase neuf.
-- Le script peut être relancé : tables et index sont protégés, politiques et triggers sont recréés.

begin;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  cover_image_url text,
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_name text not null default 'Rédaction sportive'
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

alter table public.articles
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('french'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('french'::regconfig, coalesce(excerpt, '')), 'B')
    || setweight(to_tsvector('french'::regconfig, regexp_replace(coalesce(content, ''), '<[^>]+>', ' ', 'g')), 'C')
  ) stored;

create index if not exists articles_status_published_at_idx
  on public.articles (status, published_at desc);

create index if not exists articles_category_status_published_at_idx
  on public.articles (category_id, status, published_at desc);

create index if not exists articles_featured_status_published_at_idx
  on public.articles (is_featured, status, published_at desc);

create index if not exists articles_search_vector_idx
  on public.articles using gin (search_vector);

create index if not exists article_tags_tag_id_idx
  on public.article_tags (tag_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_article_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

drop trigger if exists articles_set_published_at on public.articles;
create trigger articles_set_published_at
before insert or update on public.articles
for each row execute function public.set_article_published_at();

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

insert into public.categories (name, slug)
values
  ('Football', 'football'),
  ('Basket', 'basket'),
  ('Tennis', 'tennis'),
  ('Rugby', 'rugby')
on conflict (slug) do nothing;

alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.tags enable row level security;
alter table public.article_tags enable row level security;

grant usage on schema public to anon, authenticated, service_role;

revoke all on table public.categories, public.articles, public.tags, public.article_tags
  from public, anon, authenticated;

grant select on table public.categories, public.articles, public.tags, public.article_tags
  to anon, authenticated;

grant insert, update, delete on table public.categories, public.articles, public.tags, public.article_tags
  to authenticated;

grant all privileges on table public.categories, public.articles, public.tags, public.article_tags
  to service_role;

-- Les visiteurs non connectés ne lisent que les articles publiés et dont la date est atteinte.
drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
on public.articles
for select
to anon
using (
  status = 'published'
  and (published_at is null or published_at <= now())
);

-- Le compte d'administration authentifié peut consulter les brouillons.
drop policy if exists "Authenticated users can read all articles" on public.articles;
create policy "Authenticated users can read all articles"
on public.articles
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert articles" on public.articles;
create policy "Authenticated users can insert articles"
on public.articles
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update articles" on public.articles;
create policy "Authenticated users can update articles"
on public.articles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete articles" on public.articles;
create policy "Authenticated users can delete articles"
on public.articles
for delete
to authenticated
using (true);

-- Les catégories sont publiques afin d'alimenter les rubriques du site.
drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert categories" on public.categories;
create policy "Authenticated users can insert categories"
on public.categories
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update categories" on public.categories;
create policy "Authenticated users can update categories"
on public.categories
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete categories" on public.categories;
create policy "Authenticated users can delete categories"
on public.categories
for delete
to authenticated
using (true);

-- Les visiteurs voient seulement les tags associés à un article publié et visible.
drop policy if exists "Public can read tags on published articles" on public.tags;
create policy "Public can read tags on published articles"
on public.tags
for select
to anon
using (
  exists (
    select 1
    from public.article_tags as article_tag
    join public.articles as article on article.id = article_tag.article_id
    where article_tag.tag_id = tags.id
      and article.status = 'published'
      and (article.published_at is null or article.published_at <= now())
  )
);

drop policy if exists "Authenticated users can read all tags" on public.tags;
create policy "Authenticated users can read all tags"
on public.tags
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert tags" on public.tags;
create policy "Authenticated users can insert tags"
on public.tags
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update tags" on public.tags;
create policy "Authenticated users can update tags"
on public.tags
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete tags" on public.tags;
create policy "Authenticated users can delete tags"
on public.tags
for delete
to authenticated
using (true);

-- Le visiteur ne peut lire que les associations de tags appartenant à des articles publiés.
drop policy if exists "Public can read tags of published articles" on public.article_tags;
create policy "Public can read tags of published articles"
on public.article_tags
for select
to anon
using (
  exists (
    select 1
    from public.articles as article
    where article.id = article_tags.article_id
      and article.status = 'published'
      and (article.published_at is null or article.published_at <= now())
  )
);

drop policy if exists "Authenticated users can read all article tags" on public.article_tags;
create policy "Authenticated users can read all article tags"
on public.article_tags
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert article tags" on public.article_tags;
create policy "Authenticated users can insert article tags"
on public.article_tags
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update article tags" on public.article_tags;
create policy "Authenticated users can update article tags"
on public.article_tags
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete article tags" on public.article_tags;
create policy "Authenticated users can delete article tags"
on public.article_tags
for delete
to authenticated
using (true);

-- Le bucket est public pour la lecture par URL. Les formats acceptés sont des images.
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
set name = excluded.name,
    public = true,
    allowed_mime_types = excluded.allowed_mime_types;

-- Un bucket public permet la lecture des fichiers par URL ; aucune politique anon de listage n'est créée.
-- Les opérations d'écriture Storage restent réservées au rôle authenticated.
drop policy if exists "Authenticated users can read article image objects" on storage.objects;
create policy "Authenticated users can read article image objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'article-images');

drop policy if exists "Authenticated users can upload article images" on storage.objects;
create policy "Authenticated users can upload article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images');

drop policy if exists "Authenticated users can update article images" on storage.objects;
create policy "Authenticated users can update article images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

drop policy if exists "Authenticated users can delete article images" on storage.objects;
create policy "Authenticated users can delete article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images');

commit;
