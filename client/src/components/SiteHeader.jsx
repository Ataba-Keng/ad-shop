import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { publicContact } from '../config/contact.js';
import { useCart } from '../context/CartContext.jsx';

const navItems = [
  ['Boutique', '/boutique'],
  ['Vêtements', '/categorie/vetements'],
  ['Sacs', '/categorie/sacs'],
  ['Accessoires', '/categorie/accessoires'],
];

function Brand({ footer = false }) {
  return <Link className={footer ? 'footer-brand' : 'brand-lockup'} to="/" aria-label="AD Shop — accueil"><span className="brand-mark"><i>AD</i><b /></span><span className="brand-name">AD SHOP<br /><strong>BOUTIQUE</strong></span></Link>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const cart = useCart();
  function submitSearch(event) {
    event.preventDefault();
    const value = query.trim();
    if (value) navigate(`/recherche?q=${encodeURIComponent(value)}`);
    setMenuOpen(false);
    setSearchOpen(false);
  }
  return <header className="site-header">
    <div className="header-topline"><span></span><span>Prix affichés en francs CFA · XOF</span></div>
    <div className="header-main">
      <button className="icon-button menu-toggle" type="button" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <Brand />
      <nav className={`category-nav${menuOpen ? ' is-open' : ''}`} aria-label="Collections">
        {navItems.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <form className="header-search desktop-search" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="site-search">Rechercher un produit</label>
          <input id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher" />
          <button aria-label="Lancer la recherche" type="submit"><Search size={17} /></button>
        </form>
        <button className="icon-button mobile-search-toggle" type="button" aria-label={searchOpen ? 'Fermer la recherche' : 'Ouvrir la recherche'} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)}>{searchOpen ? <X size={18} /> : <Search size={18} />}</button>
        <Link className="cart-link" to="/panier" aria-label={`Panier, ${cart.count} article${cart.count > 1 ? 's' : ''}`}><ShoppingBag size={19} /><span>Panier</span><b>{cart.hydrated ? cart.count : 0}</b></Link>
      </div>
    </div>
    {searchOpen && <form className="mobile-search-form" role="search" onSubmit={submitSearch}><label className="sr-only" htmlFor="mobile-site-search">Rechercher un produit</label><input id="mobile-site-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit…" /><button type="submit" aria-label="Lancer la recherche"><Search size={17} /></button></form>}
    <div className="header-rule" />
  </header>;
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-top"><div className="footer-intro"><Brand footer /><p>Des essentiels à porter, associer et emporter partout. Une boutique de sélection mode imaginée par AD Shop.</p><span className="footer-demo-note">Coordonnées provisoires — à remplacer avant toute publication.</span></div>
      <div className="footer-links"><div><span className="section-kicker">LA BOUTIQUE</span><Link to="/boutique">Tous les produits</Link><Link to="/categorie/vetements">Vêtements</Link><Link to="/categorie/sacs">Sacs</Link><Link to="/categorie/accessoires">Accessoires</Link></div><div><span className="section-kicker">INFORMATIONS</span><Link to="/livraison-retours">Livraison et retours <small>(à confirmer)</small></Link><Link to="/conditions">Conditions provisoires</Link><Link to="/confidentialite">Confidentialité</Link><Link to="/contact">Contact</Link></div></div>
      <section className="footer-contact" aria-labelledby="footer-contact-title"><span className="section-kicker">BESOIN D’AIDE ?</span><h2 id="footer-contact-title">On vous répond.<span> À bientôt.</span></h2><a href={`mailto:${publicContact.email}`}>{publicContact.email}</a><span>{publicContact.phone}</span><div className="footer-socials">{publicContact.socials.map((social) => <span key={social.network} title={`${social.network} — profil fictif`}><b>{social.mark}</b>{social.network}</span>)}</div></section>
    </div>
    <div className="footer-bottom"><span>© AD Shop · Aperçu de démonstration</span><Link to="/admin/login">Administration <ArrowRight size={13} /></Link></div>
  </footer>;
}
