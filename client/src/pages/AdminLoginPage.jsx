import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { SeoHead } from '../components/SeoHead.jsx';

export function AdminLoginPage() {
  const { configured, loading, user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  if (!loading && user) return <Navigate to={location.state?.from || '/admin'} replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) { toast.error(error.message === 'Invalid login credentials' ? 'Adresse e-mail ou mot de passe incorrect.' : error.message); return; }
    toast.success('Connexion établie.');
    navigate(location.state?.from || '/admin', { replace: true });
  }
  return <main className="login-page"><SeoHead />
    <div className="login-left"><Link className="admin-brand" to="/"><span className="brand-mark"><i>AD</i><b /></span><span>AD SHOP<br /><strong>BOUTIQUE</strong></span></Link><div className="login-editorial"><span className="section-kicker">ESPACE MARCHAND</span><h1>La sélection<br />prend forme<br /><em>ici.</em></h1><p>Votre espace pour gérer les produits, les stocks et les commandes AD Shop.</p></div><div className="login-left-footer">AD SHOP BOUTIQUE · ADMINISTRATION</div></div>
    <section className="login-panel"><Link className="back-link" to="/"><ArrowLeft size={15} />Retour à la boutique</Link><div className="login-form-wrap"><span className="login-lock"><LockKeyhole size={19} /></span><span className="section-kicker">CONNEXION SÉCURISÉE</span><h2>Bon retour.</h2><p>Connectez-vous à l’administration boutique.</p>
      {!configured ? <div className="setup-message"><strong>La connexion sera activée lors du raccordement Supabase.</strong><p>Les identifiants Supabase Auth restent nécessaires. Aucun compte de démonstration n’est proposé.</p><ol><li>Renseignez l’URL Supabase et la clé publishable dans l’environnement client.</li><li>Créez l’utilisateur administrateur dans Supabase Auth.</li><li>Après application de la migration, ajoutez cet utilisateur à <code>store_admins</code>.</li></ol></div> : <form className="login-form" onSubmit={submit}>
        <label htmlFor="login-email">Adresse e-mail</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" />
        <label htmlFor="login-password">Mot de passe</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" />
        <button className="button button-dark login-submit" type="submit" disabled={busy || loading}>{busy ? 'Connexion…' : 'Se connecter'}<span>→</span></button><p className="login-help">L’accès est réservé aux comptes explicitement ajoutés à <code>store_admins</code>. Les inscriptions publiques restent désactivées.</p>
      </form>}
      <Link className="login-site-link" to="/boutique">Découvrir la boutique <span>↗</span></Link>
    </div></section>
  </main>;
}
