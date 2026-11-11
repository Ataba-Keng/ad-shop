import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { getHomeData, getPublicCategory, getPublicProduct, listPublicProducts } from './services/commerce-data.js';

function pageNotFound() {
  return { status: 404, initialData: { key: 'not-found', data: { notFound: true } } };
}

async function loadInitialPage(requestUrl) {
  const url = new URL(requestUrl, 'http://sportpress.internal');
  const pathname = url.pathname;
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = 12;

  if (pathname === '/') return { status: 200, initialData: { key: 'home', data: await getHomeData() } };
  if (pathname === '/boutique') {
    const q = (url.searchParams.get('q') || '').trim();
    const data = await listPublicProducts({ page, limit, q });
    return { status: 200, initialData: { key: `catalog:${page}:${q}`, data } };
  }
  const productMatch = pathname.match(/^\/produit\/([^/]+)\/?$/);
  if (productMatch) {
    const slug = decodeURIComponent(productMatch[1]);
    const data = await getPublicProduct(slug);
    return data
      ? { status: 200, initialData: { key: `product:${slug}`, data } }
      : { status: 404, initialData: { key: `product:${slug}`, data: { notFound: true } } };
  }
  const categoryMatch = pathname.match(/^\/categorie\/([^/]+)\/?$/);
  if (categoryMatch) {
    const slug = decodeURIComponent(categoryMatch[1]);
    const [category, products] = await Promise.all([
      getPublicCategory(slug),
      listPublicProducts({ page, limit, category: slug }),
    ]);
    return category
      ? { status: 200, initialData: { key: `category:${slug}:${page}`, data: { category, products } } }
      : { status: 404, initialData: { key: `category:${slug}:${page}`, data: { notFound: true } } };
  }
  if (pathname === '/recherche') {
    const q = (url.searchParams.get('q') || '').trim();
    const data = q ? await listPublicProducts({ page, limit, q }) : { items: [], page, limit, total: 0, pages: 1, demoMode: config.demoMode };
    return { status: 200, initialData: { key: `search:${q}:${page}`, data } };
  }
  if (pathname === '/panier' || pathname === '/paiement' || pathname.startsWith('/commande/')
    || pathname === '/contact' || pathname === '/livraison-retours'
    || pathname === '/confidentialite' || pathname === '/conditions') {
    return { status: 200, initialData: { key: 'static-page', data: null } };
  }
  if (pathname.startsWith('/admin')) return { status: 200, initialData: { key: 'admin', data: null } };
  return pageNotFound();
}

export function createSsrHandler({ vite, clientDir, clientDist }) {
  let productionRenderer;
  return async function renderPage(request, response, next) {
    if (request.method !== 'GET') return next();
    const url = new URL(request.originalUrl, 'http://sportpress.internal');
    if (url.pathname.startsWith('/api/') || url.pathname.includes('.') || url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') return next();
    try {
      const page = await loadInitialPage(request.originalUrl);
      let renderer;
      if (vite) renderer = await vite.ssrLoadModule('/src/entry-server.jsx');
      else {
        productionRenderer ??= import(pathToFileURL(join(clientDist, 'server', 'entry-server.js')).href);
        renderer = await productionRenderer;
      }
      const rendered = renderer.render({
        url: request.originalUrl,
        initialData: page.initialData,
        publicSiteUrl: config.publicSiteUrl,
        demoMode: config.demoMode,
      });
      const templatePath = vite ? join(clientDir, 'index.html') : join(clientDist, 'index.html');
      let template = await readFile(templatePath, 'utf8');
      if (vite) template = await vite.transformIndexHtml(request.originalUrl, template);
      const serialized = JSON.stringify({
        key: page.initialData.key,
        data: page.initialData.data,
        demoMode: config.demoMode,
        publicSiteUrl: config.publicSiteUrl,
      }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
      const html = template
        .replace('<!--seo-head-->', rendered.head)
        .replace('<!--app-html-->', rendered.html)
        .replace('<!--initial-data-->', `<script>window.__SPORTPRESS_INITIAL__=${serialized};</script>`);
      response.status(page.status);
      response.set('Content-Type', 'text/html; charset=utf-8');
      response.set('Cache-Control', url.pathname.startsWith('/admin') || url.pathname === '/panier' || url.pathname === '/paiement' ? 'private, no-store' : 'no-cache');
      response.send(html);
    } catch (error) {
      if (vite && error instanceof Error) vite.ssrFixStacktrace(error);
      if (error instanceof URIError) return next(new AppError(400, 'INVALID_URL', 'Cette URL contient un encodage invalide.'));
      next(error);
    }
  };
}
