import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';
import { quoteCart } from './commerce-data.js';

const zoneFields = 'country_code,region_name,carrier_name,shipping_fee_xof,estimated_min_days,estimated_max_days';

export async function quoteCheckoutShipping(items, countryCode, region) {
  const quote = await quoteCart(items);
  const hasPhysical = quote.items.some((item) => item.product_type === 'physical');
  if (!hasPhysical) return { configured: true, carrier_name: '', shipping_xof: 0, total_xof: quote.subtotal_xof, currency: 'XOF' };
  const country = String(countryCode || 'SN').trim().toUpperCase();
  const area = String(region || '').trim();
  if (!/^[A-Z]{2}$/.test(country)) throw new AppError(400, 'COUNTRY_CODE_INVALID', 'Le pays de livraison est invalide.');
  if (!area) return { configured: false, message: 'Saisissez une région ou une zone pour vérifier les frais de livraison.' };
  if (config.demoMode) return { configured: false, message: 'Aucun tarif de livraison fictif n’est affiché. Les paiements et livraisons sont désactivés dans cet aperçu.' };
  requireSupabaseConfiguration();
  const client = getAdminSupabase();
  const exact = await client.from('shipping_zones').select(zoneFields)
    .eq('country_code', country).eq('region_name', area).eq('is_active', true).maybeSingle();
  if (exact.error) throwSupabaseError(exact.error, 'Impossible de vérifier les frais de livraison.');
  let zone = exact.data;
  if (!zone) {
    const universal = await client.from('shipping_zones').select(zoneFields)
      .eq('country_code', country).eq('region_name', '*').eq('is_active', true).maybeSingle();
    if (universal.error) throwSupabaseError(universal.error, 'Impossible de vérifier les frais de livraison.');
    zone = universal.data;
  }
  if (!zone) return { configured: false, message: 'Aucun tarif actif ne correspond à cette région. Contactez la boutique avant de poursuivre.' };
  const fee = Number(zone.shipping_fee_xof);
  return {
    configured: true,
    carrier_name: zone.carrier_name || '',
    shipping_xof: fee,
    total_xof: quote.subtotal_xof + fee,
    currency: 'XOF',
    estimated_min_days: zone.estimated_min_days,
    estimated_max_days: zone.estimated_max_days,
  };
}
