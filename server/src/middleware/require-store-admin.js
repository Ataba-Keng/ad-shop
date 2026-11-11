import { AppError } from '../lib/errors.js';
import { getAdminSupabase, requireCommerceDatabase } from '../lib/supabase.js';

export async function requireStoreAdmin(request, _response, next) {
  try {
    if (!request.authUser?.id) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Connectez-vous pour accéder à cette fonction.');
    }
    requireCommerceDatabase();
    const result = await getAdminSupabase()
      .from('store_admins')
      .select('user_id')
      .eq('user_id', request.authUser.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new AppError(403, 'STORE_ADMIN_REQUIRED', 'Ce compte n’est pas autorisé à administrer la boutique.');
    next();
  } catch (error) {
    next(error);
  }
}
