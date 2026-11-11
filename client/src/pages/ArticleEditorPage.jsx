import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { ArrowLeft, CalendarClock, ImagePlus, Save, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { adminRequest, datetimeLocalToIso, slugify, toDatetimeLocal } from '../lib/admin.js';
import { RichTextEditor } from '../components/RichTextEditor.jsx';
import { LoadingState } from '../components/Editorial.jsx';

const emptyForm = {
  title: '', slug: '', excerpt: '', content: '', cover_image_url: '', category_id: '', tag_ids: [],
  status: 'draft', is_featured: false, published_at: '', author_name: 'Rédaction sportive',
};

export function ArticleEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const coverInputId = 'cover-image-input';

  useEffect(() => {
    let active = true;
    Promise.all([
      adminRequest('/api/admin/categories', session),
      adminRequest('/api/admin/tags', session),
      editing ? adminRequest(`/api/admin/articles/${id}`, session) : Promise.resolve(null),
    ]).then(([categoryResult, tagResult, articleResult]) => {
      if (!active) return;
      setCategories(categoryResult.items || []);
      setTags(tagResult.items || []);
      if (articleResult?.item) {
        const article = articleResult.item;
        setForm({
          title: article.title || '', slug: article.slug || '', excerpt: article.excerpt || '', content: article.content || '',
          cover_image_url: article.cover_image_url || '', category_id: article.category_id || '',
          tag_ids: article.tag_ids || article.tags?.map((tag) => tag.id).filter(Boolean) || [],
          status: article.status || 'draft', is_featured: Boolean(article.is_featured),
          published_at: toDatetimeLocal(article.published_at), author_name: article.author_name || 'Rédaction sportive',
        });
        setSlugManual(true);
      }
    }).catch((error) => toast.error(error.message)).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, id, session]);

  const token = session?.access_token;
  const uploadImage = useCallback(async (originalFile) => {
    const file = originalFile.type === 'image/gif'
      ? originalFile
      : await imageCompression(originalFile, { maxSizeMB: 1.2, maxWidthOrHeight: 2200, useWebWorker: true, fileType: 'image/webp' });
    const data = new FormData();
    data.append('file', file, file.name || 'image.webp');
    const result = await adminRequest('/api/upload', { access_token: token }, { method: 'POST', body: data });
    return result.url;
  }, [token]);

  async function uploadCover(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choisissez une image.'); return; }
    setCoverUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((current) => ({ ...current, cover_image_url: url }));
      toast.success('Image de couverture envoyée.');
    } catch (error) { toast.error(error.message); }
    finally { setCoverUploading(false); }
  }

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'title' && !slugManual) next.slug = slugify(value);
      return next;
    });
  }

  function onCoverDrop(event) {
    event.preventDefault(); setDragging(false);
    const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith('image/'));
    if (file) void uploadCover(file);
  }

  async function save(status) {
    if (form.title.trim().length < 3) { toast.error('Le titre doit contenir au moins 3 caractères.'); return; }
    if (!form.slug.trim()) { toast.error('Ajoutez un slug pour créer l’adresse de l’article.'); return; }
    setSaving(true);
    const payload = {
      ...form,
      title: form.title.trim(), slug: form.slug.trim(), excerpt: form.excerpt.trim(), status,
      published_at: datetimeLocalToIso(form.published_at), category_id: form.category_id || null,
      cover_image_url: form.cover_image_url || null, tag_ids: form.tag_ids,
    };
    try {
      const result = editing
        ? await adminRequest(`/api/articles/${id}`, session, { method: 'PUT', body: payload })
        : await adminRequest('/api/articles', session, { method: 'POST', body: payload });
      toast.success(status === 'published' ? 'Article publié.' : 'Brouillon enregistré.');
      navigate('/admin', { replace: true, state: { savedId: result.item.id } });
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  const selectedTags = useMemo(() => new Set(form.tag_ids), [form.tag_ids]);
  if (loading) return <LoadingState label="Ouverture de l’éditeur…" />;

  return (
    <div className="article-editor-page">
      <div className="editor-page-top"><Link className="back-link" to="/admin"><ArrowLeft size={15} />Retour aux articles</Link><span className={`status-pill status-${form.status}`}>{form.status === 'published' ? 'Publié' : 'Brouillon'}</span></div>
      <div className="admin-page-heading editor-heading"><div><span className="section-kicker">{editing ? 'REPRENDRE LA RÉDACTION' : 'NOUVEAU RÉCIT'}</span><h1>{editing ? 'Modifier l’article' : 'Écrire une histoire'}<span>.</span></h1><p>Le titre donne le ton. Le reste, c’est votre voix.</p></div><div className="editor-actions"><button type="button" className="button button-light" disabled={saving} onClick={() => save('draft')}><Save size={16} />Enregistrer brouillon</button><button type="button" className="button button-dark" disabled={saving} onClick={() => save('published')}><Send size={16} />{saving ? 'Enregistrement…' : form.status === 'published' ? 'Mettre à jour' : 'Publier'}</button></div></div>
      <div className="article-editor-layout">
        <div className="editor-main-column">
          <section className="editor-card title-card"><label className="field-label" htmlFor="article-title">TITRE</label><input id="article-title" className="article-title-input" value={form.title} maxLength="180" onChange={(event) => update('title', event.target.value)} placeholder="Le titre de votre article" /><div className="field-row"><label htmlFor="article-slug">URL <span>{window.location.origin}/article/</span></label><input id="article-slug" value={form.slug} maxLength="220" onChange={(event) => { setSlugManual(true); update('slug', slugify(event.target.value)); }} placeholder="mon-article" /></div><label className="field-label" htmlFor="article-excerpt">CHAPÔ / EXTRAIT</label><textarea id="article-excerpt" rows="3" maxLength="360" value={form.excerpt} onChange={(event) => update('excerpt', event.target.value)} placeholder="En quelques lignes, donnez envie de lire la suite." /><div className="character-count">{form.excerpt.length}/360</div></section>
          <section className="editor-card body-editor-card"><div className="editor-card-heading"><div><span className="field-label">CORPS DE L’ARTICLE</span><p>Un texte clair, des idées en mouvement.</p></div></div><RichTextEditor value={form.content} onChange={(content) => update('content', content)} onImageUpload={uploadImage} /></section>
        </div>
        <aside className="editor-side-column">
          <section className="editor-card cover-card"><div className="side-card-heading"><div><span className="field-label">IMAGE DE COUVERTURE</span><p>Le premier regard sur l’histoire.</p></div></div><div className={`cover-dropzone${dragging ? ' is-dragging' : ''}${form.cover_image_url ? ' has-image' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onCoverDrop}>
            {form.cover_image_url ? <><img src={form.cover_image_url} alt="Aperçu de la couverture" /><button type="button" className="remove-cover" aria-label="Supprimer la couverture" onClick={() => update('cover_image_url', '')}><X size={16} /></button><label className="cover-change" htmlFor={coverInputId}>Changer l’image</label></> : <><ImagePlus size={24} /><strong>{coverUploading ? 'Envoi en cours…' : 'Déposez votre image ici'}</strong><span>ou choisissez un fichier · JPEG, PNG, WebP</span><label className="button button-light cover-select" htmlFor={coverInputId}>{coverUploading ? 'Envoi…' : 'Choisir une image'}</label></>}
          </div><input className="sr-only" id={coverInputId} type="file" accept="image/*" onChange={(event) => { const [file] = event.target.files || []; void uploadCover(file); event.target.value = ''; }} /><small className="field-help">Les images sont optimisées et redimensionnées à 2 200 px maximum avant l’envoi.</small></section>
          <section className="editor-card"><span className="field-label">ORGANISATION</span><label className="form-label" htmlFor="article-category">Rubrique</label><select id="article-category" value={form.category_id} onChange={(event) => update('category_id', event.target.value)}><option value="">Choisir une rubrique</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><label className="form-label">Tags</label><div className="tag-choice-list">{tags.length ? tags.map((tag) => <label key={tag.id} className="tag-choice"><input type="checkbox" checked={selectedTags.has(tag.id)} onChange={(event) => update('tag_ids', event.target.checked ? [...form.tag_ids, tag.id] : form.tag_ids.filter((idValue) => idValue !== tag.id))} /><span>{tag.name}</span></label>) : <span className="field-help">Aucun tag créé. Vous pourrez en ajouter dans la rubrique Tags.</span>}</div></section>
          <section className="editor-card"><span className="field-label">PUBLICATION</span><label className="form-label" htmlFor="publish-date"><CalendarClock size={15} />Date et heure de publication</label><input id="publish-date" type="datetime-local" value={form.published_at} onChange={(event) => update('published_at', event.target.value)} /><small className="field-help">Une date future programme l’article. Il apparaîtra en ligne à partir de cette heure.</small><label className="feature-toggle"><input type="checkbox" checked={form.is_featured} onChange={(event) => update('is_featured', event.target.checked)} /><span><strong>À la une</strong><small>Mettre cet article en avant sur l’accueil.</small></span></label></section>
          <section className="editor-card author-card"><label className="field-label" htmlFor="author-name">SIGNATURE</label><input id="author-name" maxLength="100" value={form.author_name} onChange={(event) => update('author_name', event.target.value)} placeholder="Rédaction sportive" /></section>
          <div className="editor-bottom-actions"><button type="button" className="button button-light" onClick={() => save('draft')} disabled={saving}><Save size={15} />Brouillon</button><button type="button" className="button button-dark" onClick={() => save('published')} disabled={saving}><Send size={15} />Publier</button></div>
        </aside>
      </div>
    </div>
  );
}
