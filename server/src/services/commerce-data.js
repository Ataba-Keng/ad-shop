import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';
import { demoCategories, demoProducts } from '../data/demo-products.js';

const clone = (value) => structuredClone(value);
const searchable = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
const publicProductColumns = 'id,category_id,name,slug,sku,summary,description,product_type,status,price_xof,compare_at_price_xof,inventory_tracked,stock_quantity,is_featured,created_at,updated_at,product_categories(id,name,slug),product_images(id,storage_path,alt_text,sort_order),product_variants(id,sku,name,options,price_xof,inventory_tracked,stock_quantity,is_active,sort_order)';

function demoPage(items, page, limit) {
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: clone(items.slice(start, start + limit)), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), demoMode: true };
}

function normalizeProduct(row) {
  const categories = row.product_categories || row.category || null;
  const rawVariants = (row.product_variants || row.variants || []).filter((variant) => variant.is_active !== false);
  const variants = rawVariants.map((variant) => ({
    id: variant.id,
    name: variant.name || Object.values(variant.options || {}).join(' / '),
    options: variant.options || {},
    price_xof: variant.price_xof,
    is_available: !variant.inventory_tracked || variant.stock_quantity > 0,
    sort_order: variant.sort_order || 0,
  }));
  const sortedImages = (row.product_images || row.images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const images = sortedImages.map((image) => {
    const url = image.url || (image.storage_path
      ? getAdminSupabase().storage.from(config.productImageBucket).getPublicUrl(image.storage_path).data.publicUrl
      : '');
    return { url, alt_text: image.alt_text || row.name, id: image.id || null };
  }).filter((image) => image.url);
  const variantsAvailable = variants.length > 0 ? variants.some((variant) => variant.is_available) : true;
  return {
    id: row.id,
    category_id: row.category_id || categories?.id || null,
    name: row.name,
    slug: row.slug,
    sku: row.sku || null,
    summary: row.summary || '',
    description: row.description || '',
    product_type: row.product_type,
    status: row.status || 'published',
    price_xof: Number(row.price_xof),
    compare_at_price_xof: row.compare_at_price_xof == null ? null : Number(row.compare_at_price_xof),
    is_featured: Boolean(row.is_featured),
    is_available: Boolean(row.is_available ?? ((!row.inventory_tracked || row.stock_quantity > 0) && variantsAvailable)),
    category: categories ? { id: categories.id, name: categories.name, slug: categories.slug } : null,
    images,
    variants: variants.sort((a, b) => a.sort_order - b.sort_order),
    created_at: row.created_at,
  };
}

function productQuery() {
  return getAdminSupabase().from('products').select(publicProductColumns, { count: 'exact' }).eq('status', 'published');
}

export async function listPublicCategories() {
  if (config.demoMode) return { items: clone(demoCategories), demoMode: true };
  requireSupabaseConfiguration();
  const result = await getAdminSupabase().from('product_categories').select('id,name,slug,description,sort_order').eq('is_active', true).order('sort_order').order('name');
  if (result.error) throwSupabaseError(result.error);
  return { items: result.data || [], demoMode: false };
}

export async function getPublicCategory(slug) {
  if (config.demoMode) return clone(demoCategories.find((category) => category.slug === slug) || null);
  requireSupabaseConfiguration();
  const result = await getAdminSupabase().from('product_categories').select('id,name,slug,description,sort_order').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  return result.data;
}

export async function listPublicProducts({ page = 1, limit = 12, category = '', q = '', featured = false, ids = [] } = {}) {
  if (config.demoMode) {
    let items = demoProducts.filter((product) => product.status === 'published');
    if (category) items = items.filter((product) => product.category?.slug === category);
    if (featured) items = items.filter((product) => product.is_featured);
    if (q.trim()) {
      const needle = searchable(q);
      items = items.filter((product) => searchable(`${product.name} ${product.summary} ${product.description}`).includes(needle));
    }
    if (ids.length) items = items.filter((product) => ids.includes(product.id));
    return demoPage(items, page, limit);
  }

  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  let query = productQuery().order('is_featured', { ascending: false }).order('created_at', { ascending: false });
  if (category) {
    const categoryResult = await client.from('product_categories').select('id').eq('slug', category).eq('is_active', true).maybeSingle();
    if (categoryResult.error) throwSupabaseError(categoryResult.error);
    if (!categoryResult.data) return { items: [], page, limit, total: 0, pages: 1, demoMode: false };
    query = query.eq('category_id', categoryResult.data.id);
  }
  if (featured) query = query.eq('is_featured', true);
  if (q.trim()) {
    const escaped = q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&');
    query = query.ilike('name', `%${escaped}%`);
  }
  if (ids.length) query = query.in('id', ids);
  const from = (page - 1) * limit;
  const result = await query.range(from, from + limit - 1);
  if (result.error) throwSupabaseError(result.error, 'Impossible de charger les produits.');
  const total = result.count ?? result.data.length;
  return { items: (result.data || []).map(normalizeProduct), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), demoMode: false };
}

export async function getPublicProduct(slug) {
  if (config.demoMode) {
    const product = demoProducts.find((item) => item.slug === slug && item.status === 'published');
    if (!product) return null;
    const related = demoProducts.filter((item) => item.id !== product.id && item.category?.slug === product.category?.slug).slice(0, 4);
    return { item: clone(product), related: clone(related), demoMode: true };
  }
  requireSupabaseConfiguration();
  const result = await productQuery().eq('slug', slug).maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) return null;
  const item = normalizeProduct(result.data);
  const relatedResult = item.category_id
    ? await productQuery().eq('category_id', item.category_id).neq('id', item.id).order('created_at', { ascending: false }).limit(4)
    : { data: [], error: null };
  if (relatedResult.error) throwSupabaseError(relatedResult.error);
  return { item, related: (relatedResult.data || []).map(normalizeProduct), demoMode: false };
}

export async function getHomeData() {
  const [featuredResult, latestResult, categoriesResult] = await Promise.all([
    listPublicProducts({ page: 1, limit: 1, featured: true }),
    listPublicProducts({ page: 1, limit: 8 }),
    listPublicCategories(),
  ]);
  const featured = featuredResult.items[0] || latestResult.items[0] || null;
  const sections = await Promise.all(categoriesResult.items.map(async (category) => ({
    category,
    products: (await listPublicProducts({ page: 1, limit: 4, category: category.slug })).items,
  })));
  return {
    featured,
    products: latestResult.items.filter((product) => product.id !== featured?.id),
    categories: categoriesResult.items,
    sections: sections.filter((section) => section.products.length > 0),
    demoMode: config.demoMode,
  };
}

export async function quoteCart(items) {
  const ids = [...new Set(items.map((item) => item.product_id))];
  const products = await listPublicProducts({ page: 1, limit: Math.max(1, ids.length), ids });
  const byId = new Map(products.items.map((product) => [product.id, product]));
  const lines = [];
  for (const line of items) {
    const product = byId.get(line.product_id);
    if (!product || !product.is_available) {
      throw new AppError(409, 'PRODUCT_UNAVAILABLE', 'Un produit du panier n’est plus disponible. Actualisez votre panier.');
    }
    const variant = line.variant_id ? product.variants.find((item) => item.id === line.variant_id) : null;
    if (line.variant_id && (!variant || !variant.is_available)) {
      throw new AppError(409, 'VARIANT_UNAVAILABLE', 'Une variante du panier n’est plus disponible. Choisissez une autre option.');
    }
    if (product.variants.length && !variant) {
      throw new AppError(400, 'VARIANT_REQUIRED', `Choisissez une option pour « ${product.name} ».`);
    }
    const unitPrice = Number(variant?.price_xof ?? product.price_xof);
    lines.push({
      product_id: product.id, slug: product.slug, variant_id: variant?.id || null, name: product.name,
      variant_name: variant?.name || '', product_type: product.product_type,
      image: product.images[0] || null, unit_price_xof: unitPrice,
      quantity: line.quantity, line_total_xof: unitPrice * line.quantity,
    });
  }
  return { items: lines, subtotal_xof: lines.reduce((sum, item) => sum + item.line_total_xof, 0), currency: 'XOF', demoMode: config.demoMode };
}

export async function getStoreOrder(orderNumber, email) {
  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  const orderResult = await client.from('orders').select('id,order_number,customer_email,customer_phone,customer_name,currency,subtotal_xof,shipping_xof,total_xof,payment_status,fulfillment_status,tracking_reference,tracking_url,created_at,paid_at').eq('order_number', orderNumber).eq('customer_email', email.trim().toLowerCase()).maybeSingle();
  if (orderResult.error) throwSupabaseError(orderResult.error);
  if (!orderResult.data) return null;
  const linesResult = await client.from('order_items').select('id,product_id,product_type,product_name_snapshot,variant_name_snapshot,unit_price_xof,quantity,line_total_xof').eq('order_id', orderResult.data.id);
  if (linesResult.error) throwSupabaseError(linesResult.error);
  const order = { ...orderResult.data, items: linesResult.data || [], downloads: [] };
  if (order.payment_status === 'paid') {
    const digitalItems = (linesResult.data || []).filter((item) => item.product_type === 'digital');
    for (const item of digitalItems) {
      const entitlement = await client.from('digital_entitlements').select('id,download_count,max_downloads,expires_at').eq('order_item_id', item.id).maybeSingle();
      if (entitlement.error) throwSupabaseError(entitlement.error);
      if (!entitlement.data || entitlement.data.download_count >= entitlement.data.max_downloads || (entitlement.data.expires_at && new Date(entitlement.data.expires_at) <= new Date())) continue;
      const asset = await client.from('digital_assets').select('storage_path,original_filename').eq('product_id', item.product_id).limit(1).maybeSingle();
      if (asset.error) throwSupabaseError(asset.error);
      if (!asset.data) continue;
      const updated = await client.from('digital_entitlements').update({ download_count: entitlement.data.download_count + 1 }).eq('id', entitlement.data.id).eq('download_count', entitlement.data.download_count).select('id').maybeSingle();
      if (updated.error) throwSupabaseError(updated.error);
      if (!updated.data) continue;
      const signed = await client.storage.from(config.digitalFilesBucket).createSignedUrl(asset.data.storage_path, 900, { download: asset.data.original_filename });
      if (signed.error) throwSupabaseError(signed.error, 'Le lien de téléchargement ne peut pas être créé.');
      order.downloads.push({ product_name: item.product_name_snapshot, url: signed.data.signedUrl, expires_in_seconds: 900 });
    }
  }
  return order;
}

export function assertCommerceConfiguration() {
  if (config.nodeEnv === 'production' && !config.commerceDatabaseEnabled) {
    throw new AppError(503, 'COMMERCE_DATABASE_NOT_ENABLED', 'La boutique de production doit être raccordée à la base e-commerce après application de sa migration.');
  }
  if (config.nodeEnv === 'production' && !config.supabaseConfigured) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'La boutique doit être raccordée à Supabase avant sa mise en ligne.');
  }
}
