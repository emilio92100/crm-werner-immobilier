'use client';
import { useEffect, useState, useCallback } from 'react';
import Curseur from '@/components/shared/Curseur';
import { Carte, Enregistre, Etapes, Hero, Ico, Interrupteur, Note, Pastille, Tuiles, fr, initiales, styles as p } from './ParamUI';

/* ═══ Paramètres · Point automatique ══════════════════════════════════════
   Le réglage général du mail « Où en est votre recherche ? » (la règle est
   dans src/lib/point-auto.ts). Chaque changement s'enregistre tout de suite,
   par /api/point-auto : pas besoin du bouton « Enregistrer » de la page, et
   ce bouton-là ne touche pas à ces réglages (voir PageParametres).

   23 octobre 2026 — le nouveau dessin, et les questions d'Alexandre : « une
   fois branché sur Vercel, c'est juste lui qui active ou pas ? » (oui : le
   branchement est fait une fois, l'interrupteur est à Werner) ; « actif,
   c'est quoi ? et les prospects ? » (Actif = un demandeur qui a son espace ;
   un prospect n'en a pas, et ce mail le renvoie vers son espace : il ne le
   reçoit pas, c'est voulu — c'est dit en clair ici). */

type Candidat = {
  clientId: string; prenom: string; nom: string; statut: string;
  echeance: string; du: boolean; empechement: string | null; exclu: boolean;
  dernierMouvement: string | null; rechercheNom: string | null;
};
type Etat = {
  reglages: { actif: boolean; delai: number; exclus: string[] };
  branche: { cron: boolean; mailjet: boolean };
  candidats: Candidat[];
};

const DELAIS = [30, 45, 60];
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

export default function ParamPointAuto() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurReglage, setErreurReglage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [note, setNote] = useState(0);
  const [exemple, setExemple] = useState<'' | 'envoi' | { ok: boolean; t: string }>('');

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

  async function regler(corps: { actif?: boolean; delai?: number }) {
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

  async function envoyerExemple() {
    setExemple('envoi');
    const j = await appeler({ mode: 'exemple' }).catch(() => ({ ok: false }));
    setExemple(j.ok ? { ok: true, t: `Envoyé à ${j.a}, avec le dossier de ${j.client}.` } : { ok: false, t: `Pas parti : ${j.error || 'erreur'}` });
  }

  const hero = (droite?: React.ReactNode) => (
    <Hero ic="avion" titre="Point automatique"
      texte={fr('Le mail « Où en est votre recherche ? », envoyé tout seul à un demandeur dont le dossier ne bouge plus. Il répond en un clic depuis son espace, et sa réponse arrive dans tes Relances.')}
      droite={droite} />
  );
  if (erreur) return <div className={p.rubrique}>{hero()}<Note ton="erreur">{`Le point automatique n’a pas pu être lu : ${erreur}`}</Note></div>;
  if (!etat) return <div className={p.rubrique}>{hero()}<Carte><div className={p.aideChamp}>Chargement…</div></Carte></div>;

  const { reglages, branche, candidats } = etat;
  const dus = candidats.filter(c => c.du);
  const aVenir = candidats.filter(c => !c.du && !c.empechement).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const bloques = candidats.filter(c => c.empechement);
  const nomDe = (c: Candidat) => `${c.prenom} ${c.nom}`.trim() || 'Sans nom';
  const d = reglages.delai;

  /* L'état, en une pastille et une phrase. */
  const pret = branche.cron && branche.mailjet;
  const pastille = !pret ? <Pastille ton="or">{reglages.actif ? 'Allumé, en attente' : 'En attente'}</Pastille>
    : reglages.actif ? <Pastille ton="vert">Activé</Pastille> : <Pastille ton="gris">Désactivé</Pastille>;

  return (
    <div className={p.rubrique}>
      {hero(note ? <Enregistre /> : pastille)}

      {/* L'interrupteur, et ce qui manque éventuellement */}
      <Carte>
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
              {fr('C’est un réglage technique, posé une seule fois (l’envoi de chaque matin). Tant qu’il manque, aucun mail ne part, même allumé. Une fois fait, tout se décide ici : tu allumes ou tu éteins, rien d’autre.')}
            </Note>
          </div>
        )}
        {branche.cron && !branche.mailjet && (
          <div style={{ marginTop: 12 }}>
            <Note ton="erreur">{fr('L’envoi des mails n’est pas configuré sur le serveur : aucun mail ne peut partir pour l’instant.')}</Note>
          </div>
        )}
        {erreurReglage && <div style={{ marginTop: 12 }}><Note ton="erreur">{erreurReglage}</Note></div>}
      </Carte>

      {/* Comment ça marche */}
      <Carte ic="info" titre="Comment ça marche">
        <Etapes items={[
          { ic: 'horloge', titre: 'Le dossier ne bouge plus', texte: `Rien de nouveau depuis ${d} jours : ni note, ni envoi, ni visite.` },
          { ic: 'avion', titre: 'Le mail part, le matin', texte: 'Un seul, au demandeur, avec le rappel de sa recherche.' },
          { ic: 'message', titre: 'Il répond en un clic', texte: 'Je cherche toujours, mes critères ont changé, j’ai trouvé, en pause.' },
          { ic: 'relance', titre: 'Sa réponse arrive chez toi', texte: `Dans Relances et dans son suivi. Sans réponse, un nouveau mail ${d} jours plus tard.` },
        ]} />
      </Carte>

      {/* Le délai */}
      <Carte ic="calendrier" titre="Envoyer après combien de jours sans mouvement ?"
        sous={fr('Au moindre mouvement, le compteur repart de zéro. 45 jours conviennent à la plupart des recherches.')}
        droite={<span className={p.choix} role="group" aria-label="Délai">
          <Curseur cle={d} />
          {DELAIS.map(x => (
            <button key={x} type="button" aria-pressed={x === d} disabled={enCours} onClick={() => { if (x !== d) void regler({ delai: x }); }}>{`${x} jours`}</button>
          ))}
        </span>}>
        <div className={p.sousTitre}>Ce qui compte comme un mouvement</div>
        <Tuiles items={[
          { ic: 'check', t: 'Une note, un appel, un mail dans le suivi', ton: 'oui' },
          { ic: 'check', t: 'Un changement de critères', ton: 'oui' },
          { ic: 'check', t: 'Un local envoyé', ton: 'oui' },
          { ic: 'check', t: 'Une visite', ton: 'oui' },
          { ic: 'check', t: 'Une réaction du client : avis sur un local, message, demande de rappel', ton: 'oui' },
          { ic: 'croix', t: 'Le client qui ouvre simplement son espace', ton: 'non' },
        ]} />
      </Carte>

      {/* Qui le reçoit */}
      <Carte ic="groupe" titre="Qui le reçoit"
        sous={fr('Seulement les demandeurs Actifs : ceux qui ont leur espace client. Il faut tout ce qui est en vert.')}>
        <Tuiles items={[
          { ic: 'check', t: fr('Un demandeur « Actif », c’est-à-dire avec son espace client'), ton: 'oui' },
          { ic: 'check', t: 'Une adresse mail sur sa fiche', ton: 'oui' },
          { ic: 'check', t: 'Une recherche en cours', ton: 'oui' },
          { ic: 'croix', t: fr('Un prospect : il n’a pas d’espace, et les quatre réponses du mail ouvrent l’espace'), ton: 'non' },
          { ic: 'croix', t: 'Un contact archivé, ou qui n’est plus demandeur', ton: 'non' },
          { ic: 'croix', t: 'Un client que tu as exclu depuis sa fiche', ton: 'non' },
        ]} />
        <div style={{ marginTop: 12 }}>
          <Note ton="info">
            <b>{'Et tes prospects ? '}</b>
            {fr('Ils ne reçoivent pas ce mail, c’est voulu : sans espace, ils ne sauraient pas où répondre. Pour eux, c’est toi qui relances (Relances). Et dès que tu passes un prospect en « Actif », son espace s’ouvre et il entre tout seul dans le point automatique.')}
          </Note>
        </div>
      </Carte>

      {/* Qui le recevrait */}
      <Carte ic="personne" titre="Qui le recevrait" sous={fr(`Calculé maintenant, avec le délai de ${d} jours, parmi tes demandeurs Actifs.`)}>
        <div className={p.sousTitre}>{`Au prochain envoi · ${dus.length}`}</div>
        {dus.length === 0
          ? <div className={p.aideChamp} style={{ color: '#71717a' }}>{fr('Personne : tous tes demandeurs Actifs ont bougé récemment.')}</div>
          : <div className={p.liste}>{dus.map(c => (
            <div key={c.clientId} className={`${p.personne} ${p.personneDue}`}>
              <span className={p.avatar}>{initiales(nomDe(c))}</span><b>{nomDe(c)}</b>
              <small>{c.dernierMouvement ? `rien depuis le ${jour(c.dernierMouvement)}` : 'rien depuis la création'}</small>
            </div>
          ))}</div>}

        {aVenir.length > 0 && <>
          <div className={p.sousTitre}>{`Plus tard, si rien ne bouge · ${aVenir.length}`}</div>
          <div className={p.liste}>{aVenir.map(c => (
            <div key={c.clientId} className={p.personne}>
              <span className={p.avatar}>{initiales(nomDe(c))}</span><b>{nomDe(c)}</b>
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
              <small style={{ whiteSpace: 'normal', paddingTop: 6 }}>{(c.empechement || '').replace('Active-le plus haut si tu veux qu’il parte.', 'Active-le sur sa fiche si tu veux qu’il parte.')}</small>
            </div>
          ))}</div>
        </>}
        <div className={p.aideChamp} style={{ marginTop: 12 }}>{fr('Les prospects ne figurent pas dans ces listes : ils ne sont jamais concernés.')}</div>
      </Carte>

      {/* L'exemple */}
      <Carte ic="mail" titre="Voir le mail" sous={fr('Le mail tel qu’un demandeur le recevrait, envoyé à ton adresse. Rien ne part au client.')}>
        <div className={p.actions} style={{ marginTop: 0 }}>
          <button type="button" className={`${p.btn} ${p.btnFonce}`} onClick={() => { void envoyerExemple(); }} disabled={exemple === 'envoi'}>
            <Ico n="avion" t={15} />{exemple === 'envoi' ? 'Envoi…' : 'M’envoyer un exemple'}
          </button>
          {exemple && exemple !== 'envoi' && <span style={{ fontSize: 13, color: exemple.ok ? '#166534' : '#991b1b' }}>{exemple.t}</span>}
        </div>
      </Carte>
    </div>
  );
}
