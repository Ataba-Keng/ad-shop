import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../lib/api.js';
import { formatDate, formatXof } from '../lib/store.js';
import { SeoHead } from '../components/SeoHead.jsx';

const nextStep = { unfulfilled: 'processing', processing: 'shipped', shipped: 'delivered' };
const actionLabel = { unfulfilled: 'Marquer en préparation', processing: 'Marquer expédiée', shipped: 'Marquer livrée' };
export function StoreOrdersPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const paymentStatus = params.get('payment') || 'all';
  const fulfillmentStatus = params.get('fulfillment') || 'all';
  const q = params.get('q') || '';
  const [queryInput, setQueryInput] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [tracking, setTracking] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '25', paymentStatus, fulfillmentStatus, q });
      setData(await apiRequest(`/api/admin/orders?${query}`, { token: session?.access_token }));
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [fulfillmentStatus, page, paymentStatus, q, session?.access_token]);
  useEffect(() => { setQueryInput(q); }, [q]);
  useEffect(() => { load(); }, [load]);
  function updateFilters(next) {
    const values = { payment: paymentStatus, fulfillment: fulfillmentStatus, q, ...next };
    const search = new URLSearchParams();
    if (values.payment !== 'all') search.set('payment', values.payment);
    if (values.fulfillment !== 'all') search.set('fulfillment', values.fulfillment);
    if (values.q) search.set('q', values.q);
    if (next.page && Number(next.page) > 1) search.set('page', String(next.page));
    setParams(search, { replace: true });
  }
  function trackingValue(order, key) { return tracking[order.id]?.[key] ?? order[key === 'tracking_reference' ? 'tracking_reference' : 'tracking_url'] ?? ''; }
  function updateTracking(orderId, key, value) { setTracking((current) => ({ ...current, [orderId]: { ...current[orderId], [key]: value } })); }
  async function advance(order) {
    const status = nextStep[order.fulfillment_status];
    if (!status || order.payment_status !== 'paid') return;
    if (status === 'shipped' && !trackingValue(order, 'tracking_reference').trim()) { toast.error('Ajoutez la référence du transporteur avant de marquer la commande expédiée.'); return; }
    setBusyId(order.id);
    try {
      await apiRequest(`/api/admin/orders/${order.id}/fulfillment`, { token: session?.access_token, method: 'PATCH', body: { fulfillment_status: status, tracking_reference: trackingValue(order, 'tracking_reference'), tracking_url: trackingValue(order, 'tracking_url') } });
      toast.success(status === 'shipped' ? 'Commande marquée comme expédiée.' : status === 'delivered' ? 'Commande marquée comme livrée.' : 'Commande marquée en préparation.');
      await load();
    } catch (error) { toast.error(error.message); }
    finally { setBusyId(''); }
  }
  const orders = data?.items || [];
  return <section className="admin-page"><SeoHead /><div className="admin-page-heading"><div><span className="section-kicker">SERVICE COMMANDES</span><h1>Commandes<span>.</span></h1><p>Un paiement n’est marqué comme confirmé qu’après notification authentifiée du prestataire.</p></div></div>
    <div className="admin-card"><div className="admin-toolbar"><form className="admin-search-form" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: queryInput.trim() }); }}><Search size={16} /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Référence SP-…" aria-label="Rechercher une commande" /><button type="submit">Rechercher</button></form><div className="admin-filters"><label>Paiement<select value={paymentStatus} onChange={(event) => updateFilters({ payment: event.target.value })}><option value="all">Tous</option><option value="pending">En attente</option><option value="paid">Payé</option><option value="failed">Échec</option><option value="cancelled">Annulé</option><option value="refunded">Remboursé</option></select></label><label>Préparation<select value={fulfillmentStatus} onChange={(event) => updateFilters({ fulfillment: event.target.value })}><option value="all">Toutes</option><option value="unfulfilled">À préparer</option><option value="processing">En préparation</option><option value="shipped">Expédiée</option><option value="delivered">Livrée</option><option value="cancelled">Annulée</option></select></label></div></div>
      <div className="admin-card-heading"><div><span className="section-kicker">{data ? `${data.total} COMMANDE${data.total === 1 ? '' : 'S'}` : 'CHARGEMENT…'}</span><h2>Suivi marchand</h2></div></div>
      {loading && <p className="admin-muted">Chargement des commandes…</p>}{!loading && !orders.length && <p className="admin-muted">Aucune commande pour ces filtres.</p>}
      <div className="order-admin-list">{orders.map((order) => <article className="order-admin-card" key={order.id}><header><div><span className="section-kicker">{order.order_number}</span><h3>{order.customer_name}</h3><p>{order.customer_email} · {order.customer_phone}</p><small>Créée le {formatDate(order.created_at)}</small></div><div className="order-admin-total"><strong>{formatXof(order.total_xof)}</strong><span className={`status-pill status-${order.payment_status}`}>{order.payment_status}</span><span className={`status-pill status-${order.fulfillment_status}`}>{order.fulfillment_status}</span></div></header>
        <div className="order-admin-lines">{(order.order_items || []).map((item) => <div key={item.id}><span>{item.quantity} × {item.product_name_snapshot}{item.variant_name_snapshot ? ` — ${item.variant_name_snapshot}` : ''} <small>{item.product_type === 'digital' ? '· numérique' : '· physique'}</small></span><strong>{formatXof(item.line_total_xof)}</strong></div>)}</div>
        {order.fulfillment_status !== 'delivered' && nextStep[order.fulfillment_status] && <div className="order-fulfillment-controls">{order.fulfillment_status !== 'unfulfilled' && <div className="form-grid"><label>Référence de suivi<input value={trackingValue(order, 'tracking_reference')} onChange={(event) => updateTracking(order.id, 'tracking_reference', event.target.value)} placeholder="Transporteur / numéro" /></label><label>Lien de suivi<input type="url" value={trackingValue(order, 'tracking_url')} onChange={(event) => updateTracking(order.id, 'tracking_url', event.target.value)} placeholder="https://…" /></label></div>}<button className="button button-light" type="button" disabled={busyId === order.id || order.payment_status !== 'paid'} onClick={() => advance(order)}><Truck size={15} />{busyId === order.id ? 'Mise à jour…' : actionLabel[order.fulfillment_status]}</button>{order.payment_status !== 'paid' && <small>En attente du paiement confirmé.</small>}</div>}
      </article>)}</div>
      {data?.pages > 1 && <nav className="admin-pagination"><button type="button" disabled={loading || page <= 1} onClick={() => updateFilters({ page: page - 1 })}>Précédent</button><span>Page {data.page} sur {data.pages}</span><button type="button" disabled={loading || page >= data.pages} onClick={() => updateFilters({ page: page + 1 })}>Suivant</button></nav>}
    </div></section>;
}
