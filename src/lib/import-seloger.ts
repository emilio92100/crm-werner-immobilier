/* ═══ Une annonce SeLoger Bureaux & Commerces devient une affaire ═══════════
   Werner publiait déjà sur SeLoger Bureaux & Commerces quand son CRM a été
   créé (octobre 2026) : ses 63 annonces y sont reprises une fois, avec leur
   texte, leurs montants, leurs surfaces et leurs photos. Ce fichier lit la
   fiche détaillée d'une annonce (`detailClassified`, telle que la page de
   l'annonce la porte) et en tire les réponses du formulaire d'une affaire
   (`donnees`, voir src/lib/biens-vente.ts et src/lib/affaires.ts).

   Ce qui n'est pas dans une annonce ne s'invente pas : le mandant, l'adresse
   exacte, le numéro de mandat, les honoraires quand l'annonce dit « Nous
   consulter ». La fiche les montre « à renseigner ».

   Isomorphe et sans dépendance : le serveur l'utilise (/api/biens-vente/
   import-seloger), un banc d'essai aussi. */

import type { Donnees } from '@/lib/actes';
import type { NatureAffaire } from '@/lib/affaires';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Brut = Record<string, any>;

const sansAccent = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const nombre = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(/ | /g, ' ').match(/-?\d[\d\s]*(?:[.,]\d+)?/);
  if (!m) return null;
  const x = parseFloat(m[0].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(x) && x > 0 ? x : null;
};

/* Les lignes « label : valeur » de l'annonce (caractéristiques, détail des
   montants), lues sans accent ni majuscule. */
function table(l: unknown): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of Array.isArray(l) ? l : []) {
    if (x && typeof x === 'object' && typeof (x as Brut).label === 'string') m.set(sansAccent((x as Brut).label), String((x as Brut).value ?? '').trim());
  }
  return m;
}
const chercher = (t: Map<string, string>, ...motifs: RegExp[]): string => {
  for (const [k, v] of t) if (motifs.some(r => r.test(k))) return v;
  return '';
};
const oui = (v: string) => /^(oui|yes|vrai|true|1)$/i.test(v.trim());

/* ── La nature : ce qui change de main ── */
export function natureSeLoger(c: Brut): NatureAffaire {
  const url = String(c.urlDetail || c.detailUrl || '');
  const montants: Brut[] = Array.isArray(c.financial?.montantList) ? c.financial.montantList : [];
  const titres = montants.map(m => sansAccent(String(m.tabTitle || '')));
  const rep = table(c.financial?.repartitionMontant);
  const droitAuBail = nombre(rep.get('droit au bail')) || nombre(rep.get('pas de porte'));
  if (c.idTypeTransaction === 10 || /fonds-de-commerce/.test(url) || (Number(c.businessType) > 0 && c.idTypeTransaction !== 1)) return 'fonds';
  const texte = sansAccent(`${c.description || ''}`);
  if (c.idTypeTransaction === 1 || /\/annonces\/location\//.test(url)) {
    /* Une location avec un prix de cession : un droit au bail. */
    if (droitAuBail || titres.some(t => /cession|droit au bail|pas de porte/.test(t)) || nombre(c.price?.additionalCharges?.leaseRight)) return 'cession_bail';
    return 'location';
  }
  if (titres.some(t => /cession|droit au bail/.test(t))) return 'cession_bail';
  if (/\b(murs? occupes?|vendus? loues?|loue a|bail en cours|rentabilite|investisseurs?)\b/.test(texte)) return 'murs_occupes';
  return 'murs';
}

/* ── Le type de local ── */
export function typeSeLoger(c: Brut): string {
  const t = sansAccent(`${c.typeBien || ''} ${String(c.urlDetail || c.detailUrl || '').split('/')[3] || ''}`);
  if (/bureau|coworking/.test(t)) return 'bureaux';
  if (/entrepot|local-d-activites|activite|atelier/.test(t)) return /entrepot/.test(t) && !/activite/.test(t) ? 'entrepot' : 'activite';
  if (/terrain/.test(t)) return 'terrain';
  if (/parking|box/.test(t)) return 'parking';
  if (/immeuble/.test(t)) return 'immeuble';
  if (/restaurant|bar|cafe|hotel|brasserie/.test(t)) return 'restaurant';
  const texte = sansAccent(String(c.description || '').slice(0, 400));
  if (/fonds/.test(t) && /\b(restaurant|brasserie|bar|cafe|pizzeria|snack|traiteur|creperie)\b/.test(texte)) return 'restaurant';
  return 'local';
}

/* « Paris 1er » → « Paris » (le code postal dit l'arrondissement). */
const villeSansArrondissement = (v: string) => v.replace(/\s+\d{1,2}(er|e|ème)$/i, '').trim();

/* Le montant d'une ligne du détail des montants, cherchée par son titre. */
function montant(c: Brut, ...motifs: RegExp[]): number | null {
  const l: Brut[] = Array.isArray(c.financial?.montantList) ? c.financial.montantList : [];
  for (const m of l) {
    const t = sansAccent(`${m.tabTitle || ''} ${m.wordingUnite || ''}`);
    if (motifs.some(r => r.test(t))) { const n = nombre(m.montant); if (n) return n; }
  }
  return null;
}

/* Les transports : « Les Halles (4) à 290 m · Louvre-Rivoli (1) à 380 m ». */
function stations(c: Brut): { texte: string; metroMin: number | null; rerMin: number | null; busMin: number | null } {
  const lignes: Brut[] = Array.isArray(c.transport?.lines) ? c.transport.lines : [];
  const parStation = new Map<string, { lignes: string[]; d: number }>();
  let metro: number | null = null, rer: number | null = null, bus: number | null = null;
  for (const l of lignes) {
    const nom = String(l.displayName || l.name || '');
    for (const s of Array.isArray(l.stations) ? l.stations : []) {
      const d = Number(s.distance);
      if (!s.name || !Number.isFinite(d)) continue;
      const x = parStation.get(s.name) || { lignes: [], d };
      if (nom && !x.lignes.includes(nom)) x.lignes.push(nom);
      x.d = Math.min(x.d, d);
      parStation.set(s.name, x);
      /* À pied : environ 80 m par minute. */
      const min = Math.max(1, Math.round(d / 80));
      const sorte = sansAccent(`${l.poiType} ${nom}`);
      if (/^rer|\brer\b/.test(sorte) || /^[a-e]$/i.test(nom)) rer = rer === null ? min : Math.min(rer, min);
      else if (Number(l.poiType) === 3 || /^\d+b?$/.test(nom)) metro = metro === null ? min : Math.min(metro, min);
      else bus = bus === null ? min : Math.min(bus, min);
    }
  }
  const tri = [...parStation.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 4);
  const texte = tri.map(([n, x]) => `${n}${x.lignes.length ? ` (${x.lignes.join(', ')})` : ''} à ${Math.round(x.d / 10) * 10} m`).join(' · ');
  return { texte, metroMin: metro, rerMin: rer, busMin: bus };
}

export type AffaireImportee = {
  idPortail: string; url: string; reference: string; photos: string[];
  donnees: Donnees; publieLe: string | null;
};

/* L'annonce détaillée (`detailClassified`) devient une affaire. `resume` :
   la carte de la page de résultats, pour ce que le détail ne dit pas. */
export function affaireDepuisSeLoger(c: Brut, resume: Brut = {}): AffaireImportee {
  const nature = natureSeLoger({ ...resume, ...c });
  const typeBien = typeSeLoger({ ...resume, ...c });
  const loc: Brut = c.localisation || resume.localisation || {};
  const specs = table(c.specifications);
  const rep = table(c.financial?.repartitionMontant);
  const d: Donnees = { nature, typeBien };

  /* L'adresse : la rue seulement (SeLoger ne donne pas le numéro), le code
     postal, la ville, le quartier, le point sur la carte. */
  if (loc.adresse) d.adresse = String(loc.adresse);
  if (loc.codePostal) d.cp = String(loc.codePostal);
  if (loc.nomVille) d.ville = villeSansArrondissement(String(loc.nomVille));
  if (loc.nomQuartier) d.quartier = String(loc.nomQuartier);
  const lat = Number(loc.geoLocation?.latitude), lon = Number(loc.geoLocation?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat && lon) d.gps = { lat, lon };

  /* Les surfaces. */
  const surface = nombre(c.surface) ?? nombre(resume.space);
  if (surface) d.surface = surface;
  if (resume.isDivisible || c.isDivisible) d.divisible = 'oui';

  /* Les montants, selon la nature. Un loyer est enregistré à l'année. */
  const loyerAn = montant(c, /par an\b|€\/an$/) ?? (montant(c, /par mois|€\/mois/) ? (montant(c, /par mois|€\/mois/) as number) * 12 : null)
    ?? nombre(rep.get('loyer annuel')) ?? (nombre(rep.get('loyer mensuel')) ? (nombre(rep.get('loyer mensuel')) as number) * 12 : null)
    ?? nombre(resume.price?.rent?.yearlyPrice?.value) ?? (nombre(resume.price?.rent?.monthlyPrice?.value) ? (nombre(resume.price?.rent?.monthlyPrice?.value) as number) * 12 : null);
  const prixCession = montant(c, /prix de cession|droit au bail|pas de porte/) ?? nombre(rep.get('droit au bail')) ?? nombre(rep.get('pas de porte')) ?? nombre(resume.price?.additionalCharges?.leaseRight);
  /* Un espace de coworking : un prix par poste et par mois. */
  const parPoste = montant(c, /poste/);
  if (parPoste) d.bailNote = `Prix par poste de travail : ${Math.round(parPoste).toLocaleString('fr-FR')} € par mois.`;
  const prixTotal = montant(c, /^total|prix de vente|^prix\b/) ?? nombre(resume.price?.buy?.price?.value);
  if (nature === 'location') {
    if (loyerAn) d.prix = Math.round(loyerAn);
  } else if (nature === 'cession_bail') {
    if (prixCession) d.prix = Math.round(prixCession);
    if (loyerAn) d.loyerAn = Math.round(loyerAn);
  } else if (nature === 'fonds') {
    const p = prixCession ?? prixTotal;
    if (p) d.prix = Math.round(p);
    if (loyerAn) d.loyerAn = Math.round(loyerAn);
  } else {
    if (prixTotal) d.prix = Math.round(prixTotal);
    if (loyerAn && nature === 'murs_occupes') d.loyerAn = Math.round(loyerAn);
  }
  const charges = nombre(chercher(rep, /^charges/)) ?? montant(c, /charges/);
  if (charges) d.chargesAn = Math.round(/mois/.test(chercher(rep, /^charges/)) ? charges * 12 : charges);
  const tf = nombre(chercher(rep, /taxe fonciere/));
  if (tf) d.taxeFonciere = Math.round(tf);
  const depot = chercher(rep, /depot de garantie/);
  if (depot) { const n = nombre(depot); if (n && /mois/.test(depot)) d.depotMois = n; }

  /* Les honoraires : un montant quand l'annonce le donne ; « Nous consulter »
     reste à renseigner. */
  const hono = chercher(rep, /^honoraires$/, /^honoraires (a la charge|charge)/);
  const nHono = nombre(hono);
  if (nHono) {
    if (/%/.test(hono)) { d.honoMode = 'taux'; d.taux = nHono; } else { d.honoMode = 'forfait'; d.forfait = Math.round(nHono); }
    if (/bailleur|vendeur|cedant/.test(sansAccent(hono))) d.charge = 'vendeur';
    else if (/preneur|acquereur|locataire/.test(sansAccent(hono))) d.charge = 'acquereur';
  }

  /* Le bail. */
  const bail = sansAccent(chercher(specs, /nature du bail/) || chercher(rep, /type de bail/) || '');
  if (/derogatoire|precaire|courte duree/.test(bail)) d.bailType = /precaire/.test(bail) && !/derogatoire/.test(bail) ? 'precaire' : 'derogatoire';
  else if (/3\s*\/\s*6\s*\/\s*9|commercial/.test(bail)) d.bailType = 'commercial';
  else if (/professionnel/.test(bail)) d.bailType = 'professionnel';
  else if (/civil/.test(bail)) d.bailType = 'civil';
  else if (/prestation/.test(bail)) { d.bailType = 'precaire'; d.bailNote = [d.bailNote, 'Contrat de prestation de services (coworking).'].filter(Boolean).join(' '); }
  if (/3\s*\/\s*6\s*\/\s*9/.test(bail)) d.bailDuree = 9;
  const destination = chercher(specs, /destination|activites? (autorisees?|possibles?)/);
  if (destination) { d.destination = destination; d.destinationType = /tous commerces/i.test(destination) ? (/sauf/i.test(destination) ? 'sauf' : 'tous') : 'precise'; }

  /* Les caractéristiques. */
  const equipements: string[] = [];
  if (oui(chercher(specs, /^climatisation/))) { equipements.push('clim'); d.clim = 'reversible'; }
  if (chercher(specs, /^climatisation/) && !oui(chercher(specs, /^climatisation/))) d.clim = 'aucune';
  if (oui(chercher(specs, /^pmr|acces (pmr|handicape)/))) equipements.push('pmr');
  if (oui(chercher(specs, /monte.?charge/))) d.immeuble = ['monteCharge'];
  if (oui(chercher(specs, /ascenseur/))) d.immeuble = [...((d.immeuble as string[]) || []), 'ascenseur'];
  const extraction = chercher(specs, /extraction/);
  if (extraction) d.extraction = oui(extraction) ? 'oui' : 'non';
  if (oui(chercher(specs, /cablage|cable/))) equipements.push('cablage');
  if (oui(chercher(specs, /fibre/))) equipements.push('fibre');
  if (oui(chercher(specs, /faux plafond/))) equipements.push('fauxPlafond');
  if (oui(chercher(specs, /parking/))) d.annexes = ['parking'];
  if (equipements.length) d.equipements = equipements;
  const etage = chercher(specs, /^etage/);
  if (etage !== '') { const n = /rdc|rez/i.test(etage) ? 0 : parseInt(etage, 10); if (Number.isFinite(n)) d.etage = n; }
  const dispo = chercher(specs, /disponibilite/);
  if (dispo) d.disponible = /immediate/i.test(dispo) ? 'immédiatement' : dispo;
  const lineaire = nombre(chercher(specs, /lineaire|vitrine/));
  if (lineaire) d.vitrine = lineaire;
  const hsp = nombre(chercher(specs, /hauteur/));
  if (hsp) d.hsp = hsp;
  if (/libre|vacant|immediate/i.test(dispo)) d.occupation = 'libre';
  else if (nature === 'fonds') d.occupation = 'exploite';

  /* Le DPE, s'il est donné en lettre. */
  const dpe = String(c.environmentalDiagnostic?.performanceEnergetique?.letter || c.environmentalDiagnostic?.performanceEnergetique?.value || '').toUpperCase();
  if (/^[A-G]$/.test(dpe)) { d.dpe = dpe; d.dpeStatut = 'fait'; }
  const ges = String(c.environmentalDiagnostic?.emissionGES?.letter || c.environmentalDiagnostic?.emissionGES?.value || '').toUpperCase();
  if (/^[A-G]$/.test(ges)) d.ges = ges;

  /* Le fonds : son chiffre d'affaires et son résultat, s'ils sont publiés. */
  const fin: Brut[] = Array.isArray(c.financial?.financialDataBlock?.financialDataSet) ? c.financial.financialDataBlock.financialDataSet : [];
  for (const x of fin) {
    const l = sansAccent(String(x.label || x.title || ''));
    const v = nombre(x.value ?? x.montant);
    if (!v) continue;
    if (/chiffre/.test(l) && !d.caHt) d.caHt = Math.round(v);
    else if (/resultat|benefice/.test(l) && !d.resultat) d.resultat = Math.round(v);
    else if (/ebe|excedent/.test(l) && !d.ebe) d.ebe = Math.round(v);
  }

  /* L'activité d'un fonds : le titre de l'annonce sans la surface (« Restaurant, Restauration rapide »). */
  if (nature === 'fonds') {
    const act = String(c.title?.annonceTitle || '').replace(/,?\s*\d[\d\s,.]*\s*m²\s*$/i, '').trim();
    if (act) d.activite = act.charAt(0).toUpperCase() + act.slice(1).toLowerCase();
  }

  /* L'accès. */
  const tr = stations(c);
  if (tr.texte) d.stations = tr.texte;
  if (tr.metroMin) d.proxMetro = tr.metroMin;
  if (tr.rerMin) d.proxRer = tr.rerMin;
  if (tr.busMin) d.proxBus = tr.busMin;

  /* L'annonce, telle que Werner l'a écrite. */
  const titre = String(c.title?.seoTitle || c.title?.annonceTitle || resume.cardTitle || '').trim();
  if (titre) d.annonceTitre = titre;
  const texte = String(c.description || resume.description || '').replace(/\r\n?/g, '\n').trim();
  if (texte) d.annonceTexte = texte;

  /* Le mandat : exclusif ou non ; son numéro reste à renseigner. */
  d.mandatType = c.mandat?.estExclusive || resume.mandat?.isExclusive ? 'exclusif' : 'simple';

  const photos: string[] = (Array.isArray(c.visuel?.photoUrlList) ? c.visuel.photoUrlList : Array.isArray(resume.photos) ? resume.photos : [])
    .map((p: unknown) => (typeof p === 'string' ? p : p && typeof p === 'object' ? String((p as Brut).url || (p as Brut).src || '') : ''))
    .filter((u: string) => /^https:\/\//.test(u));
  const idPortail = String(c.id || c.idAnnonce || resume.id || '');
  const url = `https://www.seloger-bureaux-commerces.com${String(c.urlDetail || resume.detailUrl || '')}`;
  const reference = String(c.title?.refAnnonce || resume.refAnnonce || '').trim();
  d.portail = { nom: 'seloger', id: idPortail, url, reference, importeLe: new Date().toISOString().slice(0, 10) };
  /* Ce que l'annonce disait de ses montants, à vérifier une fois (notes
     internes, jamais dans l'annonce) : un loyer publié « T.T.C. », un prix
     publié hors honoraires ou honoraires inclus. */
  const complements: string[] = (Array.isArray(c.financial?.montantList) ? c.financial.montantList : []).filter((m: Brut) => m.isMontantPrincipal).map((m: Brut) => String(m.libelleComplement || ''));
  const aVerifier: string[] = [];
  if (complements.some(x => /T\.T\.C/.test(x))) aVerifier.push('le loyer est publié « toutes taxes comprises » sur SeLoger : vérifier s’il est hors taxes');
  if (complements.some(x => /H\.H\./.test(x))) aVerifier.push('le prix est publié hors honoraires');
  if (complements.some(x => /H\.I\./.test(x))) aVerifier.push('le prix est publié honoraires inclus');
  if (/nous consulter/i.test(hono)) aVerifier.push('les honoraires disaient « Nous consulter »');
  d.notes = [`Reprise de l’annonce SeLoger${reference ? ` ${reference}` : ''} le ${new Date().toLocaleDateString('fr-FR')}.`, aVerifier.length ? `À vérifier : ${aVerifier.join(' ; ')}.` : ''].filter(Boolean).join(' ');
  const publieLe = String(c.dateCreation || resume.publicationDateTime || '') || null;
  return { idPortail, url, reference, photos, donnees: d, publieLe };
}
