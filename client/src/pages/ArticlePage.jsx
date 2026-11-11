import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock3 } from 'lucide-react';
import { useApiResource } from '../hooks/use-api-resource.js';
import { ArticleCard, CategoryLabel, DemoNotice, EmptyState, ErrorState, formatDate, LoadingState, SectionHeading } from '../components/Editorial.jsx';
import { SeoHead } from '../components/SeoHead.jsx';

export function ArticlePage({ demoMode }) {
  const { slug = '' } = useParams();
  const resource = useApiResource(`article:${slug}`, `/api/articles/${encodeURIComponent(slug)}`);
  if (resource.loading && !resource.data) return <><SeoHead /><LoadingState label="Ouverture de l’article…" /></>;
  if (resource.error) return <><SeoHead data={{ notFound: resource.error.status === 404 }} /><ErrorState message={resource.error.message} /></>;
  const article = resource.data?.item;
  if (!article) return <><SeoHead data={{ notFound: true }} /><EmptyState title="Cet article est introuvable." copy="Il a peut-être été déplacé ou n’est plus disponible." /></>;

  return (
    <>
      <SeoHead data={article ? { item: article } : {}} />
      {demoMode && <DemoNotice />}
      <main className="article-page">
        <Link className="back-link" to="/"><ArrowLeft size={15} />Retour au journal</Link>
        <header className="article-header">
          <div className="article-meta"><CategoryLabel category={article.category} /><span><Clock3 size={14} />{formatDate(article.published_at)}</span></div>
          <h1>{article.title}</h1>
          {article.excerpt && <p className="article-deck">{article.excerpt}</p>}
          <div className="article-byline"><span className="byline-mark">PS</span><span>Par <strong>{article.author_name || 'La rédaction'}</strong><br /><time dateTime={article.published_at || article.created_at}>{formatDate(article.published_at || article.created_at)}</time></span></div>
        </header>
        <figure className="article-cover">
          {article.cover_image_url ? <img src={article.cover_image_url} alt={article.title} fetchPriority="high" /> : <div className="image-fallback image-fallback-large"><span>PS<span>.</span></span></div>}
          <figcaption>{article.category?.name || 'Presse sportive'} · Lecture éditoriale</figcaption>
        </figure>
        <div className="article-body-layout">
          <aside className="article-side-note"><span>À RETENIR</span><p>Une lecture claire du jeu, des choix et de ce qui se joue autour.</p><span className="side-note-line" /></aside>
          <div className="article-rich-content" dangerouslySetInnerHTML={{ __html: article.content || '' }} />
        </div>
        {article.tags?.length > 0 && <div className="article-tags"><span>À LIRE AUSSI</span>{article.tags.map((tag) => <span className="tag-pill" key={tag.id || tag.slug}>{tag.name}</span>)}</div>}
        {resource.data?.related?.length > 0 && <section className="related-section"><SectionHeading kicker="POUR PROLONGER" title="Dans le même esprit" /><div className="related-grid">{resource.data.related.map((item) => <ArticleCard key={item.id} article={item} />)}</div></section>}
        <Link className="article-end-link" to="/"><ArrowLeft size={15} /> Revenir à la une <ArrowUpRight size={15} /></Link>
      </main>
    </>
  );
}
