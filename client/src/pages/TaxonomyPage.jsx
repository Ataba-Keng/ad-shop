import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { adminRequest, slugify } from '../lib/admin.js';

export function TaxonomyPage({ type }) {
  const isCategory = type === 'categories';
  const label = isCategory ? 'catégorie' : 'tag';
  const title = isCategory ? 'Les catégories' : 'Les tags';
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminRequest(`/api/admin/${type}`, session);
      setItems(result.items || []);
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [session, type]);
  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setName(''); setSlug(''); setSlugTouched(false); setEditingId('');
  }

  function beginEdit(item) {
    setEditingId(item.id); setName(item.name); setSlug(item.slug); setSlugTouched(true);
    document.getElementById('taxonomy-name')?.focus();
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const path = editingId ? `/api/${type}/${editingId}` : `/api/${type}`;
      const result = await adminRequest(path, session, { method: editingId ? 'PUT' : 'POST', body: { name: name.trim(), slug: (slugTouched ? slug : slugify(name)).trim() } });
      toast.success(`${isCategory ? 'Catégorie' : 'Tag'} ${editingId ? 'modifié' : 'ajouté'}.`);
      resetForm();
      setItems((current) => editingId ? current.map((item) => item.id === editingId ? result.item : item) : [...current, result.item].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    const detail = isCategory ? 'Les articles resteront publiés mais ne seront plus associés à cette catégorie.' : 'Les articles resteront publiés mais perdront ce tag.';
    if (!window.confirm(`Supprimer « ${item.name} » ? ${detail}`)) return;
    try {
      await adminRequest(`/api/${type}/${item.id}`, session, { method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) resetForm();
      toast.success(`${isCategory ? 'Catégorie' : 'Tag'} supprimé.`);
    } catch (error) { toast.error(error.message); }
  }

  return (
    <div className="taxonomy-page">
      <div className="admin-page-heading"><div><span className="section-kicker">ORGANISER LE JOURNAL</span><h1>{title}<span>.</span></h1><p>Gérez les rubriques et les mots-clés de vos articles.</p></div></div>
      <div className="taxonomy-layout">
        <section className="taxonomy-form-card"><span className="section-kicker">{editingId ? `MODIFIER ${label.toUpperCase()}` : `NOUVEAU ${label.toUpperCase()}`}</span><h2>{editingId ? 'Mettre à jour' : 'Ajouter au journal'}</h2><form onSubmit={save}><label htmlFor="taxonomy-name">Nom</label><input id="taxonomy-name" value={name} required minLength="2" maxLength="80" onChange={(event) => { const next = event.target.value; setName(next); if (!slugTouched) setSlug(slugify(next)); }} placeholder={isCategory ? 'ex. Football' : 'ex. Analyse'} /><label htmlFor="taxonomy-slug">Slug</label><input id="taxonomy-slug" value={slug} required maxLength="100" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => { setSlug(event.target.value); setSlugTouched(true); }} placeholder="ex. football" /><small>Utilisé dans les adresses URL : /categorie/{slug || 'exemple'}</small><div className="taxonomy-form-actions"><button className="button button-dark" type="submit" disabled={busy || !name.trim() || !slug.trim()}>{busy ? 'Enregistrement…' : <><Plus size={16} />{editingId ? 'Enregistrer' : `Ajouter ${label}`}</>}</button>{editingId && <button className="button button-light" type="button" onClick={resetForm}><X size={15} />Annuler</button>}</div></form></section>
        <section className="taxonomy-list-card"><div className="taxonomy-list-heading"><div><h2>Vos {isCategory ? 'rubriques' : 'mots-clés'}</h2><span>{loading ? 'Chargement…' : `${items.length} élément${items.length === 1 ? '' : 's'}`}</span></div></div>{items.length === 0 ? <div className="taxonomy-empty">{loading ? 'Chargement des éléments…' : 'Aucun élément pour le moment.'}</div> : <div className="taxonomy-list">{items.map((item) => <div className="taxonomy-row" key={item.id}><div><strong>{item.name}</strong><span>/{isCategory ? 'categorie' : 'tag'}/{item.slug}</span></div><div><button type="button" aria-label={`Modifier ${item.name}`} onClick={() => beginEdit(item)}><Pencil size={15} /></button><button type="button" className="danger-action" aria-label={`Supprimer ${item.name}`} onClick={() => remove(item)}><Trash2 size={15} /></button></div></div>)}</div>}</section>
      </div>
    </div>
  );
}
