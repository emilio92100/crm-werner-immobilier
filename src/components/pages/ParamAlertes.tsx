'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ALERTES_MAIL, CLE_ALERTES, alertesCoupees, valeurAlertes, type Alerte, type CleAlerte } from '@/lib/alertes';
import { CLE_ALERTE_DEMANDE, alerteDemandeCoupee } from '@/lib/demandes-site-mail';
import { Anneau, Carte, Enregistre, Etapes, Hero, Ico, Interrupteur, Note, Tuiles, fr, styles as p } from './ParamUI';

/* ═══ Paramètres · Alertes mail ═══════════════════════════════════════════
   Les mails que le CRM envoie à Werner (« Werner · CRM »), un interrupteur
   chacun. La liste et la règle sont dans src/lib/alertes.ts ; les routes qui
   envoient relisent le réglage juste avant chaque envoi (alerteMailActive :
   les quatorze clés y sont lues, vérifié le 23 octobre 2026). Chaque clic
   s'enregistre tout de suite : le bouton « Enregistrer » de la page ne touche
   pas à ce réglage (voir PageParametres).

   23 octobre 2026 — le nouveau dessin (Alexandre : « fais une présentation
   plus jolie pour les alertes mail ») : une carte par famille, un anneau qui
   compte ce qui est reçu, « Comment ça marche » en quatre étapes. */

/* V3.50 : « Nouvelle demande du site » se coupe aussi d'ici (et avec
   « Tout couper »). Elle n'est pas encore dans la liste commune
   (src/lib/alertes.ts) : on l'ajoute ici, rangée dans la même valeur que les
   autres ; si elle y entre un jour, elle n'est pas montrée deux fois. */
type Cle = CleAlerte | typeof CLE_ALERTE_DEMANDE;
type Ligne = Omit<Alerte, 'cle' | 'groupe'> & { cle: Cle; groupe: Alerte['groupe'] | 'site' };
const DEMANDE_SITE: Ligne = {
  cle: CLE_ALERTE_DEMANDE, groupe: 'site', titre: 'Une nouvelle demande du site',
  objet: 'Nouvelle demande du site — Estimation — Paul Martin',
  quand: 'Quelqu’un remplit un formulaire de wernerimmobilier.com : estimation, accompagnement demandeur, question sur un local, message. Rien ne part pour une demande qui ressemble à un robot.',
  crm: 'La demande dans Demandes Internet, en « Nouvelle », avec ses réponses.',
};
const LISTE: Ligne[] = ALERTES_MAIL.some(a => (a.cle as string) === CLE_ALERTE_DEMANDE) ? ALERTES_MAIL : [...ALERTES_MAIL, DEMANDE_SITE];
const lireCoupees = (valeur: string | null | undefined): Set<Cle> => {
  const s = new Set<Cle>(alertesCoupees(valeur));
  if (alerteDemandeCoupee(valeur)) s.add(CLE_ALERTE_DEMANDE);
  return s;
};
const valeurDe = (s: Set<Cle>): string => {
  const o = JSON.parse(valeurAlertes(new Set([...s].filter((k): k is CleAlerte => k !== CLE_ALERTE_DEMANDE)))) as Record<string, boolean>;
  if (s.has(CLE_ALERTE_DEMANDE)) o[CLE_ALERTE_DEMANDE] = false;
  return JSON.stringify(o);
};

const GROUPES: { id: Ligne['groupe']; titre: string; sous: string; ic: string }[] = [
  { id: 'site', titre: 'Le site wernerimmobilier.com', sous: 'Les formulaires remplis par les visiteurs.', ic: 'globe' },
  { id: 'clients', titre: 'Tes clients', sous: 'Ce que tes demandeurs font depuis leur espace.', ic: 'groupe' },
  { id: 'mandats', titre: 'Les mandats et les documents', sous: 'Les signatures, les numéros, les questions.', ic: 'doc' },
  { id: 'auto', titre: 'Le point automatique', sous: 'Le récapitulatif des mails partis tout seuls.', ic: 'avion' },
];

/* Ce qui n'arrive jamais par mail. */
const JAMAIS = [
  'Les avis « Ça me plaît » et « Pas pour moi » sur un local pas encore visité',
  'Les messages du client',
  'Les demandes de rappel',
  'Les changements de critères',
  'Les fins de recherche (trouvé, pause, arrêt)',
  'Les réponses au mail « Où en est votre recherche ? »',
];

export default function ParamAlertes() {
  const [coupees, setCoupees] = useState<Set<Cle> | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurEcriture, setErreurEcriture] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [note, setNote] = useState(0);

  useEffect(() => {
    supabase.from('parametres').select('valeur').eq('cle', CLE_ALERTES).maybeSingle().then(({ data, error }) => {
      if (error) { setErreur(error.message); return; }
      setCoupees(lireCoupees(data?.valeur as string | null));
    });
  }, []);

  async function enregistrer(suivant: Set<Cle>) {
    const avant = coupees;
    setCoupees(suivant); setEnCours(true); setErreurEcriture('');
    const { error } = await supabase.from('parametres')
      .upsert({ cle: CLE_ALERTES, valeur: valeurDe(suivant), updated_at: new Date().toISOString() }, { onConflict: 'cle' });
    setEnCours(false);
    if (error) { setCoupees(avant); setErreurEcriture(`Le réglage n’a pas pu être enregistré : ${error.message}. Rien n’a changé.`); return; }
    const n = Date.now(); setNote(n); setTimeout(() => setNote(x => (x === n ? 0 : x)), 2200);
  }

  function basculer(cle: Cle) {
    if (!coupees) return;
    const s = new Set(coupees);
    if (s.has(cle)) s.delete(cle); else s.add(cle);
    void enregistrer(s);
  }

  const hero = (
    <Hero ic="cloche" titre="Alertes mail"
      texte={fr('Les mails que le CRM t’envoie, avec l’expéditeur « Werner · CRM ». Coupe ceux dont tu n’as pas besoin : l’événement reste toujours dans le CRM, rien ne se perd.')}
      droite={note ? <Enregistre /> : undefined} />
  );
  if (erreur) return <div className={p.rubrique}>{hero}<Note ton="erreur">{`Les alertes n’ont pas pu être lues : ${erreur}`}</Note></div>;
  if (!coupees) return <div className={p.rubrique}>{hero}<Carte><div className={p.aideChamp}>Chargement…</div></Carte></div>;

  const total = LISTE.length;
  const recues = total - coupees.size;

  return (
    <div className={p.rubrique}>
      {hero}

      {/* Le résumé */}
      <Carte>
        <div className={p.resume}>
          <Anneau n={recues} sur={total} />
          <div className={p.resumeTx}>
            <b>{recues === total ? 'Tu reçois toutes les alertes' : recues === 0 ? 'Toutes les alertes sont coupées' : `Tu reçois ${recues} alerte${recues > 1 ? 's' : ''} sur ${total}`}</b>
            <p>{fr('Chaque interrupteur s’enregistre tout de suite et compte dès le prochain événement : tu n’as rien d’autre à faire.')}</p>
          </div>
          <div className={p.boutons}>
            <button type="button" className={p.btn} disabled={enCours || coupees.size === total} onClick={() => { void enregistrer(new Set(LISTE.map(a => a.cle))); }}>
              <Ico n="pause" t={15} />Tout couper
            </button>
            <button type="button" className={`${p.btn} ${p.btnFonce}`} disabled={enCours || coupees.size === 0} onClick={() => { void enregistrer(new Set()); }}>
              <Ico n="check" t={15} e={2.4} />Tout recevoir
            </button>
          </div>
        </div>
        {erreurEcriture && <div style={{ marginTop: 14 }}><Note ton="erreur">{erreurEcriture}</Note></div>}
      </Carte>

      {/* Comment ça marche */}
      <Carte ic="info" titre="Comment ça marche">
        <Etapes items={[
          { ic: 'etincelle', titre: 'Il se passe quelque chose', texte: 'Un client demande une visite, signe un mandat, remplit le site…' },
          { ic: 'ecran', titre: 'Le CRM le note', texte: 'Dans son suivi, et dans Relances quand il faut agir.' },
          { ic: 'mail', titre: 'Le mail part', texte: 'Seulement si l’alerte est allumée, vers ta boîte.' },
          { ic: 'check', titre: 'Rien ne se perd', texte: 'Coupée, l’alerte reste visible dans le CRM.' },
        ]} />
      </Carte>

      {/* Une carte par famille */}
      {GROUPES.filter(g => LISTE.some(a => a.groupe === g.id)).map(g => {
        const lignes = LISTE.filter(a => a.groupe === g.id);
        const n = lignes.filter(a => !coupees.has(a.cle)).length;
        return (
          <Carte key={g.id} ic={g.ic} titre={g.titre} sous={g.sous}
            droite={<span className={p.aideChamp} style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{`${n} sur ${lignes.length}`}</span>}>
            {lignes.map(a => {
              const on = !coupees.has(a.cle);
              return (
                <div key={a.cle} className={`${p.ligne} ${on ? '' : p.ligneOff}`}>
                  <span className={p.ligneIc}><Ico n={on ? 'mail' : 'pause'} t={18} /></span>
                  <div className={p.ligneCorps}>
                    <div className={p.ligneTitre}>{a.titre}</div>
                    <div className={p.objet} title={a.objet}><Ico n="mail" t={13} e={2.2} /><span>{a.objet}</span></div>
                    <div className={p.ligneTx}>{fr(a.quand)}</div>
                    <div className={`${p.dansCrm} ${on ? '' : p.dansCrmCoupe}`}>
                      <Ico n="ecran" t={14} e={2} />
                      <span>{fr(`${on ? 'Toujours dans le CRM, mail coupé ou non' : 'Mail coupé, mais toujours dans le CRM'} : ${a.crm.charAt(0).toLowerCase()}${a.crm.slice(1)}`)}</span>
                    </div>
                    {a.sauf && !on && <div className={p.sauf}>{fr(`Il part quand même si ${a.sauf}`)}</div>}
                  </div>
                  <Interrupteur on={on} disabled={enCours} onClick={() => basculer(a.cle)} label={`${on ? 'Couper' : 'Recevoir'} : ${a.titre}`} />
                </div>
              );
            })}
          </Carte>
        );
      })}

      {/* Ce qui n'arrive jamais par mail */}
      <Carte ic="ecran" titre="Ce que tu ne reçois jamais par mail"
        sous={fr('Tout ça arrive seulement dans le CRM : dans le suivi du client, et dans Relances quand il faut le rappeler.')}>
        <Tuiles items={JAMAIS.map(t => ({ ic: 'ecran', t: fr(t), ton: 'neutre' as const }))} />
      </Carte>
    </div>
  );
}
