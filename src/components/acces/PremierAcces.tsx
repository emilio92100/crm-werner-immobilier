'use client';
import { useState } from 'react';
import a from './Acces.module.css';
import ChampsMotDePasse, { mdpValide } from './ChampsMotDePasse';
import PreparationCrm from './PreparationCrm';
import { appelAcces, connecter } from './connexion';

/* ═══ Première connexion de Werner (22 octobre 2026) ═══════════════════════════
   Trois étapes : qui il est (son prénom, son nom ; l'adresse est celle qui
   lui est attribuée, elle ne se choisit pas), le code reçu à cette adresse,
   son mot de passe deux fois. Puis la préparation du CRM, qui le connecte
   pendant qu'elle défile. Le serveur fait toutes les vérifications
   (src/lib/acces-serveur.ts) ; cet écran ne fait que les demander. */

type Pas = 'vous' | 'code' | 'mdp' | 'prepa';
const ORDRE: Pas[] = ['vous', 'code', 'mdp'];
const NOMS: Record<string, string> = { vous: 'Vous', code: 'Le code', mdp: 'Mot de passe' };

export default function PremierAcces({ mail, onRetour, onDejaCree }: { mail: string; onRetour: () => void; onDejaCree: () => void }) {
  const [pas, setPas] = useState<Pas>('vous');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [mdp, setMdp] = useState('');
  const [encore, setEncore] = useState('');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [renvoye, setRenvoye] = useState(false);

  async function demanderCode(renvoi = false) {
    if (envoi) return;
    setEnvoi(true); setErreur(''); setRenvoye(false);
    const r = await appelAcces('code', { prenom: prenom.trim() });
    setEnvoi(false);
    if (!r.ok) {
      if (r.code === 'existe') { onDejaCree(); return; }
      setErreur(r.error || 'Le code n’a pas pu partir.'); return;
    }
    if (renvoi) { setCode(''); setRenvoye(true); }
    setPas('code');
  }

  async function validerCode() {
    if (envoi) return;
    setEnvoi(true); setErreur('');
    const r = await appelAcces('verifier', { code });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error || 'Ce n’est pas le bon code.'); return; }
    setPas('mdp');
  }

  async function creer() {
    if (envoi || !mdpValide(mdp, encore)) return;
    setEnvoi(true); setErreur('');
    const r = await appelAcces('creer', { code, motDePasse: mdp, prenom: prenom.trim(), nom: nom.trim() });
    setEnvoi(false);
    if (!r.ok) {
      if (r.code === 'existe') { onDejaCree(); return; }
      /* Un code devenu mauvais (expiré, trop d'essais) : retour au code. */
      if (r.code === 'expire' || r.code === 'bloque' || r.code === 'aucun') setPas('code');
      setErreur(r.error || 'Le compte n’a pas pu être créé.'); return;
    }
    setPas('prepa');
  }

  if (pas === 'prepa') {
    return (
      <PreparationCrm prenom={prenom.trim()}
        travail={() => connecter(mail, mdp)}
        onEntrer={() => { window.location.assign('/'); }}
        onRetour={onRetour} />
    );
  }

  const i = ORDRE.indexOf(pas);
  const pretVous = prenom.trim().length > 0 && nom.trim().length > 0;
  const pretCode = code.replace(/\D/g, '').length === 6;
  return (
    <div className={a.carte}>
      <ol className={a.etapes} aria-label="Les étapes">
        {ORDRE.map((p, k) => <li key={p} data-etat={k < i ? 'fait' : k === i ? 'ici' : 'apres'}>{NOMS[p]}</li>)}
      </ol>

      {pas === 'vous' && (
        <form onSubmit={e => { e.preventDefault(); if (pretVous) void demanderCode(); }}>
          <h1>Bienvenue sur votre CRM</h1>
          <p className={a.intro}>{'Créez votre accès en trois étapes : vous, un code reçu par mail, votre mot de passe.'}</p>
          <div className={`${a.deux} ${a.bloc}`}>
            <div>
              <label className={a.etiquette} htmlFor="pa-prenom">Prénom</label>
              <input id="pa-prenom" className={a.champ} autoComplete="given-name" value={prenom} onChange={e => setPrenom(e.target.value)} autoFocus />
            </div>
            <div>
              <label className={a.etiquette} htmlFor="pa-nom">Nom</label>
              <input id="pa-nom" className={a.champ} autoComplete="family-name" value={nom} onChange={e => setNom(e.target.value)} />
            </div>
          </div>
          <div className={a.bloc}>
            <span className={a.etiquette}>Votre adresse de connexion</span>
            <div className={a.fixe}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
              <span>{mail}</span>
            </div>
            <p className={a.note}>{'L’adresse de l’agence, déjà attribuée à votre compte. Le code y sera envoyé.'}</p>
          </div>
          {erreur && <div className={a.erreur} role="alert">{erreur}</div>}
          <button type="submit" className={a.btn} disabled={!pretVous || envoi}>{envoi ? 'Envoi du code…' : 'Recevoir mon code'}</button>
          <button type="button" className={a.lien} onClick={onRetour}>{'J’ai déjà mon mot de passe'}</button>
        </form>
      )}

      {pas === 'code' && (
        <form onSubmit={e => { e.preventDefault(); if (pretCode) void validerCode(); }}>
          <h1>Le code reçu par mail</h1>
          <p className={a.intro}>{'Un code à six chiffres vient de partir à '}<b>{mail}</b>{'. Il est valable 15 minutes. Rien reçu ? Regardez dans les courriers indésirables.'}</p>
          {renvoye && <div className={a.succes}>{'Un nouveau code est parti. Seul le dernier reçu est valable.'}</div>}
          <div className={a.bloc}>
            <label className={a.etiquette} htmlFor="pa-code">Code</label>
            <input id="pa-code" className={`${a.champ} ${a.code}`} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000"
              value={code} onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))} autoFocus />
          </div>
          {erreur && <div className={a.erreur} role="alert">{erreur}</div>}
          <button type="submit" className={a.btn} disabled={!pretCode || envoi}>{envoi ? 'Vérification…' : 'Valider le code'}</button>
          <button type="button" className={a.lien} disabled={envoi} onClick={() => void demanderCode(true)}>Renvoyer un code</button>
        </form>
      )}

      {pas === 'mdp' && (
        <form onSubmit={e => { e.preventDefault(); void creer(); }}>
          <h1>Votre mot de passe</h1>
          <p className={a.intro}>{'C’est lui qui ouvrira votre CRM, avec votre adresse '}<b>{mail}</b>{'. Vous pourrez le changer dans Paramètres › Sécurité.'}</p>
          <ChampsMotDePasse mdp={mdp} encore={encore} voir={voir} onMdp={setMdp} onEncore={setEncore} onVoir={setVoir} />
          {erreur && <div className={a.erreur} role="alert">{erreur}</div>}
          <button type="submit" className={a.btn} disabled={!mdpValide(mdp, encore) || envoi}>{envoi ? 'Création…' : 'Créer mon accès'}</button>
        </form>
      )}
    </div>
  );
}
