import { AppError } from '../lib/errors.js';
import { config } from '../config.js';
import { getAuthSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

export async function requireAuth(request, _response, next) {
  try {
    if (!config.commerceDatabaseEnabled) {
      throw new AppError(503, 'COMMERCE_DATABASE_NOT_ENABLED', 'L’administration boutique sera disponible après application de la migration et activation de la base e-commerce.');
    }
    requireSupabaseConfiguration();
    const authorization = request.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Connectez-vous pour effectuer cette action.');
    }

    const { data, error } = await getAuthSupabase().auth.getUser(match[1]);
    if (error || !data?.user) {
      throw new AppError(401, 'INVALID_SESSION', 'Votre session a expiré. Reconnectez-vous.');
    }

    request.authUser = data.user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWritableDatabase(_request, _response, next) {
  if (!config.supabaseConfigured) {
    next(new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'L’administration sera disponible après le raccordement Supabase final.'));
    return;
  }
  next();
}
