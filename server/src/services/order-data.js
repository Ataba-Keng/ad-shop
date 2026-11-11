import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireCommerceDatabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { createPayTechCheckout } from '../payments/paytech.js';

const rpcErrorMap = {
  INVALID_IDEMPOTENCY_KEY: [400, 'INVALID_IDEMPOTENCY_KEY', 'La demande de commande doit être renouvelée.'],
  INVALID_CUSTOMER_EMAIL: [400, 'INVALID_CUSTOMER_EMAIL', 'Vérifiez l’adresse e-mail.'],
  INVALID_CUSTOMER_PHONE: [400, 'INVALID_CUSTOMER_PHONE', 'Vérifiez le numéro de téléphone.'],
  INVALID_CUSTOMER_NAME: [400, 'INVALID_CUSTOMER_NAME', 'Vérifiez le nom de la personne destinataire.'],
  INVALID_CART_ITEMS: [400, 'INVALID_CART_ITEMS', 'Le panier est vide ou contient trop d’articles.'],
  INVALID_CART_ITEM: [400, 'INVALID_CART_ITEM', 'Un article du panier est invalide. Actualisez le panier.'],
  INVALID_QUANTITY: [400, 'INVALID_QUANTITY', 'La quantité demandée n’est pas valide.'],
  ORDER_NOT_PAYABLE: [409, 'ORDER_NOT_PAYABLE', 'Cette commande ne peut plus recevoir un paiement. Consultez son suivi ou contactez la boutique.'],
  PRODUCT_UNAVAILABLE: [409, 'PRODUCT_UNAVAILABLE', 'Un produit du panier n’est plus disponible.'],
  VARIANT_UNAVAILABLE: [409, 'VARIANT_UNAVAILABLE', 'Une variante du panier n’est plus disponible.'],
  VARIANT_REQUIRED: [400, 'VARIANT_REQUIRED', 'Choisissez une option pour chaque produit concerné.'],
  INSUFFICIENT_STOCK: [409, 'INSUFFICIENT_STOCK', 'La quantité demandée dépasse le stock disponible.'],
  SHIPPING_ADDRESS_REQUIRED: [400, 'SHIPPING_ADDRESS_REQUIRED', 'Une adresse de livraison complète est obligatoire pour un article physique.'],
  SHIPPING_NOT_CONFIGURED: [503, 'SHIPPING_NOT_CONFIGURED', 'Les frais de livraison de cette zone ne sont pas encore configurés.'],
};

function handleRpcError(error, fallback) {
  const message = String(error?.message || '');
  const code = Object.keys(rpcErrorMap).find((candidate) => message.includes(candidate));
  if (code) {
    const [status, errorCode, userMessage] = rpcErrorMap[code];
    throw new AppError(status, errorCode, userMessage);
  }
  throwSupabaseError(error, fallback);
}

export async function startCheckout({ items, customer, countryCode, shippingAddress, paymentMethod, idempotencyKey }) {
  if (!config.paymentsEnabled) {
    throw new AppError(503, 'PAYMENTS_DISABLED', 'Le paiement en ligne est désactivé jusqu’à la configuration finale. Votre panier reste intact et aucun débit ne sera tenté.');
  }
  if (!config.paytechConfigured) {
    throw new AppError(503, 'PAYTECH_NOT_CONFIGURED', 'PayTech n’est pas encore configuré; aucune commande payable ne peut être créée.');
  }
  if (!config.paytechPaymentMethods.includes(paymentMethod)) {
    throw new AppError(400, 'PAYMENT_METHOD_INVALID', 'Ce moyen de paiement n’est pas activé pour ce compte marchand.');
  }
  if (!config.publicSiteUrl.startsWith('https://')) {
    throw new AppError(503, 'PUBLIC_SITE_URL_REQUIRED', 'L’URL publique HTTPS doit être configurée avant d’activer les paiements.');
  }
  requireCommerceDatabase();
  const client = getAdminSupabase();
  const created = await client.rpc('create_store_order', {
    p_idempotency_key: idempotencyKey,
    p_customer_email: customer.email,
    p_customer_phone: customer.phone,
    p_customer_name: customer.name,
    p_country_code: countryCode || 'SN',
    p_shipping_address: shippingAddress || null,
    p_items: items.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id || null, quantity: item.quantity })),
  });
  if (created.error) handleRpcError(created.error, 'La commande n’a pas pu être créée.');

  const order = created.data;
  const existing = await client.from('orders')
    .select('id,order_number,total_xof,payment_status')
    .eq('id', order.order_id)
    .single();
  if (existing.error) throwSupabaseError(existing.error, 'La commande a été réservée, mais son statut ne peut pas être relu.');
  if (existing.data.payment_status === 'paid') {
    return { order_number: existing.data.order_number, total_xof: existing.data.total_xof, currency: 'XOF', already_paid: true };
  }
  if (existing.data.payment_status !== 'pending') {
    throw new AppError(409, 'ORDER_NOT_PAYABLE', 'Cette commande ne peut plus être payée. Videz le panier puis recommencez.');
  }
  const claimResult = await client.rpc('claim_paytech_checkout', { p_order_id: existing.data.id });
  if (claimResult.error) {
    if (String(claimResult.error.message || '').includes('ORDER_NOT_PAYABLE')) {
      const latest = await client.from('orders').select('payment_status').eq('id', existing.data.id).maybeSingle();
      if (!latest.error && latest.data?.payment_status === 'paid') {
        return { order_number: existing.data.order_number, total_xof: existing.data.total_xof, currency: 'XOF', already_paid: true };
      }
      throw new AppError(409, 'ORDER_NOT_PAYABLE', `Cette commande ne peut plus recevoir un paiement. Consultez son suivi ou contactez la boutique avec la référence ${existing.data.order_number}.`);
    }
    handleRpcError(claimResult.error, 'La session de paiement n’a pas pu être réservée.');
  }
  const claim = Array.isArray(claimResult.data) ? claimResult.data[0] : claimResult.data;
  if (claim?.checkout_url) {
    return { order_number: existing.data.order_number, total_xof: existing.data.total_xof, currency: 'XOF', checkout_url: claim.checkout_url };
  }
  if (!claim?.claimed || !claim.claim_id) {
    throw new AppError(409, 'PAYTECH_SESSION_IN_PROGRESS', `Une session de paiement est déjà en cours ou doit être vérifiée pour ${existing.data.order_number}. Ne relancez pas le paiement; attendez la réponse ou contactez la boutique.`);
  }

  let session;
  try {
    session = await createPayTechCheckout({
      order: { order_id: existing.data.id, order_number: existing.data.order_number, total_xof: existing.data.total_xof },
      paymentMethod,
      claimId: claim.claim_id,
    });
  } catch (error) {
    if (error.code === 'PAYTECH_CHECKOUT_REJECTED') {
      const cancelled = await client.rpc('cancel_store_order', { p_order_id: existing.data.id, p_note: 'PayTech a refusé la création de la session' });
      if (cancelled.error) console.error(`[PAYTECH_CHECKOUT_CANCEL_FAILED] ${existing.data.order_number}`);
    }
    throw error;
  }

  const updated = await client.from('orders').update({
    payment_provider: 'paytech',
    provider_reference: existing.data.order_number,
    provider_token: session.providerToken || null,
    provider_checkout_url: session.redirectUrl,
    provider_session_status: 'created',
  }).eq('id', existing.data.id)
    .eq('payment_status', 'pending')
    .eq('provider_session_status', 'creating')
    .eq('provider_checkout_claim_id', claim.claim_id)
    .select('id').single();
  if (updated.error) {
    console.error(`[PAYTECH_SESSION_PERSIST_FAILED] ${existing.data.order_number}`);
    throw new AppError(503, 'PAYTECH_SESSION_PERSIST_FAILED', `PayTech a préparé une session, mais la commande n’a pas pu enregistrer son lien. Ne relancez pas le paiement; contactez la boutique avec la référence ${existing.data.order_number}.`);
  }
  return { order_number: existing.data.order_number, total_xof: existing.data.total_xof, currency: 'XOF', checkout_url: session.redirectUrl };
}

export async function applyPayTechEvent(event, payload) {
  requireCommerceDatabase();
  const result = await getAdminSupabase().rpc('apply_paytech_event', {
    p_order_number: event.orderNumber,
    p_provider_event_id: event.eventId,
    p_event_type: event.eventType,
    p_amount_xof: event.amountXof,
    p_currency: event.currency,
    p_provider_token: event.token,
    p_payload: payload,
  });
  if (result.error) handleRpcError(result.error, 'La notification de paiement n’a pas pu être enregistrée.');
  return result.data;
}

export async function updateOrderFulfillment({ orderId, fulfillmentStatus, trackingReference = '', trackingUrl = '', adminId }) {
  requireCommerceDatabase();
  const client = getAdminSupabase();
  const allowed = new Set(['processing', 'shipped', 'delivered']);
  if (!allowed.has(fulfillmentStatus)) throw new AppError(400, 'INVALID_FULFILLMENT_STATUS', 'Choisissez un statut de préparation valide.');
  if (fulfillmentStatus === 'shipped' && !trackingReference.trim()) {
    throw new AppError(400, 'TRACKING_REQUIRED', 'Ajoutez une référence de suivi avant de marquer la commande expédiée.');
  }
  if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) throw new AppError(400, 'TRACKING_URL_INVALID', 'Le lien de suivi doit commencer par https://.');
  const current = await client.from('orders').select('id,order_number,payment_status,fulfillment_status,tracking_reference,tracking_url').eq('id', orderId).maybeSingle();
  if (current.error) throwSupabaseError(current.error);
  if (!current.data) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  if (current.data.payment_status !== 'paid') throw new AppError(409, 'ORDER_NOT_PAID', 'Une commande doit être payée avant sa préparation.');
  const transitions = {
    unfulfilled: ['processing'],
    processing: ['processing', 'shipped'],
    shipped: ['shipped', 'delivered'],
    delivered: ['delivered'],
    cancelled: [],
  };
  if (!transitions[current.data.fulfillment_status]?.includes(fulfillmentStatus)) {
    throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Cette commande ne peut pas passer à ce statut depuis son état actuel.');
  }
  const updated = await client.from('orders').update({
    fulfillment_status: fulfillmentStatus,
    tracking_reference: trackingReference.trim() || null,
    tracking_url: trackingUrl.trim() || null,
  }).eq('id', orderId).select('id,order_number,fulfillment_status,tracking_reference,tracking_url').single();
  if (updated.error) throwSupabaseError(updated.error, 'Le statut de la commande n’a pas été modifié.');
  await client.from('order_status_events').insert({
    order_id: orderId,
    from_status: current.data.fulfillment_status,
    to_status: fulfillmentStatus,
    note: trackingReference.trim() ? `Suivi : ${trackingReference.trim()}` : '',
    changed_by: adminId,
  });
  return updated.data;
}

export async function createOrderDownloads(orderNumber, email) {
  requireCommerceDatabase();
  const client = getAdminSupabase();
  const orderResult = await client.from('orders').select('id,payment_status,customer_email').eq('order_number', orderNumber).eq('customer_email', email.trim().toLowerCase()).maybeSingle();
  if (orderResult.error) throwSupabaseError(orderResult.error);
  if (!orderResult.data) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable. Vérifiez la référence et l’adresse e-mail.');
  if (orderResult.data.payment_status !== 'paid') throw new AppError(409, 'PAYMENT_PENDING', 'Les fichiers seront disponibles après confirmation du paiement.');
  const lines = await client.from('order_items').select('id,product_id,product_name_snapshot').eq('order_id', orderResult.data.id).eq('product_type', 'digital');
  if (lines.error) throwSupabaseError(lines.error);
  const downloads = [];
  for (const line of lines.data || []) {
    const entitlement = await client.from('digital_entitlements').select('id,download_count,max_downloads,expires_at').eq('order_item_id', line.id).maybeSingle();
    if (entitlement.error) throwSupabaseError(entitlement.error);
    if (!entitlement.data || entitlement.data.download_count >= entitlement.data.max_downloads || (entitlement.data.expires_at && new Date(entitlement.data.expires_at) <= new Date())) continue;
    const asset = await client.from('digital_assets').select('storage_path,original_filename').eq('product_id', line.product_id).limit(1).maybeSingle();
    if (asset.error) throwSupabaseError(asset.error);
    if (!asset.data) continue;
    const updated = await client.from('digital_entitlements').update({ download_count: entitlement.data.download_count + 1 }).eq('id', entitlement.data.id).eq('download_count', entitlement.data.download_count).select('id').maybeSingle();
    if (updated.error) throwSupabaseError(updated.error);
    if (!updated.data) continue;
    const signed = await client.storage.from(config.digitalFilesBucket).createSignedUrl(asset.data.storage_path, 900, { download: asset.data.original_filename });
    if (signed.error) throwSupabaseError(signed.error, 'Le lien de téléchargement n’a pas pu être créé.');
    downloads.push({ product_name: line.product_name_snapshot, url: signed.data.signedUrl, expires_in_seconds: 900 });
  }
  return downloads;
}


export async function getCustomerOrder(orderNumber, email) {
  requireCommerceDatabase();
  const client = getAdminSupabase();
  const result = await client.from('orders')
    .select('id,order_number,customer_email,currency,subtotal_xof,shipping_xof,total_xof,payment_status,fulfillment_status,tracking_reference,tracking_url,created_at,paid_at')
    .eq('order_number', orderNumber)
    .eq('customer_email', email.trim().toLowerCase())
    .maybeSingle();
  if (result.error) throwSupabaseError(result.error);
  if (!result.data) return null;
  const lines = await client.from('order_items')
    .select('id,product_type,product_name_snapshot,variant_name_snapshot,unit_price_xof,quantity,line_total_xof')
    .eq('order_id', result.data.id);
  if (lines.error) throwSupabaseError(lines.error);
  const { id: _internalId, customer_email: _privateEmail, ...order } = result.data;
  return { ...order, items: lines.data || [] };
}
