import { lazy, Suspense } from 'react';
import { Link, Outlet, Route, Routes } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter, SiteHeader } from './components/SiteHeader.jsx';
import { AdminLayout, ProtectedAdmin } from './components/AdminLayout.jsx';
import { SeoHead } from './components/SeoHead.jsx';
import { InitialPageDataContext } from './hooks/use-api-resource.js';
import { LoadingState } from './components/Storefront.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CatalogPage, CategoryPage, CheckoutPage, InfoPage, OrderPage, ProductPage, SearchPage, CartPage } from './pages/StorePages.jsx';
import { AdminLoginPage } from './pages/AdminLoginPage.jsx';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage.jsx').then((module) => ({ default: module.AdminDashboardPage })));
const StoreProductsPage = lazy(() => import('./pages/StoreProductsPage.jsx').then((module) => ({ default: module.StoreProductsPage })));
const StoreProductEditorPage = lazy(() => import('./pages/StoreProductEditorPage.jsx').then((module) => ({ default: module.StoreProductEditorPage })));
const StoreOrdersPage = lazy(() => import('./pages/StoreOrdersPage.jsx').then((module) => ({ default: module.StoreOrdersPage })));
const StoreCategoriesPage = lazy(() => import('./pages/StoreCategoriesPage.jsx').then((module) => ({ default: module.StoreCategoriesPage })));
const StoreShippingPage = lazy(() => import('./pages/StoreShippingPage.jsx').then((module) => ({ default: module.StoreShippingPage })));

function PublicLayout() {
  return <div className="site-shell"><SiteHeader /><Outlet /><SiteFooter /></div>;
}

function NotFoundPage() {
  return <main className="page-container not-found-page"><SeoHead data={{ notFound: true }} /><span className="section-kicker">404 · PAGE INTROUVABLE</span><h1>Cette page<br />n’est plus en boutique<span>.</span></h1><p>Le lien a peut-être changé. Retrouvons la sélection AD Shop.</p><Link className="button button-dark" to="/boutique"><ArrowLeft size={16} />Retour à la boutique</Link></main>;
}

const adminFallback = <div className="admin-lazy-fallback"><LoadingState label="Ouverture de l’administration boutique…" /></div>;

function AdminInfoPage({ type }) {
  if (type === 'categories') return <Suspense fallback={adminFallback}><StoreCategoriesPage /></Suspense>;
  return <Suspense fallback={adminFallback}><StoreShippingPage /></Suspense>;
}

export function App({ initialData = { key: '', data: null, demoMode: false } }) {
  const demoMode = Boolean(initialData.demoMode || initialData.data?.demoMode || initialData.data?.products?.demoMode);
  return <CartProvider><InitialPageDataContext.Provider value={{ ...initialData, demoMode }}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage demoMode={demoMode} />} />
        <Route path="/boutique" element={<CatalogPage />} />
        <Route path="/categorie/:slug" element={<CategoryPage />} />
        <Route path="/produit/:slug" element={<ProductPage />} />
        <Route path="/recherche" element={<SearchPage />} />
        <Route path="/panier" element={<CartPage />} />
        <Route path="/paiement" element={<CheckoutPage />} />
        <Route path="/commande/:orderNumber" element={<OrderPage />} />
        <Route path="/contact" element={<InfoPage type="contact" />} />
        <Route path="/livraison-retours" element={<InfoPage type="shipping" />} />
        <Route path="/conditions" element={<InfoPage type="terms" />} />
        <Route path="/confidentialite" element={<InfoPage type="privacy" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<ProtectedAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Suspense fallback={adminFallback}><AdminDashboardPage /></Suspense>} />
          <Route path="produits" element={<Suspense fallback={adminFallback}><StoreProductsPage /></Suspense>} />
          <Route path="produits/nouveau" element={<Suspense fallback={adminFallback}><StoreProductEditorPage /></Suspense>} />
          <Route path="produits/:id/modifier" element={<Suspense fallback={adminFallback}><StoreProductEditorPage /></Suspense>} />
          <Route path="commandes" element={<Suspense fallback={adminFallback}><StoreOrdersPage /></Suspense>} />
          <Route path="categories" element={<AdminInfoPage type="categories" />} />
          <Route path="livraisons" element={<AdminInfoPage type="shipping" />} />
        </Route>
      </Route>
    </Routes>
  </InitialPageDataContext.Provider></CartProvider>;
}
