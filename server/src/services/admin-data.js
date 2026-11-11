import sanitizeHtml from 'sanitize-html';
import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

const articleSelect = 'id,title,slug,excerpt,content,cover_image_url,category_id,status,is_featured,published_at,created_at,updated_at,author_name,categories(id,name,slug),article_tags(tags(id,name,slug))';
const htmlPolicy = {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'img', 'br', 'hr'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'data-storage-path'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
};

function normalizeArticle(row) {
  return {
    ...row,
    category: row.categories || null,
    tags: (row.article_tags || []).map((entry) => entry.tags).filter(Boolean),
    tag_ids: (row.article_tags || []).map((entry) => entry.tags?.id).filter(Boolean),
  };
}

function requireValidUuid(value, name = 'Identifiant') {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, 'INVALID_ID', `${name} invalide.`);
  }
}

function collectImagePaths(article) {
  const paths = new Set();
  const candidates = [article?.cover_image_url || ''];
  const content = String(article?.content || '');
  const imagePattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  for (const match of content.matchAll(imagePattern)) candidates.push(match[2]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate, 'https://sportpress.invalid');
      const marker = `/storage/v1/object/public/${config.storageBucket}/`;
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex === -1) continue;
      const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      if (path && !path.split('/').includes('..')) paths.add(path);
    } catch {
      // Ignore malformed or demo image URLs; only this project's Storage bucket is deleted.
    }
  }
  return [...paths];
}

async function removeUnusedImages(paths) {
  if (!paths.length) return;
  const { error } = await getAdminSupabase().storage.from(config.storageBucket).remove(paths);
  if (error) throwSupabaseError(error, 'L’article a été enregistré, mais le nettoyage des images a échoué.');
}

async function getArticleRow(id) {
  const result = await getAdminSupabase().from('articles').select(articleSelect).eq('id', id).maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) throw new AppError(404, 'NOT_FOUND', 'Article introuvable.');
  return result.data;
}

async function syncTags(articleId, tagIds) {
  const client = getAdminSupabase();
  const removed = await client.from('article_tags').delete().eq('article_id', articleId);
  if (removed.error) throwSupabaseError(removed.error);
  if (!tagIds.length) return;
  const inserted = await client.from('article_tags').insert(tagIds.map((tag_id) => ({ article_id: articleId, tag_id })));
  if (inserted.error) throwSupabaseError(inserted.error, 'L’article a été enregistré, mais la mise à jour de ses tags a échoué.');
}

export async function listAdminArticles({ page = 1, limit = 20, status = 'all', category = '', q = '' }) {
  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  let query = client.from('articles').select(articleSelect, { count: 'exact' }).order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  if (category) query = query.eq('category_id', category);
  if (q.trim()) query = query.textSearch('search_vector', q.trim(), { config: 'french', type: 'websearch' });
  const result = await query.range((page - 1) * limit, page * limit - 1);
  if (result.error) throwSupabaseError(result.error, 'Impossible de charger les articles de l’administration.');
  const total = result.count ?? result.data.length;
  return { items: result.data.map(normalizeArticle), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdminArticle(id) {
  requireSupabaseConfiguration();
  requireValidUuid(id, 'Identifiant d’article');
  return normalizeArticle(await getArticleRow(id));
}

export async function saveArticle(input, id = null) {
  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  if (id) requireValidUuid(id, 'Identifiant d’article');

  const content = sanitizeHtml(input.content || '', htmlPolicy);
  const publishedAt = input.published_at || (input.status === 'published' ? new Date().toISOString() : null);
  const payload = {
    title: input.title.trim(),
    slug: input.slug.trim(),
    excerpt: input.excerpt.trim(),
    content,
    cover_image_url: input.cover_image_url || null,
    category_id: input.category_id || null,
    status: input.status,
    is_featured: Boolean(input.is_featured),
    published_at: publishedAt,
    author_name: input.author_name.trim() || 'Rédaction sportive',
  };

  const oldArticle = id ? await getArticleRow(id) : null;
  const result = id
    ? await client.from('articles').update(payload).eq('id', id).select('id').single()
    : await client.from('articles').insert(payload).select('id').single();
  if (result.error) throwSupabaseError(result.error, 'Impossible d’enregistrer cet article. Vérifiez les champs et réessayez.');

  await syncTags(result.data.id, input.tag_ids || []);
  const saved = await getArticleRow(result.data.id);
  if (oldArticle) {
    const keep = new Set(collectImagePaths(saved));
    const removed = collectImagePaths(oldArticle).filter((path) => !keep.has(path));
    await removeUnusedImages(removed);
  }
  return normalizeArticle(saved);
}

export async function deleteArticle(id) {
  requireSupabaseConfiguration();
  requireValidUuid(id, 'Identifiant d’article');
  const client = getAdminSupabase();
  const article = await getArticleRow(id);
  const result = await client.from('articles').delete().eq('id', id);
  if (result.error) throwSupabaseError(result.error, 'Impossible de supprimer cet article.');
  await removeUnusedImages(collectImagePaths(article));
}

const taxonomyInput = (input) => ({
  name: String(input.name || '').trim(),
  slug: String(input.slug || '').trim(),
});

function validateTaxonomy(input, type) {
  const values = taxonomyInput(input);
  if (values.name.length < 2 || values.name.length > 80) {
    throw new AppError(400, 'VALIDATION_ERROR', `${type} : le nom doit contenir de 2 à 80 caractères.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', `${type} : le slug doit utiliser des minuscules, chiffres et tirets.`);
  }
  return values;
}

export async function listAdminTaxonomy(table) {
  requireSupabaseConfiguration();
  if (!['categories', 'tags'].includes(table)) throw new AppError(400, 'INVALID_TYPE', 'Type de rubrique invalide.');
  const result = await getAdminSupabase().from(table).select('*').order('name');
  if (result.error) throwSupabaseError(result.error);
  return result.data;
}

export async function saveTaxonomy(table, input, id = null) {
  requireSupabaseConfiguration();
  if (!['categories', 'tags'].includes(table)) throw new AppError(400, 'INVALID_TYPE', 'Type de rubrique invalide.');
  if (id) requireValidUuid(id, 'Identifiant');
  const payload = validateTaxonomy(input, table === 'categories' ? 'Catégorie' : 'Tag');
  const query = id
    ? getAdminSupabase().from(table).update(payload).eq('id', id)
    : getAdminSupabase().from(table).insert(payload);
  const result = await query.select('*').single();
  if (result.error) throwSupabaseError(result.error, 'Impossible d’enregistrer cet élément. Vérifiez son nom et son slug.');
  return result.data;
}

export async function deleteTaxonomy(table, id) {
  requireSupabaseConfiguration();
  if (!['categories', 'tags'].includes(table)) throw new AppError(400, 'INVALID_TYPE', 'Type de rubrique invalide.');
  requireValidUuid(id, 'Identifiant');
  const result = await getAdminSupabase().from(table).delete().eq('id', id);
  if (result.error) throwSupabaseError(result.error, 'Impossible de supprimer cet élément.');
}
