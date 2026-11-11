import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { formatXof } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

const blank = { id: '', country_code: 'SN', region_name: '', carrier_name: '', shipping_fee_xof: '', estimated_min_days: '', estimated_max_days: '', is_active: true };
export function StoreShippingPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await apiRequest('/api/admin/shipping-zones', { token: session?.access_token }); setItems(result.items || []); }
    catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [session?.access_token]);
  useEffect(() => { load(); }, [load]);
  function setField(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function edit(item) { setForm({ ...item, carrier_name: item.carrier_name || '', estimated_min_days: item.estimated_min_days ?? '', estimated_max_days: item.estimated_max_days ?? '' }); setEditing(true); }
  function reset() { setForm(blank); setEditing(false); }
  async function save(event) {
    event.preventDefault(); setBusy(true);
    const payload = { country_code: form.country_code.trim().toUpperCase(), region_name: form.region_name.trim(), carrier_name: form.carrier_name.trim(), shipping_fee_xof: Number(form.shipping_fee_xof), estimated_min_days: form.estimated_min_days === '' ? null : Number(form.estimated_min_days), estimated_max_days: form.estimated_max_days === '' ? null : Number(form.estimated_max_days), is_active: Boolean(form.is_active) };
    try { await apiRequest(editing ? `/api/admin/shipping-zones/${form.id}` : '/api/admin/shipping-zones', { token: session?.access_token, method: editing ? 'PUT' : 'POST', body: payload }); toast.success(editing ? 'Zone mise à jour.' : 'Zone ajoutée.'); reset(); await load(); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Supprimer la zone ${item.region_name} (${item.country_code}) ?`)) return;
    try { await apiRequest(`/api/admin/shipping-zones/${item.id}`, { token: session?.access_token, method: 'DELETE' }); toast.success('Zone supprimée.'); await load(); }
    catch (error) { toast.error(error.message); }
  }
  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">LIVRAISON</span><h1>Zones et tarifs<span>.</span></h1><p>Configurez les transporteurs et frais réels avant d’ouvrir le paiement des produits physiques.</p></div></div>
    <div className="admin-safety-note"><strong>À renseigner avec vos coûts réels.</strong><span>Aucune zone ni aucun tarif fictif n’est préchargé. Un achat physique ne pourra pas être finalisé si sa zone n’a pas un tarif actif.</span></div>
    <div className="admin-two-column"><form className="admin-card admin-form-card" onSubmit={save}><div className="admin-card-heading"><div><span className="section-kicker">{editing ? 'MODIFICATION' : 'NOUVELLE ZONE'}</span><h2>{editing ? 'Modifier une zone' : 'Ajouter une zone'}</h2></div>{editing && <button className="icon-button" type="button" onClick={reset} aria-label="Annuler"><X size={17} /></button>}</div>
      <div className="form-grid"><label>Pays (code ISO 2 lettres)<input required pattern="[A-Za-z]{2}" maxLength="2" value={form.country_code} onChange={(event) => setField('country_code', event.target.value.toUpperCase())} /></label><label>Région / zone<input required maxLength="100" value={form.region_name} onChange={(event) => setField('region_name', event.target.value)} placeholder="Ex. Dakar ou * pour tout le pays" /></label></div>
      <label>Transporteur <span className="optional-label">(facultatif)</span><input maxLength="120" value={form.carrier_name} onChange={(event) => setField('carrier_name', event.target.value)} placeholder="Ex. transporteur local" /></label>
      <label>Frais de livraison (XOF)<input required type="number" min="0" step="1" value={form.shipping_fee_xof} onChange={(event) => setField('shipping_fee_xof', event.target.value)} /></label>
      <div className="form-grid"><label>Délai min. (jours)<input type="number" min="0" value={form.estimated_min_days} onChange={(event) => setField('estimated_min_days', event.target.value)} /></label><label>Délai max. (jours)<input type="number" min="0" value={form.estimated_max_days} onChange={(event) => setField('estimated_max_days', event.target.value)} /></label></div>
      <label className="checkbox-label"><input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} /> Zone active pour le calcul du checkout</label>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter la zone'}<Plus size={15} /></button>
    </form>
    <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">ZONES ENREGISTRÉES</span><h2>Tarifs de livraison</h2></div></div>{loading ? <p className="admin-muted">Chargement…</p> : !items.length ? <p className="admin-muted">Aucun tarif configuré : le paiement des produits physiques restera bloqué.</p> : <div className="admin-list">{items.map((item) => <article className="admin-list-row" key={item.id}><div><strong>{item.region_name} <span className="country-code">{item.country_code}</span></strong><small>{item.carrier_name ? `${item.carrier_name} · ` : ''}{formatXof(item.shipping_fee_xof)} · {item.estimated_min_days ?? '—'}–{item.estimated_max_days ?? '—'} jours · {item.is_active ? 'active' : 'inactive'}</small></div><div className="table-actions"><button type="button" onClick={() => edit(item)} aria-label={`Modifier ${item.region_name}`}><Pencil size={15} /></button><button className="danger-action" type="button" onClick={() => remove(item)} aria-label={`Supprimer ${item.region_name}`}><Trash2 size={15} /></button></div></article>)}</div>}</div></div>
  </section>;
}
