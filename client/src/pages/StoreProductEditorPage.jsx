import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { makeSlug } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

const blankProduct = { category_id: '', name: '', slug: '', sku: '', summary: '', description: '', product_type: 'physical', status: 'draft', price_xof: '', compare_at_price_xof: '', inventory_tracked: true, stock_quantity: 0, is_featured: false, images: [], variants: [] };
function plainDescription(value) {
  return String(value || '').replace(/<\/(p|h2|h3|li|blockquote)>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function descriptionToHtml(value) {
  return String(value || '').trim().split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph) => `<p>${paragraph.split('\n').map((line) => line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')).join('<br>')}</p>`).join('');
}

export function StoreProductEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState(blankProduct);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedId, setSavedId] = useState(id);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const token = session?.access_token;

  const load = useCallback(async () => {
    try {
      const [categoryResult, productResult] = await Promise.all([
        apiRequest('/api/admin/categories', { token }),
        id ? apiRequest(`/api/admin/products/${id}`, { token }) : Promise.resolve(null),
      ]);
      setCategories(categoryResult.items || []);
      if (productResult?.item) {
        const item = productResult.item;
        setForm({ ...blankProduct, ...item, category_id: item.category_id || '', description: plainDescription(item.description), images: item.images || [], variants: item.product_type === 'physical' ? item.variants || [] : [], compare_at_price_xof: item.compare_at_price_xof ?? '' });
        setSavedId(item.id);
      }
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [id, token]);
  useEffect(() => { load(); }, [load]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function updateVariant(index, name, value) {
    setForm((current) => ({ ...current, variants: current.variants.map((variant, position) => position === index ? { ...variant, [name]: value } : variant) }));
  }
  function addVariant() {
    const base = makeSlug(form.slug || form.name).replaceAll('-', '_').toUpperCase() || 'AD';
    const size = form.variants.length + 1;
    setForm((current) => ({ ...current, variants: [...current.variants, { sku: `${base}-OPT-${size}`, name: '', options: {}, price_xof: null, inventory_tracked: true, stock_quantity: 0, is_active: true }] }));
  }
  function removeVariant(index) {
    setForm((current) => ({ ...current, variants: current.variants.filter((_, position) => position !== index) }));
  }

  async function uploadImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1800, useWebWorker: true, fileType: 'image/webp' });
      const body = new FormData();
      body.append('file', compressed, `${file.name.replace(/\.[^.]+$/, '') || 'produit'}.webp`);
      const result = await apiRequest('/api/admin/upload?kind=product-image', { method: 'POST', body, token });
      setForm((current) => ({ ...current, images: [...current.images, result.item] }));
      toast.success('Image optimisée et téléversée.');
    } catch (error) { toast.error(error.message); }
    finally { setUploading(false); }
  }
  function removeImage(path) { setForm((current) => ({ ...current, images: current.images.filter((image) => image.storage_path !== path) })); }

  async function uploadDigitalFile(file) {
    if (!file || !savedId) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('product_id', savedId);
      body.append('file', file);
      const result = await apiRequest('/api/admin/upload?kind=digital-file', { method: 'POST', body, token });
      toast.success(`Fichier « ${result.item.original_filename} » stocké dans le bucket privé.`);
      const current = document.getElementById('digital-file-input');
      if (current) current.value = '';
    } catch (error) { toast.error(error.message); }
    finally { setUploading(false); }
  }

  async function save(event) {
    event.preventDefault(); setSaving(true);
    const payload = {
      category_id: form.category_id || null,
      name: form.name.trim(), slug: (form.slug || makeSlug(form.name)).trim(), sku: form.sku.trim(), summary: form.summary.trim(), description: descriptionToHtml(form.description),
      product_type: form.product_type, status: form.status, price_xof: Number(form.price_xof), compare_at_price_xof: form.compare_at_price_xof === '' ? null : Number(form.compare_at_price_xof),
      inventory_tracked: form.product_type === 'physical' && !form.variants.length && Boolean(form.inventory_tracked), stock_quantity: form.product_type === 'physical' && !form.variants.length ? Number(form.stock_quantity || 0) : 0, is_featured: Boolean(form.is_featured),
      images: form.images.map((image) => ({ storage_path: image.storage_path, alt_text: image.alt_text || '' })),
      variants: form.product_type === 'physical' ? form.variants.map((variant) => ({ ...(variant.id ? { id: variant.id } : {}), sku: variant.sku.trim(), name: variant.name.trim(), options: variant.name.trim() ? { Taille: variant.name.trim() } : {}, price_xof: variant.price_xof === '' || variant.price_xof == null ? null : Number(variant.price_xof), inventory_tracked: Boolean(variant.inventory_tracked), stock_quantity: Number(variant.stock_quantity || 0), is_active: variant.is_active !== false })) : [],
    };
    if (payload.variants.some((variant) => !variant.sku || !variant.name)) { toast.error('Chaque variante doit avoir un SKU et un nom d’option.'); setSaving(false); return; }
    try {
      const result = await apiRequest(savedId ? `/api/admin/products/${savedId}` : '/api/admin/products', { method: savedId ? 'PUT' : 'POST', body: payload, token });
      const productId = result.item.id;
      setSavedId(productId);
      setForm((current) => ({ ...current, ...result.item, category_id: result.item.category_id || '', description: plainDescription(result.item.description), compare_at_price_xof: result.item.compare_at_price_xof ?? '' }));
      toast.success('Produit enregistré.');
      if (!id) navigate(`/admin/produits/${productId}/modifier`, { replace: true });
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  if (loading) return <section className="admin-page"><p className="admin-muted">Chargement du produit…</p></section>;
  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">CATALOGUE AD SHOP</span><h1>{id ? 'Modifier le produit' : 'Nouveau produit'}<span>.</span></h1><p>Les montants sont des entiers en francs CFA (XOF).</p></div><button className="button button-light" type="button" onClick={() => navigate('/admin/produits')}><ArrowLeft size={15} />Retour au catalogue</button></div>
    <form className="product-editor-form" onSubmit={save}>
      <div className="admin-card editor-main"><div className="admin-card-heading"><div><span className="section-kicker">INFORMATIONS PRODUIT</span><h2>Fiche catalogue</h2></div></div>
        <label>Nom du produit<input required minLength={3} maxLength={160} value={form.name} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : makeSlug(name) })); }} /></label>
        <div className="form-grid"><label>URL (slug)<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={180} value={form.slug} onChange={(event) => { setSlugTouched(true); setField('slug', makeSlug(event.target.value)); }} /></label><label>SKU principal<input maxLength={80} value={form.sku || ''} onChange={(event) => setField('sku', event.target.value)} placeholder="Référence interne (facultatif)" /></label></div>
        <label>Résumé<input maxLength={500} value={form.summary || ''} onChange={(event) => setField('summary', event.target.value)} placeholder="Courte description affichée dans la boutique" /></label>
        <label>Description<textarea rows="8" value={form.description || ''} onChange={(event) => setField('description', event.target.value)} placeholder="Décrivez le produit, ses matières, son usage ou le contenu numérique." /></label>
        <div className="form-grid"><label>Type de produit<select value={form.product_type} onChange={(event) => { const productType = event.target.value; setForm((current) => ({ ...current, product_type: productType, inventory_tracked: productType === 'physical', stock_quantity: productType === 'physical' ? current.stock_quantity : 0, variants: productType === 'digital' ? [] : current.variants })); }}><option value="physical">Physique</option><option value="digital">Numérique</option></select></label><label>Catégorie<select value={form.category_id || ''} onChange={(event) => setField('category_id', event.target.value)}><option value="">Sans catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <div className="form-grid"><label>Prix (XOF)<input required type="number" min="0" step="1" value={form.price_xof} onChange={(event) => setField('price_xof', event.target.value)} /></label><label>Prix de comparaison (XOF)<input type="number" min="0" step="1" value={form.compare_at_price_xof} onChange={(event) => setField('compare_at_price_xof', event.target.value)} /></label></div>
      </div>
      <aside className="editor-side"><div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">VISIBILITÉ</span><h2>Publication</h2></div></div><label>Statut<select value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label><label className="checkbox-label"><input type="checkbox" checked={Boolean(form.is_featured)} onChange={(event) => setField('is_featured', event.target.checked)} /> Mettre en avant sur l’accueil</label></div>
        <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">GALERIE</span><h2>Images produit</h2></div></div><label className="upload-drop"><ImagePlus size={21} /><strong>{uploading ? 'Téléversement…' : 'Ajouter une image'}</strong><span>JPEG, PNG, WebP ou AVIF · compression automatique</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => uploadImage(event.target.files?.[0])} /></label><div className="editor-image-list">{form.images.map((image) => <div className="editor-image-row" key={image.storage_path}><img src={image.url} alt={image.alt_text || ''} /><input aria-label="Texte alternatif" value={image.alt_text || ''} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((item) => item.storage_path === image.storage_path ? { ...item, alt_text: event.target.value } : item) }))} placeholder="Texte alternatif" /><button className="danger-action" type="button" onClick={() => removeImage(image.storage_path)} aria-label="Retirer l’image"><Trash2 size={15} /></button></div>)}</div></div>
        {form.product_type === 'physical' ? <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">INVENTAIRE</span><h2>Stock et variantes</h2></div><button className="small-outline-button" type="button" onClick={addVariant}><Plus size={14} />Variante</button></div>{!form.variants.length && <><label className="checkbox-label"><input type="checkbox" checked={Boolean(form.inventory_tracked)} onChange={(event) => setField('inventory_tracked', event.target.checked)} /> Suivre le stock</label>{form.inventory_tracked && <label>Quantité disponible<input type="number" min="0" step="1" value={form.stock_quantity} onChange={(event) => setField('stock_quantity', event.target.value)} /></label>}</>}{form.variants.map((variant, index) => <div className="variant-admin-row" key={variant.id || `new-${index}`}><div className="form-grid"><label>Option / taille<input required value={variant.name || ''} onChange={(event) => updateVariant(index, 'name', event.target.value)} placeholder="S, M, L…" /></label><label>SKU<input required value={variant.sku || ''} onChange={(event) => updateVariant(index, 'sku', event.target.value)} /></label></div><div className="form-grid"><label>Stock<input type="number" min="0" value={variant.stock_quantity || 0} onChange={(event) => updateVariant(index, 'stock_quantity', Number(event.target.value))} /></label><label>Prix spécifique (XOF)<input type="number" min="0" value={variant.price_xof ?? ''} onChange={(event) => updateVariant(index, 'price_xof', event.target.value)} placeholder="Prix du produit" /></label></div><button className="remove-variant" type="button" onClick={() => removeVariant(index)}>Retirer cette variante <Trash2 size={13} /></button></div>)}</div> : <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">FICHIER NUMÉRIQUE</span><h2>Téléchargement privé</h2></div></div>{savedId ? <label className="upload-drop"><Upload size={20} /><strong>{uploading ? 'Téléversement…' : 'Ajouter le fichier vendu'}</strong><span>PDF, ZIP, EPUB, MP3 ou MP4 · max. 50 Mo</span><input id="digital-file-input" type="file" accept=".pdf,.zip,.epub,.mp3,.mp4,application/pdf,application/zip,audio/mpeg,video/mp4" disabled={uploading} onChange={(event) => uploadDigitalFile(event.target.files?.[0])} /></label> : <p className="admin-muted">Enregistrez d’abord le produit pour pouvoir associer son fichier privé.</p>}<p className="admin-help">Le fichier sera privé; les liens temporaires ne sont générés qu’après confirmation du paiement.</p></div>}
        <div className="admin-safety-note"><strong>Avant publication.</strong><span>Vérifiez vos vrais prix, vos stocks, les droits sur les images et le contenu. La passerelle de paiement reste désactivée.</span></div>
        <button className="button button-dark editor-save" type="submit" disabled={saving || uploading}>{saving ? 'Enregistrement…' : 'Enregistrer le produit'}<Save size={16} /></button>
      </aside>
    </form>
  </section>;
}
