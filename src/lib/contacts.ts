/* ═══ Les types de contact ════════════════════════════════════════════════
   Un contact du CRM n'est plus forcément un acheteur. Il porte un ou
   plusieurs types (colonne `clients.types`, voir outils/sql/types-contact.sql) :
   acheteur, vendeur, propriétaire, notaire, confrère ou agence, gardien,
   partenaire. Ce qui est propre à chaque type vit dans `clients.pro`.

   « Acheteur non filtré » n'est pas un type : c'est un acheteur dont la
   recherche n'a pas encore de critères. Il se calcule.

   Avant le SQL, la colonne n'existe pas : tout contact est un acheteur,
   comme avant. Ce fichier est isomorphe (CRM et bancs d'essai). */

export type TypeContact = 'acheteur' | 'vendeur' | 'vendeur_signe' | 'proprietaire' | 'notaire' | 'confrere' | 'gardien' | 'partenaire';

export const TYPES_CONTACT: { k: TypeContact; lib: string; pluriel: string; ic: string; c: string; fond: string; aide: string }[] = [
  /* Werner : les clés internes restent celles du CRM d'origine (la base et
     ses déclencheurs les connaissent) ; seuls les mots changent. */
  { k: 'acheteur', lib: 'Demandeur', pluriel: 'Demandeurs', ic: 'cible', c: '#0f7a4f', fond: '#ecfdf5', aide: 'Il cherche un local : à louer, un droit au bail, un fonds ou des murs à acheter. Sa recherche, son espace, la veille.' },
  { k: 'vendeur', lib: 'Bailleur, cédant', pluriel: 'Bailleurs et cédants', ic: 'etiquette', c: '#c2621c', fond: '#fbf0e9', aide: 'Son local, son fonds ou ses murs sont confiés à l’agence : mandat en cours, sous offre ou en signature.' },
  /* Son affaire est signée (bail, cession, vente) : il quitte les mandants
     en cours, sans être archivé. Proposé quand l'affaire est conclue. */
  { k: 'vendeur_signe', lib: 'Ancien mandant', pluriel: 'Anciens mandants', ic: 'check', c: '#15803d', fond: '#f0fdf4', aide: 'Son affaire est signée : un ancien client, pour une recommandation ou une prochaine affaire.' },
  { k: 'proprietaire', lib: 'Propriétaire', pluriel: 'Propriétaires', ic: 'cle', c: '#c05d12', fond: '#fff7ed', aide: 'Il possède un local, des murs ou un fonds qui ne sont pas encore confiés : à suivre, en estimation. Un mandant de demain.' },
  { k: 'notaire', lib: 'Notaire, avocat', pluriel: 'Notaires et avocats', ic: 'balance', c: '#2e3034', fond: '#f4f3f2', aide: 'Son étude, son cabinet : pour les baux, les cessions et les actes.' },
  { k: 'confrere', lib: 'Confrère ou agence', pluriel: 'Confrères', ic: 'agence', c: '#7c3aed', fond: '#f5f3ff', aide: 'Un agent, un cabinet, un réseau : pour les affaires partagées.' },
  { k: 'gardien', lib: 'Gardien, gestionnaire', pluriel: 'Gardiens et gestionnaires', ic: 'immeuble', c: '#0e7490', fond: '#ecfeff', aide: 'Le gardien ou le gestionnaire d’un immeuble : ses horaires, les clés, les accès.' },
  { k: 'partenaire', lib: 'Partenaire', pluriel: 'Partenaires', ic: 'outil', c: '#475569', fond: '#f1f5f9', aide: 'Expert-comptable, banquier, architecte, diagnostiqueur, apporteur d’affaires…' },
];
export const typeDe = (k: string) => TYPES_CONTACT.find(t => t.k === k) || TYPES_CONTACT[0];

/* ── V3.137 : « Vendeur » suit ses biens ──
   Alexandre : « vendeur, ça veut dire ceux qui vendent ; une estimation qui
   débouche sur une vente, sinon ça reste propriétaire ». Avant, tout contact
   relié à un bien de la rubrique Biens devenait « Vendeur », même en
   estimation : 162 vendeurs, la plupart sans mandat.
     · un bien en mandat, sous offre ou sous compromis : Vendeur, à la place
       de Propriétaire — les deux listes ne se recouvrent plus (un « Vendeur
       signé » qui revend redevient Vendeur, comme avant) ;
     · sinon, un bien à suivre, en estimation, en pause ou retiré :
       Propriétaire (et plus Vendeur) ;
     · son seul bien vient d'être vendu : rien ici — « La vente est signée »
       décide (Vendeur signé) ;
     · plus aucun bien : il quitte Vendeur ; un contact ne reste jamais sans
       type (vide voudrait dire acheteur), alors Propriétaire.
   Un archivé ne bouge pas. La base applique la même règle toute seule à
   chaque changement d'un bien (outils/sql/vendeurs-en-vente.sql) : les deux
   doivent rester identiques. Rend les nouveaux types, ou null si rien ne
   change. */
export const ETAPES_EN_VENTE = ['mandat', 'offre', 'compromis'];
export function typesSelonBiens(types: TypeContact[], biens: { etape: string | null; archive?: boolean | null }[]): TypeContact[] | null {
  const actifs = biens.filter(b => b.archive !== true);
  const vend = actifs.some(b => ETAPES_EN_VENTE.includes(b.etape || ''));
  const possede = actifs.some(b => !['vendu', 'annonce_type'].includes(b.etape || ''));
  const vendu = actifs.some(b => b.etape === 'vendu');
  let n: TypeContact[];
  if (vend) n = [...types.filter(t => t !== 'vendeur_signe' && t !== 'proprietaire'), 'vendeur'];
  else if (types.includes('vendeur')) {
    if (!possede && vendu) return null;
    n = types.filter(t => t !== 'vendeur');
    if (possede || !n.length) n.push('proprietaire');
  } else if (possede && !types.includes('proprietaire')) n = [...types, 'proprietaire'];
  else return null;
  const range = TYPES_CONTACT.map(t => t.k).filter(k => n.includes(k));
  return range.join() === TYPES_CONTACT.map(t => t.k).filter(k => types.includes(k)).join() ? null : range;
}
/* L'erreur d'une base où le SQL des types n'est pas encore passé. */
export const colonneContactAbsente = (m: string) => /(types|pro|archive).*(column|schema cache)|column .*(types|pro|archive)|could not find the '(types|pro|archive)'/i.test(m);

type AvecTypes = { types?: unknown; pro?: unknown; archive?: unknown };
/* Les types d'un contact. Sans la colonne (avant le SQL) ou vide : acheteur. */
export function typesDe(c: AvecTypes | null | undefined): TypeContact[] {
  const l = Array.isArray(c?.types) ? (c!.types as unknown[]).filter((x): x is TypeContact => typeof x === 'string' && TYPES_CONTACT.some(t => t.k === x)) : [];
  return l.length ? TYPES_CONTACT.map(t => t.k).filter(k => l.includes(k)) : ['acheteur'];
}
export const estAcheteur = (c: AvecTypes | null | undefined) => typesDe(c).includes('acheteur');
export const estArchive = (c: AvecTypes | null | undefined) => c?.archive === true;
/* V3.50 : à qui parlent les automatismes d'achat (point automatique, alertes
   de rapprochement) : un acheteur, pas archivé. Sans la colonne des types
   (avant le SQL) ou vide, un contact reste un acheteur, comme avant. */
export const acheteurEnCours = (c: AvecTypes | null | undefined) => estAcheteur(c) && !estArchive(c);
/* V3.240 (comme chez Emilio) — « Ancien demandeur » n'est pas un type non
   plus : un demandeur dont le dossier est clos (« Local trouvé avec moi »,
   « Recherche arrêtée »). Il quitte « Demandeurs » (ceux qui cherchent
   encore : en recherche, accompagnés, en pause) pour « Anciens demandeurs » ;
   rouvrir sa recherche l'y ramène tout seul : rien ne change en base, ni son
   type ni les automatismes (`acheteurEnCours` reste le même). */
export const STATUTS_CLOS: string[] = ['bien_trouve', 'perdu'];
type AvecStatut = AvecTypes & { statut?: unknown };
export const estAncienAcheteur = (c: AvecStatut | null | undefined) => estAcheteur(c) && STATUTS_CLOS.includes(String(c?.statut));
export const acheteurQuiCherche = (c: AvecStatut | null | undefined) => estAcheteur(c) && !STATUTS_CLOS.includes(String(c?.statut));
/* Le nom d'un type pour ce contact : « Ancien demandeur » pour un dossier clos. */
export const libType = (k: TypeContact, c?: AvecStatut | null) => (k === 'acheteur' && estAncienAcheteur(c) ? 'Ancien demandeur' : typeDe(k).lib);
/* Les contacts « particuliers » (on les suit pour un achat ou une vente)
   par opposition aux professionnels. */
export const PARTICULIERS: TypeContact[] = ['acheteur', 'vendeur', 'vendeur_signe', 'proprietaire'];
/* Vend, a vendu ou possède un bien : ses biens, sa société s'affichent (V3.47). */
export const aUnBien = (t: TypeContact[]) => t.includes('vendeur') || t.includes('vendeur_signe') || t.includes('proprietaire');
export const estPro = (types: TypeContact[]) => !types.some(t => PARTICULIERS.includes(t));
/* V3.50 : « Revente possible » (bien_actuel_a_vendre). Un vendeur signé a
   vendu : la case, restée cochée d'avant sa vente, ne veut plus rien dire. */
export const reventePossible = (c: (AvecTypes & { bien_actuel_a_vendre?: unknown }) | null | undefined) =>
  !!c?.bien_actuel_a_vendre && !typesDe(c).includes('vendeur_signe');
/* V3.207 — « Revente possible après l'achat » : il possède le bien qu'il
   revendra, c'est donc aussi un Propriétaire (Alexandre : « ça n'a pas mis
   le statut propriétaire aussi ? »). Un Vendeur l'est déjà autrement (V3.137 :
   les deux listes ne se recouvrent pas) ; un Vendeur signé a vendu, la case
   ne veut plus rien dire pour lui. Rend les types à écrire, ou null si rien
   ne change. Même règle pour les fiches d'avant : outils/sql/revente-proprietaire.sql. */
export function typesAvecRevente(types: TypeContact[]): TypeContact[] | null {
  if (types.includes('proprietaire') || types.includes('vendeur') || types.includes('vendeur_signe')) return null;
  const n: TypeContact[] = [...types, 'proprietaire'];
  return TYPES_CONTACT.map(t => t.k).filter(k => n.includes(k));
}

/* Un acheteur « non filtré » : sa recherche n'a encore aucun critère. On lit
   les colonnes fusionnées sur le contact par la liste (la recherche
   d'affichage), ou celles de la recherche elle-même. */
export function sansCriteres(x: object | null | undefined): boolean {
  if (!x) return true;
  const r = x as Record<string, unknown>;
  const vide = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || v === 0;
  return ['type_bien', 'budget_min', 'budget_max', 'surface_min', 'surface_max', 'nb_pieces_min', 'nb_pieces_max', 'secteurs', 'chambres_min'].every(k => vide(r[k]));
}

/* ── Ce qui est propre à chaque type (clients.pro) ── */
/* Un confrère : ce que la délégation de mandat imprime sur lui (V3.19).
   Écrit sur sa fiche à chaque délégation finalisée, repris à la suivante. */
export type Juridique = {
  societe?: string; forme?: string; capital?: string; siege?: string; rcs?: string;
  carte?: string; cci?: string; fonds?: 'garantie' | 'aucun'; garant?: string; rcp?: string; qualite?: string;
  /* La date de la délégation d'où ça vient (AAAA-MM-JJ). */
  le?: string;
};
/* La société qu'un contact représente (V3.30) : une SCI qui vend, dont il
   est associé ou gérant. Rangée dans sa fiche (clients.pro, pas de SQL),
   avec ses associés — chacun avec son rôle, son téléphone et son e-mail. */
export type Associe = { id: string; nom: string; role: string; tel: string; email: string };
export type Structure = {
  denomination: string; forme: string; rcs: string; siege: string;
  /* Son rôle à lui : gérant, associé, directeur immobilier… */
  qualite: string; associes: Associe[];
  /* Werner : ce qu'un contact d'entreprise porte d'abord. L'enseigne (le nom
     sur la vitrine, pas toujours celui de la société), l'activité (ce qui
     décide où elle peut s'installer), le SIREN. */
  enseigne?: string; activite?: string; siren?: string;
};
export const FORMES_SOCIETE = ['SAS', 'SASU', 'SARL', 'EURL', 'SCI', 'SA', 'Entreprise individuelle', 'Association', 'Autre'];
export const ROLES_SOCIETE = ['Gérant', 'Gérante', 'Président', 'Présidente', 'Directeur général', 'Directeur immobilier', 'Associé', 'Associée', 'Mandataire'];
export function lireStructure(x: unknown): Structure | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const t = (k: string) => (typeof o[k] === 'string' ? String(o[k]) : '');
  const associes = (Array.isArray(o.associes) ? o.associes : []).map((a, i) => {
    const y = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    const u = (k: string) => (typeof y[k] === 'string' ? String(y[k]) : '');
    return { id: u('id') || `a${i}`, nom: u('nom'), role: u('role'), tel: u('tel'), email: u('email') };
  }).filter(a => a.nom || a.tel || a.email);
  const s = { denomination: t('denomination'), forme: t('forme'), rcs: t('rcs'), siege: t('siege'), qualite: t('qualite'), associes,
    ...(t('enseigne') ? { enseigne: t('enseigne') } : {}), ...(t('activite') ? { activite: t('activite') } : {}), ...(t('siren') ? { siren: t('siren') } : {}) };
  return s.denomination || s.enseigne || s.associes.length ? s : null;
}
export type InfosPro = {
  agence?: string; statutPro?: 'salarie' | 'mandataire' | 'independant' | ''; reseau?: string; adresseAgence?: string; siteWeb?: string;
  etude?: string; adresseEtude?: string; clerc?: string; clercTel?: string;
  immeuble?: string; horaires?: string; acces?: string;
  metier?: string; societe?: string;
  juridique?: Juridique;
  structure?: Structure;
};
export const lirePro = (x: unknown): InfosPro => (x && typeof x === 'object' && !Array.isArray(x) ? x as InfosPro : {});
/* La société saisie dans le formulaire (V3.31) : gardée si elle a un nom ou
   des associés, nettoyée ; sinon retirée (on avait coché « Pour une
   société » sans rien écrire). */
export function structurePropre(p: InfosPro): InfosPro {
  if (p.structure === undefined) return p;
  const st = lireStructure(p.structure);
  const { structure: _, ...reste } = p;
  void _;
  return st ? { ...reste, structure: { ...st, denomination: st.denomination.trim(), qualite: st.qualite.trim(),
    ...(st.enseigne ? { enseigne: st.enseigne.trim() } : {}), ...(st.activite ? { activite: st.activite.trim() } : {}), ...(st.siren ? { siren: st.siren.replace(/\s+/g, ' ').trim() } : {}) } } : reste;
}
export const STATUTS_PRO: { v: 'salarie' | 'mandataire' | 'independant'; l: string; aide: string }[] = [
  { v: 'salarie', l: 'Salarié d’un cabinet', aide: 'Un conseil, une agence, un réseau d’entreprise' },
  { v: 'mandataire', l: 'Agent commercial', aide: 'Sous la carte d’une agence' },
  { v: 'independant', l: 'À son compte', aide: 'Son agence, sa carte' },
];
export const METIERS = ['Expert-comptable', 'Avocat', 'Banquier', 'Architecte', 'Diagnostiqueur', 'Géomètre', 'Entreprise de travaux', 'Apporteur d’affaires', 'Syndic, gestionnaire', 'Assureur'];

/* La ligne qui dit qui c'est, sous le nom : « Mandataire IAD · Agence du
   Parc », « Étude Durand · Boulogne », « Gardien · 12 rue de Silly ». */
export function ligneContact(c: AvecTypes & { adresse?: string | null }): string {
  const t = typesDe(c);
  const p = lirePro(c.pro);
  if (t.includes('confrere')) {
    const st = p.statutPro === 'mandataire' ? `Mandataire${p.reseau ? ` ${p.reseau}` : ''}` : p.statutPro === 'independant' ? 'À son compte' : p.statutPro === 'salarie' ? 'Agent immobilier' : '';
    return [st, p.agence].filter(Boolean).join(' · ') || 'Confrère';
  }
  if (t.includes('notaire')) return [p.etude || 'Notaire', villeDe(p.adresseEtude)].filter(Boolean).join(' · ');
  if (t.includes('gardien')) return [`Gardien${p.immeuble ? ` · ${p.immeuble}` : ''}`, p.horaires].filter(Boolean).join(' · ');
  if (t.includes('partenaire')) return [p.metier || 'Partenaire', p.societe].filter(Boolean).join(' · ');
  /* Un contact qui représente une société : « Présidente · Maison Léa (boulangerie) ». */
  const st = lireStructure(p.structure);
  if (st?.denomination || st?.enseigne) {
    const nom = st.enseigne && st.denomination && st.enseigne.toLowerCase() !== st.denomination.toLowerCase() ? `${st.enseigne} (${st.denomination})` : st.enseigne || st.denomination;
    return [st.qualite, nom, st.activite].filter(Boolean).join(' · ');
  }
  return '';
}
function villeDe(adr?: string) {
  if (!adr) return '';
  const m = adr.match(/\d{5}\s+(.+)$/);
  return m ? m[1].trim() : '';
}
