'use client';
import { useEffect, useRef, useState } from 'react';
import a from './Acces.module.css';

/* ═══ « Nous préparons votre CRM » (22 octobre 2026) ═══════════════════════════
   Alexandre : « dès qu'il crée son compte, une petite animation pendant 20,
   30 secondes, création de votre CRM en cours, mise en page des onglets, des
   affaires en cours… ne quittez pas la page ; puis votre CRM est prêt,
   cliquez ici pour y accéder ».

   Le vrai travail (`travail` : la connexion à Supabase puis le badge du
   CRM) part dès l'ouverture ; les étapes défilent à leur rythme, environ
   21 secondes, et la dernière attend que le travail soit fini. Un échec
   s'affiche à la fin, avec de quoi réessayer. Une fenêtre plein écran, au
   niveau du module (AGENTS.md §2.4). */

const ETAPES: { t: string; s: string }[] = [
  { t: 'Votre accès sécurisé', s: 'Votre compte, votre mot de passe, la connexion chiffrée' },
  { t: 'Votre tableau de bord', s: 'Les chiffres du jour, vos rendez-vous, vos relances' },
  { t: 'Vos affaires en cours', s: 'Bureaux, boutiques, restaurants, locaux d’activité' },
  { t: 'Vos demandeurs', s: 'Leurs recherches, leurs critères, leur loyer ou budget' },
  { t: 'Le rapprochement', s: 'Vos affaires face aux demandeurs, en un clic' },
  { t: 'Vos documents juridiques', s: 'Mandats, bons de visite, avenants, signature en ligne' },
  { t: 'Votre agenda', s: 'Visites, rendez-vous et rappels' },
  { t: 'Les espaces de vos clients', s: 'Et les annonces de wernerimmobilier.com' },
];
const PAS = 2600;

export default function PreparationCrm({ prenom, travail, onEntrer, onRetour }: {
  prenom: string;
  /* Rend null quand tout va bien, sinon le message d'erreur. */
  travail: () => Promise<string | null>;
  onEntrer: () => void;
  onRetour: () => void;
}) {
  const [etape, setEtape] = useState(0);
  const [resultat, setResultat] = useState<{ erreur: string | null } | null>(null);
  const [essai, setEssai] = useState(0);
  const lance = useRef(-1);
  const travailRef = useRef(travail);
  useEffect(() => { travailRef.current = travail; }, [travail]);

  const monte = useRef(true);
  useEffect(() => { monte.current = true; return () => { monte.current = false; }; }, []);

  /* Le travail, une fois par essai (un drapeau de montage plutôt qu'un
     nettoyage : en mode strict, l'effet joué deux fois ne le relance pas). */
  useEffect(() => {
    if (lance.current === essai) return;
    lance.current = essai;
    travailRef.current().then(
      erreur => { if (monte.current) setResultat({ erreur }); },
      e => { if (monte.current) setResultat({ erreur: e instanceof Error ? e.message : 'Connexion impossible.' }); },
    );
  }, [essai]);

  /* Les étapes : une toutes les PAS millisecondes ; la dernière attend le
     travail. Un échec se dit tout de suite, sans faire attendre la fin. */
  useEffect(() => {
    if (etape >= ETAPES.length) return;
    if (resultat?.erreur) { setEtape(ETAPES.length); return; }
    if (etape === ETAPES.length - 1 && !resultat) return;
    const t = setTimeout(() => setEtape(e => e + 1), PAS);
    return () => clearTimeout(t);
  }, [etape, resultat]);

  const fini = etape >= ETAPES.length && !!resultat;
  const pct = Math.min(100, Math.round((etape / ETAPES.length) * 100));
  const R = 56, C = 2 * Math.PI * R;

  return (
    <div className={a.prepa} role="dialog" aria-modal="true" aria-label="Préparation de votre CRM" data-emi-anim="non">
      <div className={a.prepaBoite}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo-emilio-blanc-800.png" alt="Werner Immobilier" width={800} height={336} />
        {fini ? (
          <div className={a.pret}>
            {resultat?.erreur ? (
              <>
                <h2>{'Votre accès est créé'}</h2>
                <p>{'Mais la connexion n’a pas abouti. Réessayez : votre compte et votre mot de passe sont bien enregistrés.'}</p>
                <div className={a.pretErreur} role="alert">{resultat.erreur}</div>
                <button type="button" className={a.btn} onClick={() => { setResultat(null); setEtape(ETAPES.length - 1); setEssai(n => n + 1); }}>Réessayer la connexion</button>
                <button type="button" className={a.lien} style={{ color: 'rgba(255,255,255,.6)' }} onClick={onRetour}>Retour à la page de connexion</button>
              </>
            ) : (
              <>
                <span className={a.pretIc}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.5 5 5L19.5 7" /></svg></span>
                <h2>{'Votre CRM est prêt'}</h2>
                <p>{`Bienvenue${prenom ? `, ${prenom}` : ''}. Vos onglets, vos affaires et vos documents vous attendent.`}</p>
                <button type="button" className={a.btn} autoFocus onClick={onEntrer}>{'Accéder à mon CRM →'}</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={a.anneau} aria-hidden="true">
              <svg viewBox="0 0 132 132" width="100%" height="100%">
                <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
                <circle cx="66" cy="66" r={R} fill="none" stroke="#f08c42" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(.03, pct / 100))} transform="rotate(-90 66 66)"
                  style={{ transition: 'stroke-dashoffset .6s ease' }} />
              </svg>
              <svg viewBox="0 0 132 132" width="100%" height="100%" className={a.tourne}>
                <circle cx="66" cy="66" r="64" fill="none" stroke="rgba(247,176,122,.35)" strokeWidth="1.5" strokeDasharray="2 9" />
              </svg>
              <div className={a.pourcent}>{pct}<small>%</small></div>
            </div>
            <h2 className={a.prepaTitre}>Nous préparons votre CRM</h2>
            <p className={a.prepaSous}><b>{'Ne quittez pas la page'}</b>{' : cela prend une vingtaine de secondes.'}</p>
            <ol className={a.liste} aria-live="polite">
              {ETAPES.map((e, i) => (
                <li key={e.t} data-etat={i < etape ? 'fait' : i === etape ? 'ici' : 'apres'}>
                  <span className={a.puce}>{i < etape && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.5 5 5L19.5 7" /></svg>}</span>
                  <span>{e.t}<small>{e.s}</small></span>
                </li>
              ))}
            </ol>
            <div className={a.barre}><i style={{ width: `${pct}%` }} /></div>
          </>
        )}
      </div>
    </div>
  );
}
