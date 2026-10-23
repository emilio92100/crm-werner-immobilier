'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Cascade from '@/components/shared/Cascade';
import Curseur from '@/components/shared/Curseur';
import ParamPointAuto from './ParamPointAuto';
import ParamAlertes from './ParamAlertes';
import ParamAgence from './ParamAgence';
import ParamSecurite from './ParamSecurite';
import { coordonneesMail, signatureDe, texteModele, VARIABLES_MAIL } from '@/lib/mail-variables';
import { CLE_IDENTITE } from '@/lib/agence';
import { Carte, Enregistre, Etapes, Hero, Ico, Note, fr, styles as p } from './ParamUI';

/* ═══ Paramètres ══════════════════════════════════════════════════════════
   23 octobre 2026 — le nouveau dessin (Alexandre : « rendre plus joli, plus
   ergonomique cette page de paramètres, donner des explications à Werner,
   avec des animations continues… de jolies cases, de beaux rectangles ») :
   une tête sombre, un rail de rubriques avec leurs icônes dessinées (la
   pastille glisse : Curseur), et dans chaque rubrique une tête qui dit ce
   qu'elle règle, des cartes, des interrupteurs, « Comment ça marche ».
   Les pièces communes : ParamUI.tsx et Parametres.module.css.

   Agence, Point automatique, Alertes mail et Sécurité s'enregistrent seules
   (leur propre bouton, ou chaque clic). Mails et Relances passent par la
   barre « Enregistrer » qui monte en bas dès qu'un champ change. */

/* Les clés que chaque rubrique enregistre par la barre du bas. */
const CLES_RUBRIQUE: Record<string, string[]> = {
  emails: ['conseiller_prenom', 'conseiller_nom', 'signature_email', 'template_email_objet', 'template_email_corps'],
  relances: ['delai_relance_jours'],
};

const SECTIONS: { id: string; titre: string; sous: string; ic: string }[] = [
  { id: 'agence', titre: 'Agence', sous: 'Identité, carte, signature', ic: 'agence' },
  { id: 'emails', titre: 'Mails et signature', sous: 'Ce qui signe tes mails', ic: 'mail' },
  { id: 'alertes', titre: 'Alertes mail', sous: 'Ce que le CRM t’envoie', ic: 'cloche' },
  { id: 'relances', titre: 'Relances', sous: 'Après un envoi de locaux', ic: 'relance' },
  { id: 'point', titre: 'Point automatique', sous: 'Le mail aux demandeurs', ic: 'avion' },
  { id: 'securite', titre: 'Sécurité', sous: 'Ton mot de passe', ic: 'cadenas' },
];

type Params = Record<string, string>;
type Poser = (k: string, v: string) => void;

/* ── Mails et signature (déclarée au niveau du module : AGENTS.md §2.4) ── */
function RubriqueMails({ params, set, saved, onAgence }: { params: Params; set: Poser; saved: boolean; onAgence: () => void }) {
  const corps = useRef<HTMLTextAreaElement>(null);
  const co = coordonneesMail(params);
  const champ = (cle: string, lib: string, o: { type?: string; ph?: string; large?: boolean; facultatif?: boolean } = {}) => (
    <label className={`${p.champ} ${o.large ? p.champLarge : ''}`}>
      <span>{lib}{o.facultatif && <em>{' · facultatif'}</em>}</span>
      <input className={p.input} type={o.type || 'text'} value={params[cle] || ''} placeholder={o.ph} onChange={e => set(cle, e.target.value)} />
    </label>
  );
  /* Une variable cliquée se pose là où est le curseur, dans le corps. */
  function inserer(v: string) {
    const t = corps.current, avant = params.template_email_corps || '';
    const i = t && document.activeElement === t ? t.selectionStart : avant.length;
    const j = t && document.activeElement === t ? t.selectionEnd : avant.length;
    set('template_email_corps', avant.slice(0, i) + v + avant.slice(j));
    requestAnimationFrame(() => { if (t) { t.focus(); t.setSelectionRange(i + v.length, i + v.length); } });
  }
  return (
    <div className={p.rubrique}>
      <Hero ic="mail" titre="Mails et signature"
        texte={fr('Ce qui signe les mails que tu écris depuis le CRM, et le texte qui pré-remplit l’envoi d’une sélection de locaux. Rien ne part tout seul : tu relis toujours avant d’envoyer.')}
        droite={saved ? <Enregistre /> : undefined} />

      <Carte ic="personne" titre="Qui signe tes mails" sous={fr('Ton prénom et ton nom, tels qu’ils s’écrivent en bas de tes mails et à la place de {{conseiller}}.')}>
        <div className={p.champs}>
          {champ('conseiller_prenom', 'Prénom')}
          {champ('conseiller_nom', 'Nom')}
        </div>
      </Carte>

      {/* 23 octobre 2026 : le nom de l'agence, le téléphone, le mail et le site
          ne se règlent plus ici. Une seule source, Agence › Coordonnées. */}
      <Carte ic="tel" titre="Les coordonnées de l’agence" sous={fr('Lues dans la rubrique Agence, la même source que tes documents, tes mails automatiques et l’espace de tes clients.')}
        droite={<button type="button" className={p.lien} onClick={onAgence}>{'Les changer dans Agence'}<Ico n="fleche" t={14} /></button>}>
        <div className={p.tuiles} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {[
            { ic: 'agence', l: 'Agence', v: co.agence },
            { ic: 'tel', l: 'Téléphone', v: co.tel },
            { ic: 'mail', l: 'Mail', v: co.mail },
            { ic: 'globe', l: 'Site', v: co.site || 'aucun' },
          ].map(x => (
            <div key={x.l} className={`${p.tuile} ${p.tuileNeutre}`}>
              <Ico n={x.ic} t={16} e={2} />
              <span><small style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: '#a1a1aa' }}>{x.l}</small><b style={{ overflowWrap: 'anywhere' }}>{x.v}</b></span>
            </div>
          ))}
        </div>
      </Carte>

      <Carte ic="plume" titre="Ta signature" sous={fr('Placée à la fin de chaque mail que tu écris depuis le CRM (Nouveau mail, envoi de locaux) : tu peux la retoucher avant d’envoyer.')}>
        <textarea className={p.input} rows={5} value={params.signature_email || signatureDe(params)} onChange={e => set('signature_email', e.target.value)} />
        {(params.signature_email || '').trim()
          ? (
            <div style={{ marginTop: 10 }}>
              <Note ton="attention">
                {fr('Tu l’as écrite toi-même : elle ne suit plus toute seule. Si tu changes de numéro dans Agence, pense à la retoucher.')}{' '}
                <button type="button" className={p.lien} onClick={() => set('signature_email', '')}>{'Revenir à la signature automatique'}</button>
              </Note>
            </div>
          )
          : <div className={p.aideChamp} style={{ marginTop: 6 }}>{fr('Automatique : elle se compose avec ton prénom, ton nom, l’agence et son téléphone, et suit tout seule ce que tu changes dans Agence.')}</div>}
      </Carte>

      {/* « Email de relance J+5 » est parti : aucun mail de relance ne part
          tout seul. Une relance est une tâche pour toi (rubrique Relances). */}
      <Carte ic="doc" titre="Le mail « Envoyer la sélection »"
        sous={fr('Pré-remplit « Envoyer la sélection » sur la fiche d’un demandeur. Laissé vide, le texte habituel.')}>
        <div className={p.champs}>
          <label className={`${p.champ} ${p.champLarge}`}>
            <span>Objet</span>
            <input className={p.input} value={params.template_email_objet || ''} onChange={e => set('template_email_objet', e.target.value)} placeholder="Vide : « Sélection de locaux — Votre recherche »" />
          </label>
          <label className={`${p.champ} ${p.champLarge}`}>
            <span>Le texte du mail</span>
            <textarea ref={corps} className={p.input} rows={7} value={params.template_email_corps || ''} onChange={e => set('template_email_corps', e.target.value)}
              placeholder={'Vide : le texte habituel, qui commence par « Bonjour {{prénom}}, suite à votre projet de recherche… »'} />
          </label>
        </div>
        <div className={p.sousTitre} style={{ marginTop: 16 }}>{'Les mots remplacés pour chaque client'}</div>
        <div className={p.puces}>
          {VARIABLES_MAIL.map(v => <button key={v} type="button" className={p.puceVar} onClick={() => inserer(v)} title="Ajouter dans le texte">{v}</button>)}
        </div>
        <div className={p.aideChamp} style={{ marginTop: 8 }}>{fr('Clique sur un mot pour l’ajouter dans le texte. {{conseiller}} donne ton prénom et ton nom, ci-dessus.')}</div>
      </Carte>
    </div>
  );
}

/* ── Relances ── */
const DELAIS_RELANCE = ['3', '5', '7', '10', '14'];
function RubriqueRelances({ params, set, saved }: { params: Params; set: Poser; saved: boolean }) {
  const d = params.delai_relance_jours || '5';
  return (
    <div className={p.rubrique}>
      <Hero ic="relance" titre="Relances"
        texte={fr('Après chaque envoi de locaux à un demandeur, une relance se programme toute seule dans tes Relances, pour penser à l’appeler. Elle se ferme d’elle-même s’il répond avant.')}
        droite={saved ? <Enregistre /> : undefined} />

      <Carte ic="calendrier" titre="Combien de jours après un envoi ?" sous={fr('5 jours laissent au client le temps de regarder, sans le laisser refroidir.')}>
        <span className={p.choix} role="group" aria-label="Délai de la relance" data-defile="">
          <Curseur cle={d} />
          {DELAIS_RELANCE.map(x => (
            <button key={x} type="button" aria-pressed={x === d} onClick={() => set('delai_relance_jours', x)}>{`J+${x}`}</button>
          ))}
        </span>
        <div className={p.aideChamp} style={{ marginTop: 10 }}>{fr(d === '5' ? 'J+5 : le réglage conseillé.' : `J+${d} : la relance apparaîtra ${d} jours après chaque envoi.`)}</div>
      </Carte>

      <Carte ic="info" titre="Comment ça marche">
        <Etapes items={[
          { ic: 'envoi', titre: 'Tu envoies des locaux', texte: 'Depuis la fiche d’un demandeur.' },
          { ic: 'horloge', titre: `J+${d}`, texte: 'Le délai passe, sans réponse de sa part.' },
          { ic: 'cloche', titre: 'La relance apparaît', texte: 'Dans Relances et sur le tableau de bord. Aucun mail ne part au client.' },
          { ic: 'check', titre: 'Il a répondu avant ?', texte: 'La relance se ferme toute seule.' },
        ]} />
      </Carte>
    </div>
  );
}

export default function PageParametres() {
  const [params, setParams] = useState<Params>({});
  /* Seules les clés modifiées sur cette page repartent : réécrire toutes les
     valeurs lues à l'ouverture écrasait ce qui avait changé entre-temps
     (l'identité de l'agence, la réserve de numéros de mandat…). */
  const [modifiees, setModifiees] = useState<Set<string>>(new Set());
  const [lues, setLues] = useState<Params>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erreurSave, setErreurSave] = useState('');
  const [activeSection, setActiveSection] = useState('agence');

  useEffect(() => {
    supabase.from('parametres').select('cle, valeur').then(({ data }) => {
      const v: Params = {};
      (data || []).forEach((r: { cle: string; valeur: string | null }) => { v[r.cle] = r.valeur || ''; });
      /* V3.151 : un modèle aux « \n » écrits en toutes lettres s'affiche avec
         ses vrais retours à la ligne ; l'enregistrer le corrige en base. */
      for (const k of ['template_email_corps', 'template_email_objet', 'signature_email']) if (v[k]) v[k] = texteModele(v[k]);
      setParams(v); setLues(v);
    });
  }, []);

  const set: Poser = (k, v) => {
    setParams(prev => ({ ...prev, [k]: v }));
    /* Revenu à la valeur lue : plus rien à enregistrer pour cette clé. */
    setModifiees(prev => { const s = new Set(prev); if ((lues[k] || '') === v) s.delete(k); else s.add(k); return s; });
    setSaved(false); setErreurSave('');
  };

  async function save() {
    const cles = Array.from(modifiees);
    if (!cles.length) return;
    setSaving(true); setErreurSave('');
    const le = new Date().toISOString();
    const { error } = await supabase.from('parametres')
      .upsert(cles.map(cle => ({ cle, valeur: params[cle] ?? '', updated_at: le })), { onConflict: 'cle' });
    setSaving(false);
    if (error) { setErreurSave(`Pas enregistré : ${error.message}. Tes changements sont toujours là, réessaie.`); return; }
    setLues(prev => { const n = { ...prev }; for (const k of cles) n[k] = params[k] ?? ''; return n; });
    setModifiees(new Set()); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function annuler() {
    setParams(prev => { const n = { ...prev }; for (const k of modifiees) n[k] = lues[k] ?? ''; return n; });
    setModifiees(new Set()); setErreurSave('');
  }

  const enAttente = (id: string) => (CLES_RUBRIQUE[id] || []).some(k => modifiees.has(k));
  const nbIci = (CLES_RUBRIQUE[activeSection] || []).filter(k => modifiees.has(k)).length;
  const nbAilleurs = modifiees.size - nbIci;

  return (
    <div className={p.page}>
      <div className={p.tete}>
        <span className={p.teteIc}><Ico n="reglage" t={24} /></span>
        <div className={p.teteTx}>
          <h1>Paramètres</h1>
          <p>{fr('Ton agence, tes mails, tes alertes et ton compte : tout se règle ici. Chaque rubrique dit ce qu’elle change.')}</p>
        </div>
      </div>

      <div className={p.grille}>
        {/* Le rail des rubriques : la pastille sombre glisse de l'une à l'autre (Curseur). */}
        <nav className={p.rail} data-defile="" aria-label="Rubriques des paramètres">
          <Curseur cle={activeSection} />
          {SECTIONS.map(s => (
            <button key={s.id} type="button" className={p.railBtn} onClick={() => setActiveSection(s.id)} aria-pressed={activeSection === s.id}>
              <span className={p.railIc}><Ico n={s.ic} t={17} /></span>
              <span className={p.railTx}><b>{s.titre}</b><small>{s.sous}</small></span>
              {enAttente(s.id) && <i className={p.railPoint} title="Pas encore enregistré" />}
            </button>
          ))}
        </nav>

        {/* V3.152 : une autre rubrique arrive en cascade. */}
        <div style={{ minWidth: 0 }}>
          <Cascade cle={activeSection}>
            {activeSection === 'agence' && <ParamAgence onEnregistree={v => { setParams(x => ({ ...x, [CLE_IDENTITE]: v })); setLues(x => ({ ...x, [CLE_IDENTITE]: v })); }} />}
            {activeSection === 'emails' && <RubriqueMails params={params} set={set} saved={saved} onAgence={() => setActiveSection('agence')} />}
            {activeSection === 'alertes' && <ParamAlertes />}
            {activeSection === 'relances' && <RubriqueRelances params={params} set={set} saved={saved} />}
            {activeSection === 'point' && <ParamPointAuto />}
            {/* SÉCURITÉ — ton compte et ton mot de passe (ParamSecurite.tsx). */}
            {activeSection === 'securite' && <ParamSecurite />}
          </Cascade>

          {/* La barre d'enregistrement de Mails et Relances : elle monte dès qu'un champ change. */}
          {CLES_RUBRIQUE[activeSection] && modifiees.size > 0 && (
            <div style={{ marginTop: 14 }}>
              {erreurSave && <div style={{ marginBottom: 10 }}><Note ton="erreur">{erreurSave}</Note></div>}
              <div className={p.barre}>
                <div className={p.barreTx}>
                  <Ico n="enregistrer" t={18} />
                  <div>
                    <b>{`${modifiees.size} changement${modifiees.size > 1 ? 's' : ''} à enregistrer`}</b>
                    <span>{nbAilleurs > 0 ? ` · dont ${nbAilleurs} dans ${activeSection === 'emails' ? 'Relances' : 'Mails et signature'}` : ''}</span>
                  </div>
                </div>
                <div className={p.barreBoutons}>
                  <button type="button" className={p.barreAnnuler} onClick={annuler} disabled={saving}>Annuler</button>
                  <button type="button" className={p.barreOk} onClick={() => { void save(); }} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
