import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, CircleDollarSign, Clock3, PackageCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDate, formatXof } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

export function AdminDashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/admin/dashboard', { token: session?.access_token, signal: controller.signal })
      .then(setData)
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, [session?.access_token]);
  const summary = data?.summary;
  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">ESPACE MARCHAND</span><h1>Vue d’ensemble<span>.</span></h1><p>Suivez le catalogue et les commandes de AD Shop.</p></div><Link className="button button-dark" to="/admin/produits/nouveau">Ajouter un produit <ArrowRight size={15} /></Link></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-stat-grid"><article><span><Boxes size={17} /></span><small>Produits actifs</small><strong>{summary?.product_count ?? '—'}</strong></article><article><span><Clock3 size={17} /></span><small>Paiements en attente</small><strong>{summary?.pending_payment_count ?? '—'}</strong></article><article><span><PackageCheck size={17} /></span><small>Commandes payées</small><strong>{summary?.paid_order_count ?? '—'}</strong></article><article><span><CircleDollarSign size={17} /></span><small>Commandes totales</small><strong>{summary?.order_count ?? '—'}</strong></article></div>
    <div className="admin-card"><div className="admin-card-heading"><div><span className="section-kicker">ACTIVITÉ RÉCENTE</span><h2>Dernières commandes</h2></div><Link className="text-link" to="/admin/commandes">Toutes les commandes <ArrowRight size={14} /></Link></div>
      {!data ? <p className="admin-muted">Chargement des données…</p> : data.recent_orders?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Commande</th><th>Client</th><th>Date</th><th>Paiement</th><th>Total</th></tr></thead><tbody>{data.recent_orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong><small>{order.order_items?.length || 0} ligne(s)</small></td><td>{order.customer_name}<small>{order.customer_email}</small></td><td>{formatDate(order.created_at)}</td><td><span className={`status-pill status-${order.payment_status}`}>{order.payment_status}</span></td><td><strong>{formatXof(order.total_xof)}</strong></td></tr>)}</tbody></table></div> : <p className="admin-muted">Aucune commande pour le moment. Les commandes apparaîtront ici après configuration du paiement.</p>}
    </div>
    <div className="admin-safety-note"><strong>Paiements : désactivés.</strong><span>PayTech ne sera activé qu’après configuration des secrets, validation des tarifs et accord explicite du propriétaire.</span></div>
  </section>;
}
