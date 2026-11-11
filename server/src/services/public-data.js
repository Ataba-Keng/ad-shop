import { demoArticles, demoCategories } from '../data/demo-articles.js';
import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

const currentIso = () => new Date().toISOString();
const searchable = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
const isVisible = (article) => article.status === 'published' && (!article.published_at || article.published_at <= currentIso());
const clone = (value) => structuredClone(value);

function publicQuery() {
  const client = getAdminSupabase();
  return client
    .from('articles')
    .select('id,title,slug,excerpt,content,cover_image_url,category_id,status,is_featured,published_at,created_at,updated_at,author_name,categories(id,name,slug),article_tags(tags(id,name,slug))', { count: 'exact' })
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${currentIso()}`);
}

function normalizeArticle(row) {
  return {
    ...row,
    category: row.categories || null,
    tags: (row.article_tags || []).map((entry) => entry.tags).filter(Boolean),
  };
}

function demoPage(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: clone(items.slice(start, start + limit)),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    demoMode: true,
  };
}

export async function listPublicArticles({ page = 1, limit = 8, category = '', tag = '', featured = false } = {}) {
  if (config.demoMode) {
    let items = demoArticles.filter(isVisible);
    if (category) items = items.filter((article) => article.category?.slug === category);
    if (tag) items = items.filter((article) => article.tags.some((entry) => entry.slug === tag));
    if (featured) items = items.filter((article) => article.is_featured);
    return demoPage(items, page, limit);
  }

  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  let query = publicQuery().order('published_at', { ascending: false, nullsFirst: false });

  if (category) {
    const categoryResult = await client.from('categories').select('id').eq('slug', category).maybeSingle();
    if (categoryResult.error) throwSupabaseError(categoryResult.error);
    if (!categoryResult.data) return { items: [], page, limit, total: 0, pages: 1, demoMode: false };
    query = query.eq('category_id', categoryResult.data.id);
  }

  if (tag) {
    const tagResult = await client.from('tags').select('id').eq('slug', tag).maybeSingle();
    if (tagResult.error) throwSupabaseError(tagResult.error);
    if (!tagResult.data) return { items: [], page, limit, total: 0, pages: 1, demoMode: false };
    const links = await client.from('article_tags').select('article_id').eq('tag_id', tagResult.data.id);
    if (links.error) throwSupabaseError(links.error);
    const ids = (links.data || []).map((link) => link.article_id);
    if (!ids.length) return { items: [], page, limit, total: 0, pages: 1, demoMode: false };
    query = query.in('id', ids);
  }

  if (featured) query = query.eq('is_featured', true);
  const from = (page - 1) * limit;
  const result = await query.range(from, from + limit - 1);
  if (result.error) throwSupabaseError(result.error);
  const total = result.count ?? result.data.length;
  return {
    items: result.data.map(normalizeArticle),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    demoMode: false,
  };
}

export async function getPublicArticle(slug) {
  if (config.demoMode) {
    const article = demoArticles.find((item) => item.slug === slug && isVisible(item));
    if (!article) return null;
    const related = demoArticles
      .filter((item) => item.slug !== slug && item.category_id === article.category_id && isVisible(item))
      .slice(0, 3);
    return { item: clone(article), related: clone(related), demoMode: true };
  }

  requireSupabaseConfiguration();
  const result = await publicQuery().eq('slug', slug).maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) return null;
  const article = normalizeArticle(result.data);
  const relatedResult = article.category_id
    ? await publicQuery().eq('category_id', article.category_id).neq('id', article.id).order('published_at', { ascending: false, nullsFirst: false }).limit(3)
    : { data: [], error: null };
  if (relatedResult.error) throwSupabaseError(relatedResult.error);
  return { item: article, related: (relatedResult.data || []).map(normalizeArticle), demoMode: false };
}

export async function listPublicCategories() {
  if (config.demoMode) return { items: clone(demoCategories), demoMode: true };
  requireSupabaseConfiguration();
  const result = await getAdminSupabase().from('categories').select('id,name,slug,created_at').order('name');
  if (result.error) throwSupabaseError(result.error);
  return { items: result.data, demoMode: false };
}

export async function getPublicCategory(slug) {
  if (config.demoMode) return clone(demoCategories.find((category) => category.slug === slug) || null);
  requireSupabaseConfiguration();
  const result = await getAdminSupabase()
    .from('categories')
    .select('id,name,slug,created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  return result.data;
}

export async function searchPublicArticles({ q, page = 1, limit = 8 }) {
  const term = q.trim();
  if (term.length < 2) return { items: [], page, limit, total: 0, pages: 1, demoMode: config.demoMode };
  if (config.demoMode) {
    const needle = searchable(term);
    const matches = demoArticles.filter((article) => isVisible(article)
      && searchable(`${article.title} ${article.excerpt} ${article.content}`).includes(needle));
    return demoPage(matches, page, limit);
  }

  requireSupabaseConfiguration();
  const result = await publicQuery()
    .textSearch('search_vector', term, { config: 'french', type: 'websearch' })
    .order('published_at', { ascending: false, nullsFirst: false })
    .range((page - 1) * limit, page * limit - 1);
  if (result.error) throwSupabaseError(result.error, 'La recherche dans les articles a échoué.');
  const total = result.count ?? result.data.length;
  return {
    items: result.data.map(normalizeArticle),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    demoMode: false,
  };
}

export async function getHomeData() {
  const [featured, latest, categories] = await Promise.all([
    listPublicArticles({ page: 1, limit: 1, featured: true }),
    listPublicArticles({ page: 1, limit: 8 }),
    listPublicCategories(),
  ]);

  const lead = featured.items[0] || latest.items[0] || null;
  const sections = await Promise.all(categories.items.map(async (category) => ({
    category,
    articles: (await listPublicArticles({ page: 1, limit: 3, category: category.slug })).items,
  })));

  return {
    featured: lead,
    latest: latest.items.filter((article) => article.id !== lead?.id),
    categories: categories.items,
    sections: sections.filter((section) => section.articles.length > 0),
    demoMode: config.demoMode,
  };
}

export function assertPublicConfiguration() {
  if (config.nodeEnv === 'production' && !config.supabaseConfigured) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Le service de publication n’est pas encore configuré.');
  }
}
