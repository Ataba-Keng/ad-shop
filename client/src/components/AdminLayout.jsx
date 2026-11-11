import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Boxes, ClipboardList, FolderKanban, LogOut, Menu, PackagePlus, Truck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from './Storefront.jsx';
import { SeoHead } from './SeoHead.jsx';
import { apiRequest } from '../lib/api.js';

const navigation = [
  { to: '/admin', label: 'Vue d’ensemble', icon: ClipboardList, end: true },
  { to: '/admin/produits', label: 'Produits', icon: Boxes },
  { to: '/admin/produits/nouveau', label: 'Ajouter un produit', icon: PackagePlus },
  { to: '/admin/commandes', label: 'Commandes', icon: ClipboardList },
  { to: '/admin/categories', label: 'Catégories', icon: FolderKanban },
  { to: '/admin/livraisons', label: 'Zones de livraison', icon: Truck },
];

export function ProtectedAdmin() {
  const { configured, loading, user, session, signOut } = useAuth();
  const location = useLocation();
  const [role, setRole] = useState({ userId: '', loading: false, allowed: false });
  const token = session?.access_token || '';

  useEffect(() => {
    if (!user?.id || !token) { setRole({ userId: '', loading: false, allowed: false }); return undefined; }
    let active = true;
    setRole({ userId: user.id, loading: true, allowed: false });
    apiRequest('/api/admin/access', { token })
      .then(() => { if (active) setRole({ userId: user.id, loading: false, allowed: true }); })
      .catch(() => { if (active) setRole({ userId: user.id, loading: false, allowed: false }); });
    return () => { active = false; };
  }, [token, user?.id]);

  if (loading) return <main className="admin-auth-wait"><LoadingState label="Vérification de votre session…" /></main>;
  if (!configured) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (role.loading || role.userId !== user.id) return <main className="admin-auth-wait"><LoadingState label="Vérification des droits boutique…" /></main>;
  if (!role.allowed) return <main className="admin-auth-wait"><SeoHead /><section className="admin-denied"><span className="section-kicker">ACCÈS REFUSÉ</span><h1>Ce compte n’administre pas la boutique.</h1><p>Connectez-vous avec un compte autorisé dans la table <code>store_admins</code>, ou demandez au propriétaire de la boutique de l’ajouter.</p><button className="button button-dark" type="button" onClick={() => signOut()}>Se déconnecter</button></section></main>;
  return <Outlet />;
}

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    setSigningOut(true);
    const { error } = await signOut();
    if (error) { setSigningOut(false); return; }
    window.location.assign('/admin/login');
  }
  return <div className="admin-shell">
    <SeoHead />
    <aside className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}>
      <Link className="admin-brand" to="/"><span className="brand-mark"><i>AD</i><b /></span><span>AD SHOP<br /><strong>BOUTIQUE</strong></span></Link>
      <div className="admin-nav-title">GESTION DE LA BOUTIQUE</div>
      <nav className="admin-nav" aria-label="Navigation administration">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}><Icon size={17} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-bottom"><span className="admin-avatar">{user?.email?.slice(0, 1).toUpperCase() || 'S'}</span><span className="admin-user-email">{user?.email || 'Admin boutique'}</span><button className="logout-button" type="button" onClick={logout} disabled={signingOut} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} /></button></div>
    </aside>
    <div className="admin-main"><header className="admin-topbar"><button className="icon-button admin-menu-toggle" type="button" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button><div><span className="admin-top-kicker">ESPACE MARCHAND</span><strong>AD Shop</strong></div><Link className="admin-view-site" to="/" target="_blank" rel="noreferrer">Voir la boutique ↗</Link></header><div className="admin-content"><Outlet /></div></div>
    {menuOpen && <button className="admin-scrim" type="button" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
  </div>;
}
