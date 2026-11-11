import sanitizeHtml from 'sanitize-html';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { config } from '../config.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productSelect = 'id,category_id,name,slug,sku,summary,description,product_type,status,price_xof,compare_at_price_xof,inventory_tracked,stock_quantity,is_featured,created_at,updated_at,product_categories(id,name,slug),product_images(id,storage_path,alt_text,sort_order),product_variants(id,sku,name,options,price_xof,inventory_tracked,stock_quantity,is_active,sort_order)';
const richTextPolicy = {
  allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'br'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
};

function requireUuid(value, label = 'Identifiant') {
  if (!uuidPattern.test(String(value || ''))) throw new AppError(400, 'INVALID_ID', `${label} invalide.`);
}

function normalizeAdminProduct(row) {
  return {
    ...row,
    category: row.product_categories || null,
    images: (row.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((image) => ({
      ...image,
      url: getAdminSupabase().storage.from(config.productImageBucket).getPublicUrl(image.storage_path).data.publicUrl,
    })),
    variants: (row.product_variants || []).slice().sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function listAdminProducts({ page = 1, limit = 20, status = 'all', category = '', q = '' }) {
  requireSupabaseConfiguration();
  let query = getAdminSupabase().from('products').select(productSelect, { count: 'exact' }).order('updated_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  if (category) query = query.eq('category_id', category);
  if (q.trim()) query = query.ilike('name', `%${q.trim().replace(/[\\%_]/g, '\\$&').slice(0, 100)}%`);
  const result = await query.range((page - 1) * limit, page * limit - 1);
  if (result.error) throwSupabaseError(result.error, 'Impossible de charger les produits.');
  const total = result.count ?? result.data.length;
  return { items: (result.data || []).map(normalizeAdminProduct), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdminProduct(id) {
  requireSupabaseConfiguration();
  requireUuid(id, 'Produit');
  const result = await getAdminSupabase().from('products').select(productSelect).eq('id', id).maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
  return normalizeAdminProduct(result.data);
}

export async function saveProduct(input, id = null, adminId) {
  requireSupabaseConfiguration();
  if (id) requireUuid(id, 'Produit');
  const client = getAdminSupabase();
  const payload = {
    category_id: input.category_id || null,
    name: input.name.trim(),
    slug: input.slug.trim(),
    sku: input.sku.trim() || null,
    summary: input.summary.trim(),
    description: sanitizeHtml(input.description || '', richTextPolicy),
    product_type: input.product_type,
    status: input.status,
    price_xof: input.price_xof,
    compare_at_price_xof: input.compare_at_price_xof ?? null,
    inventory_tracked: input.variants.length ? false : input.inventory_tracked,
    stock_quantity: input.variants.length ? 0 : input.stock_quantity,
    is_featured: input.is_featured,
  };
  const saved = id
    ? await client.from('products').update(payload).eq('id', id).select('id').single()
    : await client.from('products').insert(payload).select('id').single();
  if (saved.error) throwSupabaseError(saved.error, 'Impossible d’enregistrer le produit. Vérifiez le nom, le slug et le SKU.');
  const productId = saved.data.id;

  const images = (input.images || []).map((image, index) => {
    const storagePath = String(image.storage_path || '');
    if (!storagePath.startsWith(`${adminId}/`) || storagePath.split('/').includes('..')) {
      throw new AppError(400, 'IMAGE_PATH_INVALID', 'Une image ne provient pas du stockage autorisé. Téléversez-la de nouveau.');
    }
    return { product_id: productId, storage_path: storagePath, alt_text: image.alt_text || payload.name, sort_order: index };
  });
  const oldImages = await client.from('product_images').select('storage_path').eq('product_id', productId);
  if (oldImages.error) throwSupabaseError(oldImages.error);
  const removedPaths = (oldImages.data || []).map((image) => image.storage_path).filter((path) => !images.some((image) => image.storage_path === path));
  const removedRows = await client.from('product_images').delete().eq('product_id', productId);
  if (removedRows.error) throwSupabaseError(removedRows.error);
  if (images.length) {
    const insertedImages = await client.from('product_images').insert(images);
    if (insertedImages.error) throwSupabaseError(insertedImages.error, 'Le produit est enregistré, mais ses images n’ont pas été associées.');
  }
  if (removedPaths.length) {
    const cleaned = await client.storage.from(config.productImageBucket).remove(removedPaths);
    if (cleaned.error) throwSupabaseError(cleaned.error, 'Le produit est enregistré, mais une ancienne image n’a pas pu être nettoyée.');
  }

  if (Array.isArray(input.variants)) {
    const existing = await client.from('product_variants').select('id').eq('product_id', productId);
    if (existing.error) throwSupabaseError(existing.error);
    const kept = [];
    for (const [index, variant] of input.variants.entries()) {
      const variantPayload = {
        product_id: productId,
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        options: variant.options || {},
        price_xof: variant.price_xof ?? null,
        inventory_tracked: variant.inventory_tracked,
        stock_quantity: variant.stock_quantity,
        is_active: variant.is_active,
        sort_order: index,
      };
      if (variant.id) {
        requireUuid(variant.id, 'Variante');
        const update = await client.from('product_variants').update(variantPayload).eq('id', variant.id).eq('product_id', productId).select('id').single();
        if (update.error) throwSupabaseError(update.error, 'Impossible d’enregistrer une variante. Vérifiez son SKU.');
        kept.push(update.data.id);
      } else {
        const insert = await client.from('product_variants').insert(variantPayload).select('id').single();
        if (insert.error) throwSupabaseError(insert.error, 'Impossible d’ajouter une variante. Vérifiez son SKU.');
        kept.push(insert.data.id);
      }
    }
    const removeIds = (existing.data || []).map((variant) => variant.id).filter((variantId) => !kept.includes(variantId));
    if (removeIds.length) {
      const removed = await client.from('product_variants').delete().in('id', removeIds).eq('product_id', productId);
      if (removed.error) throwSupabaseError(removed.error, 'Les anciennes variantes n’ont pas toutes été supprimées.');
    }
  }
  return getAdminProduct(productId);
}

export async function archiveProduct(id) {
  requireSupabaseConfiguration();
  requireUuid(id, 'Produit');
  const result = await getAdminSupabase().from('products').update({ status: 'archived' }).eq('id', id).select('id').maybeSingle();
  if (result.error) throwSupabaseError(result.error, 'Impossible d’archiver le produit.');
  if (!result.data) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
}

export async function listAdminCategories() {
  requireSupabaseConfiguration();
  const result = await getAdminSupabase().from('product_categories').select('id,name,slug,description,sort_order,is_active,created_at').order('sort_order').order('name');
  if (result.error) throwSupabaseError(result.error);
  return result.data || [];
}

export async function saveCategory(input, id = null) {
  requireSupabaseConfiguration();
  if (id) requireUuid(id, 'Catégorie');
  const payload = { name: input.name.trim(), slug: input.slug.trim(), description: input.description.trim(), sort_order: input.sort_order, is_active: input.is_active };
  const query = id
    ? getAdminSupabase().from('product_categories').update(payload).eq('id', id)
    : getAdminSupabase().from('product_categories').insert(payload);
  const result = await query.select('id,name,slug,description,sort_order,is_active,created_at').single();
  if (result.error) throwSupabaseError(result.error, 'Impossible d’enregistrer cette catégorie. Vérifiez son nom et son slug.');
  return result.data;
}

export async function deleteCategory(id) {
  requireSupabaseConfiguration();
  requireUuid(id, 'Catégorie');
  const result = await getAdminSupabase().from('product_categories').delete().eq('id', id).select('id').maybeSingle();
  if (result.error) throwSupabaseError(result.error, 'Impossible de supprimer cette catégorie.');
  if (!result.data) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Catégorie introuvable.');
}

export async function listAdminOrders({ page = 1, limit = 25, paymentStatus = 'all', fulfillmentStatus = 'all', q = '' }) {
  requireSupabaseConfiguration();
  let query = getAdminSupabase().from('orders').select('id,order_number,customer_email,customer_phone,customer_name,currency,subtotal_xof,shipping_xof,total_xof,payment_status,fulfillment_status,tracking_reference,tracking_url,created_at,paid_at,order_items(id,product_type,product_name_snapshot,variant_name_snapshot,quantity,unit_price_xof,line_total_xof)', { count: 'exact' }).order('created_at', { ascending: false });
  if (paymentStatus !== 'all') query = query.eq('payment_status', paymentStatus);
  if (fulfillmentStatus !== 'all') query = query.eq('fulfillment_status', fulfillmentStatus);
  if (q.trim()) query = query.ilike('order_number', `%${q.trim().replace(/[\\%_]/g, '\\$&').slice(0, 80)}%`);
  const result = await query.range((page - 1) * limit, page * limit - 1);
  if (result.error) throwSupabaseError(result.error, 'Impossible de charger les commandes.');
  const total = result.count ?? result.data.length;
  return { items: result.data || [], page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdminDashboard() {
  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  const [products, orders, pending, paid] = await Promise.all([
    client.from('products').select('id', { count: 'exact', head: true }).neq('status', 'archived'),
    client.from('orders').select('id', { count: 'exact', head: true }),
    client.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'pending'),
    client.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid'),
  ]);
  for (const result of [products, orders, pending, paid]) if (result.error) throwSupabaseError(result.error);
  return { product_count: products.count || 0, order_count: orders.count || 0, pending_payment_count: pending.count || 0, paid_order_count: paid.count || 0 };
}

export async function listShippingZones() {
  requireSupabaseConfiguration();
  const result = await getAdminSupabase().from('shipping_zones').select('id,country_code,region_name,carrier_name,shipping_fee_xof,estimated_min_days,estimated_max_days,is_active').order('country_code').order('region_name');
  if (result.error) throwSupabaseError(result.error);
  return result.data || [];
}

export async function saveShippingZone(input, id = null) {
  requireSupabaseConfiguration();
  if (id) requireUuid(id, 'Zone de livraison');
  const payload = {
    country_code: input.country_code.toUpperCase(), region_name: input.region_name.trim(), carrier_name: input.carrier_name.trim(),
    shipping_fee_xof: input.shipping_fee_xof, estimated_min_days: input.estimated_min_days ?? null,
    estimated_max_days: input.estimated_max_days ?? null, is_active: input.is_active,
  };
  const query = id
    ? getAdminSupabase().from('shipping_zones').update(payload).eq('id', id)
    : getAdminSupabase().from('shipping_zones').insert(payload);
  const result = await query.select('id,country_code,region_name,carrier_name,shipping_fee_xof,estimated_min_days,estimated_max_days,is_active').single();
  if (result.error) throwSupabaseError(result.error, 'Impossible d’enregistrer cette zone.');
  return result.data;
}

export async function deleteShippingZone(id) {
  requireSupabaseConfiguration();
  requireUuid(id, 'Zone de livraison');
  const result = await getAdminSupabase().from('shipping_zones').delete().eq('id', id).select('id').maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) throw new AppError(404, 'SHIPPING_ZONE_NOT_FOUND', 'Zone de livraison introuvable.');
}
