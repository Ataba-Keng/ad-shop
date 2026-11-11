import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { makeSlug } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

const blank = { id: '', name: '', slug: '', description: '', sort_order: 0, is_active: true };
export function StoreCategoriesPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await apiRequest('/api/admin/categories', { token: session?.access_token }); setItems(result.items || []); }
    catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [session?.access_token]);
  useEffect(() => { load(); }, [load]);
  function edit(item) { setForm({ ...item }); setEditing(true); }
  function reset() { setForm(blank); setEditing(false); }
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { name: form.name.trim(), slug: (form.slug || makeSlug(form.name)).trim(), description: form.description || '', sort_order: Number(form.sort_order) || 0, is_active: Boolean(form.is_active) };
      await apiRequest(editing ? `/api/admin/categories/${form.id}` : '/api/admin/categories', { token: session?.access_token, method: editing ? 'PUT' : 'POST', body: payload });
      toast.success(editing ? 'Catégorie mise à jour.' : 'Catégorie créée.'); reset(); await load();
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Supprimer la catégorie « ${item.name} » ? Les produits resteront sans catégorie.`)) return;
    try { await apiRequest(`/api/admin/categories/${item.id}`, { token: session?.access_token, method: 'DELETE' }); toast.success('Catégorie supprimée.'); await load(); }
    catch (error) { toast.error(error.message); }
  }
  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">ORGANISATION DU CATALOGUE</span><h1>Catégories<span>.</span></h1><p>Créez et classez les collections AD Shop.</p></div></div>
    <div className="admin-two-column"><form className="admin-card admin-form-card" onSubmit={save}><div className="admin-card-heading"><div><span className="section-kicker">{editing ? 'MODIFICATION' : 'NOUVELLE COLLECTION'}</span><h2>{editing ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2></div>{editing && <button className="icon-button" type="button" onClick={reset} aria-label="Annuler"><X size={17} /></button>}</div>
      <label>Nom<input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: editing ? current.slug : makeSlug(event.target.value) }))} placeholder="Ex. Vêtements" /></label>
      <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: makeSlug(event.target.value) }))} placeholder="vetements" /></label>
      <label>Description<textarea maxLength={500} rows="4" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
      <div className="form-grid"><label>Ordre d’affichage<input type="number" min="0" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} /></label><label className="checkbox-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /> Visible dans la boutique</label></div>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la catégorie'}<Plus size={15} /></button>
    </form>
    <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">COLLECTIONS</span><h2>Catégories existantes</h2></div></div>{loading ? <p className="admin-muted">Chargement…</p> : !items.length ? <p className="admin-muted">Aucune catégorie.</p> : <div className="admin-list">{items.map((item) => <article className="admin-list-row" key={item.id}><div><strong>{item.name}</strong><small>/{item.slug} · ordre {item.sort_order} · {item.is_active ? 'visible' : 'masquée'}</small></div><div className="table-actions"><button type="button" onClick={() => edit(item)} aria-label={`Modifier ${item.name}`}><Pencil size={15} /></button><button className="danger-action" type="button" onClick={() => remove(item)} aria-label={`Supprimer ${item.name}`}><Trash2 size={15} /></button></div></article>)}</div>}</div></div>
  </section>;
}
