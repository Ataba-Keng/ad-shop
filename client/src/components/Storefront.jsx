import { Link } from 'react-router-dom';
import { ArrowRight, Check, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../context/CartContext.jsx';
import { formatXof } from '../lib/store.js';

export function DemoNotice() {
  return <div className="demo-notice"><span className="demo-dot" /><strong>Aperçu de démonstration.</strong><span>Les produits, prix et coordonnées sont fictifs; aucun paiement n’est activé.</span></div>;
}

export function SectionHeading({ kicker, title, to, linkLabel = 'Tout voir' }) {
  return <div className="section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div>{to && <Link className="section-link" to={to}>{linkLabel}<ArrowRight size={14} /></Link>}</div>;
}

export function ProductCard({ product, eager = false }) {
  const { addItem } = useCart();
  const image = product.images?.[0];
  const hasVariants = (product.variants || []).length > 0;
  function quickAdd(event) {
    event.preventDefault();
    event.stopPropagation();
    addItem(product.id, null, 1);
    toast.success(`${product.name} ajouté au panier.`);
  }

  return (
    <article className="product-card">
      <Link className="product-card-image" to={`/produit/${product.slug}`} aria-label={`Voir ${product.name}`}>
        {image?.url ? <img src={image.url} alt={image.alt_text || product.name} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} /> : <div className="product-image-empty">AD SHOP</div>}
        {product.product_type === 'digital' && <span className="product-type-badge">Nouveauté</span>}
        {!product.is_available && <span className="product-stock-badge">Épuisé</span>}
      </Link>
      <div className="product-card-body">
        <div className="product-card-meta"><Link to={product.category?.slug ? `/categorie/${product.category.slug}` : '/boutique'}>{product.category?.name || 'AD Shop'}</Link><span>{product.product_type === 'digital' ? 'Accessoire' : 'Article'}</span></div>
        <h3><Link to={`/produit/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-card-summary">{product.summary}</p>
        <div className="product-card-bottom"><div><strong>{formatXof(product.price_xof)}</strong>{product.compare_at_price_xof && <del>{formatXof(product.compare_at_price_xof)}</del>}</div>
          {hasVariants ? <Link className="quick-add-button" to={`/produit/${product.slug}`} aria-label={`Choisir une option pour ${product.name}`}><ArrowRight size={17} /></Link>
            : <button className="quick-add-button" type="button" onClick={quickAdd} disabled={!product.is_available} aria-label={`Ajouter ${product.name} au panier`}><ShoppingBag size={16} /></button>}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products = [], eagerCount = 0 }) {
  if (!products.length) return <EmptyState title="Aucun produit pour le moment." description="Revenez bientôt pour découvrir la sélection AD Shop." />;
  return <div className="product-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} eager={index < eagerCount} />)}</div>;
}

export function LoadingState({ label = 'Chargement de la boutique…' }) {
  return <div className="store-state" role="status"><span className="loading-mark" /><p>{label}</p></div>;
}

export function ErrorState({ message = 'Une erreur est survenue.' }) {
  return <div className="store-state store-state-error" role="alert"><strong>Impossible de charger la boutique.</strong><p>{message}</p><button className="button button-light" type="button" onClick={() => window.location.reload()}>Réessayer</button></div>;
}

export function EmptyState({ title, description = '' }) {
  return <div className="empty-state"><span className="empty-state-icon"><Check size={18} /></span><h3>{title}</h3>{description && <p>{description}</p>}</div>;
}
