'use client';
import { useState } from 'react';
import a from './Acces.module.css';
import { appelAcces } from './connexion';

/* ═══ « Mot de passe oublié ? » (22 octobre 2026) ══════════════════════════════
   L'adresse, puis un mail « Réinitialiser votre mot de passe » avec un lien
   valable une heure (src/lib/acces-serveur.ts). La réponse est la même que
   l'adresse ait un compte ou non : on ne dit pas qui a un compte. */

export default function MotDePasseOublie({ mailInitial, onRetour }: { mailInitial: string; onRetour: () => void }) {
  const [mail, setMail] = useState(mailInitial);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [parti, setParti] = useState(false);
  const pret = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim());

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || envoi) return;
    setEnvoi(true); setErreur('');
    const r = await appelAcces('oubli', { mail: mail.trim() });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error || 'Le mail n’a pas pu partir.'); return; }
    setParti(true);
  }

  return (
    <div className={a.carte}>
      {parti ? (
        <>
          <h1>Regardez votre boîte mail</h1>
          <p className={a.intro}>{'Si un compte existe à l’adresse '}<b>{mail.trim()}</b>{', un mail « Réinitialiser votre mot de passe » vient de partir.'}</p>
          <div className={a.succes}>{'Cliquez sur le bouton du mail, puis choisissez votre nouveau mot de passe deux fois. Le lien est valable une heure. Rien reçu ? Regardez dans les courriers indésirables.'}</div>
          <button type="button" className={a.btn} onClick={onRetour}>Retour à la connexion</button>
          <button type="button" className={a.lien} onClick={() => setParti(false)}>Renvoyer le mail</button>
        </>
      ) : (
        <form onSubmit={envoyer}>
          <h1>Mot de passe oublié ?</h1>
          <p className={a.intro}>{'Indiquez votre adresse mail : vous recevrez un lien pour choisir un nouveau mot de passe.'}</p>
          <label className={a.etiquette} htmlFor="oubli-mail">Adresse mail</label>
          <input id="oubli-mail" className={a.champ} type="email" autoComplete="username" value={mail} onChange={e => setMail(e.target.value)} autoFocus placeholder="Votre adresse mail" />
          {erreur && <div className={a.erreur} role="alert">{erreur}</div>}
          <button type="submit" className={a.btn} disabled={!pret || envoi}>{envoi ? 'Envoi…' : 'Recevoir le lien'}</button>
          <button type="button" className={a.lien} onClick={onRetour}>Retour à la connexion</button>
        </form>
      )}
    </div>
  );
}
