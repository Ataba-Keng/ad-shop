import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

export function RichTextEditor({ value, onChange, onImageUpload }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const uploadRef = useRef(onImageUpload);
  const onChangeRef = useRef(onChange);
  uploadRef.current = onImageUpload;
  onChangeRef.current = onChange;

  const uploadAndInsert = useCallback(async (file, editor) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Choisissez un fichier image.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadRef.current(file);
      editor.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run();
      toast.success('Image insérée dans l’article.');
    } catch (error) {
      toast.error(error.message || 'Impossible d’envoyer cette image.');
    } finally {
      setUploading(false);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
      Placeholder.configure({ placeholder: 'Commencez à raconter l’histoire…' }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChangeRef.current(currentEditor.getHTML()),
    editorProps: {
      attributes: { class: 'tiptap-content', 'aria-label': 'Contenu de l’article' },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files?.length) return false;
        const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        void uploadAndInsert(file, view.state ? editor : null);
        return true;
      },
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        void uploadAndInsert(file, view.state ? editor : null);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current && (value || '') !== '<p></p>') editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Adresse du lien (https://…)', previous);
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const buttons = [
    ['Gras', <Bold size={17} />, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold')],
    ['Italique', <Italic size={17} />, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic')],
    ['Titre 2', <span className="toolbar-letter">H2</span>, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive('heading', { level: 2 })],
    ['Titre 3', <span className="toolbar-letter">H3</span>, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), editor?.isActive('heading', { level: 3 })],
    ['Liste à puces', <List size={17} />, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList')],
    ['Liste numérotée', <ListOrdered size={17} />, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList')],
    ['Citation', <Quote size={16} />, () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive('blockquote')],
    ['Lien', <Link2 size={16} />, setLink, editor?.isActive('link')],
  ];

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Mise en forme du texte">
        {buttons.map(([label, icon, action, active]) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={Boolean(active)} className={active ? 'is-active' : ''} onClick={action}>{icon}</button>)}
        <span className="toolbar-divider" />
        <button type="button" aria-label="Insérer une image" title="Insérer une image" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <span className="mini-spinner" /> : <ImagePlus size={17} />}</button>
        <button type="button" aria-label="Annuler" title="Annuler" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button>
        <button type="button" aria-label="Rétablir" title="Rétablir" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button>
        <button type="button" aria-label="Effacer la mise en forme" title="Effacer la mise en forme" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={16} /></button>
        <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => { const [file] = event.target.files || []; if (file && editor) void uploadAndInsert(file, editor); event.target.value = ''; }} />
      </div>
      <EditorContent editor={editor} />
      <div className="editor-help">Glissez une image dans le texte ou utilisez l’icône image. Taille finale optimisée avant l’envoi.</div>
    </div>
  );
}
