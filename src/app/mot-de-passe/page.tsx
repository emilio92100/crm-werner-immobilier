'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import a from '@/components/acces/Acces.module.css';
import ChampsMotDePasse, { mdpValide } from '@/components/acces/ChampsMotDePasse';
import { poserBadge } from '@/components/acces/connexion';

/* ═══ /mot-de-passe?jeton=… — le lien du mail « Réinitialiser votre mot de
   passe » (22 octobre 2026, src/lib/acces-serveur.ts) ═══════════════════════
   Le jeton n'est vérifié qu'au moment d'enregistrer (`verifyOtp`), pas à
   l'ouverture : les antivirus de messagerie qui ouvrent les liens ne le
   consomment pas. Puis le nouveau mot de passe, le badge du CRM, et l'entrée.
   Page publique (src/proxy.ts). */

function Formulaire() {
  const params = useSearchParams();
  const jeton = params.get('jeton') || '';
  const [mdp, setMdp] = useState('');
  const [encore, setEncore] = useState('');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [perime, setPerime] = useState(false);
  const [fait, setFait] = useState(false);
  /* La session ouverte par le lien : un mot de passe refusé se corrige sans
     redemander de lien (le jeton ne sert qu'une fois). */
  const [session, setSession] = useState<string | null>(null);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (envoi || !mdpValide(mdp, encore)) return;
    setEnvoi(true); setErreur('');
    try {
      let jetonSession = session;
      if (!jetonSession) {
        const v = await supabase.auth.verifyOtp({ token_hash: jeton, type: 'recovery' });
        if (v.error || !v.data?.session) { setPerime(true); return; }
        jetonSession = v.data.session.access_token;
        setSession(jetonSession);
      }
      const u = await supabase.auth.updateUser({ password: mdp });
      if (u.error) {
        const m = u.error.message || '';
        setErreur(/same|different from the old/i.test(m) ? 'C’est déjà votre mot de passe actuel : choisissez-en un autre.'
          : /weak|short|characters/i.test(m) ? `Ce mot de passe est refusé, trop simple : allongez-le, mélangez lettres et chiffres. (${m})`
          : `Le mot de passe n’a pas pu être changé : ${m}.`);
        return;
      }
      const badge = await poserBadge(jetonSession);
      if (badge) { setErreur(`Votre mot de passe est changé, mais l’entrée dans le CRM a échoué (${badge}). Connectez-vous avec le nouveau mot de passe.`); return; }
      setFait(true);
      setTimeout(() => window.location.assign('/'), 2200);
    } catch {
      setErreur('Erreur réseau : rien n’a changé. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className={a.page}>
      <div className={a.colonne}>
        <div className={a.marque}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/logo-emilio-blanc-800.png" alt="Werner Immobilier" width={800} height={336} />
          <span>Immobilier d’entreprise</span>
        </div>
        <div className={a.carte}>
          {!jeton || perime ? (
            <>
              <h1>{jeton ? 'Ce lien ne marche plus' : 'Lien incomplet'}</h1>
              <p className={a.intro}>{jeton
                ? 'Il a expiré (une heure) ou a déjà servi. Demandez-en un nouveau : il arrive en une minute.'
                : 'L’adresse ouverte n’a pas son jeton. Ouvrez le bouton du mail tel quel, ou demandez un nouveau lien.'}</p>
              <button type="button" className={a.btn} onClick={() => window.location.assign('/login?oubli=1')}>Recevoir un nouveau lien</button>
            </>
          ) : fait ? (
            <>
              <h1>Votre mot de passe est changé</h1>
              <div className={a.succes}>{'C’est fait. Vous entrez dans votre CRM…'}</div>
              <button type="button" className={a.btn} onClick={() => window.location.assign('/')}>{'Accéder à mon CRM →'}</button>
            </>
          ) : (
            <form onSubmit={enregistrer}>
              <h1>Votre nouveau mot de passe</h1>
              <p className={a.intro}>{'Choisissez-le, puis répétez-le. Il remplace l’ancien dès que vous l’enregistrez.'}</p>
              <ChampsMotDePasse mdp={mdp} encore={encore} voir={voir} onMdp={setMdp} onEncore={setEncore} onVoir={setVoir} />
              {erreur && <div className={a.erreur} role="alert">{erreur}</div>}
              <button type="submit" className={a.btn} disabled={!mdpValide(mdp, encore) || envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer et entrer'}</button>
            </form>
          )}
        </div>
        <div className={a.pied}>Accès réservé — Werner Immobilier · RT Conseils · CPI 9201 2020 000 045 344</div>
      </div>
    </div>
  );
}

export default function PageMotDePasse() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#25272b' }} />}>
      <Formulaire />
    </Suspense>
  );
}
