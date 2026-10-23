'use client';
import { useEffect, useState, useCallback } from 'react';
import Curseur from '@/components/shared/Curseur';
import { Carte, Enregistre, Etapes, Hero, Ico, Interrupteur, Note, Pastille, fr, initiales, styles as p } from './ParamUI';

/* ═══ Paramètres · Point automatique ══════════════════════════════════════
   Le réglage général du mail « Où en est votre recherche ? » (la règle est
   dans src/lib/point-auto.ts). Chaque changement s'enregistre tout de suite,
   par /api/point-auto : pas besoin du bouton « Enregistrer » de la page, et
   ce bouton-là ne touche pas à ces réglages (voir PageParametres).

   23 octobre 2026, deuxième dessin, à la demande d'Alexandre : moins de
   redites (le délai, « ce qui compte comme un mouvement » et « qui le
   reçoit » tenaient chacun une carte de tuiles), et le mail aussi pour les
   demandeurs sans espace. Trois cartes :
     1. Réglages — l'interrupteur, pour qui, après combien de jours ;
     2. Comment ça marche — les quatre étapes, puis les cinq réponses du mail
        et ce que chacune fait dans le CRM, avec l'exemple à s'envoyer ;
     3. Qui le recevrait — la liste exacte, calculée maintenant. */

type Pour = 'espace' | 'recherche';
type Candidat = {
  clientId: string; prenom: string; nom: string; statut: string;
  echeance: string; du: boolean; empechement: string | null; exclu: boolean;
  dernierMouvement: string | null; rechercheNom: string | null; viaEspace?: boolean;
};
type Etat = {
  reglages: { actif: boolean; delai: number; exclus: string[]; pour?: Pour };
  branche: { cron: boolean; mailjet: boolean };
  candidats: Candidat[];
};

const DELAIS = [30, 45, 60];
/* Le plafond de l'envoi du matin (PLAFOND_PAR_JOUR, src/lib/point-auto.ts). */
const PLAFOND = 30;
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

const POUR: { v: Pour; titre: string; sous: string }[] = [
  { v: 'espace', titre: 'Les demandeurs qui ont leur espace', sous: 'Statut Actif. Ils répondent depuis leur espace, qui s’ouvre sur la bonne question.' },
  { v: 'recherche', titre: 'Tous ceux qui ont une recherche en cours', sous: 'Actifs et prospects. Sans espace, ils répondent sur une petite page à eux : ni compte, ni mot de passe.' },
];

/* Les cinq réponses du mail, comme le client les voit, et ce que chacune fait. */
const EFFETS: { bouton: string; style: string; effet: string }[] = [
  { bouton: 'Je cherche toujours', style: 'effetFonce', effet: 'Une ligne dans son suivi, et le compteur repart. Pas de relance : il n’y a rien à faire (sauf s’il laisse un mot).' },
  { bouton: 'Mes critères ont changé', style: '', effet: 'Une relance du jour, avec ce qu’il a écrit. Avec un espace, il peut aussi corriger ses critères lui-même.' },
  { bouton: 'J’ai trouvé mon local', style: 'effetOr', effet: 'Le dossier passe en « Local trouvé » (avec toi) ou « Perdu » (ailleurs), la veille s’arrête, et une relance « à rappeler pour confirmer ».' },
  { bouton: 'J’ai mis ma recherche en pause ou arrêtée', style: 'effetGris', effet: 'Le dossier passe en « Suspendu » ou « Perdu », la veille s’arrête, et une relance pour savoir quand reprendre.' },
  { bouton: 'Je souhaite être rappelé', style: 'effetDoux', effet: 'Une relance du jour, avec le moment qu’il a choisi : le matin, l’après-midi ou en fin de journée.' },
];

export default function ParamPointAuto() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurReglage, setErreurReglage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [note, setNote] = useState(0);
  const [exemple, setExemple] = useState<'' | 'espace' | 'page' | { ok: boolean; t: string }>('');

  const appeler = useCallback(async (corps: Record<string, unknown>) => {
    const r = await fetch('/api/point-auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    return r.json();
  }, []);

  const charger = useCallback(async () => {
    try {
      const j = await appeler({ mode: 'etat' });
      if (!j.ok) { setErreur(j.error || 'Lecture impossible'); return; }
      setErreur(''); setEtat(j);
    } catch { setErreur('Lecture impossible'); }
  }, [appeler]);

  useEffect(() => { void charger(); }, [charger]);

  async function regler(corps: { actif?: boolean; delai?: number; pour?: Pour }) {
    setEnCours(true); setErreurReglage('');
    try {
      const j = await appeler({ mode: 'reglages', ...corps });
      if (!j.ok) { setErreurReglage(`Le réglage n’a pas pu être enregistré : ${j.error || 'erreur'}. Rien n’a changé.`); return; }
      const n = Date.now(); setNote(n); setTimeout(() => setNote(x => (x === n ? 0 : x)), 2200);
      await charger();
    } catch {
      setErreurReglage('Erreur réseau : le réglage n’a pas été enregistré. Réessaie dans un instant.');
    } finally { setEnCours(false); }
  }

  async function envoyerExemple(via: 'espace' | 'page') {
    setExemple(via);
    const j = await appeler({ mode: 'exemple', via }).catch(() => ({ ok: false }));
    setExemple(j.ok
      ? { ok: true, t: `Envoyé à ${j.a}, avec le dossier de ${j.client}${j.via === 'page' ? ' (version sans espace : ses boutons ouvrent une page d’exemple, rien ne s’enregistre)' : ''}.` }
      : { ok: false, t: `Pas parti : ${j.error || 'erreur'}` });
  }

  const hero = (droite?: React.ReactNode) => (
    <Hero ic="avion" titre="Point automatique"
      texte={fr('Le mail « Où en est votre recherche ? », envoyé tout seul quand un dossier ne bouge plus. Le client répond en un clic, et sa réponse arrive dans tes Relances et dans son suivi.')}
      droite={droite} />
  );
  if (erreur) return <div className={p.rubrique}>{hero()}<Note ton="erreur">{`Le point automatique n’a pas pu être lu : ${erreur}`}</Note></div>;
  if (!etat) return <div className={p.rubrique}>{hero()}<Carte><div className={p.aideChamp}>Chargement…</div></Carte></div>;

  const { reglages, branche, candidats } = etat;
  const pour: Pour = reglages.pour === 'recherche' ? 'recherche' : 'espace';
  const dus = candidats.filter(c => c.du);
  const aVenir = candidats.filter(c => !c.du && !c.empechement).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const bloques = candidats.filter(c => c.empechement);
  const nomDe = (c: Candidat) => `${c.prenom} ${c.nom}`.trim() || 'Sans nom';
  const d = reglages.delai;

  /* L'état, en une pastille et une phrase. */
  const pret = branche.cron && branche.mailjet;
  const pastille = !pret ? <Pastille ton="or">{reglages.actif ? 'Allumé, en attente' : 'En attente'}</Pastille>
    : reglages.actif ? <Pastille ton="vert">Activé</Pastille> : <Pastille ton="gris">Désactivé</Pastille>;

  const sansEspace = (c: Candidat) => (c.viaEspace === false && !c.empechement ? <span className={p.sansEspace}>sans espace</span> : null);

  return (
    <div className={p.rubrique}>
      {hero(note ? <Enregistre /> : pastille)}

      {/* 1. Les réglages : allumé ou non, pour qui, après combien de jours */}
      <Carte ic="reglage" titre="Réglages" sous={fr('Chaque choix s’enregistre tout de suite. La liste « Qui le recevrait », plus bas, suit.')}>
        <div className={`${p.ligne} ${reglages.actif ? '' : p.ligneOff}`} style={{ margin: 0 }}>
          <span className={p.ligneIc}><Ico n={reglages.actif ? 'avion' : 'pause'} t={18} /></span>
          <div className={p.ligneCorps}>
            <div className={p.ligneTitre}>{reglages.actif ? 'L’envoi automatique est activé' : 'L’envoi automatique est éteint'}</div>
            <div className={p.ligneTx}>
              {fr(reglages.actif
                ? (pret ? 'Chaque matin, le CRM regarde qui est dû et lui envoie le mail. Tu peux l’éteindre quand tu veux.' : 'Il est allumé : les mails partiront dès que le branchement du serveur sera fait (voir dessous).')
                : 'Aucun mail ne part. Regarde plus bas qui le recevrait avant de l’allumer : la liste est exacte.')}
            </div>
          </div>
          <Interrupteur on={reglages.actif} disabled={enCours} onClick={() => { void regler({ actif: !reglages.actif }); }}
            label={reglages.actif ? 'Éteindre l’envoi automatique' : 'Allumer l’envoi automatique'} />
        </div>
        {!branche.cron && (
          <div style={{ marginTop: 12 }}>
            <Note ton="attention">
              <b>{'Le branchement du serveur n’est pas encore fait. '}</b>
              {fr('C’est un réglage technique, posé une seule fois (l’envoi de chaque matin). Tant qu’il manque, aucun mail ne part, même allumé. Une fois fait, tout se décide ici.')}
            </Note>
          </div>
        )}
        {branche.cron && !branche.mailjet && (
          <div style={{ marginTop: 12 }}>
            <Note ton="erreur">{fr('L’envoi des mails n’est pas configuré sur le serveur : aucun mail ne peut partir pour l’instant.')}</Note>
          </div>
        )}

        <div className={p.sousTitre} style={{ marginTop: 20 }}>Pour qui</div>
        <div className={p.cases} role="group" aria-label="Pour qui">
          {POUR.map(o => (
            <button key={o.v} type="button" className={p.case} aria-pressed={pour === o.v} disabled={enCours}
              onClick={() => { if (o.v !== pour) void regler({ pour: o.v }); }}>
              <span className={p.caseRond} />
              <span><b>{o.titre}</b><small>{fr(o.sous)}</small></span>
            </button>
          ))}
        </div>

        <div className={p.sousTitre} style={{ marginTop: 20 }}>Après combien de jours sans mouvement</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className={p.choix} role="group" aria-label="Délai">
            <Curseur cle={d} />
            {DELAIS.map(x => (
              <button key={x} type="button" aria-pressed={x === d} disabled={enCours} onClick={() => { if (x !== d) void regler({ delai: x }); }}>{`${x} jours`}</button>
            ))}
          </span>
          <span className={p.aideChamp} style={{ flex: '1 1 260px', margin: 0 }}>
            {fr('45 jours conviennent à la plupart des recherches. Un mouvement, c’est tout ce qui s’écrit dans son suivi (note, appel, mail, visite, critères), un local envoyé ou une réaction du client ; ouvrir son espace ne compte pas. Au moindre mouvement, le compteur repart de zéro.')}
          </span>
        </div>
        {erreurReglage && <div style={{ marginTop: 12 }}><Note ton="erreur">{erreurReglage}</Note></div>}
      </Carte>

      {/* 2. Comment ça marche, et ce que fait chaque réponse */}
      <Carte ic="info" titre="Comment ça marche">
        <Etapes items={[
          { ic: 'horloge', titre: 'Le dossier ne bouge plus', texte: `Rien de nouveau depuis ${d} jours : ni note, ni envoi, ni visite.` },
          { ic: 'avion', titre: 'Le mail part, le matin', texte: 'Un seul, avec le rappel de sa recherche et cinq réponses en un clic.' },
          { ic: 'message', titre: 'Il répond', texte: pour === 'espace' ? 'Depuis son espace, ouvert sur la bonne question.' : 'Depuis son espace s’il en a un ; sinon, sur une page à lui.' },
          { ic: 'relance', titre: 'Sa réponse arrive chez toi', texte: `Dans Relances et dans son suivi. Sans réponse, un nouveau mail ${d} jours plus tard.` },
        ]} />

        <div className={p.sousTitre} style={{ marginTop: 22 }}>Les cinq réponses du mail, et ce qu’elles font</div>
        <div className={p.effets}>
          {EFFETS.map(e => (
            <div key={e.bouton} className={p.effet}>
              <span className={`${p.effetBtn} ${e.style ? p[e.style] : ''}`}>{e.bouton}</span>
              <span className={p.effetTx}>{fr(e.effet)}</span>
            </div>
          ))}
        </div>
        <div className={p.aideChamp} style={{ marginTop: 10 }}>
          {fr('Chaque réponse s’inscrit dans son suivi, juste sous la ligne « Mail envoyé automatiquement » : tu vois s’il a répondu, et quoi. Un lien du mail ne répond jamais tout seul : c’est le client qui confirme, sur la page qui s’ouvre.')}
        </div>

        <div className={p.actions} style={{ marginTop: 16 }}>
          {pour === 'recherche' ? <>
            <button type="button" className={`${p.btn} ${p.btnFonce}`} onClick={() => { void envoyerExemple('espace'); }} disabled={exemple === 'espace' || exemple === 'page'}>
              <Ico n="avion" t={15} />{exemple === 'espace' ? 'Envoi…' : 'Exemple avec espace'}
            </button>
            <button type="button" className={p.btn} onClick={() => { void envoyerExemple('page'); }} disabled={exemple === 'espace' || exemple === 'page'}>
              <Ico n="avion" t={15} />{exemple === 'page' ? 'Envoi…' : 'Exemple sans espace'}
            </button>
          </> : (
            <button type="button" className={`${p.btn} ${p.btnFonce}`} onClick={() => { void envoyerExemple('espace'); }} disabled={exemple === 'espace'}>
              <Ico n="avion" t={15} />{exemple === 'espace' ? 'Envoi…' : 'M’envoyer un exemple'}
            </button>
          )}
          {pour === 'recherche' && <a className={p.lien} href="/point/exemple" target="_blank" rel="noreferrer">{'Voir la page sans espace'}</a>}
        </div>
        {exemple && typeof exemple === 'object' && (
          <div style={{ fontSize: 13, marginTop: 8, color: exemple.ok ? '#166534' : '#991b1b' }}>{exemple.t}</div>
        )}
        <div className={p.aideChamp} style={{ marginTop: 8 }}>{fr('L’exemple arrive à ton adresse, avec le dossier d’un de tes demandeurs. Rien ne part au client.')}</div>
      </Carte>

      {/* 3. Qui le recevrait */}
      <Carte ic="personne" titre="Qui le recevrait"
        sous={fr(`Calculé maintenant, avec le délai de ${d} jours, parmi ${pour === 'espace' ? 'tes demandeurs Actifs' : 'tes demandeurs Actifs et tes prospects'}.`)}>
        <div className={p.sousTitre}>{`Au prochain envoi · ${dus.length}`}</div>
        {dus.length === 0
          ? <div className={p.aideChamp} style={{ color: '#71717a' }}>{fr('Personne : tous ont bougé récemment.')}</div>
          : <div className={p.liste}>{dus.map(c => (
            <div key={c.clientId} className={`${p.personne} ${p.personneDue}`}>
              <span className={p.avatar}>{initiales(nomDe(c))}</span><span className={p.personneNom}><b>{nomDe(c)}</b>{sansEspace(c)}</span>
              <small>{c.dernierMouvement ? `rien depuis le ${jour(c.dernierMouvement)}` : 'rien depuis la création'}</small>
            </div>
          ))}</div>}
        {dus.length > PLAFOND && (
          <div style={{ marginTop: 10 }}>
            <Note ton="info">{fr(`${PLAFOND} mails au plus par matin : les ${dus.length - PLAFOND} autres partiront les matins suivants. C’est voulu, pour ne jamais écrire à toute la base d’un coup.`)}</Note>
          </div>
        )}

        {aVenir.length > 0 && <>
          <div className={p.sousTitre}>{`Plus tard, si rien ne bouge · ${aVenir.length}`}</div>
          <div className={p.liste}>{aVenir.map(c => (
            <div key={c.clientId} className={p.personne}>
              <span className={p.avatar}>{initiales(nomDe(c))}</span><span className={p.personneNom}><b>{nomDe(c)}</b>{sansEspace(c)}</span>
              <small>{`le ${jour(c.echeance)}`}</small>
            </div>
          ))}</div>
        </>}

        {bloques.length > 0 && <>
          <div className={p.sousTitre}>{`Ne le recevront pas · ${bloques.length}`}</div>
          <div className={p.liste}>{bloques.map(c => (
            <div key={c.clientId} className={p.personne} style={{ alignItems: 'flex-start' }}>
              <span className={p.avatar} style={{ background: '#e4e4e7', color: '#52525b' }}>{initiales(nomDe(c))}</span>
              <b style={{ color: '#52525b', paddingTop: 5 }}>{nomDe(c)}</b>
              <small style={{ whiteSpace: 'normal', paddingTop: 6 }}>{fr((c.empechement || '').replace('Paramètres › Point automatique › Pour qui', '« Pour qui », plus haut'))}</small>
            </div>
          ))}</div>
        </>}
      </Carte>
    </div>
  );
}
