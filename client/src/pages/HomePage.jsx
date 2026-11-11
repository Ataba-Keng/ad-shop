import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MoveRight } from 'lucide-react';
import { useApiResource } from '../hooks/use-api-resource.js';
import { DemoNotice, EmptyState, ErrorState, LoadingState, ProductGrid, SectionHeading } from '../components/Storefront.jsx';
import { SeoHead } from '../components/SeoHead.jsx';
import { formatXof } from '../lib/store.js';

export function HomePage({ demoMode }) {
  const resource = useApiResource('home', '/api/home');
  const home = resource.data;
  if (resource.loading && !home) return <><SeoHead /><LoadingState /></>;
  if (resource.error && !home) return <><SeoHead /><ErrorState message={resource.error.message} /></>;
  const featured = home?.featured;

  return <>
    <SeoHead data={home || {}} />
    <main className="home-page">
      {demoMode && <DemoNotice />}
      <section className="shop-hero" aria-label="AD Shop">
        <img className="shop-hero-art" src="/images/shop/shop-hero.jpg" alt="Campagne mode AD Shop avec des vêtements et accessoires contemporains" fetchPriority="high" />
        <div className="shop-hero-shade" />
        <div className="shop-hero-copy">
          <span className="hero-kicker"><i /> STYLE DU QUOTIDIEN</span>
          <h1>Le style commence<br /><em>dès le premier regard.</em></h1>
          <p>Une sélection AD Shop imaginée pour les clientes et clients, femmes et hommes à la recherche de pièces faciles à porter.</p>
          <div className="hero-actions"><Link className="button button-coral" to="/boutique">Explorer la boutique <ArrowRight size={16} /></Link><Link className="hero-text-link" to="/categorie/vetements">Voir les vêtements <ArrowUpRight size={15} /></Link></div>
          <div className="hero-footnote">AD SHOP · PRIX EN FCFA</div>
        </div>
        <div className="hero-stamp"><span>AD</span><i>COLLECTION<br />AD SHOP</i></div>
      </section>

      <nav className="collection-nav" aria-label="Collections">
        <span className="section-kicker">PARCOURIR</span>
        {(home?.categories || []).map((category, index) => <Link key={category.id} to={`/categorie/${category.slug}`}><span>0{index + 1}</span>{category.name}<ArrowUpRight size={14} /></Link>)}
        <Link className="collection-all" to="/boutique">Tout le shop <MoveRight size={15} /></Link>
      </nav>

      {featured ? <section className="featured-product-section">
        <div className="featured-product-image">{featured.images?.[0]?.url && <Link to={`/produit/${featured.slug}`}><img src={featured.images[0].url} alt={featured.images[0].alt_text || featured.name} loading="lazy" /></Link>}<span className="image-caption">SÉLECTION AD SHOP · 01</span></div>
        <div className="featured-product-copy"><span className="section-kicker">DU QUOTIDIEN · À LA SORTIE</span><h2>Les pièces qui<br /><em>accompagnent.</em></h2><p>Des essentiels pensés pour le quotidien : coupes simples, accessoires utiles et détails qui signent une silhouette.</p><div className="featured-product-detail"><div><span>{featured.category?.name || 'Sélection'}</span><strong>{featured.name}</strong><b>{formatXof(featured.price_xof)}</b></div><Link className="button button-dark" to={`/produit/${featured.slug}`}>Voir l’article <ArrowRight size={15} /></Link></div></div>
      </section> : <EmptyState title="La sélection se prépare." />}

      <section className="home-products-section">
        <SectionHeading kicker="LA SÉLECTION AD SHOP" title="La sélection du moment" to="/boutique" linkLabel="Voir tous les produits" />
        <ProductGrid products={home?.products || []} eagerCount={2} />
      </section>

      {(home?.sections || []).map(({ category, products }, index) => <section className={`category-promo category-promo-${index % 2}`} key={category.id}>
        <SectionHeading kicker={`COLLECTION · 0${index + 1}`} title={category.name} to={`/categorie/${category.slug}`} linkLabel="Voir la collection" />
        <ProductGrid products={products} />
      </section>)}

    </main>
  </>;
}
