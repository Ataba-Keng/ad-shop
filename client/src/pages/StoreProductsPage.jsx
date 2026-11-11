import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, PackagePlus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDate, formatXof } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

export function StoreProductsPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const [queryInput, setQueryInput] = useState(q);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ status, category, q, page: params.get('page') || '1', limit: '20' });
      const [productResult, categoryResult] = await Promise.all([
        apiRequest(`/api/admin/products?${query}`, { token: session?.access_token }),
        apiRequest('/api/admin/categories', { token: session?.access_token }),
      ]);
      setProducts(productResult.items || []);
      setPagination({ page: productResult.page || 1, pages: productResult.pages || 1, total: productResult.total || 0 });
      setCategories(categoryResult.items || []);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [category, params, q, session?.access_token, status]);
  useEffect(() => { setQueryInput(q); }, [q]);
  useEffect(() => { load(); }, [load]);

  function updateFilters(next) {
    const values = { status, category, q, ...next };
    const nextParams = new URLSearchParams();
    if (values.status && values.status !== 'all') nextParams.set('status', values.status);
    if (values.category) nextParams.set('category', values.category);
    if (values.q) nextParams.set('q', values.q);
    if (next.page && Number(next.page) > 1) nextParams.set('page', String(next.page));
    setParams(nextParams, { replace: true });
  }

  async function toggleStatus(product) {
    const nextStatus = product.status === 'published' ? 'draft' : 'published';
    setBusyId(product.id);
    try {
      await apiRequest(`/api/admin/products/${product.id}`, { token: session?.access_token, method: 'PUT', body: {
        category_id: product.category_id || null, name: product.name, slug: product.slug, sku: product.sku || '', summary: product.summary || '', description: product.description || '', product_type: product.product_type,
        status: nextStatus, price_xof: product.price_xof, compare_at_price_xof: product.compare_at_price_xof ?? null, inventory_tracked: product.inventory_tracked, stock_quantity: product.stock_quantity, is_featured: product.is_featured,
        images: (product.images || []).map((image) => ({ storage_path: image.storage_path, alt_text: image.alt_text || '' })),
        variants: (product.variants || []).map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name || '', options: variant.options || {}, price_xof: variant.price_xof ?? null, inventory_tracked: variant.inventory_tracked, stock_quantity: variant.stock_quantity, is_active: variant.is_active !== false })),
      } });
      toast.success(nextStatus === 'published' ? 'Produit publié.' : 'Produit dépublié et conservé en brouillon.');
      await load();
    } catch (error) { toast.error(error.message); }
    finally { setBusyId(''); }
  }

  async function archive(product) {
    if (!window.confirm(`Archiver « ${product.name} » ? Les commandes déjà passées resteront conservées.`)) return;
    setBusyId(product.id);
    try { await apiRequest(`/api/admin/products/${product.id}`, { token: session?.access_token, method: 'DELETE' }); toast.success('Produit archivé.'); await load(); }
    catch (error) { toast.error(error.message); }
    finally { setBusyId(''); }
  }

  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">CATALOGUE</span><h1>Produits<span>.</span></h1><p>Gérez les articles physiques et les nouveautés.</p></div><Link className="button button-dark" to="/admin/produits/nouveau"><PackagePlus size={16} />Ajouter un produit</Link></div>
    <div className="admin-card"><div className="admin-toolbar"><form className="admin-search-form" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: queryInput.trim() }); }}><Search size={16} /><input aria-label="Rechercher un produit" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Nom ou référence produit" /><button type="submit">Rechercher</button></form><div className="admin-filters"><label>Statut<select value={status} onChange={(event) => updateFilters({ status: event.target.value })}><option value="all">Tous</option><option value="published">Publié</option><option value="draft">Brouillon</option><option value="archived">Archivé</option></select></label><label>Catégorie<select value={category} onChange={(event) => updateFilters({ category: event.target.value })}><option value="">Toutes les catégories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></div>
      <div className="admin-card-heading"><div><span className="section-kicker">{loading ? 'CHARGEMENT…' : `${pagination.total} RÉSULTAT${pagination.total === 1 ? '' : 'S'}`}</span><h2>Catalogue</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PRODUIT</th><th>CATÉGORIE</th><th>PRIX</th><th>STOCK</th><th>STATUT</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {loading && <tr><td colSpan="6" className="table-message">Chargement des produits…</td></tr>}
        {!loading && products.length === 0 && <tr><td colSpan="6" className="table-message">Aucun produit pour ces critères.</td></tr>}
        {!loading && products.map((product) => <tr key={product.id}><td><div className="table-product-cell">{product.images?.[0]?.url ? <img src={product.images[0].url} alt="" loading="lazy" /> : <span className="table-image-placeholder">AD</span>}<div><Link className="table-title" to={`/admin/produits/${product.id}/modifier`}>{product.name}</Link><small>/{product.slug} · {product.product_type === 'digital' ? 'Numérique' : 'Physique'}</small><small>Modifié le {formatDate(product.updated_at)}</small></div></div></td><td>{product.category?.name || '—'}</td><td><strong>{formatXof(product.price_xof)}</strong></td><td>{product.variants?.length ? `${product.variants.length} variante(s)` : product.inventory_tracked ? product.stock_quantity : 'Non suivi'}</td><td><span className={`status-pill status-${product.status}`}>{product.status === 'published' ? 'Publié' : product.status === 'archived' ? 'Archivé' : 'Brouillon'}</span></td><td><div className="table-actions"><button type="button" onClick={() => toggleStatus(product)} disabled={busyId === product.id || product.status === 'archived'} title={product.status === 'published' ? 'Dépublier' : 'Publier'}><Eye size={16} /><span className="sr-only">{product.status === 'published' ? 'Dépublier' : 'Publier'}</span></button><Link to={`/admin/produits/${product.id}/modifier`} title="Modifier"><ArrowRight size={16} /><span className="sr-only">Modifier</span></Link><button className="danger-action" type="button" onClick={() => archive(product)} disabled={busyId === product.id || product.status === 'archived'} title="Archiver"><Trash2 size={16} /><span className="sr-only">Archiver</span></button></div></td></tr>)}
      </tbody></table></div>
      {pagination.pages > 1 && <nav className="admin-pagination"><button type="button" disabled={loading || pagination.page <= 1} onClick={() => updateFilters({ page: pagination.page - 1 })}>Précédent</button><span>Page {pagination.page} sur {pagination.pages}</span><button type="button" disabled={loading || pagination.page >= pagination.pages} onClick={() => updateFilters({ page: pagination.page + 1 })}>Suivant</button></nav>}
    </div></section>;
}
