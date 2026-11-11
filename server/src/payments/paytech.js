import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import { config } from '../config.js';

const PAYMENT_ENDPOINT = 'https://paytech.sn/api/payment/request-payment';
const PAYMENT_HOST = 'paytech.sn';

function requirePayTechEnabled() {
  if (!config.commerceDatabaseEnabled) {
    throw new AppError(503, 'COMMERCE_DATABASE_NOT_ENABLED', 'La base e-commerce doit être activée avant le paiement.');
  }
  if (!config.paymentsEnabled) {
    throw new AppError(503, 'PAYMENTS_DISABLED', 'Le paiement en ligne est désactivé jusqu’à la configuration finale. Aucun débit ne sera tenté.');
  }
  if (!config.paytechConfigured) {
    throw new AppError(503, 'PAYTECH_NOT_CONFIGURED', 'PayTech n’est pas encore configuré. Le paiement reste indisponible.');
  }
}

function safeEqualHex(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(received, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function configuredPaymentMethods() {
  return config.commerceDatabaseEnabled && config.paymentsEnabled && config.paytechConfigured ? [...config.paytechPaymentMethods] : [];
}

export async function createPayTechCheckout({ order, paymentMethod, claimId }) {
  requirePayTechEnabled();
  if (!config.paytechPaymentMethods.includes(paymentMethod)) {
    throw new AppError(400, 'PAYMENT_METHOD_UNAVAILABLE', 'Choisissez un moyen de paiement actuellement activé.');
  }
  if (!config.publicSiteUrl.startsWith('https://')) {
    throw new AppError(503, 'PUBLIC_SITE_URL_REQUIRED', 'L’URL publique HTTPS doit être configurée avant d’activer les paiements.');
  }

  const payload = {
    item_name: `Commande ${order.order_number}`,
    item_price: order.total_xof,
    currency: 'XOF',
    ref_command: order.order_number,
    command_name: `AD Shop — ${order.order_number}`,
    target_payment: paymentMethod,
    env: config.paytechEnv,
    ipn_url: `${config.publicSiteUrl}/api/payments/paytech/ipn`,
    success_url: `${config.publicSiteUrl}/commande/${encodeURIComponent(order.order_number)}`,
    cancel_url: `${config.publicSiteUrl}/panier?paiement=annule&commande=${encodeURIComponent(order.order_number)}`,
    custom_field: JSON.stringify({ order_id: order.order_id, order_number: order.order_number, checkout_claim_id: claimId }),
  };

  let response;
  try {
    response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        API_KEY: config.paytechApiKey,
        API_SECRET: config.paytechApiSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AppError(502, 'PAYTECH_UNREACHABLE', `La réponse PayTech est incertaine pour ${order.order_number}. Ne relancez pas le paiement; contactez la boutique avec cette référence.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new AppError(502, 'PAYTECH_INVALID_RESPONSE', `La réponse PayTech est illisible pour ${order.order_number}. Ne relancez pas le paiement; contactez la boutique avec cette référence.`);
  }
  if (Number(result?.success) === 0) {
    throw new AppError(502, 'PAYTECH_CHECKOUT_REJECTED', 'PayTech a explicitement refusé la création de la session. La commande peut être recommencée.');
  }
  const redirectUrl = typeof result.redirect_url === 'string' ? result.redirect_url : result.redirectUrl;
  const providerToken = typeof result.token === 'string' ? result.token : '';
  let parsedRedirect;
  try { parsedRedirect = new URL(redirectUrl); } catch { parsedRedirect = null; }
  if (!response.ok || result.success !== 1 || !parsedRedirect || parsedRedirect.protocol !== 'https:' || parsedRedirect.hostname !== PAYMENT_HOST || !providerToken) {
    throw new AppError(502, 'PAYTECH_SESSION_RESULT_UNKNOWN', `PayTech a répondu sans session vérifiable pour ${order.order_number}. Ne relancez pas le paiement; contactez la boutique avec cette référence.`);
  }
  return { redirectUrl: parsedRedirect.toString(), providerToken };
}

export function verifyPayTechIpn(payload) {
  if (!config.paytechConfigured) return { valid: false, reason: 'PAYTECH_NOT_CONFIGURED' };
  const eventType = String(payload?.type_event || '');
  const orderNumber = String(payload?.ref_command || '');
  const token = String(payload?.token || '');
  const amountRaw = payload?.final_item_price ?? payload?.final_item_price_xof ?? payload?.item_price ?? payload?.item_price_xof;
  const amountXof = Number(amountRaw);
  const currency = String(payload?.currency || '').toUpperCase();
  const receivedHmac = String(payload?.hmac_compute || '');

  if (!['sale_complete', 'sale_canceled', 'refund_complete'].includes(eventType)
    || !/^SP-[0-9]{4}-[A-F0-9]{10}$/i.test(orderNumber)
    || !Number.isSafeInteger(amountXof) || amountXof < 0
    || currency !== 'XOF' || !token || !receivedHmac) {
    return { valid: false, reason: 'INVALID_PAYLOAD' };
  }
  const message = `${amountRaw}|${orderNumber}|${config.paytechApiKey}`;
  const expectedHmac = createHmac('sha256', config.paytechApiSecret).update(message).digest('hex');
  if (!safeEqualHex(expectedHmac, receivedHmac)) return { valid: false, reason: 'INVALID_HMAC' };

  const expectedKeyHash = createHash('sha256').update(config.paytechApiKey).digest('hex');
  if (payload.api_key_sha256 && !safeEqualHex(expectedKeyHash, String(payload.api_key_sha256))) {
    return { valid: false, reason: 'INVALID_API_KEY_HASH' };
  }

  const eventId = createHash('sha256')
    .update(`${orderNumber}|${eventType}|${token}|${amountXof}|${receivedHmac}`)
    .digest('hex');
  return { valid: true, eventType, orderNumber, token, amountXof, currency, eventId };
}
