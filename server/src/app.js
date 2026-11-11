import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { apiRouter } from './routes/api.js';
import { config } from './config.js';
import { AppError, errorHandler, notFoundHandler } from './lib/errors.js';
import { listPublicCategories, listPublicProducts } from './services/commerce-data.js';

const xmlEscape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

function createSitemapXml(urls) {
  const entries = urls.map(({ loc, lastmod }) => `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

async function buildSitemap() {
  const origin = config.publicSiteUrl;
  if (!origin) throw new AppError(503, 'PUBLIC_SITE_URL_REQUIRED', 'L’URL publique sera renseignée lors de la configuration finale.');
  const urls = [
    { loc: `${origin}/` },
    { loc: `${origin}/boutique` },
    { loc: `${origin}/livraison-retours` },
    { loc: `${origin}/contact` },
  ];
  const categories = await listPublicCategories();
  for (const category of categories.items) urls.push({ loc: `${origin}/categorie/${encodeURIComponent(category.slug)}` });
  const firstPage = await listPublicProducts({ page: 1, limit: 36 });
  for (const product of firstPage.items) {
    urls.push({ loc: `${origin}/produit/${encodeURIComponent(product.slug)}`, lastmod: product.updated_at || product.created_at });
  }
  for (let page = 2; page <= firstPage.pages; page += 1) {
    const result = await listPublicProducts({ page, limit: 36 });
    for (const product of result.items) urls.push({ loc: `${origin}/produit/${encodeURIComponent(product.slug)}`, lastmod: product.updated_at || product.created_at });
  }
  return createSitemapXml(urls);
}

export function createApplication() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === config.clientOrigin) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));
  app.use(express.urlencoded({ extended: false, limit: '128kb' }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'sportpress-store-api', databaseConfigured: config.supabaseConfigured, demoMode: config.demoMode, paymentsEnabled: config.paymentsEnabled && config.paytechConfigured });
  });
  app.get('/robots.txt', (_request, response) => {
    const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api', 'Disallow: /panier', 'Disallow: /paiement'];
    if (config.publicSiteUrl) lines.push(`Sitemap: ${config.publicSiteUrl}/sitemap.xml`);
    response.type('text/plain').send(`${lines.join('\n')}\n`);
  });
  app.get('/sitemap.xml', async (_request, response) => {
    response.type('application/xml').send(await buildSitemap());
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Trop de demandes. Réessayez dans quelques minutes.' } },
  });
  const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'ORDER_RATE_LIMITED', message: 'Trop de tentatives sur les commandes. Réessayez plus tard.' } },
  });
  app.use('/api/orders', orderLimiter);
  app.use('/api/checkout', orderLimiter);
  app.use('/api', apiLimiter, apiRouter);
  app.use('/api', notFoundHandler);
  return app;
}

export function addFinalHandlers(app) {
  app.use(notFoundHandler);
  app.use(errorHandler);
}
