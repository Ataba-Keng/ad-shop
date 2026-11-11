const htmlEscape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const truncate = (value, max = 155) => {
  const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

export function getSeoForPage(pathname, data = {}, siteUrl = '') {
  const origin = String(siteUrl || '').replace(/\/$/, '');
  const requestedUrl = new URL(pathname || '/', 'https://sportpress.invalid');
  const pagePath = requestedUrl.pathname;
  const pageNumber = Math.max(1, Number.parseInt(requestedUrl.searchParams.get('page') || '1', 10) || 1);
  const product = data?.item?.slug ? data.item : data?.featured?.slug ? data.featured : null;
  const isProduct = pagePath.startsWith('/produit/');
  const isCategory = pagePath.startsWith('/categorie/');
  const isSearch = pagePath === '/recherche';
  const isAdmin = pagePath.startsWith('/admin');
  const isPrivate = ['/panier', '/paiement'].includes(pagePath) || pagePath.startsWith('/commande/');
  const isNotFound = Boolean(data?.notFound);

  let title = 'AD Shop — Mode et accessoires au Sénégal';
  let description = 'Vêtements, accessoires et sacs, vêtements et accessoires AD Shop. Une boutique de sélection mode imaginée pour les femmes et hommes au Sénégal.';
  let image = '';
  let type = 'website';
  const noindex = isSearch || isAdmin || isPrivate || isNotFound;

  if (isProduct && product) {
    title = `${product.name} — AD Shop`;
    description = truncate(product.summary || product.description);
    image = product.images?.[0]?.url || '';
    type = 'product';
  } else if (isCategory) {
    const category = data?.category;
    const categoryName = category?.name || 'Collection';
    title = `${categoryName} — AD Shop`;
    description = truncate(category?.description || `Découvrez la sélection ${categoryName} de AD Shop, avec des prix en FCFA.`);
  } else if (isSearch) {
    const query = requestedUrl.searchParams.get('q') || '';
    title = query ? `Résultats pour « ${query} » — AD Shop` : 'Recherche — AD Shop';
    description = 'Rechercher des vêtements, accessoires et sacs, vêtements et accessoires AD Shop.';
  } else if (pagePath.startsWith('/admin')) {
    title = 'Administration — AD Shop';
    description = 'Espace privé de gestion du catalogue et des commandes.';
  } else if (isPrivate) {
    title = pagePath.startsWith('/commande/') ? 'Suivi de commande — AD Shop' : pagePath === '/panier' ? 'Votre panier — AD Shop' : 'Finaliser la commande — AD Shop';
    description = 'Consultez votre commande AD Shop.';
  } else if (pagePath === '/livraison-retours') {
    title = 'Livraison et retours — AD Shop';
    description = 'Informations provisoires sur la livraison et les retours AD Shop.';
  } else if (pagePath === '/contact') {
    title = 'Contact — AD Shop';
    description = 'Contacter le support de AD Shop.';
  } else if (pagePath === '/conditions') {
    title = 'Conditions provisoires — AD Shop';
    description = 'Conditions commerciales provisoires à valider avant toute mise en vente.';
  } else if (pagePath === '/confidentialite') {
    title = 'Confidentialité — AD Shop';
    description = 'Informations provisoires sur la confidentialité de AD Shop.';
  } else if (isNotFound) {
    title = 'Page introuvable — AD Shop';
    description = 'Cette page n’existe pas ou le produit n’est plus disponible.';
  }

  const canonicalPath = isCategory && pageNumber > 1 ? `${pagePath}?page=${pageNumber}` : pagePath;
  const canonical = origin && !noindex ? `${origin}${canonicalPath}` : '';
  const absoluteImage = origin && image
    ? (image.startsWith('http://') || image.startsWith('https://') ? image : `${origin}${image.startsWith('/') ? '' : '/'}${image}`)
    : '';

  return { title, description, canonical, image: absoluteImage, type, noindex };
}

export function renderSeoHead(seo, siteName = 'AD Shop') {
  const head = [
    `<title>${htmlEscape(seo.title)}</title>`,
    `<meta name="description" content="${htmlEscape(seo.description)}">`,
    '<meta name="keywords" content="articles de mode et accessoires, vêtements, sacs, boutique Sénégal, FCFA, AD Shop">',
    `<meta name="robots" content="${seo.noindex ? 'noindex, nofollow' : 'index, follow'}">`,
    `<meta property="og:type" content="${htmlEscape(seo.type)}">`,
    `<meta property="og:site_name" content="${htmlEscape(siteName)}">`,
    `<meta property="og:title" content="${htmlEscape(seo.title)}">`,
    `<meta property="og:description" content="${htmlEscape(seo.description)}">`,
    `<meta name="twitter:card" content="${seo.image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${htmlEscape(seo.title)}">`,
    `<meta name="twitter:description" content="${htmlEscape(seo.description)}">`,
  ];
  if (seo.canonical) {
    head.push(`<link rel="canonical" href="${htmlEscape(seo.canonical)}">`);
    head.push(`<meta property="og:url" content="${htmlEscape(seo.canonical)}">`);
  }
  if (seo.image) {
    head.push(`<meta property="og:image" content="${htmlEscape(seo.image)}">`);
    head.push(`<meta name="twitter:image" content="${htmlEscape(seo.image)}">`);
  }
  return head.join('\n    ');
}
