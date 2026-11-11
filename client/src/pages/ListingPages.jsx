import { useMemo } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApiResource } from '../hooks/use-api-resource.js';
import { ArticleCard, DemoNotice, EmptyState, ErrorState, LoadingState, Pagination } from '../components/Editorial.jsx';
import { SeoHead } from '../components/SeoHead.jsx';

function pageFromSearch(searchParams) {
  return Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
}

export function CategoryPage({ demoMode }) {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const page = pageFromSearch(searchParams);
  const key = `category:${slug}:${page}`;
  const resource = useApiResource(key, `/api/categories/${encodeURIComponent(slug)}/articles?page=${page}&limit=8`);
  const result = resource.data;
  const category = result?.category;
  const articles = result?.articles;

  if (resource.loading && !result) return <><SeoHead /><LoadingState label="Chargement de la rubrique…" /></>;
  if (resource.error) return <><SeoHead data={{ notFound: resource.error.status === 404 }} /><ErrorState message={resource.error.message} /></>;
  if (!category) return <><SeoHead data={{ notFound: true }} /><EmptyState title="Cette rubrique n’existe pas." /></>;

  return (
    <>
      <SeoHead data={{ category }} />
      {demoMode && <DemoNotice />}
      <main className="listing-page">
        <div className="listing-intro"><span className="section-kicker">LE SPORT, SOUS TOUS SES ANGLES</span><p className="listing-index">RUBRIQUE / {String(category.name).toUpperCase()}</p><h1>{category.name}<span>.</span></h1><p className="listing-description">Les dernières nouvelles, analyses et histoires de la rubrique {category.name.toLowerCase()}.</p></div>
        {articles?.items?.length ? <div className="listing-grid">{articles.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div> : <EmptyState title={`Pas encore d’article en ${category.name.toLowerCase()}.`} />}
        {articles && <Pagination page={articles.page} pages={articles.pages} makeHref={(nextPage) => `${location.pathname}?page=${nextPage}`} />}
        <Link className="back-link listing-back" to="/">← Retour à la une</Link>
      </main>
    </>
  );
}

export function SearchPage({ demoMode }) {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const page = pageFromSearch(searchParams);
  const location = useLocation();
  const endpoint = query ? `/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=8` : '';
  const resource = useApiResource(`search:${query}:${page}`, endpoint);
  const results = resource.data;
  const countLabel = useMemo(() => {
    if (!results) return '';
    return `${results.total} ${results.total === 1 ? 'article trouvé' : 'articles trouvés'}`;
  }, [results]);

  return (
    <>
      <SeoHead data={{ query }} />
      {demoMode && <DemoNotice />}
      <main className="listing-page search-page">
        <div className="listing-intro"><span className="section-kicker">LE JOURNAL · RECHERCHE</span><p className="listing-index">EXPLORER LES ARTICLES</p><h1>La recherche<span>.</span></h1><p className="listing-description">Un nom, une idée, un mouvement de jeu : fouillez dans les récits de la rédaction.</p></div>
        <form className="search-page-form" role="search" action="/recherche" method="get">
          <label className="sr-only" htmlFor="search-page-input">Mot-clé recherché</label>
          <Search size={20} /><input id="search-page-input" type="search" name="q" defaultValue={query} minLength="2" maxLength="120" placeholder="Que cherchez-vous ?" /><button className="button button-dark" type="submit">Chercher</button>
        </form>
        {query && <div className="search-results-heading"><div><span className="section-kicker">RÉSULTATS POUR</span><h2>« {query} »</h2></div>{countLabel && <span>{countLabel}</span>}</div>}
        {resource.loading && !results && <LoadingState label="Recherche en cours…" />}
        {resource.error && <ErrorState message={resource.error.message} />}
        {results?.items?.length > 0 && <div className="listing-grid">{results.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
        {results && !results.items.length && <EmptyState title="Aucun article ne correspond." copy="Essayez un autre mot-clé ou vérifiez l’orthographe." />}
        {results && <Pagination page={results.page} pages={results.pages} makeHref={(nextPage) => `${location.pathname}?q=${encodeURIComponent(query)}&page=${nextPage}`} />}
      </main>
    </>
  );
}
