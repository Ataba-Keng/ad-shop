import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireStoreAdmin } from '../middleware/require-store-admin.js';
import { config } from '../config.js';
import {
  getHomeData,
  getPublicCategory,
  getPublicProduct,
  listPublicCategories,
  listPublicProducts,
  quoteCart,
} from '../services/commerce-data.js';
import { quoteCheckoutShipping } from '../services/shipping-data.js';
import {
  archiveProduct,
  deleteCategory,
  deleteShippingZone,
  getAdminDashboard,
  getAdminProduct,
  listAdminCategories,
  listAdminOrders,
  listAdminProducts,
  listShippingZones,
  saveCategory,
  saveProduct,
  saveShippingZone,
} from '../services/store-admin-data.js';
import {
  applyPayTechEvent,
  createOrderDownloads,
  getCustomerOrder,
  startCheckout,
  updateOrderFulfillment,
} from '../services/order-data.js';
import { configuredPaymentMethods, verifyPayTechIpn } from '../payments/paytech.js';
import { uploadStoreAsset } from './store-upload.js';

export const apiRouter = Router();

function parseQuery(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Vérifiez les paramètres de la demande.', details);
  }
  return parsed.data;
}

function parseBody(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    throw new AppError(400, 'VALIDATION_ERROR', 'Certains champs sont incorrects.', details);
  }
  return parsed.data;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(36).default(12),
  category: z.string().regex(/^[a-z0-9-]*$/).default(''),
  q: z.string().trim().max(100).default(''),
  featured: z.enum(['true', 'false']).default('false'),
});
const productSearchSchema = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(36).default(12) });
const cartItemsSchema = z.array(z.object({
  product_id: z.string().min(1).max(80),
  variant_id: z.string().min(1).max(80).nullable().optional(),
  quantity: z.number().int().min(1).max(10),
})).min(1).max(30);
const checkoutSchema = z.object({
  idempotency_key: z.string().regex(/^[A-Za-z0-9-]{16,100}$/),
  items: cartItemsSchema,
  customer: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().min(7).max(32),
  }),
  country_code: z.string().regex(/^[A-Za-z]{2}$/).default('SN'),
  shipping_address: z.object({
    address_line1: z.string().trim().min(4).max(180),
    address_line2: z.string().trim().max(180).optional().default(''),
    city: z.string().trim().min(2).max(100),
    region: z.string().trim().max(100).optional().default(''),
    postal_code: z.string().trim().max(24).optional().default(''),
    country: z.string().trim().max(80).optional().default('Sénégal'),
  }).nullable().optional(),
  payment_method: z.string().trim().min(2).max(80),
});
const adminProductListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  category: z.string().regex(/^[0-9a-f-]*$/i).default(''), q: z.string().trim().max(100).default(''),
});
const variantSchema = z.object({
  id: z.string().regex(uuidPattern).optional(), sku: z.string().trim().min(1).max(80),
  name: z.string().trim().max(100).default(''), options: z.record(z.string(), z.string()).default({}),
  price_xof: z.number().int().min(0).nullable().optional(), inventory_tracked: z.boolean().default(true),
  stock_quantity: z.number().int().min(0).default(0), is_active: z.boolean().default(true),
});
const productSchema = z.object({
  category_id: z.string().regex(uuidPattern).nullable().optional(),
  name: z.string().trim().min(3).max(160), slug: z.string().trim().min(1).max(180).regex(slugPattern),
  sku: z.string().trim().max(80).default(''), summary: z.string().trim().max(500).default(''),
  description: z.string().max(30000).default(''), product_type: z.enum(['physical', 'digital']),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  price_xof: z.number().int().min(0), compare_at_price_xof: z.number().int().min(0).nullable().optional(),
  inventory_tracked: z.boolean().default(true), stock_quantity: z.number().int().min(0).default(0),
  is_featured: z.boolean().default(false),
  images: z.array(z.object({ storage_path: z.string().min(1).max(500), alt_text: z.string().max(180).optional().default('') })).max(12).default([]),
  variants: z.array(variantSchema).max(50).default([]),
});
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80), slug: z.string().trim().min(1).max(100).regex(slugPattern),
  description: z.string().trim().max(500).default(''), sort_order: z.number().int().min(0).max(10000).default(0), is_active: z.boolean().default(true),
});
const orderListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(25),
  paymentStatus: z.enum(['all', 'pending', 'paid', 'cancelled', 'refunded', 'failed']).default('all'),
  fulfillmentStatus: z.enum(['all', 'unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled']).default('all'),
  q: z.string().trim().max(80).default(''),
});
const fulfillmentSchema = z.object({
  fulfillment_status: z.enum(['processing', 'shipped', 'delivered']),
  tracking_reference: z.string().trim().max(120).default(''), tracking_url: z.string().trim().max(500).default(''),
});
const shippingZoneSchema = z.object({
  country_code: z.string().regex(/^[A-Za-z]{2}$/), region_name: z.string().trim().min(1).max(100), carrier_name: z.string().trim().max(120).default(''),
  shipping_fee_xof: z.number().int().min(0), estimated_min_days: z.number().int().min(0).nullable().optional(),
  estimated_max_days: z.number().int().min(0).nullable().optional(), is_active: z.boolean().default(true),
});

apiRouter.get('/home', async (_request, response) => response.json(await getHomeData()));

apiRouter.get('/products', async (request, response) => {
  const query = parseQuery(productListSchema, request.query);
  response.json(await listPublicProducts({ ...query, featured: query.featured === 'true' }));
});

apiRouter.get('/products/:slug', async (request, response) => {
  const result = await getPublicProduct(request.params.slug);
  if (!result) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Ce produit n’existe pas ou n’est pas disponible.');
  response.json(result);
});

apiRouter.get('/categories', async (_request, response) => response.json(await listPublicCategories()));

apiRouter.get('/categories/:slug/products', async (request, response) => {
  const query = parseQuery(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(36).default(12) }), request.query);
  const category = await getPublicCategory(request.params.slug);
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Cette catégorie n’existe pas.');
  const products = await listPublicProducts({ ...query, category: request.params.slug });
  response.json({ category, products });
});

apiRouter.get('/search', async (request, response) => {
  const query = parseQuery(productSearchSchema, request.query);
  response.json(await listPublicProducts({ ...query, q: query.q }));
});

apiRouter.post('/cart/quote', async (request, response) => {
  const items = parseBody(cartItemsSchema, request.body);
  response.json(await quoteCart(items));
});

apiRouter.post('/checkout/quote', async (request, response) => {
  const input = parseBody(z.object({
    items: cartItemsSchema,
    country_code: z.string().regex(/^[A-Za-z]{2}$/).default('SN'),
    region: z.string().trim().max(100).default(''),
  }), request.body);
  response.json(await quoteCheckoutShipping(input.items, input.country_code, input.region));
});

apiRouter.get('/payments/methods', (_request, response) => {
  response.json({ enabled: config.commerceDatabaseEnabled && config.paymentsEnabled && config.paytechConfigured, items: configuredPaymentMethods(), currency: 'XOF' });
});

apiRouter.post('/checkout', async (request, response) => {
  const input = parseBody(checkoutSchema, request.body);
  const result = await startCheckout({
    ...input,
    countryCode: input.country_code,
    shippingAddress: input.shipping_address || null,
    idempotencyKey: input.idempotency_key,
  });
  response.status(201).json(result);
});

apiRouter.get('/orders/:orderNumber', async (request, response) => {
  const orderNumber = String(request.params.orderNumber || '');
  if (!/^SP-[0-9]{4}-[A-F0-9]{10}$/i.test(orderNumber)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  const email = String(request.query.email || '').trim();
  if (!z.string().email().safeParse(email).success) throw new AppError(400, 'EMAIL_REQUIRED', 'Saisissez l’adresse e-mail utilisée lors de la commande.');
  const order = await getCustomerOrder(orderNumber, email);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable. Vérifiez la référence et l’adresse e-mail.');
  response.json({ item: order });
});

apiRouter.post('/orders/:orderNumber/downloads', async (request, response) => {
  const orderNumber = String(request.params.orderNumber || '');
  if (!/^SP-[0-9]{4}-[A-F0-9]{10}$/i.test(orderNumber)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  const body = parseBody(z.object({ email: z.string().trim().email().max(254) }), request.body);
  const items = await createOrderDownloads(orderNumber, body.email);
  response.json({ items });
});

apiRouter.post('/payments/paytech/ipn', async (request, response) => {
  if (!config.commerceDatabaseEnabled) return response.status(503).type('text/plain').send('Commerce database is not enabled');
  const verification = verifyPayTechIpn(request.body || {});
  if (!verification.valid) return response.status(403).type('text/plain').send('Forbidden');
  const result = await applyPayTechEvent(verification, request.body);
  if (!result?.accepted) {
    console.warn(`[PAYTECH_IPN_REJECTED] ${verification.orderNumber}: ${result?.reason || 'not accepted'}`);
  }
  response.status(200).type('text/plain').send('OK');
});

apiRouter.get('/admin/access', requireAuth, requireStoreAdmin, (_request, response) => response.json({ allowed: true }));

apiRouter.get('/admin/dashboard', requireAuth, requireStoreAdmin, async (_request, response) => {
  const [summary, recentOrders] = await Promise.all([
    getAdminDashboard(),
    listAdminOrders({ page: 1, limit: 6, paymentStatus: 'all', fulfillmentStatus: 'all', q: '' }),
  ]);
  response.json({ summary, recent_orders: recentOrders.items });
});

apiRouter.get('/admin/products', requireAuth, requireStoreAdmin, async (request, response) => {
  response.json(await listAdminProducts(parseQuery(adminProductListSchema, request.query)));
});

apiRouter.get('/admin/products/:id', requireAuth, requireStoreAdmin, async (request, response) => {
  response.json({ item: await getAdminProduct(request.params.id) });
});

apiRouter.post('/admin/products', requireAuth, requireStoreAdmin, async (request, response) => {
  response.status(201).json({ item: await saveProduct(parseBody(productSchema, request.body), null, request.authUser.id) });
});

apiRouter.put('/admin/products/:id', requireAuth, requireStoreAdmin, async (request, response) => {
  response.json({ item: await saveProduct(parseBody(productSchema, request.body), request.params.id, request.authUser.id) });
});

apiRouter.delete('/admin/products/:id', requireAuth, requireStoreAdmin, async (request, response) => {
  await archiveProduct(request.params.id);
  response.json({ ok: true, message: 'Produit archivé; les anciennes lignes de commande sont conservées.' });
});

apiRouter.get('/admin/categories', requireAuth, requireStoreAdmin, async (_request, response) => response.json({ items: await listAdminCategories() }));
apiRouter.post('/admin/categories', requireAuth, requireStoreAdmin, async (request, response) => response.status(201).json({ item: await saveCategory(parseBody(categorySchema, request.body)) }));
apiRouter.put('/admin/categories/:id', requireAuth, requireStoreAdmin, async (request, response) => response.json({ item: await saveCategory(parseBody(categorySchema, request.body), request.params.id) }));
apiRouter.delete('/admin/categories/:id', requireAuth, requireStoreAdmin, async (request, response) => { await deleteCategory(request.params.id); response.json({ ok: true }); });

apiRouter.get('/admin/orders', requireAuth, requireStoreAdmin, async (request, response) => response.json(await listAdminOrders(parseQuery(orderListSchema, request.query))));
apiRouter.patch('/admin/orders/:id/fulfillment', requireAuth, requireStoreAdmin, async (request, response) => {
  const input = parseBody(fulfillmentSchema, request.body);
  const item = await updateOrderFulfillment({
    orderId: request.params.id,
    fulfillmentStatus: input.fulfillment_status,
    trackingReference: input.tracking_reference,
    trackingUrl: input.tracking_url,
    adminId: request.authUser.id,
  });
  response.json({ item });
});

apiRouter.get('/admin/shipping-zones', requireAuth, requireStoreAdmin, async (_request, response) => response.json({ items: await listShippingZones() }));
apiRouter.post('/admin/shipping-zones', requireAuth, requireStoreAdmin, async (request, response) => response.status(201).json({ item: await saveShippingZone(parseBody(shippingZoneSchema, request.body)) }));
apiRouter.put('/admin/shipping-zones/:id', requireAuth, requireStoreAdmin, async (request, response) => response.json({ item: await saveShippingZone(parseBody(shippingZoneSchema, request.body), request.params.id) }));
apiRouter.delete('/admin/shipping-zones/:id', requireAuth, requireStoreAdmin, async (request, response) => { await deleteShippingZone(request.params.id); response.json({ ok: true }); });

apiRouter.post('/admin/upload', requireAuth, requireStoreAdmin, uploadStoreAsset);
