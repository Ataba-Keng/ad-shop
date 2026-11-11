const configuredBase = import.meta.env.VITE_API_URL || '';
const apiBase = configuredBase.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const request = { method, headers, signal };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      request.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      request.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(`${apiBase}${path}`, request);
  } catch {
    throw new ApiError('Le serveur est momentanément injoignable. Réessayez dans un instant.', 0, 'NETWORK_ERROR');
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(error.message || `La demande a échoué (${response.status}).`, response.status, error.code, error.details);
  }
  return payload;
}
