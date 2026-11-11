import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiResource } from '../hooks/use-api-resource.js';
import { apiRequest } from '../lib/api.js';
import { formatXof } from '../lib/store.js';
import { useCart } from '../context/CartContext.jsx';
import { DemoNotice, EmptyState, ErrorState, LoadingState, ProductGrid, SectionHeading } from '../components/Storefront.jsx';
import { SeoHead } from '../components/SeoHead.jsx';

function Pager({ page, pages, basePath, query = '' }) {
  if (pages <= 1) return null;
  const href = (next) => `${basePath}?page=${next}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  return <nav className="pagination" aria-label="Pagination des produits">{page > 1 ? <Link to={href(page - 1)}><ArrowLeft size={15} /> Précédent</Link> : <span />}
    <span>Page {page} sur {pages}</span>{page < pages ? <Link to={href(page + 1)}>Suivant <ArrowRight size={15} /></Link> : <span />}</nav>;
}

export function CatalogPage() {
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') || 1));
  const q = (params.get('q') || '').trim();
  const key = `catalog:${page}:${q}`;
  const endpoint = `/api/products?page=${page}&limit=12${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const resource = useApiResource(key, endpoint);
  const data = resource.data;
  if (resource.loading && !data) return <main className="page-container"><SeoHead /><LoadingState /></main>;
  if (resource.error && !data) return <main className="page-container"><SeoHead /><ErrorState message={resource.error.message} /></main>;
  return <main className="page-container catalog-page">
    <SeoHead data={data || {}} />
    {data?.demoMode && <DemoNotice />}
    <div className="page-heading"><span className="section-kicker">AD SHOP · MODE & ACCESSOIRES</span><h1>Le shop<span>.</span></h1><p>Des vêtements, sacs et accessoires pour femmes et hommes, sélectionnés pour accompagner tous les styles.</p></div>
    <div className="catalog-tools"><span>{data?.total ?? 0} produit{data?.total === 1 ? '' : 's'}</span><Link className="filter-link" to="/recherche">Rechercher un produit <ArrowRight size={15} /></Link></div>
    <ProductGrid products={data?.items || []} eagerCount={3} />
    <Pager page={data?.page || page} pages={data?.pages || 1} basePath="/boutique" query={q} />
  </main>;
}

export function CategoryPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') || 1));
  const key = `category:${slug}:${page}`;
  const resource = useApiResource(key, `/api/categories/${encodeURIComponent(slug)}/products?page=${page}&limit=12`);
  const data = resource.data;
  if (resource.loading && !data) return <main className="page-container"><SeoHead /><LoadingState /></main>;
  if (resource.error && !data) return <main className="page-container"><SeoHead /><ErrorState message={resource.error.message} /></main>;
  return <main className="page-container catalog-page">
    <SeoHead data={data || {}} />
    {data?.products?.demoMode && <DemoNotice />}
    <Link className="back-link" to="/boutique"><ArrowLeft size={15} /> Toutes les collections</Link>
    <div className="page-heading"><span className="section-kicker">COLLECTION AD SHOP</span><h1>{data?.category?.name || 'Collection'}<span>.</span></h1><p>{data?.category?.description}</p></div>
    <div className="catalog-tools"><span>{data?.products?.total ?? 0} produit{data?.products?.total === 1 ? '' : 's'}</span></div>
    <ProductGrid products={data?.products?.items || []} eagerCount={3} />
    <Pager page={data?.products?.page || page} pages={data?.products?.pages || 1} basePath={`/categorie/${slug}`} />
  </main>;
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const resource = useApiResource(`product:${slug}`, `/api/products/${encodeURIComponent(slug)}`);
  const data = resource.data;
  const product = data?.item;
  const [variantId, setVariantId] = useState('');
  const { addItem } = useCart();
  useEffect(() => setVariantId(''), [slug]);
  if (resource.loading && !data) return <main className="page-container"><SeoHead /><LoadingState /></main>;
  if (resource.error && !data) return <main className="page-container"><SeoHead /><ErrorState message={resource.error.message} /></main>;
  if (!product || data?.notFound) return <main className="page-container"><SeoHead data={{ notFound: true }} /><EmptyState title="Produit introuvable." description="Le produit recherché n’existe pas ou n’est plus disponible." /><Link className="button button-dark" to="/boutique">Retour à la boutique</Link></main>;
  const selectedVariant = product.variants?.find((item) => item.id === variantId);
  const displayedPrice = selectedVariant?.price_xof ?? product.price_xof;
  const mustChooseVariant = (product.variants || []).length > 0;
  function addToCart() {
    if (mustChooseVariant && !selectedVariant) return toast.error('Choisissez une option avant l’ajout au panier.');
    if (!product.is_available || (selectedVariant && !selectedVariant.is_available)) return toast.error('Ce produit n’est plus disponible.');
    addItem(product.id, selectedVariant?.id || null, 1);
    toast.success(`${product.name} ajouté au panier.`);
  }
  return <main className="page-container product-page">
    <SeoHead data={data} />
    {data?.demoMode && <DemoNotice />}
    <Link className="back-link" to={product.category?.slug ? `/categorie/${product.category.slug}` : '/boutique'}><ArrowLeft size={15} /> Retour à la collection</Link>
    <section className="product-detail">
      <div className="product-gallery">{(product.images || []).map((image, index) => <figure key={image.id || image.url} className={index === 0 ? 'product-main-image' : 'product-alt-image'}><img src={image.url} alt={image.alt_text || product.name} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} /></figure>)}</div>
      <div className="product-detail-copy"><span className="section-kicker">{product.category?.name || 'AD SHOP'} · {product.product_type === 'digital' ? 'NOUVEAUTÉ' : 'ARTICLE MODE'}</span><h1>{product.name}</h1><p className="product-detail-summary">{product.summary}</p><div className="product-detail-price"><strong>{formatXof(displayedPrice)}</strong>{product.compare_at_price_xof && <del>{formatXof(product.compare_at_price_xof)}</del>}</div>
        {mustChooseVariant && <fieldset className="variant-picker"><legend>Choisir une option <span aria-hidden="true">*</span></legend><div className="variant-options">{product.variants.map((variant) => <button key={variant.id} type="button" className={variantId === variant.id ? 'is-selected' : ''} disabled={!variant.is_available} onClick={() => setVariantId(variant.id)}>{variant.name || Object.values(variant.options || {}).join(' / ')}</button>)}</div></fieldset>}
        {!product.is_available && <p className="stock-message is-unavailable">Ce produit est momentanément indisponible.</p>}
        {product.product_type === 'digital' && <p className="digital-delivery-note"><Download size={16} /> Fichier disponible par lien temporaire après confirmation du paiement.</p>}
        <button className="button button-dark add-to-cart-button" type="button" onClick={addToCart} disabled={!product.is_available || (mustChooseVariant && !selectedVariant)}><span>Ajouter au panier</span><strong>{formatXof(displayedPrice)}</strong></button>
        <p className="payment-assurance"><ShieldCheck size={15} /> Paiement sécurisé prévu via prestataire hébergé. Le paiement est désactivé dans cet aperçu.</p>
        <div className="product-description"><span className="section-kicker">DÉTAILS</span><div className="product-rich-copy" dangerouslySetInnerHTML={{ __html: product.description || '<p>Les détails seront bientôt disponibles.</p>' }} /></div>
      </div>
    </section>
    {data?.related?.length > 0 && <section className="related-products"><SectionHeading kicker="POUR COMPLÉTER" title="À découvrir aussi" to="/boutique" /><ProductGrid products={data.related} /></section>}
  </main>;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') || '').trim();
  const page = Math.max(1, Number(params.get('page') || 1));
  const key = `search:${q}:${page}`;
  const endpoint = `/api/search?q=${encodeURIComponent(q)}&page=${page}&limit=12`;
  const resource = useApiResource(key, endpoint);
  const data = resource.data;
  if (resource.loading && !data) return <main className="page-container"><SeoHead /><LoadingState /></main>;
  if (resource.error && !data) return <main className="page-container"><SeoHead /><ErrorState message={resource.error.message} /></main>;
  return <main className="page-container catalog-page"><SeoHead data={data || {}} />
    <div className="page-heading"><span className="section-kicker">RECHERCHE BOUTIQUE</span><h1>Résultats<span>.</span></h1><p>{q ? <>Recherche pour « <strong>{q}</strong> »</> : 'Recherchez un article dans la boutique.'}</p></div>
    {!q ? <EmptyState title="Saisissez un mot-clé." description="Utilisez la recherche dans l’en-tête pour trouver un produit." /> : <><div className="catalog-tools"><span>{data?.total ?? 0} résultat{data?.total === 1 ? '' : 's'}</span></div><ProductGrid products={data?.items || []} eagerCount={3} /><Pager page={data?.page || page} pages={data?.pages || 1} basePath="/recherche" query={q} /></>}
  </main>;
}

function useCartQuote(items) {
  const signature = useMemo(() => items.map((item) => `${item.product_id}:${item.variant_id || ''}:${item.quantity}`).join('|'), [items]);
  const [state, setState] = useState({ data: null, loading: false, error: null });
  useEffect(() => {
    if (!signature) { setState({ data: null, loading: false, error: null }); return undefined; }
    const controller = new AbortController();
    const payload = items.map((item) => ({ ...item }));
    setState((current) => ({ ...current, loading: true, error: null }));
    apiRequest('/api/cart/quote', { method: 'POST', body: payload, signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ data: null, loading: false, error }); });
    return () => controller.abort();
  }, [items, signature]);
  return state;
}

export function CartPage() {
  const { items, updateQuantity, removeItem, clear } = useCart();
  const quote = useCartQuote(items);
  const data = quote.data;
  useEffect(() => {
    if (quote.error?.code === 'PRODUCT_UNAVAILABLE' || quote.error?.code === 'VARIANT_UNAVAILABLE') {
      clear();
      toast.info('Votre panier a été actualisé : un article n’est plus disponible.');
    }
  }, [clear, quote.error]);
  return <main className="page-container cart-page"><SeoHead />
    <div className="page-heading"><span className="section-kicker">VOTRE SÉLECTION</span><h1>Le panier<span>.</span></h1><p>Les prix sont vérifiés de nouveau par le serveur au moment de la commande.</p></div>
    {quote.loading && !data && <LoadingState label="Actualisation des prix…" />}
    {quote.error && <ErrorState message={quote.error.message} />}
    {!items.length ? <div className="empty-cart"><EmptyState title="Votre panier est encore vide." description="Parcourez la sélection AD Shop et ajoutez une article qui vous plaît." /><Link className="button button-dark" to="/boutique">Découvrir la boutique <ArrowRight size={15} /></Link></div> : data && <div className="cart-layout"><div className="cart-lines">{data.items.map((line) => <article className="cart-line" key={`${line.product_id}:${line.variant_id || ''}`}>
      <Link className="cart-line-image" to={`/produit/${line.slug}`}><img src={line.image?.url || '/images/shop/product-tshirt.svg'} alt={line.image?.alt_text || line.name} /></Link>
      <div className="cart-line-info"><Link className="cart-line-name" to={`/produit/${line.slug}`}>{line.name}</Link>{line.variant_name && <span>Option : {line.variant_name}</span>}<span>{line.product_type === 'digital' ? 'Article' : 'Article'}</span><button type="button" className="remove-line" onClick={() => removeItem(line.product_id, line.variant_id)}><Trash2 size={13} /> Retirer</button></div>
      <div className="cart-line-quantity"><button type="button" aria-label="Diminuer la quantité" onClick={() => updateQuantity(line.product_id, line.variant_id, line.quantity - 1)}><Minus size={13} /></button><span>{line.quantity}</span><button type="button" aria-label="Augmenter la quantité" disabled={line.quantity >= 10} onClick={() => updateQuantity(line.product_id, line.variant_id, line.quantity + 1)}><Plus size={13} /></button></div>
      <strong className="cart-line-total">{formatXof(line.line_total_xof)}</strong>
    </article>)}</div><aside className="cart-summary"><span className="section-kicker">RÉCAPITULATIF</span><div><span>Sous-total</span><strong>{formatXof(data.subtotal_xof)}</strong></div><p>Les frais d’expédition (pour les articles) seront calculés selon la zone de livraison configurée. Aucun tarif provisoire n’est présenté comme validé.</p><Link className="button button-dark" to="/paiement">Continuer vers le paiement <ArrowRight size={15} /></Link><Link className="continue-shopping" to="/boutique">Continuer mes achats</Link></aside></div>}
  </main>;
}

const countries = [['SN', 'Sénégal'], ['CI', 'Côte d’Ivoire'], ['ML', 'Mali'], ['GN', 'Guinée'], ['GH', 'Ghana'], ['BJ', 'Bénin'], ['BF', 'Burkina Faso'], ['TG', 'Togo']];

export function CheckoutPage() {
  const cart = useCart();
  const quote = useCartQuote(cart.items);
  const [payments, setPayments] = useState({ enabled: false, items: [] });
  const [countryCode, setCountryCode] = useState('SN');
  const [region, setRegion] = useState('');
  const [shippingQuote, setShippingQuote] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address_line1: '', address_line2: '', city: '', postal_code: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const productSignature = useMemo(() => cart.items.map((item) => `${item.product_id}:${item.variant_id || ''}:${item.quantity}`).join('|'), [cart.items]);
  const hasPhysical = Boolean(quote.data?.items?.some((item) => item.product_type === 'physical'));

  useEffect(() => { apiRequest('/api/payments/methods').then(setPayments).catch(() => setPayments({ enabled: false, items: [] })); }, []);
  useEffect(() => {
    if (!payments.items.includes(paymentMethod)) setPaymentMethod(payments.items[0] || '');
  }, [payments, paymentMethod]);
  useEffect(() => {
    if (!productSignature || !quote.data) { setShippingQuote(null); return undefined; }
    if (!hasPhysical) { setShippingQuote({ configured: true, shipping_xof: 0, total_xof: quote.data.subtotal_xof }); return undefined; }
    if (!region.trim()) { setShippingQuote(null); return undefined; }
    const controller = new AbortController();
    apiRequest('/api/checkout/quote', { method: 'POST', body: { items: cart.items, country_code: countryCode, region }, signal: controller.signal })
      .then(setShippingQuote).catch((reason) => { if (reason.name !== 'AbortError') setShippingQuote({ configured: false, message: reason.message }); });
    return () => controller.abort();
  }, [cart.items, countryCode, hasPhysical, productSignature, quote.data, region]);

  function setField(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!quote.data || !payments.enabled || !paymentMethod) return;
    setBusy(true);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `sp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const countryName = countries.find(([code]) => code === countryCode)?.[1] || countryCode;
      const response = await apiRequest('/api/checkout', {
        method: 'POST',
        body: {
          idempotency_key: idempotencyKey,
          items: cart.items,
          customer: { name: form.name, email: form.email, phone: form.phone },
          country_code: countryCode,
          shipping_address: hasPhysical ? { ...form, region, country: countryName } : null,
          payment_method: paymentMethod,
        },
      });
      if (response.already_paid) { window.location.assign(`/commande/${encodeURIComponent(response.order_number)}`); return; }
      if (!response.checkout_url) throw new Error('La session de paiement n’a pas pu être créée.');
      window.location.assign(response.checkout_url);
    } catch (reason) {
      setError(reason.message || 'La commande n’a pas pu être lancée.');
      setBusy(false);
    }
  }

  return <main className="page-container checkout-page"><SeoHead />
    <div className="page-heading"><span className="section-kicker">DERNIÈRE ÉTAPE</span><h1>Finaliser<span>.</span></h1><p>Le serveur recalcule les prix et la disponibilité avant de créer une commande.</p></div>
    {!cart.items.length ? <div className="empty-cart"><EmptyState title="Votre panier est vide." description="Ajoutez un produit avant de poursuivre." /><Link className="button button-dark" to="/boutique">Retour à la boutique</Link></div> : <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <section className="checkout-section"><span className="checkout-step">01</span><div><span className="section-kicker">VOS COORDONNÉES</span><h2>Où vous joindre ?</h2></div>
          <label>Nom complet<input autoComplete="name" required minLength={2} value={form.name} onChange={(event) => setField('name', event.target.value)} /></label>
          <div className="form-grid"><label>Adresse e-mail<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setField('email', event.target.value)} /></label><label>Téléphone<input type="tel" autoComplete="tel" required placeholder="+221 …" value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></label></div>
        </section>
        {hasPhysical && <section className="checkout-section"><span className="checkout-step">02</span><div><span className="section-kicker">PRODUITS PHYSIQUES</span><h2>Adresse de livraison</h2></div>
          <label>Pays / territoire<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>{countries.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label>Adresse<input autoComplete="address-line1" required value={form.address_line1} onChange={(event) => setField('address_line1', event.target.value)} /></label>
          <label>Complément d’adresse <span className="optional-label">(facultatif)</span><input autoComplete="address-line2" value={form.address_line2} onChange={(event) => setField('address_line2', event.target.value)} /></label>
          <div className="form-grid"><label>Ville<input autoComplete="address-level2" required value={form.city} onChange={(event) => setField('city', event.target.value)} /></label><label>Région / zone<input autoComplete="address-level1" required value={region} onChange={(event) => setRegion(event.target.value)} /></label></div>
          <label>Code postal <span className="optional-label">(facultatif)</span><input autoComplete="postal-code" value={form.postal_code} onChange={(event) => setField('postal_code', event.target.value)} /></label>
          {region && shippingQuote && <p className={`shipping-quote${shippingQuote.configured ? '' : ' is-pending'}`}>{shippingQuote.configured ? `${shippingQuote.carrier_name ? `${shippingQuote.carrier_name} · ` : ''}Livraison : ${formatXof(shippingQuote.shipping_xof)}${shippingQuote.estimated_min_days != null ? ` · ${shippingQuote.estimated_min_days}–${shippingQuote.estimated_max_days ?? shippingQuote.estimated_min_days} jours` : ''}` : (shippingQuote.message || 'Les frais de livraison de cette zone restent à configurer.')}</p>}
        </section>}
        <section className="checkout-section"><span className="checkout-step">{hasPhysical ? '03' : '02'}</span><div><span className="section-kicker">PAIEMENT</span><h2>Moyen de paiement</h2></div>
          {payments.enabled ? <label>Choisissez un moyen<select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{payments.items.map((method) => <option key={method} value={method}>{method}</option>)}</select></label> : <div className="payment-disabled"><strong>Le paiement est désactivé.</strong><p>Il sera activé après configuration et validation du compte marchand PayTech, des moyens de paiement et des tarifs de livraison. Aucun débit ne sera tenté dans cet aperçu.</p></div>}
        </section>
        {quote.error && <p className="form-error" role="alert">{quote.error.message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-dark checkout-submit" type="submit" disabled={busy || !payments.enabled || !quote.data || (hasPhysical && !shippingQuote?.configured)}>{busy ? 'Préparation de la commande…' : 'Continuer vers le paiement'}<ArrowRight size={16} /></button>
      </form>
      <aside className="checkout-summary"><span className="section-kicker">RÉCAPITULATIF</span><h2>{quote.data?.items?.length || 0} article{quote.data?.items?.length === 1 ? '' : 's'}</h2>{quote.data?.items?.map((item) => <div className="summary-line" key={`${item.product_id}:${item.variant_id || ''}`}><span>{item.quantity} × {item.name}{item.variant_name ? ` — ${item.variant_name}` : ''}</span><strong>{formatXof(item.line_total_xof)}</strong></div>)}<div className="summary-subtotal"><span>Sous-total</span><strong>{quote.data ? formatXof(quote.data.subtotal_xof) : '—'}</strong></div>{hasPhysical && <div className="summary-subtotal"><span>Livraison</span><strong>{shippingQuote?.configured ? formatXof(shippingQuote.shipping_xof) : 'À confirmer'}</strong></div>}<div className="summary-subtotal summary-grand-total"><strong>Total XOF</strong><strong>{shippingQuote?.configured ? formatXof(shippingQuote.total_xof) : quote.data && !hasPhysical ? formatXof(quote.data.subtotal_xof) : 'À confirmer'}</strong></div><p className="summary-security"><ShieldCheck size={15} /> Les données de carte seront traitées par le prestataire hébergé, jamais par la boutique.</p></aside>
    </div>}
  </main>;
}

export function OrderPage() {
  const { orderNumber = '' } = useParams();
  const cart = useCart();
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  async function lookup(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiRequest(`/api/orders/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`);
      setOrder(result.item);
      if (result.item.payment_status === 'paid') cart.clear();
    } catch (reason) { setOrder(null); setError(reason.message); }
    finally { setBusy(false); }
  }
  async function getDownloads() {
    setDownloadBusy(true); setError('');
    try { const result = await apiRequest(`/api/orders/${encodeURIComponent(orderNumber)}/downloads`, { method: 'POST', body: { email } }); setDownloads(result.items || []); }
    catch (reason) { setError(reason.message); }
    finally { setDownloadBusy(false); }
  }
  const fulfillmentLabels = { unfulfilled: 'À préparer', processing: 'En préparation', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };
  return <main className="page-container order-page"><SeoHead />
    <div className="page-heading"><span className="section-kicker">SUIVI DE COMMANDE</span><h1>Votre commande<span>.</span></h1><p>La page de retour du prestataire ne confirme pas le paiement. Le statut affiché est vérifié côté serveur.</p></div>
    <form className="order-lookup" onSubmit={lookup}><label>Référence de commande<input value={orderNumber} readOnly aria-label="Référence de commande" /></label><label>Adresse e-mail utilisée<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Vérifier la commande'}</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {order && <section className="order-result">
      <div className="order-result-heading"><div><span className="section-kicker">{order.order_number}</span><h2>{order.payment_status === 'paid' ? 'Paiement confirmé.' : order.payment_status === 'cancelled' ? 'Paiement annulé.' : 'Paiement en attente.'}</h2></div><span className={`status-pill status-${order.payment_status}`}>{order.payment_status}</span></div>
      <div className="order-result-items">{order.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.product_name_snapshot}{item.variant_name_snapshot ? ` — ${item.variant_name_snapshot}` : ''}</span><strong>{formatXof(item.line_total_xof)}</strong></div>)}</div>
      {Number(order.shipping_xof) > 0 && <div className="summary-subtotal"><span>Livraison</span><strong>{formatXof(order.shipping_xof)}</strong></div>}
      <div className="order-total"><span>Total XOF</span><strong>{formatXof(order.total_xof)}</strong></div>
      {order.items.some((item) => item.product_type === 'physical') && <div className="order-delivery-status"><strong>Livraison : {fulfillmentLabels[order.fulfillment_status] || 'Statut en cours'}</strong>{order.tracking_reference && <span>Référence transporteur : {order.tracking_reference}</span>}{order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer">Suivre le colis <ArrowRight size={14} /></a>}</div>}
      {order.payment_status === 'paid' && order.items.some((item) => item.product_type === 'digital') && <div className="download-panel"><p>Les contenus numériques éventuels sont disponibles après paiement. Les liens générés sont temporaires et limités en nombre.</p><button className="button button-dark" type="button" onClick={getDownloads} disabled={downloadBusy}>{downloadBusy ? 'Préparation…' : 'Obtenir mes fichiers'}<Download size={15} /></button>{downloads.map((item) => <a className="download-link" key={item.url} href={item.url} rel="noreferrer">Télécharger — {item.product_name}<ArrowRight size={14} /></a>)}</div>}
    </section>}
    <Link className="continue-shopping" to="/boutique">Retour à la boutique</Link>
  </main>;
}

export function InfoPage({ type }) {
  const pages = {
    contact: { kicker: 'SERVICE CLIENT', title: 'Nous contacter.', paragraphs: ['Pour toute question, écrivez à support@example.com ou appelez le +221 77 000 00 00.', 'Ces coordonnées sont fictives et doivent être remplacées avant toute publication ou vente. Les profils sociaux de démonstration ne sont pas cliquables.'] },
    shipping: { kicker: 'INFORMATIONS PROVISOIRES', title: 'Livraison et retours.', paragraphs: ['Les zones, transporteurs, frais, délais et modalités de retour ne sont pas encore validés par le propriétaire.', 'Aucune livraison ne peut être promise dans cet aperçu. Les frais réels seront calculés et affichés avant la confirmation d’une commande, une fois les zones configurées.'] },
    terms: { kicker: 'DOCUMENT À VALIDER', title: 'Conditions provisoires.', paragraphs: ['Cette page est un espace de contenu provisoire, pas des conditions commerciales approuvées ni un conseil juridique.', 'Avant toute vente, le propriétaire devra renseigner les conditions de commande, de paiement, de livraison, de retour et de remboursement applicables.'] },
    privacy: { kicker: 'INFORMATIONS', title: 'Confidentialité.', paragraphs: ['Les données de contact sont nécessaires au traitement d’une commande et à la remise d’un article. Les coordonnées bancaires ne sont pas recueillies par AD Shop.', 'Le texte définitif relatif à la conservation et aux droits des clients devra être validé avant la mise en vente.'] },
  };
  const page = pages[type] || pages.contact;
  return <main className="page-container info-page"><SeoHead /><span className="section-kicker">{page.kicker}</span><h1>{page.title}</h1>{page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<Link className="button button-dark" to="/boutique">Retour à la boutique <ArrowRight size={15} /></Link></main>;
}
