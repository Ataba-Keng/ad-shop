export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function throwSupabaseError(error, fallbackMessage = 'La base de données a refusé cette opération.') {
  if (!error) return;
  if (error.code === '23505') {
    throw new AppError(409, 'CONFLICT', 'Ce slug existe déjà. Choisissez-en un autre.');
  }
  if (error.code === '23503') {
    throw new AppError(400, 'INVALID_REFERENCE', 'La catégorie ou le tag sélectionné n’existe plus.');
  }
  if (error.code === 'PGRST116') {
    throw new AppError(404, 'NOT_FOUND', 'L’élément demandé est introuvable.');
  }
  throw new AppError(500, 'DATABASE_ERROR', fallbackMessage);
}

export function notFoundHandler(request, response) {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `La route ${request.method} ${request.originalUrl} n’existe pas.`,
    },
  });
}

export function errorHandler(error, request, response, _next) {
  if (response.headersSent) return;

  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = status >= 500 && !error.code
    ? 'Une erreur interne est survenue. Réessayez dans un instant.'
    : error.message;

  if (status >= 500) {
    console.error(`[${code}] ${request.method} ${request.path}: ${error.message}`);
  }

  response.status(status).json({
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
