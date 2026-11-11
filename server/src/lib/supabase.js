import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { AppError } from './errors.js';

let authClient;
let adminClient;

export function requireSupabaseConfiguration() {
  if (!config.supabaseConfigured) {
    const message = config.supabasePartiallyConfigured
      ? 'La configuration Supabase est incomplète. Renseignez l’URL, la clé publishable et la clé secret.'
      : 'Supabase n’est pas encore configuré. Les opérations d’administration seront disponibles après le raccordement final.';
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', message);
  }
}

export function requireCommerceDatabase() {
  if (!config.commerceDatabaseEnabled) {
    throw new AppError(503, 'COMMERCE_DATABASE_NOT_ENABLED', 'La boutique reste en démonstration. Appliquez d’abord la migration e-commerce, puis activez COMMERCE_DB_ENABLED=true.');
  }
  requireSupabaseConfiguration();
}

export function getAuthSupabase() {
  requireSupabaseConfiguration();
  authClient ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return authClient;
}

export function getAdminSupabase() {
  requireSupabaseConfiguration();
  adminClient ??= createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}
