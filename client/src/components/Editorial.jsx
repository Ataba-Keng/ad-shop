import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronRight } from 'lucide-react';

export function formatDate(value) {
  if (!value) return 'À lire';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À lire';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function CategoryLabel({ category, small = false }) {
  if (!category?.name) return null;
  return <Link className={`category-label${small ? ' category-label-small' : ''}`} to={`/categorie/${category.slug}`}>{category.name}</Link>;
}

export function ArticleCard({ article, variant = 'standard', eager = false }) {
  if (!article) return null;
  return (
    <article className={`article-card article-card-${variant}`}>
      <Link className="article-card-image" to={`/article/${article.slug}`} aria-label={`Lire : ${article.title}`}>
        {article.cover_image_url
          ? <img src={article.cover_image_url} alt={article.title} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} />
          : <div className="image-fallback" aria-hidden="true"><span>PS<span>.</span></span></div>}
      </Link>
      <div className="article-card-copy">
        <div className="article-meta"><CategoryLabel category={article.category} small /><span>{formatDate(article.published_at || article.created_at)}</span></div>
        <h3><Link to={`/article/${article.slug}`}>{article.title}</Link></h3>
        {article.excerpt && <p>{article.excerpt}</p>}
        {variant === 'feature' && <Link className="text-link" to={`/article/${article.slug}`}>Lire l’analyse <ArrowRight size={15} /></Link>}
      </div>
    </article>
  );
}

export function SectionHeading({ kicker, title, to, linkLabel = 'Tout voir' }) {
  return (
    <div className="section-heading">
      <div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div>
      {to && <Link className="section-link" to={to}>{linkLabel}<ChevronRight size={16} /></Link>}
    </div>
  );
}

export function Pagination({ page, pages, makeHref }) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).filter((number) => number === 1 || number === pages || Math.abs(number - page) <= 1);
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 && <Link to={makeHref(page - 1)} aria-label="Page précédente">← Précédent</Link>}
      <div className="pagination-numbers">
        {numbers.map((number, index) => (
          <span key={number} className="pagination-item">
            {index > 0 && number - numbers[index - 1] > 1 && <span className="pagination-ellipsis">…</span>}
            <Link className={number === page ? 'is-current' : ''} aria-current={number === page ? 'page' : undefined} to={makeHref(number)}>{number}</Link>
          </span>
        ))}
      </div>
      {page < pages && <Link to={makeHref(page + 1)} aria-label="Page suivante">Suivant →</Link>}
    </nav>
  );
}

export function LoadingState({ label = 'Chargement des articles…' }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" />{label}</div>;
}

export function ErrorState({ message = 'Les contenus ne sont pas accessibles pour le moment.', onRetry }) {
  return <div className="state-panel state-panel-error"><strong>Un instant, s’il vous plaît.</strong><p>{message}</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>Réessayer</button>}</div>;
}

export function EmptyState({ title = 'Rien à afficher pour le moment.', copy = 'Les prochaines publications apparaîtront ici.' }) {
  return <div className="state-panel"><CalendarDays size={24} /><strong>{title}</strong><p>{copy}</p></div>;
}

export function DemoNotice() {
  return <div className="demo-notice"><span className="demo-dot" />Aperçu éditorial — les articles affichés sont des exemples et seront remplacés par vos publications.</div>;
}
