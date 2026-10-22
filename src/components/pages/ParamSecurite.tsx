'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Page.module.css';

/* ═══ Paramètres › Sécurité : ton compte et ton mot de passe (22 octobre 2026) ═══
   Alexandre : « est-ce qu'il peut se connecter, créer son identifiant ? ».
   Le compte de Werner est créé à la main dans Supabase (les inscriptions sont
   fermées), avec un mot de passe provisoire. Ici, Werner le remplace par le
   sien, sans passer par Supabase.

   Le mot de passe actuel est d'abord vérifié (une connexion Supabase avec
   lui : ratée, elle ne touche pas à la session ouverte) : un ordinateur
   laissé ouvert ne suffit pas pour changer le mot de passe. Puis
   `auth.updateUser`. Chaque refus est dit en français. */

const MIN = 8;

export default function ParamSecurite() {
  const [mail, setMail] = useState<string | null>(null);
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [encore, setEncore] = useState('');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState(false);

  useEffect(() => {
    let vivant = true;
    supabase.auth.getUser().then(({ data }) => { if (vivant) setMail(data.user?.email || ''); });
    return () => { vivant = false; };
  }, []);

  const tropCourt = nouveau.length > 0 && nouveau.length < MIN;
  const different = encore.length > 0 && encore !== nouveau;
  const pret = !!mail && actuel.length > 0 && nouveau.length >= MIN && encore === nouveau && !envoi;

  async function changer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || !mail) return;
    setEnvoi(true); setErreur(''); setFait(false);
    try {
      if (nouveau === actuel) { setErreur('Le nouveau mot de passe est le même que l’actuel : choisis-en un autre.'); return; }
      const v = await supabase.auth.signInWithPassword({ email: mail, password: actuel });
      if (v.error || !v.data?.session) {
        setErreur(/invalid login/i.test(v.error?.message || '')
          ? 'Ton mot de passe actuel n’est pas le bon. Rien n’a changé.'
          : `Vérification impossible : ${v.error?.message || 'réessaie dans un instant'}. Rien n’a changé.`);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nouveau, current_password: actuel });
      if (error) {
        const m = error.message || '';
        setErreur(/same|different from the old/i.test(m) ? 'Le nouveau mot de passe est le même que l’actuel : choisis-en un autre.'
          : /weak|short|characters/i.test(m) ? `Ce mot de passe est trop simple pour Supabase : allonge-le, mélange lettres et chiffres. (${m})`
          : /reauth|nonce/i.test(m) ? 'Pour ta sécurité, Supabase demande une connexion récente : déconnecte-toi, reconnecte-toi, puis recommence.'
          : `Le mot de passe n’a pas pu être changé : ${m}. L’ancien reste valable.`);
        return;
      }
      setActuel(''); setNouveau(''); setEncore(''); setVoir(false); setFait(true);
    } catch {
      setErreur('Erreur réseau : le mot de passe n’a pas été changé. Réessaie dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  const type = voir ? 'text' : 'password';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form className={`${styles.card} ${styles.carteForm}`} style={{ padding: 24 }} onSubmit={changer}>
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--emilio)', marginBottom: 6 }}>🔒 Ton compte</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 18 }}>
          {mail === null ? 'Lecture de ton compte…'
            : mail ? <span>{'Tu te connectes avec '}<b style={{ color: '#232528' }}>{mail}</b>{' et ton mot de passe. L’adresse ne se change pas ici : demande-le à Alexandre.'}</span>
            : 'Ton compte n’a pas pu être lu : recharge la page.'}
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--emilio)', marginBottom: 4, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>Changer mon mot de passe</div>
        <div style={{ fontSize: 12.5, color: '#64748b', margin: '8px 0 14px', lineHeight: 1.5 }}>
          {`Remplace le mot de passe provisoire par le tien. ${MIN} caractères au moins ; une phrase courte que toi seul connais se retient mieux qu’un mot compliqué.`}
        </div>

        <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <div>
            <label className={styles.label} htmlFor="mdp-actuel">Mot de passe actuel</label>
            <input id="mdp-actuel" className={styles.input} type={type} autoComplete="current-password" value={actuel} onChange={e => { setActuel(e.target.value); setErreur(''); setFait(false); }} />
          </div>
          <div>
            <label className={styles.label} htmlFor="mdp-nouveau">Nouveau mot de passe</label>
            <input id="mdp-nouveau" className={styles.input} type={type} autoComplete="new-password" value={nouveau} onChange={e => { setNouveau(e.target.value); setErreur(''); setFait(false); }} />
            {tropCourt && <div style={{ fontSize: 12, color: '#b45309', marginTop: 5 }}>{`Encore ${MIN - nouveau.length} caractère${MIN - nouveau.length > 1 ? 's' : ''} au moins.`}</div>}
          </div>
          <div>
            <label className={styles.label} htmlFor="mdp-encore">Le nouveau, une deuxième fois</label>
            <input id="mdp-encore" className={styles.input} type={type} autoComplete="new-password" value={encore} onChange={e => { setEncore(e.target.value); setErreur(''); setFait(false); }} />
            {different && <div style={{ fontSize: 12, color: '#b45309', marginTop: 5 }}>Les deux ne sont pas pareils.</div>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={voir} onChange={e => setVoir(e.target.checked)} />
            <span>Afficher les mots de passe</span>
          </label>
        </div>

        {erreur && <div role="alert" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, lineHeight: 1.5, maxWidth: 520 }}>{erreur}</div>}
        {fait && <div role="status" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 13, lineHeight: 1.5, maxWidth: 520 }}>{'✅ C’est fait. La prochaine fois, connecte-toi avec ce nouveau mot de passe.'}</div>}

        <div style={{ marginTop: 16 }}>
          <button type="submit" className={`${styles.btn} ${styles.btnDark}`} disabled={!pret} style={{ opacity: pret ? 1 : .5, cursor: pret ? 'pointer' : 'default' }}>
            {envoi ? 'Changement…' : 'Changer mon mot de passe'}
          </button>
        </div>
      </form>

      <div className={`${styles.card} ${styles.carteForm}`} style={{ padding: 24 }}>
        <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#166534', marginBottom: 6 }}>✅ À propos de la sécurité</div>
          <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
            • Tes données sont stockées sur Supabase (chiffrement AES-256)<br />
            • Connexion HTTPS uniquement<br />
            • Hébergé sur Vercel (infrastructure sécurisée)<br />
            • Aucune donnée partagée avec des tiers<br />
            • Mot de passe oublié : préviens Alexandre, il te rouvre l’accès
          </div>
        </div>
      </div>
    </div>
  );
}
