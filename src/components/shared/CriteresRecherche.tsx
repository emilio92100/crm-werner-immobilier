'use client';
import React, { Fragment } from 'react';
import styles from '@/components/fiche/FicheClient.module.css';
import SecteurPicker from '@/components/shared/SecteurPicker';
import ArretPicker from '@/components/shared/ArretPicker';
import type { Arret } from '@/lib/arrets';
import type { Parcours } from '@/lib/parcours';
import { EtapeParcours } from './Parcours';

/* ═══ Les critères de recherche, une bonne fois ═══════════════════════════
   Ce formulaire vivait dans la fiche client. La création d'un client en
   avait un second, plus pauvre, qui dérivait à chaque retouche. Il n'y en a
   plus qu'un : les neuf étapes, les deux affichages, les mêmes libellés. */

/* Un critère n'est pas seulement « coché / pas coché » : il peut être
   indifférent, simplement souhaité, ou carrément indispensable.
   Un clic fait avancer d'un cran, et le troisième clic revient à zéro. */
export type Niveau = '' | 'souhaite' | 'indispensable';
const CYCLE: Niveau[] = ['', 'souhaite', 'indispensable'];

export const PastilleExigence = ({ ico, libelle, niveau, onChange }: {
  ico: string; libelle: string; niveau: Niveau; onChange: (n: Niveau) => void;
}) => {
  const indisp = niveau === 'indispensable';
  const souh = niveau === 'souhaite';
  return (
    <button type="button"
      onClick={() => onChange(CYCLE[(CYCLE.indexOf(niveau) + 1) % CYCLE.length])}
      title="Un clic : souhaité — deux clics : indispensable — trois clics : indifférent"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20,
        border: `1px solid ${indisp ? '#f08c42' : souh ? '#10b981' : '#e2e8f0'}`,
        background: indisp ? 'var(--emilio)' : souh ? '#ecfdf5' : 'white',
        color: indisp ? '#f9c69f' : souh ? '#10b981' : '#64748b',
        fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.14s',
      }}>
      <span>{ico}</span><span>{libelle}</span>
      {indisp ? <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, background: '#f08c42', color: 'var(--emilio)', borderRadius: 6, padding: '2px 5px' }}>INDISPENSABLE</span>
        : souh ? <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, color: '#10b981' }}>SOUHAITÉ</span> : null}
    </button>
  );
};

/* Légende expliquant les trois niveaux, à placer sous une série de pastilles. */
export const LegendeNiveaux = () => (
  <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
    <span>Cliquez une fois = <b style={{ color: '#10b981' }}>souhaité</b></span>
    <span>deux fois = <b style={{ color: '#c46318' }}>indispensable</b></span>
    <span>trois fois = indifférent</span>
  </div>
);

/* Listes de choix, chacune avec son icône. Mêmes clés et mêmes intitulés
   que l'espace acheteur : le client et le chasseur lisent la même chose. */
export const ETATS: [string, string, string][] = [
  ['brut', 'Brut, à aménager', '🧱'], ['a_renover', 'À rénover', '🔨'], ['travaux_legers', 'À rafraîchir', '🧰'],
  ['bon_etat', 'Bon état', '✨'], ['refait_neuf', 'Refait à neuf', '💎'],
];
/* Werner : le financement d'un acquéreur de murs ou d'un fonds. */
export const FINANCEMENTS: [string, string, string][] = [
  ['fonds_propres', 'Fonds propres', '💵'], ['pret_valide', 'Prêt accordé', '✅'],
  ['pret_en_cours', 'Prêt en cours', '⏳'], ['a_monter', 'Financement à monter', '📝'],
  ['mixte', 'Fonds propres et prêt', '🔀'], ['credit_bail', 'Crédit-bail', '🏦'],
];
export const URGENCES: [string, string, string][] = [
  ['immediate', 'Immédiate', '🔥'], ['3_mois', 'Sous 3 mois', '⏱️'],
  ['6_mois', 'Sous 6 mois', '📆'], ['annee', "Dans l'année", '🗓️'],
];
export const CUISINES: [string, string, string][] = [
  ['', 'Indifférent', '🤷'], ['ouverte', 'Ouverte sur le séjour', '🍽️'], ['separee', 'Séparée', '🚪'],
];
/* L'état souhaité se choisit à plusieurs (« travaux légers » ET « bon état »).
   Les clés sont enregistrées à la suite, séparées par des virgules, dans
   l'ordre de la liste. Rien d'enregistré = pas de préférence. Mêmes règles
   dans l'espace acheteur (EspaceClient.tsx) et à l'enregistrement côté client
   (api/espace/[action]). */
export const etatsDe = (v?: string | null): string[] => {
  const l = String(v || '').split(',').map(x => x.trim());
  return ETATS.map(e => e[0]).filter(k => l.includes(k));
};
export const texteEtats = (v?: string | null): string | null => {
  const l = etatsDe(v);
  return l.length ? l.map(k => { const e = ETATS.find(x => x[0] === k)!; return `${e[2]} ${e[1]}`; }).join(' · ') : null;
};
export const ChoixEtats = ({ valeur, onChange, couleur = 'var(--emilio)' }: { valeur: string; onChange: (v: string) => void; couleur?: string }) => {
  const choisis = etatsDe(valeur);
  const puce = (actif: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20,
    border: `1px solid ${actif ? couleur : '#e2e8f0'}`, background: actif ? couleur : 'white',
    color: actif ? 'white' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.12s',
  });
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onChange('')} aria-pressed={!choisis.length} style={puce(!choisis.length)}>
        <span style={{ fontSize: 14 }}>🤷</span>Pas de préférence
      </button>
      {ETATS.map(([k, l, i]) => {
        const actif = choisis.includes(k);
        return (
          <button type="button" key={k} aria-pressed={actif} style={puce(actif)}
            onClick={() => onChange(ETATS.map(e => e[0]).filter(x => (x === k ? !actif : choisis.includes(x))).join(','))}>
            <span style={{ fontSize: 14 }}>{i}</span>{l}
          </button>
        );
      })}
    </div>
  );
};

/* Retrouve « 💵 Cash » à partir de la valeur enregistrée. */
export const texteChoix = (table: [string, string, string][], v?: string | null) => {
  const l = table.find(x => x[0] === v);
  return l ? `${l[2]} ${l[1]}` : (v || null);
};

/* Une ligne de pastilles à choix unique — remplace les anciens menus déroulants. */
export const ChoixIco = ({ table, valeur, onChange, couleur = 'var(--emilio)' }: {
  table: [string, string, string][]; valeur: string; onChange: (v: string) => void; couleur?: string;
}) => (
  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
    {table.map(([k, l, i]) => {
      const actif = valeur === k;
      return (
        <button type="button" key={k || 'vide'} onClick={() => onChange(actif ? '' : k)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20,
            border: `1px solid ${actif ? couleur : '#e2e8f0'}`, background: actif ? couleur : 'white',
            color: actif ? 'white' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.12s',
          }}>
          <span style={{ fontSize: 14 }}>{i}</span>{l}
        </button>
      );
    })}
  </div>
);

/* Orientations, avec leur icône : on lit la ligne d'un coup d'œil. */
export const EXPOSITIONS = [
  { k: 'sud', l: 'Sud', i: '☀️' }, { k: 'est', l: 'Est', i: '🌅' },
  { k: 'ouest', l: 'Ouest', i: '🌇' }, { k: 'nord', l: 'Nord', i: '❄️' },
  { k: 'traversant', l: 'Traversant', i: '↔️' },
];
export const ICONE_EXPO: Record<string, string> = Object.fromEntries(EXPOSITIONS.map(e => [e.k, e.i]));

/* Types de biens proposés dans les critères. Les valeurs déjà enregistrées
   qui ne sont plus dans cette liste restent affichées, pour rester modifiables. */
export const TYPES_BIEN = [
  { t: 'Bureaux', i: '🏢' }, { t: 'Local commercial', i: '🏪' }, { t: 'Restaurant', i: '🍽️' },
  { t: 'Local d’activité', i: '🏭' }, { t: 'Entrepôt', i: '📦' }, { t: 'Immeuble', i: '🏬' },
  { t: 'Terrain', i: '🌱' }, { t: 'Parking', i: '🅿️' },
];
/* Werner : ce que le demandeur cherche (src/lib/affaires.ts, NATURES). */
export const NATURES_RECHERCHE = [
  { k: 'location', t: 'Louer', i: '🔑', aide: 'Un local vide, un bail neuf' },
  { k: 'cession_bail', t: 'Reprendre un bail', i: '📄', aide: 'Un droit au bail' },
  { k: 'fonds', t: 'Racheter un fonds', i: '🛍️', aide: 'Une affaire en activité' },
  { k: 'murs', t: 'Acheter des murs', i: '🏛️', aide: 'Pour s’y installer' },
  { k: 'murs_occupes', t: 'Investir', i: '📈', aide: 'Des murs déjà loués' },
];
export const EMPLACEMENTS_RECHERCHE = [
  { k: 'n1', t: 'N° 1' }, { k: 'n1bis', t: 'N° 1 bis' }, { k: 'n2', t: 'N° 2' },
  { k: 'quartier', t: 'Commerce de quartier' }, { k: 'centre', t: 'Centre commercial' }, { k: 'zone', t: 'Zone commerciale' },
];
/* Ce qu'un demandeur peut exiger : les mêmes clés que les équipements d'une
   affaire (src/lib/affaires.ts, EQUIPEMENTS), pour que le rapprochement
   compare clé à clé ; « rdc » : un rez-de-chaussée. */
export const EXIGENCES_PRO: { k: string; l: string; i: string }[] = [
  { k: 'rdc', l: 'Rez-de-chaussée', i: '🚪' }, { k: 'vitrineEq', l: 'Vitrine', i: '🪟' }, { k: 'extraction', l: 'Extraction', i: '🔥' },
  { k: 'terrasse', l: 'Terrasse', i: '☀️' }, { k: 'reserve', l: 'Réserve', i: '📦' }, { k: 'clim', l: 'Climatisation', i: '❄️' },
  { k: 'pmr', l: 'Accès PMR', i: '♿' }, { k: 'parking', l: 'Parking', i: '🅿️' }, { k: 'ascenseur', l: 'Ascenseur', i: '🛗' },
  { k: 'fibre', l: 'Fibre', i: '🌐' }, { k: 'cablage', l: 'Câblage', i: '🔌' }, { k: 'plancherTech', l: 'Plancher technique', i: '🧩' },
  { k: 'quai', l: 'Quai de chargement', i: '🚚' }, { k: 'cuisinePro', l: 'Cuisine équipée', i: '🍳' }, { k: 'chambreFroide', l: 'Chambre froide', i: '🧊' },
];



/* En-tête de section dans la pop-up « Critères de recherche ». */
export const SectionCrit = ({ ico, titre, note }: { ico: string; titre: string; note?: string }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 -4px',
    paddingBottom: 9, borderBottom: '1px solid #eaeae9' }}>
    <span style={{ fontSize: 16, lineHeight: 1 }}>{ico}</span>
    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--emilio)', letterSpacing: 0.2 }}>{titre}</span>
    {note ? <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{note}</span> : null}
  </div>
);


/* La forme du formulaire. `exigences` porte le niveau de chaque critère —
   souhaité, indispensable — et les anciennes colonnes booléennes suivent. */
export type CritForm = {
  exigences: Record<string, Niveau>;
  etage_max_sans_ascenseur: string; cuisine_type: string; exterieur_surface_min: string;
  types_bien: string[]; budget_min: string; budget_max: string;
  surface_min: string; surface_max: string; nb_pieces_min: string; nb_pieces_max: string;
  chambres_min: string; secteurs: string[]; transport_minutes: string;
  transport_lignes: string[]; transport_arrets: Arret[]; notes: string;
  parking: boolean; balcon: boolean; terrasse: boolean; jardin: boolean; cave: boolean;
  ascenseur: boolean; gardien: boolean; interphone: boolean; digicode: boolean;
  rdc_exclu: boolean; dernier_etage: boolean;
  etage_min: string; etage_max: string; dpe_max: string; annee_min: string;
  etat_souhaite: string; exposition_souhaitee: string; surface_sejour_min: string;
  urgence: string; financement: string; apport: string;
  /* V3.122 : son parcours (src/lib/parcours.ts). Hors de `colonnesCriteres` :
     il s'écrit à part (`recherches.parcours`), pour qu'une colonne pas encore
     créée n'empêche jamais d'enregistrer les critères. */
  parcours?: Parcours;
  /* Werner : les critères de l'immobilier d'entreprise (recherches.criteres_pro). */
  pro?: ProForm;
};
export type ProForm = {
  natures: string[]; activite: string; loyerMin: string; loyerMax: string;
  vitrineMin: string; postesMin: string; emplacements: string[];
};
export const PRO_VIDE: ProForm = { natures: [], activite: '', loyerMin: '', loyerMax: '', vitrineMin: '', postesMin: '', emplacements: [] };
const proDe = (f: CritForm): ProForm => ({ ...PRO_VIDE, ...(f.pro || {}) });

export const CRIT_VIDE: CritForm = {
  exigences: {}, etage_max_sans_ascenseur: '', cuisine_type: '', exterieur_surface_min: '',
  types_bien: [], budget_min: '', budget_max: '', surface_min: '', surface_max: '',
  nb_pieces_min: '', nb_pieces_max: '', chambres_min: '', secteurs: [],
  transport_minutes: '', transport_lignes: [], transport_arrets: [], notes: '',
  parking: false, balcon: false, terrasse: false, jardin: false, cave: false,
  ascenseur: false, gardien: false, interphone: false, digicode: false,
  rdc_exclu: false, dernier_etage: false, etage_min: '', etage_max: '', dpe_max: '',
  annee_min: '', etat_souhaite: '', exposition_souhaitee: '', surface_sejour_min: '',
  urgence: '', financement: '', apport: '', parcours: {}, pro: PRO_VIDE,
};

/* Les colonnes de `recherches` que portent les critères, tirées du
   formulaire : les mêmes à la création d'un contact (Clients.tsx) et à
   l'import d'ImmoFacile (V3.61, contacts/import-ecriture.ts). */
export function colonnesCriteres(cr: CritForm) {
  const ent = (v: string) => (v ? parseInt(v) : null);
  return {
    type_bien: cr.types_bien.length ? cr.types_bien.join(', ') : null,
    budget_min: ent(cr.budget_min), budget_max: ent(cr.budget_max),
    surface_min: ent(cr.surface_min), surface_max: ent(cr.surface_max),
    nb_pieces_min: ent(cr.nb_pieces_min), nb_pieces_max: ent(cr.nb_pieces_max),
    chambres_min: ent(cr.chambres_min),
    surface_sejour_min: ent(cr.surface_sejour_min),
    secteurs: cr.secteurs,
    transport_minutes: ent(cr.transport_minutes),
    transport_lignes: cr.transport_lignes,
    transport_arrets: cr.transport_arrets,
    etage_min: ent(cr.etage_min), etage_max: ent(cr.etage_max),
    etage_max_sans_ascenseur: ent(cr.etage_max_sans_ascenseur),
    rdc_exclu: cr.rdc_exclu, dernier_etage: cr.dernier_etage,
    dpe_max: cr.dpe_max || null,
    annee_construction_min: ent(cr.annee_min),
    etat_souhaite: cr.etat_souhaite || null,
    exposition_souhaitee: cr.exposition_souhaitee || null,
    cuisine_type: cr.cuisine_type || null,
    exterieur_surface_min: ent(cr.exterieur_surface_min),
    parking: cr.parking, cave: cr.cave, balcon: cr.balcon,
    terrasse: cr.terrasse, jardin: cr.jardin,
    ascenseur: cr.ascenseur, gardien: cr.gardien,
    interphone: cr.interphone, digicode: cr.digicode,
    exigences: cr.exigences,
    urgence: cr.urgence || null,
    financement: cr.financement || null,
    apport: ent(cr.apport),
    notes: cr.notes || null,
    criteres_pro: proPourBase(cr.pro),
  };
}
/* Les critères de l'immobilier d'entreprise, tels que la base les garde. */
export function proPourBase(p?: ProForm) {
  const x = { ...PRO_VIDE, ...(p || {}) };
  const ent = (v: string) => { const n = parseInt(String(v).replace(/\s/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };
  return {
    natures: x.natures, activite: x.activite.trim(), loyerMin: ent(x.loyerMin), loyerMax: ent(x.loyerMax),
    vitrineMin: x.vitrineMin ? parseFloat(x.vitrineMin.replace(',', '.')) || null : null, postesMin: ent(x.postesMin), emplacements: x.emplacements,
  };
}
/* Le formulaire rempli depuis une ligne de `recherches` (la fiche du contact). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function proDepuisRecherche(r: any): ProForm {
  const o = r?.criteres_pro && typeof r.criteres_pro === 'object' ? r.criteres_pro : {};
  const t = (v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : typeof v === 'string' ? v : '');
  const l = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { natures: l(o.natures), activite: t(o.activite), loyerMin: t(o.loyerMin), loyerMax: t(o.loyerMax), vitrineMin: t(o.vitrineMin), postesMin: t(o.postesMin), emplacements: l(o.emplacements) };
}

export type EtapeCrit = { id: string; ico: string; titre: string; note?: string; sous: string; contenu: React.ReactNode };
export type SetCrit = (maj: (f: CritForm) => CritForm) => void;

/* L'ordre des étapes, pour en ouvrir une précise (« Modifier ma note » →
   « Contexte du projet », le bloc « Son parcours » → son étape). */
export const ORDRE_ETAPES_CRIT = ['projet', 'surfaces', 'budget', 'equipements', 'lieu', 'transports', 'parcours', 'contexte'];

/* Les dix catégories : affichées à la suite (mode « tout ») ou une par une. */
export function etapesCriteres(crit: CritForm, setCrit: SetCrit): EtapeCrit[] {
        const niv = (k: string): Niveau => (crit.exigences?.[k] as Niveau) || '';
        const setNiv = (k: string, n: Niveau) => setCrit(f => {
          const ex = { ...(f.exigences || {}) };
          if (n) ex[k] = n; else delete ex[k];
          const maj: Record<string, unknown> = { exigences: ex };
          if (k in f) maj[k] = !!n;
          return { ...f, ...maj } as typeof f;
        });
        /* Werner : les critères de l'immobilier d'entreprise. */
        const pro = proDe(crit);
        const setPro = (maj: Partial<ProForm>) => setCrit(f => ({ ...f, pro: { ...proDe(f), ...maj } }));
        const basculer = (l: string[], k: string) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);
        const pastille = (sel: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1px solid ${sel ? 'var(--emilio)' : '#e2e8f0'}`, background: sel ? 'var(--emilio)' : 'white', color: sel ? 'white' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' });
        const cherche = (k: string) => pro.natures.includes(k);
        const avecLoyer = !pro.natures.length || cherche('location') || cherche('cession_bail') || cherche('fonds');
        const avecPrix = !pro.natures.length || cherche('cession_bail') || cherche('fonds') || cherche('murs') || cherche('murs_occupes');
        const achat = cherche('fonds') || cherche('murs') || cherche('murs_occupes');
        const commerce = !crit.types_bien.length || crit.types_bien.some(t => /commercial|restaurant/i.test(t));
        const bureaux = crit.types_bien.some(t => /bureau/i.test(t));
        const etapesCrit: { id: string; ico: string; titre: string; note?: string; sous: string; contenu: React.ReactNode }[] = [
          {
            id: 'projet', ico: '🎯', titre: 'SON PROJET', note: 'plusieurs choix possibles',
            sous: 'Ce qu’il cherche, quel local, pour quelle activité',
            contenu: (<>
              <div>
                <label className={styles.lbl}>Il veut</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {NATURES_RECHERCHE.map(o => { const sel = cherche(o.k); return <button type="button" key={o.k} title={o.aide} aria-pressed={sel} onClick={() => setPro({ natures: basculer(pro.natures, o.k) })} style={pastille(sel)}>{o.i} {o.t}</button>; })}
                </div>
              </div>
              <div>
                <label className={styles.lbl}>Type de local</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[...TYPES_BIEN, ...crit.types_bien.filter(t => !TYPES_BIEN.some(o => o.t === t)).map(t => ({ t, i: '✳️' }))].map(o => { const sel = crit.types_bien.includes(o.t); return <button type="button" key={o.t} aria-pressed={sel} onClick={() => setCrit(f => ({ ...f, types_bien: sel ? f.types_bien.filter(x => x !== o.t) : [...f.types_bien, o.t] }))} style={pastille(sel)}>{o.i} {o.t}</button>; })}
                </div>
              </div>
              <div className={styles.formRow}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.lbl}>Son activité <span style={{ fontWeight: 500, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>· ce qu’il fera dans le local</span></label>
                  <input className={styles.inp} value={pro.activite} onChange={e => setPro({ activite: e.target.value })} placeholder="Boulangerie, cabinet d’architectes, prêt-à-porter…" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.lbl}>État accepté <span style={{ fontWeight: 500, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>· plusieurs choix possibles</span></label>
                  <ChoixEtats valeur={crit.etat_souhaite} onChange={v => setCrit(f => ({ ...f, etat_souhaite: v }))} />
                </div>
              </div>
            </>),
          },
          {
            id: 'surfaces', ico: '📐', titre: 'SURFACES', note: undefined,
            sous: 'La surface, la vitrine, les postes de travail',
            contenu: (<>
              <div className={styles.formRow}>
                <div><label className={styles.lbl}>Surface m²</label><div style={{display:'flex',gap:6}}><input className={styles.inp} type="number" value={crit.surface_min} onChange={e=>setCrit(f=>({...f,surface_min:e.target.value}))} placeholder="Min" /><input className={styles.inp} type="number" value={crit.surface_max} onChange={e=>setCrit(f=>({...f,surface_max:e.target.value}))} placeholder="Max" /></div></div>
                {commerce && <div><label className={styles.lbl}>Linéaire de vitrine min (m)</label><input className={styles.inp} type="number" value={pro.vitrineMin} onChange={e => setPro({ vitrineMin: e.target.value })} /></div>}
                {bureaux && <div><label className={styles.lbl}>Postes de travail min</label><input className={styles.inp} type="number" value={pro.postesMin} onChange={e => setPro({ postesMin: e.target.value })} /></div>}
              </div>
              {commerce && (
                <div>
                  <label className={styles.lbl}>Emplacement <span style={{ fontWeight: 500, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>· plusieurs choix possibles</span></label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {EMPLACEMENTS_RECHERCHE.map(o => { const sel = pro.emplacements.includes(o.k); return <button type="button" key={o.k} aria-pressed={sel} onClick={() => setPro({ emplacements: basculer(pro.emplacements, o.k) })} style={pastille(sel)}>{o.t}</button>; })}
                  </div>
                </div>
              )}
            </>),
          },
          {
            id: 'budget', ico: '💶', titre: 'BUDGET', note: 'hors taxes',
            sous: 'Le loyer annuel, le prix, le financement',
            contenu: (<>
              {avecLoyer && (
                <div className={styles.formRow}>
                  <div><label className={styles.lbl}>Loyer annuel HT HC · min €</label><input className={styles.inp} type="number" value={pro.loyerMin} onChange={e => setPro({ loyerMin: e.target.value })} /></div>
                  <div><label className={styles.lbl}>Loyer annuel HT HC · max €</label><input className={styles.inp} type="number" value={pro.loyerMax} onChange={e => setPro({ loyerMax: e.target.value })} /></div>
                </div>
              )}
              {avecPrix && (
                <div className={styles.formRow}>
                  <div><label className={styles.lbl}>{cherche('cession_bail') && !achat ? 'Droit au bail · min €' : 'Prix · min €'}</label><input className={styles.inp} type="number" value={crit.budget_min} onChange={e => setCrit(f => ({ ...f, budget_min: e.target.value }))} /></div>
                  <div><label className={styles.lbl}>{cherche('cession_bail') && !achat ? 'Droit au bail · max €' : 'Prix · max €'}</label><input className={styles.inp} type="number" value={crit.budget_max} onChange={e => setCrit(f => ({ ...f, budget_max: e.target.value }))} /></div>
                </div>
              )}
              {achat && (
                <>
                  <div className={styles.formRow}>
                    <div><label className={styles.lbl}>Apport €</label><input className={styles.inp} type="number" value={crit.apport} onChange={e=>setCrit(f=>({...f,apport:e.target.value}))} /></div>
                  </div>
                  <div>
                    <label className={styles.lbl}>Financement</label>
                    <ChoixIco table={FINANCEMENTS} valeur={crit.financement} onChange={v => setCrit(f => ({ ...f, financement: v }))} couleur="#0f766e" />
                  </div>
                </>
              )}
            </>),
          },
          {
            id: 'equipements', ico: '✨', titre: 'CE QU’IL LUI FAUT', note: 'souhaité ou indispensable',
            sous: 'Ce qui ferait plaisir, et ce sans quoi c’est non',
            contenu: (<>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EXIGENCES_PRO.map(o => (
                  <PastilleExigence key={o.k} ico={o.i} libelle={o.l} niveau={niv(o.k)} onChange={n => setNiv(o.k, n)} />
                ))}
              </div>
              <LegendeNiveaux />
            </>),
          },
          {
            id: 'lieu', ico: '📍', titre: 'OÙ CHERCHER', note: 'ville puis quartiers',
            sous: 'Villes puis quartiers',
            contenu: (<>
              <SecteurPicker secteurs={crit.secteurs} onChange={(next) => setCrit(f => ({ ...f, secteurs: next }))} />
            </>),
          },
          {
            id: 'transports', ico: '🚇', titre: 'TRANSPORTS', note: 'cherchez un arrêt, puis réglez le temps à pied',
            sous: 'Arrêts souhaités et temps à pied',
            contenu: (<>
              <ArretPicker
                arrets={crit.transport_arrets}
                onChange={(v) => setCrit(f => ({ ...f, transport_arrets: v }))}
                minutesDefaut={crit.transport_minutes ? parseInt(crit.transport_minutes) : 10} />
            </>),
          },
          {
            id: 'parcours', ico: '🧭', titre: 'SON PARCOURS', note: 'visible de toi seul',
            sous: 'Ce qu’il a déjà visité, et ce qui n’allait pas',
            contenu: (<EtapeParcours valeur={crit.parcours} onChange={x => setCrit(f => ({ ...f, parcours: x }))} />),
          },
          {
            id: 'contexte', ico: '🗒️', titre: 'CONTEXTE DU PROJET', note: undefined,
            sous: 'Urgence et notes pour le client',
            contenu: (<>
              <div>
                <label className={styles.lbl}>Urgence du projet</label>
                <ChoixIco table={URGENCES} valeur={crit.urgence} onChange={v => setCrit(f => ({ ...f, urgence: v }))} couleur="#c05d12" />
              </div>
              <div><label className={styles.lbl}>Notes libres <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>— visibles par le client dans son espace</span></label><textarea className={styles.inp} rows={3} value={crit.notes} onChange={e => setCrit(f=>({...f,notes:e.target.value}))} placeholder="Une ouverture prévue au printemps, une enseigne à respecter, une activité à faire accepter par le bailleur…" /></div>
            </>),
          },
        ];
        return etapesCrit;
}

const cls = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(' ');

/* ═══ Le rendu ═══════════════════════════════════════════════════════════
   Deux affichages pour la même matière : tout déroulé quand on relit un
   dossier, étape par étape quand on remplit au téléphone. */
export function BasculeCriteres({ mode, onMode }: { mode: ModeCrit; onMode: (m: ModeCrit) => void }) {
  return (
    <div className={styles.critBasc}>
      <button type="button" className={cls(styles.critBascBtn, mode === 'tout' && styles.critBascOn)}
        onClick={() => onMode('tout')}>☰ Tout afficher</button>
      <button type="button" className={cls(styles.critBascBtn, mode === 'etapes' && styles.critBascOn)}
        onClick={() => onMode('etapes')}>✨ Étape par étape</button>
    </div>
  );
}

export function FriseCriteres({ etapes, i, onAller }: { etapes: EtapeCrit[]; i: number; onAller: (n: number) => void }) {
  return (
    <div className={styles.critFrise} data-defile="">
      {etapes.map((sE, k) => (
        <Fragment key={sE.id}>
          {k > 0 && <span className={cls(styles.critTrait, k <= i && styles.critTraitFait)} />}
          <button type="button" title={sE.titre} aria-label={sE.titre} onClick={() => onAller(k)}
            className={cls(styles.critPuce, k === i && styles.critPuceOn, k < i && styles.critPuceFait)}>
            <span className={styles.critPuceIco}>{sE.ico}</span>
            <span className={styles.critPuceTxt}>{sE.titre}</span>
          </button>
        </Fragment>
      ))}
    </div>
  );
}

export function CorpsCriteres({ etapes, mode, i, sens }: { etapes: EtapeCrit[]; mode: ModeCrit; i: number; sens: 1 | -1 }) {
  if (mode === 'tout') {
    return (<>
      {etapes.map(sE => (
        <Fragment key={sE.id}>
          <SectionCrit ico={sE.ico} titre={sE.titre} note={sE.note} />
          {sE.contenu}
        </Fragment>
      ))}
    </>);
  }
  const e = etapes[Math.min(Math.max(i, 0), etapes.length - 1)];
  return (
    <div key={e.id} className={cls(styles.critPanneau, sens === 1 ? styles.critAvant : styles.critArriere)}>
      <div className={styles.critEnTete}>
        <div className={styles.critEnTeteIco}>{e.ico}</div>
        <div>
          <div className={styles.critEnTeteT}>{e.titre}</div>
          <div className={styles.critEnTeteS}>{e.sous}</div>
        </div>
        <div className={styles.critCompteur}>Étape {i + 1} / {etapes.length}</div>
      </div>
      {e.contenu}
    </div>
  );
}

export type ModeCrit = 'tout' | 'etapes';

/* Les classes viennent de la feuille de la fiche : l'écran qui accueille ce
   formulaire en a besoin pour son enveloppe (défilement, panneaux). */
export const classesCrit = styles;

/* Le choix d'affichage est une habitude de travail, pas une donnée du
   dossier : il se retient d'un écran à l'autre et d'une session à l'autre. */
export function lireModeCrit(): ModeCrit {
  try {
    const m = localStorage.getItem('emilio_mode_criteres');
    return m === 'etapes' ? 'etapes' : 'tout';
  } catch { return 'tout'; }
}
export function ecrireModeCrit(m: ModeCrit) {
  try { localStorage.setItem('emilio_mode_criteres', m); } catch { /* stockage indisponible */ }
}
