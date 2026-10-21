'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Croix, Ic } from './ApercuActe';
import s from './Documents.module.css';

/* ═══ L'aperçu d'un mail avant de l'envoyer d'un clic (22 octobre 2026) ═════
   Alexandre : « une petite fonction, genre renvoyer le lien, et ça renvoie le
   lien avec un aperçu de ce qui va être renvoyé ; ensuite, il aura juste à
   cliquer sur Renvoyer ». Le mail est préparé par le serveur exactement comme
   il partira (`charger`), montré tel quel (cadre isolé, sans script), puis
   envoyé (`onEnvoyer`). Sert au lien de signature (SuiviSignature) et à
   l'adresse du local d'une reconnaissance (fiche de l'affaire). */

export type MailApercu = { a: string; nom?: string; sujet: string; html: string };

export default function ApercuMail({ titre, sous, charger, libelle, onEnvoyer, onFermer }: {
  titre: string; sous?: string;
  charger: () => Promise<MailApercu>;
  /* « Renvoyer le lien », « Envoyer l'adresse »… */
  libelle: string;
  onEnvoyer: () => Promise<void>;
  onFermer: () => void;
}) {
  const [mail, setMail] = useState<MailApercu | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  /* Préparé une fois, à l'ouverture (la fonction peut changer d'un rendu à l'autre). */
  const premier = useRef(charger);
  useEffect(() => {
    let vivant = true;
    premier.current().then(m => { if (vivant) setMail(m); }).catch(e => { if (vivant) setErreur((e as Error).message); });
    return () => { vivant = false; };
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !envoi) onFermer(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [envoi, onFermer]);
  async function envoyer() {
    setEnvoi(true); setErreur('');
    try { await onEnvoyer(); } catch (e) { setErreur((e as Error).message); setEnvoi(false); }
  }
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={s.fenetre} style={{ zIndex: 1100 }} onClick={e => { if (e.target === e.currentTarget && !envoi) onFermer(); }}>
      <div className={s.fenetreIn} style={{ width: 'min(680px, 100%)' }} role="dialog" aria-modal="true" aria-label={titre}>
        <div className={s.fenTete}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h3>{titre}</h3>
            {sous && <p>{sous}</p>}
          </div>
          <button type="button" className={s.panFermer} aria-label="Fermer" disabled={envoi} onClick={onFermer}><Croix /></button>
        </div>
        <div className={s.fenCorps}>
          {!mail && !erreur && <div className={s.chAide}>Préparation de l’aperçu…</div>}
          {mail && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 14px', borderRadius: 12, background: '#f9f8f8', border: '1px solid #eeeeed', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 10, minWidth: 0 }}><span style={{ flex: '0 0 48px', fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: '#94a3b8' }}>À</span><span style={{ overflowWrap: 'anywhere', color: '#334155' }}>{[mail.nom, mail.a].filter(Boolean).join(' · ')}</span></div>
                <div style={{ display: 'flex', gap: 10, minWidth: 0 }}><span style={{ flex: '0 0 48px', fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: '#94a3b8' }}>Objet</span><b style={{ overflowWrap: 'anywhere', color: '#25272b' }}>{mail.sujet}</b></div>
              </div>
              <iframe title="Aperçu du mail" sandbox="" srcDoc={mail.html}
                style={{ width: '100%', height: 'min(520px, 58vh)', border: '1px solid #eeeeed', borderRadius: 12, background: '#f6f6f7' }} />
              <div className={s.chAide}>{'C’est exactement le mail qui part, avec son bouton. Rien n’est envoyé tant que tu ne cliques pas.'}</div>
            </>
          )}
          {erreur && <div className={s.erreur}>{erreur}</div>}
        </div>
        <div className={s.fenPied}>
          <button type="button" className={s.btn} disabled={envoi} onClick={onFermer}>Annuler</button>
          <button type="button" className={`${s.btn} ${s.btnNavy}`} disabled={envoi || !mail} onClick={() => { void envoyer(); }}>
            <Ic n="mail" t={15} />{envoi ? 'Envoi…' : libelle}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
