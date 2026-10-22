'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Map as CarteML, Marker, GeoJSONSource } from 'maplibre-gl';
import { supabase } from '@/lib/supabase';
import { toutLire } from '@/lib/registre';
import FondCarte, { type MapLibre } from './FondCarte';
import {
  adresseUtile, assezPrecis, cleAdresse, composerAdresse, garderPositions, geocoder, lienItineraire,
  placerAdresses, CENTRE, type Position,
} from '@/lib/carte';
import { TYPES_CONTACT, estArchive, estPro, lirePro, reventePossible, typeDe, typesDe } from '@/lib/contacts';
import { etapeDe, nomProprio, type Donnees } from '@/lib/biens-vente';
import { NATURES, TYPES_LOCAL, estLocation } from '@/lib/affaires';
import { nomFoyer } from '@/lib/foyer';
import { signalerEchec } from '@/lib/ecritures';
import { Ic } from '@/components/documents/ApercuActe';
import AvatarContact, { type Teinte } from '@/components/contacts/AvatarContact';
import { createRoot, type Root } from 'react-dom/client';
import { Icone } from '@/components/fiche/ParcoursBien';
import Aide from '@/components/shared/Aide';
import { signalerFicheOuverte } from '@/components/layout/FichesOuvertes';
import s from './Carte.module.css';

/* ═══ La rubrique Carte du CRM (V3.26) ═════════════════════════════════════
   Les contacts et les biens, là où ils sont. Deux panneaux posés sur la
   carte, qui se replient chacun d'une flèche pour la laisser prendre tout
   l'écran : à gauche les filtres (qui voir), à droite « Dans cette zone »
   (la liste suit la carte quand on la déplace). Un repère touché ouvre sa
   carte de visite : ouvrir la fiche, l'itinéraire, appeler.

   Sur téléphone : la recherche et les filtres en haut, en une bande qui
   défile ; en bas, les fiches de la zone, qu'on fait glisser du doigt — la
   carte suit la fiche, et la liste suit la carte.

   Seuls les contacts et les biens dont l'adresse est connue y figurent : le
   ⓘ le rappelle d'une phrase (pas de liste de ceux qui manquent, V3.28).

   On y arrive aussi d'une fiche (« Voir sur la carte ») : la carte s'ouvre
   sur le contact ou le bien, sa carte de visite ouverte. */

type Genre = 'contact' | 'bien';
type Point = {
  id: string;           // « c:<id> », « c:<id>:bien » (le bien qu'il possède), « b:<id> »
  genre: Genre;
  perso?: boolean;      // le bien d'un propriétaire, pas son domicile
  ref: string;          // l'id du contact ou du bien
  cats: string[];
  couleur: string;
  fond: string;
  /* L'avatar : la teinte du statut pour un acheteur (comme dans Mes
     contacts), celle du type pour les autres. */
  teinte?: Teinte;
  titre: string;
  sous: string;
  etiquette: string;
  adresse: string;
  cle: string;
  exact?: { lat: number; lng: number };
  photo?: string | null;
  prix?: number | null;
  /* Le montant tel qu'on le lit : « 48 000 € / an » pour une location. */
  prixLib?: string;
  tel?: string | null;
  client?: Record<string, unknown>;
  /* Werner : les filtres de plus d'une affaire (« n:location », « t:bureaux ») :
     chacun doit être allumé pour qu'elle se voie. */
  filtres?: string[];
  proprio?: string;
  /* V3.156 : les vignettes du bas des fiches au téléphone — ses types pour
     un contact (Acheteur, Propriétaire…), son étape pour un bien. */
  pastilles?: { lib: string; c: string }[];
};
type Place = Point & { lat: number; lng: number };

/* Les filtres, dans l'ordre des panneaux. Les vendus et les retirés sont
   éteints d'office : ils encombreraient la carte de ce qui ne se travaille
   plus. */
/* `ic` : l'icône de la pastille (V3.28), la même que dans le menu et les
   fiches quand elle existe. */
type Cat = { k: string; lib: string; c: string; ic: string; etapes?: string[]; eteint?: boolean };
/* Le petit message du bas de la carte : une phrase, ou un titre et une phrase. */
type Msg = string | { titre?: string; texte: string };
/* V3.50 : « Vendeurs signés » a sa pastille. Avant, il n'en avait pas : il
   tombait dans « Propriétaires » (la création coche « propriétaire »), ou
   n'était sur aucune carte du tout. */
const CATS_CONTACTS: Cat[] = [
  ...(['acheteur', 'vendeur', 'vendeur_signe', 'proprietaire'] as const).map(k => ({ k, lib: typeDe(k).pluriel, c: typeDe(k).c, ic: typeDe(k).ic })),
  ...(['notaire', 'confrere', 'gardien', 'partenaire'] as const).map(k => ({ k, lib: typeDe(k).pluriel, c: typeDe(k).c, ic: typeDe(k).ic })),
];
const CATS_BIENS: Cat[] = [
  { k: 'b:a_suivre', lib: 'À suivre', c: etapeDe('a_suivre').c, ic: 'oeil', etapes: ['a_suivre'] },
  { k: 'b:estimation', lib: 'Estimations', c: etapeDe('estimation').c, ic: 'euro', etapes: ['estimation'] },
  { k: 'b:mandat', lib: 'Affaires en cours', c: etapeDe('mandat').c, ic: 'panneau', etapes: ['mandat'] },
  { k: 'b:offre', lib: 'Sous offre ou en signature', c: etapeDe('offre').c, ic: 'accord', etapes: ['offre', 'compromis'] },
  { k: 'b:suspendu', lib: 'En pause', c: etapeDe('suspendu').c, ic: 'pause', etapes: ['suspendu'] },
  /* V3.155 — Alexandre : « je ne vois pas Annonces type, ils sont dans À
     suivre ». L'étape existait depuis la V3.79, pas sa pastille : toute
     étape sans pastille tombait dans « À suivre ». */
  { k: 'b:annonce_type', lib: 'Annonces type', c: etapeDe('annonce_type').c, ic: 'megaphone', etapes: ['annonce_type'] },
  { k: 'b:vendu', lib: 'Conclues', c: etapeDe('vendu').c, ic: 'cle', etapes: ['vendu'], eteint: true },
  { k: 'b:retire', lib: 'Retirées', c: etapeDe('retire').c, ic: 'croix', etapes: ['retire'], eteint: true },
];
/* Werner : sur la carte, les affaires se filtrent aussi par nature et par
   type de local (Alexandre : « les filtres quand il est sur la carte »). */
const TEINTES_NATURE: Record<string, string> = { location: '#0f7a4f', cession_bail: '#c2621c', fonds: '#b45309', murs: '#1d4ed8', murs_occupes: '#7c3aed' };
const CATS_NATURES: Cat[] = [
  ...NATURES.map(n => ({ k: `n:${n.v}`, lib: n.court, c: TEINTES_NATURE[n.v] || '#64748b', ic: n.ic })),
  { k: 'n:', lib: 'Nature à préciser', c: '#94a3b8', ic: 'info' },
];
const CATS_TYPES: Cat[] = [
  ...TYPES_LOCAL.filter(t => t.v !== 'autre').map(t => ({ k: `t:${t.v}`, lib: t.court, c: '#475569', ic: t.ic })),
  { k: 't:', lib: 'Autre ou à préciser', c: '#94a3b8', ic: 'info' },
];
const TOUTES = [...CATS_CONTACTS, ...CATS_BIENS, ...CATS_NATURES, ...CATS_TYPES];
const actifsParDefaut = () => Object.fromEntries(TOUTES.map(c => [c.k, !c.eteint]));
/* 22 octobre 2026 — Alexandre : « rien n'est coché et je vois des chiffres sur
   la carte, je ne comprends pas ». Ce qui est coché est exactement ce qui se
   voit.
   Puis, le même soir : « quand il n'en reste qu'un et que je clique dessus,
   tout se rallume ; et Affaires en cours, on ne peut pas l'enlever ». Une
   pastille s'allume ou s'éteint toujours, même la dernière : une section
   vide vide la carte, qui le dit (« Aucune nature cochée ») avec « Tout
   rallumer ». `completer` ne sert plus qu'à l'ouverture : des filtres gardés
   d'une visite d'avant qui ne montreraient rien repartent pleins. */
function completer(a: Record<string, boolean>, nb: Record<string, number>): Record<string, boolean> {
  const n = { ...a };
  const existe = (c: Cat) => (nb[c.k] || 0) > 0;
  for (const sec of [CATS_NATURES, CATS_TYPES]) if (sec.some(existe) && !sec.some(c => existe(c) && n[c.k])) for (const c of sec) n[c.k] = true;
  const quoi = [...CATS_CONTACTS, ...CATS_BIENS];
  if (quoi.some(existe) && !quoi.some(c => existe(c) && n[c.k])) for (const c of CATS_BIENS) n[c.k] = !c.eteint;
  return n;
}

/* Les teintes du statut d'un acheteur : les mêmes que la liste des contacts. */
const TEINTE_STATUT: Record<string, Teinte> = {
  prospect: { bg: '#f5f3ff', fg: '#6d28d9', trait: '#ddd6fe' },
  actif: { bg: '#ecfdf5', fg: '#0f7a4f', trait: '#a7e8c6' },
  suspendu: { bg: '#fffbeb', fg: '#c05d12', trait: '#fde68a' },
  bien_trouve: { bg: '#eff6ff', fg: '#1d4ed8', trait: '#dedcd9' },
  perdu: { bg: '#fef2f2', fg: '#b91c1c', trait: '#fecaca' },
};
const EUR = (n?: number | null) => (n ? `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} €` : '');
const normer = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLE_RETOUR = 'carte.retour';
const rue = (a: string) => a.replace(/,?\s*\d{5}\b.*$/, '').trim() || a;
/* V3.155 — Le nom d'un bien dans les fiches du bas, au téléphone :
   « Appartement 2 p. · 36,8 m² » tient sur une ligne à côté du prix. Si
   un nom ne tient toujours pas, il ne se coupe qu'entre ses morceaux
   (jamais « 36,8 » d'un côté et « m² » de l'autre). */
const nomCourt = (t: string) => t.replace(/\b(\d+) pièces?\b/, '$1 p.').split(' · ').map(x => x.replace(/ /g, '\u00a0')).join(' · ');
/* V3.156 — « l'adresse et le code postal ; la ville, ça ferait long » :
   « 27 avenue Jean Jaurès, 92140 ». Sans code postal, l'adresse telle quelle. */
const adresseCp = (a: string) => {
  const m = /^(.*?)[,\s]*\b(\d{5})\b/.exec(a);
  if (!m) return a;
  const r = m[1].replace(/[,\s]+$/, '').trim();
  return r ? `${r}, ${m[2]}` : m[2];
};
/* Les vignettes d'un contact : ses catégories sur la carte, au singulier. */
const pastilleCat = (k: string) => (k === 'vente_possible' ? { lib: 'Revente possible', c: '#c2621c' } : { lib: typeDe(k).lib, c: typeDe(k).c });
/* Où tombe le repère choisi : un peu plus bas que le milieu sur ordinateur
   (sa carte de visite s'ouvre au-dessus), un peu plus haut sur téléphone
   (les fiches du bas le cacheraient). */
/* Téléphone : le centre utile est entre la recherche (en haut) et la bande
   des fiches (en bas), presque au milieu de l'écran depuis qu'elle est fine. */
const DECALAGE = (tel: boolean, o?: { filtres: boolean; liste: boolean }): [number, number] =>
  (tel ? [0, 8] : [Math.round(((o?.filtres ? 410 : 0) - (o?.liste ? 350 : 0)) / 2), 120]);
const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sans mémoire, tant pis */ } };

/* ── Les contacts et les biens, devenus des points à placer ── */
function pointsDesContacts(clients: Record<string, unknown>[]): { points: Point[]; sansAdresse: { c: Record<string, unknown>; cats: string[] }[] } {
  const points: Point[] = [];
  const sansAdresse: { c: Record<string, unknown>; cats: string[] }[] = [];
  for (const c of clients) {
    if (estArchive(c)) continue;
    const t = typesDe(c);
    const p = lirePro(c.pro);
    const cats: string[] = [...t];
    /* Un vendeur signé n'est rangé que là : « propriétaire » (cochée d'office
       à sa création) et « revente possible » (restée d'avant sa vente) ne
       disent plus rien de lui (V3.50). Son type « Propriétaire », s'il l'a,
       compte toujours. */
    const signe = t.includes('vendeur_signe');
    const revente = reventePossible(c);
    if (c.statut_occupation === 'proprietaire' && !signe && !cats.includes('proprietaire')) cats.push('proprietaire');
    if (revente) cats.push('vente_possible');
    const perso = typeof c.adresse === 'string' ? c.adresse : '';
    const adrPro = t.includes('notaire') ? p.adresseEtude : t.includes('confrere') ? p.adresseAgence : t.includes('gardien') ? p.immeuble : '';
    /* Un professionnel se trouve à son étude, à son agence, à son
       immeuble ; un particulier, chez lui. */
    const adresse = (estPro(t) ? (adresseUtile(adrPro) ? adrPro : perso) : (adresseUtile(perso) ? perso : adrPro || '')) || '';
    const tel = Array.isArray(c.telephones) ? String(c.telephones.find(Boolean) || '') || null : null;
    const nom = nomFoyer(c as never) || 'Contact';
    const principal = TYPES_CONTACT.find(x => cats.includes(x.k)) || typeDe('acheteur');
    const teinte: Teinte = t.includes('acheteur')
      ? TEINTE_STATUT[String(c.statut || 'actif')] || TEINTE_STATUT.actif
      : { bg: principal.fond, fg: principal.c };
    /* Son bien actuel, ailleurs : pas pour un vendeur signé (c'est celui qu'il
       a vendu), sauf s'il est aussi « Propriétaire » (V3.50). */
    const bienAilleurs = (!signe || t.includes('proprietaire')) && typeof c.bien_actuel_adresse === 'string' && adresseUtile(c.bien_actuel_adresse)
      && cleAdresse(c.bien_actuel_adresse) !== cleAdresse(adresse) ? c.bien_actuel_adresse : '';
    let catsPrincipal = cats;
    if (bienAilleurs) {
      const duBien = cats.filter(k => k === 'proprietaire' || k === 'vente_possible');
      if (!duBien.length) duBien.push('proprietaire');
      points.push({
        id: `c:${c.id}:bien`, genre: 'contact', perso: true, ref: String(c.id), cats: duBien,
        couleur: revente ? '#c2621c' : typeDe('proprietaire').c, fond: revente ? '#fbf0e9' : typeDe('proprietaire').fond,
        titre: nom, sous: `${revente ? 'Son bien, à revendre' : 'Son bien'} · ${rue(bienAilleurs)}`,
        etiquette: revente ? 'Revente possible' : 'Son bien', adresse: bienAilleurs, cle: cleAdresse(bienAilleurs), tel, client: c,
        pastilles: [{ lib: 'Son bien', c: typeDe('proprietaire').c }, ...(revente ? [pastilleCat('vente_possible')] : [])],
      });
      catsPrincipal = cats.filter(k => k !== 'vente_possible' && (k !== 'proprietaire' || t.includes('proprietaire')));
      if (!catsPrincipal.length) catsPrincipal = ['proprietaire'];
    }
    if (!adresseUtile(adresse)) { if (!bienAilleurs) sansAdresse.push({ c, cats: catsPrincipal }); continue; }
    points.push({
      id: `c:${c.id}`, genre: 'contact', ref: String(c.id), cats: catsPrincipal,
      couleur: principal.c, fond: principal.fond, teinte, titre: nom,
      sous: `${t.map(k => typeDe(k).lib).join(', ')} · ${rue(adresse)}`,
      etiquette: t.map(k => typeDe(k).lib).join(' · '), adresse, cle: cleAdresse(adresse), tel, client: c,
      pastilles: catsPrincipal.map(pastilleCat),
    });
  }
  return { points, sansAdresse };
}

type LigneBien = {
  id: string; etape: string; archive: boolean; client_id: string | null; titre: string | null;
  adresse: string | null; code_postal: string | null; ville: string | null; prix: number | null; photo: string | null;
  gps: { lat?: number; lon?: number } | null; proprietaires: unknown; qui: unknown; sciNom: unknown;
  nature?: string | null; typeLocal?: string | null;
};
/* Les filtres de plus d'une affaire : sa nature, son type de local. */
const filtresDe = (b: LigneBien) => [
  `n:${NATURES.some(n => n.v === b.nature) ? b.nature : ''}`,
  `t:${TYPES_LOCAL.some(t => t.v === b.typeLocal && t.v !== 'autre') ? b.typeLocal : ''}`,
];
function pointsDesBiens(biens: LigneBien[], clients: Map<string, Record<string, unknown>>): { points: Point[]; sansAdresse: { b: LigneBien; cats: string[] }[] } {
  const points: Point[] = [];
  const sansAdresse: { b: LigneBien; cats: string[] }[] = [];
  for (const b of biens) {
    if (b.archive) continue;
    const e = etapeDe(b.etape);
    const cat = CATS_BIENS.find(c => c.etapes?.includes(e.k))?.k || 'b:a_suivre';
    const adresse = composerAdresse(b.adresse, b.code_postal, b.ville);
    const exact = b.gps && typeof b.gps.lat === 'number' && typeof b.gps.lon === 'number' ? { lat: b.gps.lat, lng: b.gps.lon } : undefined;
    if (!exact && !adresseUtile(b.adresse)) { sansAdresse.push({ b, cats: [cat, ...filtresDe(b)] }); continue; }
    const cl = b.client_id ? clients.get(b.client_id) : undefined;
    const proprio = (cl ? nomFoyer(cl as never) : '') || nomProprio({ proprietaires: b.proprietaires, qui: b.qui, sciNom: b.sciNom } as Donnees);
    points.push({
      id: `b:${b.id}`, genre: 'bien', ref: b.id, cats: [cat], filtres: filtresDe(b), couleur: e.c, fond: `${e.c}18`,
      titre: b.titre || 'Affaire', sous: `${[NATURES.find(n => n.v === b.nature)?.court, e.court].filter(Boolean).join(' · ')}${b.adresse ? ` · ${rue(b.adresse)}` : ''}`, etiquette: e.lib,
      adresse, cle: cleAdresse(adresse), exact, photo: b.photo, prix: b.prix, proprio,
      prixLib: b.prix ? `${EUR(b.prix)}${estLocation({ nature: b.nature }) ? ' / an' : ''}` : '',
      tel: cl && Array.isArray(cl.telephones) ? String(cl.telephones.find(Boolean) || '') || null : null,
      pastilles: [{ lib: e.lib, c: e.c }],
    });
  }
  return { points, sansAdresse };
}

/* ── Les repères, en DOM : MapLibre les pose et les déplace lui-même ── */
const SVG_MAISON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>';
const SVG_CLE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3.5"/><path d="M16.5 7l3 3"/></svg>';
/* Les avatars dessinés dans les repères, à démonter quand le repère part. */
const RACINES = new WeakMap<HTMLElement, Root>();
function retirerRepere(r: Marker) {
  const b = r.getElement().firstElementChild as HTMLElement | null;
  const racine = b ? RACINES.get(b) : undefined;
  r.remove();
  if (racine) setTimeout(() => racine.unmount(), 0);
}
/* Le repère lui-même est un bouton posé DANS une enveloppe : MapLibre place
   l'enveloppe en la déplaçant (transform), le bouton peut grossir au survol
   sans jamais la faire sauter. */
function envelopper(b: HTMLElement, id?: string): HTMLElement {
  const env = document.createElement('div');
  env.className = s.env;
  if (id) env.dataset.id = id;
  env.appendChild(b);
  return env;
}
function elementPoint(p: Point): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `${s.rep} ${p.genre === 'bien' ? s.repBien : p.perso ? s.repPerso : s.repContact}`;
  el.style.setProperty('--c', p.couleur);
  el.setAttribute('aria-label', `${p.titre} — ${p.sous}`);
  if (p.genre === 'bien') el.innerHTML = `<span>${SVG_MAISON}</span>`;
  else if (p.perso) el.innerHTML = `<span>${SVG_CLE}</span>`;
  else {
    /* Le même petit personnage que dans Mes contacts (une mallette pour un
       professionnel, deux pour un couple), dessiné par React dans le repère. */
    const t = p.teinte || { bg: p.fond, fg: p.couleur };
    el.style.setProperty('--c', t.fg);
    const racine = createRoot(el);
    racine.render(<AvatarContact c={(p.client || {}) as never} teinte={t} taille={33} />);
    RACINES.set(el, racine);
  }
  return envelopper(el, p.id);
}
function elementAmas(n: number): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = s.amas;
  const d = n < 10 ? 34 : n < 30 ? 40 : n < 100 ? 48 : 56;
  el.style.width = el.style.height = `${d}px`;
  el.setAttribute('aria-label', `${n} repères : zoomer`);
  const b = document.createElement('b');
  b.textContent = String(n);
  el.appendChild(b);
  return envelopper(el);
}

export default function PageCarte({ onNavigate, onMenu }: {
  onNavigate: (page: string, data?: unknown) => void;
  /* Téléphone : la barre du haut du CRM est masquée sur la carte, le menu
     s'ouvre depuis la recherche de la carte (V3.28). */
  onMenu?: () => void;
}) {
  const [tel, setTel] = useState(false);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [sansAdresse, setSansAdresse] = useState<{ id: string; nom: string; genre: Genre; raison: string; cats: string[] }[]>([]);
  const positions = useRef(new Map<string, Position | null>());
  const [posV, setPosV] = useState(0);
  const [progres, setProgres] = useState<{ fait: number; total: number } | null>(null);
  const [tableAbsente, setTableAbsente] = useState(false);
  const [actifs, setActifs] = useState<Record<string, boolean>>(actifsParDefaut);
  const [recherche, setRecherche] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [zone, setZone] = useState<string[]>([]);
  const [ouverts, setOuverts] = useState({ filtres: true, liste: true });
  /* « Qui est sur la carte ? » : une phrase derrière le ⓘ, au téléphone
     comme sur ordinateur (V3.28). */
  /* Téléphone (V3.28) : les filtres rangés sous deux boutons, « Contacts » et
     « Biens » ; un seul panneau ouvert à la fois. */
  const [pliTel, setPliTel] = useState<null | 'contacts' | 'biens'>(null);
  /* Le petit message du bas : une phrase, ou un titre et une phrase. */
  const [message, setMessage] = useState<Msg | null>(null);
  const [cartePrete, setCartePrete] = useState(false);
  /* Toutes les adresses ont été cherchées (ou lues dans la mémoire). */
  const [fini, setFini] = useState(false);

  const carte = useRef<CarteML | null>(null);
  const ml = useRef<MapLibre | null>(null);
  const reperes = useRef(new Map<string, Marker>());
  const fiche = useRef<HTMLDivElement>(null);
  const carrousel = useRef<HTMLDivElement>(null);
  const parCarrousel = useRef(false);
  const focus = useRef<string | null>(null);
  const cadre = useRef(false);
  /* Le repère à rallumer au retour d'une fiche (voir quitterPour). */
  const retourSel = useRef<string | null>(null);
  const monPoint = useRef<Marker | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  /* La carte prend exactement la hauteur qui reste : sous la barre du haut,
     au-dessus des onglets du téléphone et de la bande des fiches ouvertes
     quand elle est là. Rien ne défile, c'est la carte qu'on déplace. */
  useLayoutEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const main = el.closest('main') as HTMLElement | null;
    const maj = () => {
      const telephone = window.matchMedia('(max-width: 900px)').matches;
      const defile = telephone ? (main?.parentElement as HTMLElement | null) : main;
      /* V3.217 — Alexandre, au téléphone : « dès que je sélectionne un filtre,
         la carte est coupée en deux, on ne voit plus rien, il faut rafraîchir ».
         La hauteur se calculait sur `window.innerHeight`, qui sur un téléphone
         est la partie VISIBLE de l'écran : elle rapetisse un instant (clavier,
         zoom, barre d'adresse), et si la carte se remesurait à ce moment-là, elle
         restait à son plancher de 360 px. On mesure maintenant la zone qui
         contient la carte elle-même (sa vraie hauteur, 100dvh), et la position
         de la carte DANS cette zone : ni le clavier, ni un défilement de la page
         ne la faussent plus. */
      if (telephone && defile) {
        if (main && main.scrollTop) main.scrollTop = 0;
        const haut = el.getBoundingClientRect().top - defile.getBoundingClientRect().top + defile.scrollTop;
        const pb = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
        el.style.height = `${Math.max(360, Math.round(defile.clientHeight - haut - pb))}px`;
        return;
      }
      const haut = el.getBoundingClientRect().top + (defile?.scrollTop || 0);
      if (telephone || !main) {
        el.style.height = `${Math.max(360, Math.round(window.innerHeight - haut))}px`;
        return;
      }
      /* Ordinateur (V3.28) : jusqu'au bas de la zone qui défile, et non de la
         fenêtre — la barre des fiches ouvertes, posée dessous, mangeait le
         bas de la carte et son bouton « − ». */
      el.style.height = `${Math.max(360, Math.round(main.getBoundingClientRect().bottom - haut))}px`;
    };
    maj();
    const t = setTimeout(maj, 480); // après l'entrée de l'écran, qui le fait glisser
    /* Et à la fin de ce glissement, quelle que soit sa durée : mesurée pendant,
       la carte dépassait du bas de l'écran de la hauteur du décalage. */
    const finGlissement = (e: AnimationEvent) => { if ((e.target as Element)?.contains?.(el)) maj(); };
    document.addEventListener('animationend', finGlissement);
    window.addEventListener('resize', maj);
    const mo = main ? new MutationObserver(maj) : null;
    if (main) mo?.observe(main, { attributes: true, attributeFilter: ['class'] });
    /* La barre des fiches ouvertes apparaît, disparaît : la zone change de hauteur. */
    const ro = main ? new ResizeObserver(maj) : null;
    if (main) ro?.observe(main);
    /* Au téléphone, la zone qui contient la carte (sa hauteur suit l'écran). */
    if (main?.parentElement) ro?.observe(main.parentElement);
    return () => { clearTimeout(t); document.removeEventListener('animationend', finGlissement); window.removeEventListener('resize', maj); mo?.disconnect(); ro?.disconnect(); };
  }, [tel]);

  /* Téléphone ou ordinateur ; les filtres et les panneaux d'une visite à
     l'autre ; le contact ou le bien demandé par une fiche. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const maj = () => setTel(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    try {
      const f = JSON.parse(lire('carte.filtres') || 'null');
      if (f && typeof f === 'object') setActifs(a => ({ ...a, ...f }));
      const o = JSON.parse(lire('carte.panneaux') || 'null');
      if (o && typeof o === 'object') setOuverts(x => ({ ...x, ...o }));
    } catch { /* mémoire illisible : les réglages d'origine */ }
    focus.current = new URLSearchParams(window.location.search).get('focus');
    /* De retour d'une fiche ouverte depuis la carte (le bloc « Carte » de la
       barre du bas) : le repère choisi et la recherche d'alors. La vue, elle,
       est déjà dans carte.vue. */
    try {
      const r = JSON.parse(sessionStorage.getItem(CLE_RETOUR) || 'null');
      sessionStorage.removeItem(CLE_RETOUR);
      if (r && typeof r === 'object' && !focus.current) {
        if (typeof r.sel === 'string') retourSel.current = r.sel;
        if (typeof r.recherche === 'string') setRecherche(r.recherche);
      }
    } catch { /* sans mémoire : la carte s'ouvre sur sa dernière vue */ }
    return () => mq.removeEventListener('change', maj);
  }, []);
  const basculerCat = (k: string) => setActifs(a => { const n = { ...a, [k]: !a[k] }; ecrire('carte.filtres', JSON.stringify(n)); return n; });
  const toutSection = (cats: Cat[], v: boolean) => setActifs(a => {
    const n = { ...a, ...Object.fromEntries(cats.map(c => [c.k, v])) };
    ecrire('carte.filtres', JSON.stringify(n));
    return n;
  });
  const toutRallumer = () => { const n = actifsParDefaut(); setActifs(n); ecrire('carte.filtres', JSON.stringify(n)); };
  const basculerPanneau = (k: 'filtres' | 'liste') => setOuverts(o => { const n = { ...o, [k]: !o[k] }; ecrire('carte.panneaux', JSON.stringify(n)); return n; });

  /* ── Les données, puis leurs positions ── */
  useEffect(() => {
    let vivant = true;
    const arret = new AbortController();
    (async () => {
      const [cl, bv] = await Promise.all([
        /* Par pages de 1 000 (V3.43). */
        toutLire<Record<string, unknown>>((de, a) => supabase.from('clients').select('*').order('id').range(de, a)).then(r => ({ data: r.data, error: r.erreur ? { message: r.erreur } : null })),
        supabase.from('biens_vente').select('id, etape, archive, client_id, titre, adresse, code_postal, ville, prix, photo, gps:donnees->gps, proprietaires:donnees->proprietaires, qui:donnees->qui, sciNom:donnees->sciNom, nature:donnees->>nature, typeLocal:donnees->>typeBien'),
      ]);
      if (!vivant) return;
      if (cl.error) { setErreur(`Les contacts n’ont pas pu être lus : ${cl.error.message}`); setCharge(false); return; }
      const clients = (cl.data || []) as Record<string, unknown>[];
      const parId = new Map(clients.map(c => [String(c.id), c]));
      const pc = pointsDesContacts(clients);
      /* Sans la table des biens en vente (SQL pas encore passé), la carte
         montre les contacts, sans rien dire de plus. */
      const pb = bv.error ? { points: [], sansAdresse: [] } : pointsDesBiens((bv.data || []) as unknown as LigneBien[], parId);
      const tous = [...pb.points, ...pc.points];
      setPoints(tous);
      setSansAdresse([
        ...pc.sansAdresse.map(({ c, cats }) => ({ id: `c:${c.id}`, nom: nomFoyer(c as never) || 'Contact', genre: 'contact' as Genre, raison: 'pas d’adresse', cats })),
        ...pb.sansAdresse.map(({ b, cats }) => ({ id: `b:${b.id}`, nom: b.titre || 'Affaire', genre: 'bien' as Genre, raison: 'pas d’adresse', cats })),
      ]);
      setCharge(false);
      /* Rafraîchir l'écran par vagues, pas à chaque adresse trouvée. */
      let minuterie: ReturnType<typeof setTimeout> | null = null;
      const bientot = () => { if (!minuterie) minuterie = setTimeout(() => { minuterie = null; if (vivant) setPosV(v => v + 1); }, 250); };
      const res = await placerAdresses(supabase, tous.filter(p => !p.exact).map(p => p.adresse), {
        signal: arret.signal,
        surPosition: (k, p) => { positions.current.set(k, p); bientot(); },
        surMemoireLue: n => { if (vivant) { setPosV(v => v + 1); if (n) setProgres({ fait: 0, total: n }); } },
        surProgres: (fait, total) => { if (vivant && total) setProgres(fait >= total ? null : { fait, total }); },
      });
      if (!vivant) return;
      setProgres(null);
      setPosV(v => v + 1);
      setFini(true);
      setTableAbsente(res.tableAbsente);
      if (!res.tableAbsente && res.aEcrire.length) {
        const e = await garderPositions(supabase, res.aEcrire);
        if (e) signalerEchec('La position des adresses', e);
      }
    })();
    return () => { vivant = false; arret.abort(); };
  }, []);

  /* Les points placés : l'adresse trouvée au numéro, à la rue, ou au
     lieu-dit. La ville seule ne place rien. */
  const places = useMemo<Place[]>(() => {
    const l: Place[] = [];
    for (const p of points) {
      if (p.exact) { l.push({ ...p, ...p.exact }); continue; }
      const pos = positions.current.get(p.cle);
      if (assezPrecis(pos)) l.push({ ...p, lat: pos.lat, lng: pos.lng });
    }
    /* Plusieurs repères à la même adresse (un gardien et un habitant de
       l'immeuble, un bien et son propriétaire) : on les écarte en petite
       couronne, sinon un seul se verrait. */
    const memes = new Map<string, Place[]>();
    for (const p of l) { const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`; memes.set(k, [...(memes.get(k) || []), p]); }
    for (const g of memes.values()) {
      if (g.length < 2) continue;
      g.forEach((p, i) => {
        const a = (i / g.length) * Math.PI * 2 - Math.PI / 2;
        p.lat += (Math.sin(a) * 18) / 111_320;
        p.lng += (Math.cos(a) * 18) / (111_320 * Math.cos((p.lat * Math.PI) / 180));
      });
    }
    return l;
    // posV : les positions arrivent par vagues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, posV]);
  const parId = useMemo(() => new Map(places.map(p => [p.id, p])), [places]);

  const q = normer(recherche.trim());
  const nbCat = useMemo(() => {
    const n: Record<string, number> = {};
    for (const p of places) for (const k of [...p.cats, ...(p.filtres || [])]) n[k] = (n[k] || 0) + 1;
    return n;
  }, [places]);
  const visibles = useMemo(() => places.filter(p => p.cats.some(k => actifs[k]) && (p.filtres || []).every(k => actifs[k] !== false)
    && (!q || normer(`${p.titre} ${p.sous} ${p.adresse} ${p.etiquette}`).includes(q))), [places, actifs, q]);
  /* Plus rien à l'écran à cause des filtres : pourquoi, en une phrase. */
  const pourquoiVide = useMemo((): { titre: string; texte: string } | null => {
    if (q || visibles.length || !places.length) return null;
    const existe = (cats: Cat[]) => cats.some(c => nbCat[c.k]);
    const on = (cats: Cat[]) => cats.some(c => nbCat[c.k] && actifs[c.k]);
    if (!on([...CATS_CONTACTS, ...CATS_BIENS])) return {
      titre: 'Rien de coché',
      texte: existe(CATS_CONTACTS) ? 'Coche des contacts ou des affaires pour les voir sur la carte.' : 'Coche « Affaires en cours » pour revoir les affaires sur la carte.',
    };
    if (existe(CATS_NATURES) && !on(CATS_NATURES)) return { titre: 'Aucune nature cochée', texte: 'Coche au moins une nature (à louer, droit au bail…) pour voir les affaires.' };
    if (existe(CATS_TYPES) && !on(CATS_TYPES)) return { titre: 'Aucun type de local coché', texte: 'Coche au moins un type de local (bureaux, local commercial…) pour voir les affaires.' };
    return { titre: 'Aucune affaire pour ces filtres', texte: 'Aucune affaire ne réunit ce qui est coché à la fois dans la nature et dans le type de local.' };
  }, [q, visibles.length, places.length, nbCat, actifs]);
  /* Ce que le CRM contient, placé ou non (V3.28) : un filtre s'affiche dès
     que sa catégorie existe, même si aucun n'a d'adresse — il montre alors
     « 0 », en pâle, et un appui dit pourquoi. Avant, les mandats sans
     adresse faisaient disparaître toute la section « Biens ». */
  const nbCrm = useMemo(() => {
    const n: Record<string, number> = {};
    for (const p of points) for (const k of [...p.cats, ...(p.filtres || [])]) n[k] = (n[k] || 0) + 1;
    for (const x of sansAdresse) for (const k of x.cats) n[k] = (n[k] || 0) + 1;
    return n;
  }, [points, sansAdresse]);
  /* Les filtres gardés d'une visite d'avant : une section vide se recoche,
     une fois, à l'ouverture (jamais au clic). */
  const normalise = useRef(false);
  useEffect(() => {
    if (!Object.keys(nbCrm).length || normalise.current) return;
    normalise.current = true;
    setActifs(a => {
      const n = completer(a, nbCrm);
      if (Object.keys(n).every(k => n[k] === a[k])) return a;
      ecrire('carte.filtres', JSON.stringify(n));
      return n;
    });
  }, [nbCrm]);

  /* ── La carte ── */
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;
  const parIdRef = useRef(parId);
  parIdRef.current = parId;
  const telRef = useRef(tel);
  telRef.current = tel;
  const selRef = useRef(sel);
  selRef.current = sel;
  const ouvertsRef = useRef(ouverts);
  ouvertsRef.current = ouverts;

  const calculerZone = useCallback(() => {
    const m = carte.current;
    if (!m) return;
    const b = m.getBounds();
    const l = visiblesRef.current.filter(p => b.contains([p.lng, p.lat]));
    l.sort((a, z) => (a.genre === z.genre ? a.titre.localeCompare(z.titre, 'fr') : a.genre === 'bien' ? -1 : 1));
    setZone(l.map(p => p.id));
  }, []);

  const choisir = useCallback((id: string | null, o: { voler?: boolean; zoom?: number } = {}) => {
    setSel(id);
    const m = carte.current;
    const p = id ? parIdRef.current.get(id) : null;
    if (!m || !p || !o.voler) return;
    const z = Math.max(m.getZoom(), o.zoom ?? 15.6);
    m.flyTo({ center: [p.lng, p.lat], zoom: z, duration: 1000, essential: true, offset: DECALAGE(telRef.current, ouvertsRef.current) });
  }, []);

  const majReperes = useCallback(() => {
    const m = carte.current, lib = ml.current;
    if (!m || !lib || !m.getSource('pts') || !m.isSourceLoaded('pts')) return;
    const vus = new Set<string>();
    for (const f of m.querySourceFeatures('pts')) {
      const pr = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
      const cle = pr.cluster ? `k${pr.cluster_id}` : String(pr.id);
      if (vus.has(cle)) continue;
      vus.add(cle);
      if (reperes.current.has(cle)) continue;
      const xy = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      let el: HTMLElement;
      if (pr.cluster) {
        el = elementAmas(pr.point_count || 0);
        const idAmas = pr.cluster_id!;
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          (m.getSource('pts') as GeoJSONSource).getClusterExpansionZoom(idAmas)
            .then(z => m.easeTo({ center: xy, zoom: Math.min(z + 0.4, 17), duration: 650 }))
            .catch(() => m.easeTo({ center: xy, zoom: m.getZoom() + 2, duration: 650 }));
        });
      } else {
        const p = parIdRef.current.get(String(pr.id));
        if (!p) continue;
        el = elementPoint(p);
        if (p.id === selRef.current) { el.firstElementChild?.classList.add(s.repSel); el.style.zIndex = '5'; }
        el.addEventListener('click', ev => { ev.stopPropagation(); choisir(p.id); });
        el.addEventListener('mouseenter', () => setSurvol(p.id));
        el.addEventListener('mouseleave', () => setSurvol(x => (x === p.id ? null : x)));
      }
      const r = new lib.Marker({ element: el, anchor: pr.cluster ? 'center' : el.firstElementChild?.classList.contains(s.repBien) ? 'bottom' : 'center' })
        .setLngLat(xy).addTo(m);
      reperes.current.set(cle, r);
    }
    for (const [k, r] of reperes.current) if (!vus.has(k)) { retirerRepere(r); reperes.current.delete(k); }
  }, [choisir]);

  const surPrete = useCallback((m: CarteML, lib: MapLibre) => {
    carte.current = m;
    ml.current = lib;
    m.addSource('pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 46, clusterMaxZoom: 14 });
    /* Une couche invisible : MapLibre ne calcule les amas que d'une source
       affichée. Les repères eux-mêmes sont du HTML, posés par-dessus. */
    m.addLayer({ id: 'pts-ancre', type: 'circle', source: 'pts', paint: { 'circle-radius': 1, 'circle-opacity': 0 } });
    let attente = 0;
    const planifier = () => { if (!attente) attente = requestAnimationFrame(() => { attente = 0; majReperes(); }); };
    m.on('render', planifier);
    m.on('moveend', () => {
      if (parCarrousel.current) { parCarrousel.current = false; return; }
      calculerZone();
      /* V3.219 — Pas avant le premier cadrage. La carte naît sur sa vue par
         défaut, et le moindre `resize` (la hauteur qui se règle à l'arrivée)
         déclenche un `moveend` : la vue par défaut écrasait alors celle qu'on
         avait laissée, et le retour depuis une fiche ne retrouvait ni
         l'endroit ni le zoom. */
      if (!cadre.current) return;
      const c = m.getCenter();
      ecrire('carte.vue', JSON.stringify({ c: [c.lng, c.lat], z: m.getZoom() }));
    });
    m.on('click', () => { setSel(null); setPliTel(null); });
    setCartePrete(true);
    return () => { cancelAnimationFrame(attente); for (const r of reperes.current.values()) retirerRepere(r); reperes.current.clear(); carte.current = null; };
  }, [majReperes, calculerZone]);

  /* Les repères suivent les filtres, la recherche et les positions. */
  useEffect(() => {
    const m = carte.current;
    const src = m?.getSource('pts') as GeoJSONSource | undefined;
    if (!m || !src) return;
    /* Les amas se recalculent : on retire les leurs ; les repères des
       points restent en place (pas de clignement quand une adresse arrive). */
    for (const [k, r] of reperes.current) if (k.startsWith('k')) { r.remove(); reperes.current.delete(k); }
    src.setData({
      type: 'FeatureCollection',
      features: visibles.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
    });
    calculerZone();
  }, [visibles, cartePrete, calculerZone]);

  /* Le premier cadrage : la fiche demandée, sinon la dernière vue, sinon
     tout ce qui est placé. Une seule fois. */
  useEffect(() => {
    const m = carte.current;
    if (!m || cadre.current || charge) return;
    const f = focus.current;
    if (f) {
      const p = parId.get(f) || parId.get(`${f}:bien`);
      if (p) {
        cadre.current = true;
        m.jumpTo({ center: [p.lng, p.lat], zoom: 13.2 });
        setTimeout(() => {
          /* V3.50 : « Voir sur la carte » sur un bien vendu (éteint d'office)
             ou une catégorie qu'on a éteinte : on l'allume, pour cette
             visite seulement, sinon la carte volait vers un repère absent. */
          setActifs(a => (p.cats.some(k => a[k]) ? a : { ...a, [p.cats[0]]: true }));
          m.flyTo({ center: [p.lng, p.lat], zoom: 16.2, duration: 1500, essential: true, offset: DECALAGE(tel, ouverts) });
          m.once('moveend', () => setSel(p.id));
        }, 250);
        return;
      }
      if (!fini) return; // les positions arrivent encore
      cadre.current = true;
      setMessage('Cette fiche n’a pas d’adresse que la carte sache placer : complète-la pour la voir ici.');
      return;
    }
    const v = (() => { try { return JSON.parse(lire('carte.vue') || 'null'); } catch { return null; } })();
    if (v && Array.isArray(v.c) && typeof v.z === 'number') { cadre.current = true; m.jumpTo({ center: v.c, zoom: v.z }); calculerZone(); return; }
    /* Tout voir : une fois toutes les adresses placées, pas sur les trois
       premières arrivées. */
    if (!fini || !places.length || !ml.current) return;
    cadre.current = true;
    const b = new ml.current.LngLatBounds();
    for (const p of places) b.extend([p.lng, p.lat]);
    m.fitBounds(b, { padding: tel ? { top: 130, bottom: 110, left: 44, right: 44 } : { top: 80, bottom: 60, left: ouverts.filtres ? 420 : 80, right: ouverts.liste ? 360 : 80 }, maxZoom: 15, duration: 900 });
  }, [cartePrete, charge, places, parId, fini, tel, ouverts, calculerZone]);

  /* Au retour d'une fiche : le repère d'où l'on était parti se rallume, dès
     que sa position est connue (la mémoire des adresses la donne vite). */
  useEffect(() => {
    const id = retourSel.current;
    if (!id || !cadre.current) return;
    if (parId.has(id)) { retourSel.current = null; setSel(id); }
    else if (fini) retourSel.current = null;
  }, [parId, fini, cartePrete, charge]);

  /* Le repère choisi et celui qu'on survole s'allument. */
  useEffect(() => {
    for (const r of reperes.current.values()) {
      const env = r.getElement();
      const id = env.dataset.id;
      const b = env.firstElementChild;
      if (!id || !b) continue;
      b.classList.toggle(s.repSel, id === sel);
      b.classList.toggle(s.repSurvol, id === survol && id !== sel);
      env.style.zIndex = id === sel ? '5' : id === survol ? '4' : '';
    }
  });

  /* La carte de visite suit son repère quand la carte bouge (ordinateur). */
  useEffect(() => {
    const m = carte.current;
    const p = sel ? parId.get(sel) : null;
    if (!m || !p || tel) return;
    const placer = () => {
      const el = fiche.current;
      if (!el) return;
      const xy = m.project([p.lng, p.lat]);
      const haut = el.offsetHeight + 40;
      el.style.left = `${xy.x}px`;
      el.style.top = `${xy.y}px`;
      el.classList.toggle(s.ficheDessous, xy.y < haut);
    };
    placer();
    m.on('move', placer);
    return () => { m.off('move', placer); };
  }, [sel, parId, tel]);

  /* Téléphone : la fiche choisie vient au milieu de la bande du bas. */
  useEffect(() => {
    if (!tel || !sel) return;
    const c = carrousel.current;
    const el = c?.querySelector<HTMLElement>(`[data-id="${CSS.escape(sel)}"]`);
    /* V3.217 : on fait glisser la bande seulement. `scrollIntoView` faisait
       aussi défiler, de haut en bas, tout ce qui contient la carte (même ce
       qui ne défile pas à la main) : la page pouvait se décaler sous le doigt. */
    if (c && el) {
      const r = el.getBoundingClientRect(), rc = c.getBoundingClientRect();
      defileParCode.current = Date.now();
      c.scrollTo({ left: c.scrollLeft + r.left - rc.left - (c.clientWidth - r.width) / 2, behavior: 'smooth' });
    }
  }, [sel, tel, zone]);

  /* Téléphone : on fait glisser les fiches, la carte suit. */
  const finGlisse = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* V3.219 — La bande que le CRM fait glisser lui-même (pour amener la fiche
     choisie au milieu) ne choisit pas une autre fiche à l'arrivée : seul le
     doigt le fait. Sinon, au retour d'une fiche, la bande se remettait en
     place, s'arrêtait à côté, et la carte partait vers un autre repère. */
  const defileParCode = useRef(0);
  const toucheBande = useRef(0);
  const surGlisse = () => {
    if (finGlisse.current) clearTimeout(finGlisse.current);
    finGlisse.current = setTimeout(() => {
      const c = carrousel.current, m = carte.current;
      if (!c || !m) return;
      if (defileParCode.current > toucheBande.current && Date.now() - defileParCode.current < 1500) return;
      const milieu = c.scrollLeft + c.clientWidth / 2;
      let meilleur: HTMLElement | null = null, d = Infinity;
      for (const el of Array.from(c.querySelectorAll<HTMLElement>('[data-id]'))) {
        const x = el.offsetLeft + el.offsetWidth / 2;
        if (Math.abs(x - milieu) < d) { d = Math.abs(x - milieu); meilleur = el; }
      }
      const id = meilleur?.dataset.id;
      if (!id || id === sel) return;
      const p = parId.get(id);
      setSel(id);
      if (p) { parCarrousel.current = true; m.easeTo({ center: [p.lng, p.lat], duration: 650, offset: DECALAGE(true) }); }
    }, 140);
  };

  /* Autour de moi : là où est le téléphone (ou l'ordinateur). */
  const autourDeMoi = () => {
    if (!navigator.geolocation) { setMessage('Ce navigateur ne sait pas donner ta position.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const m = carte.current, lib = ml.current;
      if (!m || !lib) return;
      const xy: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      if (!monPoint.current) {
        const el = document.createElement('div');
        el.className = s.moi;
        monPoint.current = new lib.Marker({ element: el }).setLngLat(xy).addTo(m);
      } else monPoint.current.setLngLat(xy);
      m.flyTo({ center: xy, zoom: 15.5, duration: 1100 });
    }, () => setMessage('La position n’a pas été donnée : autorise-la dans le navigateur pour t’en servir.'), { enableHighAccuracy: true, timeout: 10000 });
  };
  const toutVoir = () => {
    const m = carte.current, lib = ml.current;
    if (!m || !lib || !visibles.length) return;
    const b = new lib.LngLatBounds();
    for (const p of visibles) b.extend([p.lng, p.lat]);
    m.fitBounds(b, { padding: tel ? { top: 130, bottom: 110, left: 44, right: 44 } : { top: 80, bottom: 60, left: ouverts.filtres ? 420 : 80, right: ouverts.liste ? 360 : 80 }, maxZoom: 15.5, duration: 900 });
  };

  /* Une adresse tapée dans la recherche, qui ne correspond à personne : on y va. */
  const [cherche, setCherche] = useState(false);
  const allerA = async () => {
    const t = recherche.trim();
    if (t.length < 4) return;
    setCherche(true);
    try {
      const p = await geocoder(t);
      if (!p) { setMessage(`« ${t} » : adresse introuvable.`); return; }
      setRecherche('');
      carte.current?.flyTo({ center: [p.lng, p.lat], zoom: p.precision === 'municipality' ? 13 : 16, duration: 1200 });
    } catch { setMessage('La recherche d’adresse ne répond pas pour l’instant.'); }
    finally { setCherche(false); }
  };

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), typeof message === 'string' ? 6000 : 9000);
    return () => clearTimeout(t);
  }, [message]);

  /* Ouvrir une fiche depuis la carte : la carte prend place dans la barre
     des fiches ouvertes, et un clic sur ce bloc la rouvre là où on l'a
     laissée — même vue, même repère choisi, même recherche. */
  const quitterPour = (suite: () => void) => {
    const m = carte.current;
    if (m && cadre.current) { const c = m.getCenter(); ecrire('carte.vue', JSON.stringify({ c: [c.lng, c.lat], z: m.getZoom() })); }
    try { sessionStorage.setItem(CLE_RETOUR, JSON.stringify({ sel, recherche })); } catch { /* sans mémoire */ }
    const p = sel ? parId.get(sel) : null;
    signalerFicheOuverte({ k: 'carte', id: 'carte', titre: 'Carte', sous: p ? `près de ${rue(p.adresse)}` : undefined });
    suite();
  };
  const ouvrirFiche = (p: Point) => quitterPour(() => {
    /* V3.219 : le bouton retour du bien ramène ici (« ← Carte »). */
    if (p.genre === 'bien') onNavigate('biens', { bien: p.ref, depuis: 'carte' });
    else if (p.client) onNavigate('fiche', p.client);
  });
  /* V3.218 — Alexandre : « il faut appuyer sur le petit bouton bleu pour que
     ça s'ouvre ; j'aimerais que ça s'ouvre même si j'appuie sur l'encadré
     entier ». Un appui n'importe où sur la fiche l'ouvre, sauf sur ses propres
     boutons et liens (appeler, itinéraire, fermer, « Voir son bien »). */
  const surSesBoutons = (e: React.MouseEvent) => !!(e.target as HTMLElement).closest('button, a');

  const pSel = sel ? parId.get(sel) || null : null;
  /* La première position de la carte de visite, avant que la carte bouge. */
  const positionFiche = (p: Place): React.CSSProperties => {
    const xy = carte.current?.project([p.lng, p.lat]);
    return xy ? { left: xy.x, top: xy.y } : {};
  };
  const listeIds = q ? visibles.map(p => p.id) : zone;
  const liste = listeIds.map(id => parId.get(id)).filter((p): p is Place => !!p);
  const nbPlaces = new Set(places.map(p => p.ref)).size;

  /* ── Les morceaux de l'écran ── */
  const puces = (cats: Cat[]) => cats.filter(c => (nbCrm[c.k] || 0) > 0).map(c => {
    /* Des biens ou des contacts de ce type existent, mais aucun n'a d'adresse
       que la carte sache placer : la pastille le dit, et l'appui explique. */
    const vide = fini && !nbCat[c.k];
    return (
      <button key={c.k} type="button" className={`${s.puce} ${actifs[c.k] && !vide ? s.puceOn : ''} ${vide ? s.puceVide : ''}`}
        onClick={() => {
          if (!vide) { basculerCat(c.k); return; }
          setMessage({ titre: `${c.lib} : 0 sur la carte`, texte: 'Leur adresse manque, ou n’a pas été trouvée. Complète leur fiche pour les voir ici.' });
        }}
        aria-pressed={!!actifs[c.k] && !vide} style={{ '--c': c.c } as React.CSSProperties}>
        <span className={s.puceIc}><Ic n={c.ic} t={12} e={2.2} /></span>{c.lib}<b>{nbCat[c.k] || 0}</b>
      </button>
    );
  });
  /* Qui est sur la carte : une phrase, au ⓘ (V3.28). Avant, un bloc avec
     le nombre et la liste de ceux qui manquent restait affiché sous les
     filtres de l'ordinateur — Alexandre n'en voyait pas l'intérêt. */
  /* Le « ? » de la carte (22 octobre 2026) — Alexandre : « il faut qu'on
     comprenne mieux, avec un point d'interrogation, un joli pop-up ».
     Comment les pastilles se combinent, ce que dit leur chiffre, qui est sur
     la carte. La même fenêtre que les « ? » du reste du CRM (Aide). */
  const aideCarte = (classe: string) => (
    <Aide titre="Comment marchent les filtres" label="Comment marche la carte" classe={classe}>
      <span><b>{'Une pastille allumée (en couleur) s’affiche sur la carte. '}</b>{'Un appui l’allume ou l’éteint, même la dernière.'}</span>
      <span><b>{'Dans une rubrique, elles s’additionnent. '}</b>{'« À louer » et « Droit au bail » allumées : la carte montre les deux.'}</span>
      <span><b>{'D’une rubrique à l’autre, tout doit correspondre. '}</b>{'Une affaire s’affiche si son étape (Affaires en cours…), sa nature et son type de local sont allumés tous les trois. Exemple : seulement « Murs à vendre » et seulement « Local commercial » montrent les murs à vendre qui sont des locaux commerciaux.'}</span>
      <span>{'Les contacts (demandeurs, bailleurs…) s’ajoutent aux affaires, dès qu’ils ont une adresse. La nature et le type de local ne trient que les affaires.'}</span>
      <span>{'Le chiffre d’une pastille : combien il y en a sur la carte. « Toutes » ou « Aucune », en haut d’une rubrique, allume ou éteint tout d’un coup. Plus rien à l’écran : la carte dit pourquoi, avec « Tout rallumer ».'}</span>
      <span>{'Seuls les contacts et les affaires dont l’adresse est connue sont sur la carte.'}</span>
      {tableAbsente && <span>{'Les adresses sont recherchées à chaque ouverture tant que le fichier outils/sql/carte.sql n’a pas été passé dans Supabase.'}</span>}
    </Aide>
  );

  const carteDeVisite = (p: Place, compacte = false) => {
    const itineraire = lienItineraire(p.lat, p.lng);
    return (
      <>
        {p.genre === 'bien' && !compacte && (
          <div className={s.ficheImg} style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined}>
            {!p.photo && <Ic n="photo" t={24} />}
            <span className={s.ficheTag} style={{ '--c': p.couleur } as React.CSSProperties}><i />{p.etiquette}</span>
          </div>
        )}
        <div className={s.ficheCorps}>
          {p.genre === 'contact' ? (
            <div className={s.ficheQui}>
              <AvatarContact c={(p.client || {}) as never} teinte={p.teinte || { bg: p.fond, fg: p.couleur }} taille={compacte ? 38 : 42} />
              <div>
                <b>{p.titre}</b>
                <span className={s.ficheTypes} style={{ '--c': p.couleur } as React.CSSProperties}>{p.etiquette}</span>
              </div>
            </div>
          ) : (
            <>
              {compacte && <span className={s.ficheTag2} style={{ '--c': p.couleur } as React.CSSProperties}><i />{p.etiquette}</span>}
              <b className={s.ficheTitre}>{p.titre}</b>
              {!!p.prix && <span className={s.fichePrix}>{p.prixLib || EUR(p.prix)}</span>}
            </>
          )}
          <span className={s.ficheLigne}><Ic n="lieu" t={13} /><span>{p.perso ? `Son bien : ${p.adresse}` : p.adresse}</span></span>
          {/* Le contact possède un bien ailleurs : on y va d'un clic, et retour. */}
          {p.genre === 'contact' && !compacte && (() => {
            const autre = parId.get(p.perso ? p.id.replace(/:bien$/, '') : `${p.id}:bien`);
            return autre ? (
              <button type="button" className={s.ficheSaut} onClick={() => choisir(autre.id, { voler: true })}>
                <Ic n={p.perso ? 'personne' : 'cle'} t={13} /><span>{p.perso ? 'Voir son domicile' : `Voir son bien · ${rue(autre.adresse)}`}</span>
              </button>
            ) : null;
          })()}
          {p.genre === 'bien' && p.proprio && <span className={s.ficheLigne}><Ic n="personne" t={13} /><span>{p.proprio}</span></span>}
          <div className={s.ficheBoutons}>
            <button type="button" className={s.btnPlein} onClick={() => ouvrirFiche(p)}>Ouvrir la fiche</button>
            <a className={s.btn} href={itineraire} target="_blank" rel="noopener noreferrer">Itinéraire</a>
            {tel && p.tel && <a className={s.btn} href={`tel:${p.tel.replace(/\s/g, '')}`} aria-label={`Appeler ${p.titre}`}><Ic n="telephone" t={15} /></a>}
          </div>
        </div>
      </>
    );
  };

  const ligne = (p: Place) => (
    <li key={p.id}>
      <button type="button" className={`${s.ligne} ${sel === p.id ? s.ligneSel : ''}`}
        onClick={() => choisir(p.id, { voler: true })} onMouseEnter={() => setSurvol(p.id)} onMouseLeave={() => setSurvol(null)}>
        {p.genre === 'bien'
          ? <span className={s.ligneIc} style={{ '--c': p.couleur } as React.CSSProperties}><Ic n="maison" t={15} e={2.1} /></span>
          : p.perso
            ? <span className={s.ligneIc} style={{ '--c': p.couleur } as React.CSSProperties}><Ic n="cle" t={14} e={2.1} /></span>
            : <AvatarContact c={(p.client || {}) as never} teinte={p.teinte || { bg: p.fond, fg: p.couleur }} taille={32} />}
        <span className={s.ligneTxt}><b>{p.titre}</b><small>{p.sous}</small></span>
      </button>
    </li>
  );

  return (
    <div ref={pageRef} className={`${s.page} ${tel ? s.pageTel : ''}`}>
      <FondCarte className={s.fond} surPrete={surPrete} mention={tel ? 'sous-filtres' : 'bas-gauche'}
        centre={CENTRE} zoom={12.6} surErreur={m => setErreur(m)} />
      {fini && pourquoiVide && (
        <div className={s.carteVide} role="status">
          <span className={s.carteVideIc}><Icone nom="info" taille={18} epaisseur={2} /></span>
          <b>{pourquoiVide.titre}</b>
          <span>{pourquoiVide.texte}</span>
          <button type="button" onClick={toutRallumer}>Tout rallumer</button>
        </div>
      )}

      {progres && (
        <div className={s.progres} role="status">
          <span className={s.progresRond} />
          {`Placement des adresses… ${progres.fait} / ${progres.total}`}
        </div>
      )}
      {message && (() => {
        const m = typeof message === 'string' ? { texte: message } as Exclude<Msg, string> : message;
        return (
          <div className={s.message} role="status" key={m.texte + (m.titre || '')}>
            <span className={s.messageIc}><Icone nom="info" taille={15} epaisseur={2.1} /></span>
            <span className={s.messageTxt}>
              {m.titre && <b>{m.titre}</b>}
              <span>{m.texte}</span>
            </span>
            <button type="button" className={s.messageFermer} onClick={() => setMessage(null)} aria-label="Fermer">×</button>
          </div>
        );
      })()}

      {!tel ? (
        <>
          {/* ── À gauche : les filtres ── */}
          {ouverts.filtres ? (
            <section className={`${s.panneau} ${s.panneauFiltres}`} aria-label="Filtres de la carte">
              <div className={s.tete}>
                <span className={s.teteIc}><Ic n="carte" t={18} /></span>
                <div className={s.teteTxt}>
                  <h1>Carte</h1>
                  <span>{charge ? 'Chargement…' : `${nbPlaces} adresse${nbPlaces > 1 ? 's' : ''} sur la carte`}</span>
                </div>
                {!charge && (
                  aideCarte(`${s.replier} ${s.replierQ}`)
                )}
                <button type="button" className={s.replier} onClick={() => basculerPanneau('filtres')} aria-label="Replier les filtres" title="Replier">
                  <Ic n="gauche" t={16} e={2.2} />
                </button>
              </div>
              {charge ? (
                <div className={s.squelettes}>{[0, 1, 2, 3, 4].map(i => <span key={i} className="sq-barre" style={{ width: `${60 + (i * 17) % 40}%` }} />)}</div>
              ) : erreur ? <div className={s.erreur}>{erreur}</div> : (
                <>
                  {CATS_CONTACTS.some(c => nbCrm[c.k]) && <div className={s.section}>
                    <div className={s.sectionTete}><span>Contacts</span>
                      <button type="button" onClick={() => toutSection(CATS_CONTACTS, !CATS_CONTACTS.every(c => !nbCat[c.k] || actifs[c.k]))}>
                        {CATS_CONTACTS.every(c => !nbCat[c.k] || actifs[c.k]) ? 'Aucun' : 'Tous'}
                      </button>
                    </div>
                    <div className={s.puces}>{puces(CATS_CONTACTS)}</div>
                  </div>}
                  {CATS_BIENS.some(c => nbCrm[c.k]) && <div className={s.section}>
                    <div className={s.sectionTete}><span>Affaires</span>
                      <button type="button" onClick={() => toutSection(CATS_BIENS, !CATS_BIENS.every(c => !nbCat[c.k] || actifs[c.k]))}>
                        {CATS_BIENS.every(c => !nbCat[c.k] || actifs[c.k]) ? 'Aucune' : 'Toutes'}
                      </button>
                    </div>
                    <div className={s.puces}>{puces(CATS_BIENS)}</div>
                  </div>}
                  {CATS_NATURES.some(c => nbCrm[c.k]) && <div className={s.section}>
                    <div className={s.sectionTete}><span>Nature de l’affaire</span>
                      <button type="button" onClick={() => toutSection(CATS_NATURES, !CATS_NATURES.every(c => !nbCat[c.k] || actifs[c.k]))}>
                        {CATS_NATURES.every(c => !nbCat[c.k] || actifs[c.k]) ? 'Aucune' : 'Toutes'}
                      </button>
                    </div>
                    <div className={s.puces}>{puces(CATS_NATURES)}</div>
                  </div>}
                  {CATS_TYPES.some(c => nbCrm[c.k]) && <div className={s.section}>
                    <div className={s.sectionTete}><span>Type de local</span>
                      <button type="button" onClick={() => toutSection(CATS_TYPES, !CATS_TYPES.every(c => !nbCat[c.k] || actifs[c.k]))}>
                        {CATS_TYPES.every(c => !nbCat[c.k] || actifs[c.k]) ? 'Aucun' : 'Tous'}
                      </button>
                    </div>
                    <div className={s.puces}>{puces(CATS_TYPES)}</div>
                  </div>}
                  {!places.length && !progres && <p className={s.vide}>Aucune adresse à placer pour l’instant.</p>}
                </>
              )}
            </section>
          ) : (
            <button type="button" className={s.pastille} onClick={() => basculerPanneau('filtres')} aria-label="Ouvrir les filtres">
              <Ic n="carte" t={16} /><span>Filtres</span>
              <b>{TOUTES.filter(c => nbCat[c.k] && actifs[c.k]).length}</b>
            </button>
          )}

          {/* ── À droite : la zone affichée ── */}
          {ouverts.liste ? (
            <section className={`${s.panneau} ${s.panneauListe}`} aria-label="Dans cette zone">
              <div className={s.listeTete}>
                <h2>{q ? 'Résultats' : 'Dans cette zone'}<span>{liste.length}</span></h2>
                <button type="button" className={s.replier} onClick={() => basculerPanneau('liste')} aria-label="Replier la liste" title="Replier">
                  <Ic n="droite" t={16} e={2.2} />
                </button>
              </div>
              <label className={s.cherche}>
                <Ic n="loupe" t={15} />
                <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Un nom, une adresse, une ville…"
                  onKeyDown={e => { if (e.key === 'Enter' && q && !visibles.length) allerA(); }} />
                {recherche && <button type="button" onClick={() => setRecherche('')} aria-label="Effacer">×</button>}
              </label>
              <ul className={s.liste}>
                {liste.slice(0, 200).map(ligne)}
              </ul>
              {!liste.length && (
                <div className={s.listeVide}>
                  {q ? (recherche.trim().length >= 4
                    ? <button type="button" className={s.allerA} onClick={allerA} disabled={cherche}><Ic n="lieu" t={14} />{cherche ? 'Recherche…' : `Aller à « ${recherche.trim()} »`}</button>
                    : 'Personne ne correspond.')
                    : charge ? 'Chargement…' : 'Rien dans cette zone : déplace la carte ou dézoome.'}
                </div>
              )}
              <div className={s.listePied}><Ic n="lieu" t={13} />Déplace ou zoome : la liste suit la carte.</div>
            </section>
          ) : (
            <button type="button" className={s.onglet} onClick={() => basculerPanneau('liste')} aria-label="Ouvrir la liste de la zone">
              <Ic n="liste" t={16} /><b>{liste.length}</b>
            </button>
          )}

          {/* La carte de visite, accrochée à son repère. */}
          {pSel && (
            <div ref={fiche} className={s.fiche} key={pSel.id} role="dialog" aria-label={pSel.titre} style={positionFiche(pSel)}
              title="Ouvrir la fiche" onClick={e => { if (!surSesBoutons(e)) ouvrirFiche(pSel); }}>
              <button type="button" className={s.ficheFermer} onClick={() => setSel(null)} aria-label="Fermer">×</button>
              {carteDeVisite(pSel)}
            </div>
          )}

          <div className={s.outils}>
            <button type="button" onClick={autourDeMoi} title="Autour de moi" aria-label="Autour de moi"><Ic n="boussole" t={17} /></button>
            <button type="button" onClick={toutVoir} title="Tout voir" aria-label="Tout voir"><Ic n="globe" t={17} /></button>
            <span />
            <button type="button" onClick={() => carte.current?.zoomIn()} aria-label="Zoomer"><Icone nom="plus" taille={17} epaisseur={2.1} /></button>
            <button type="button" onClick={() => carte.current?.zoomOut()} aria-label="Dézoomer"><Icone nom="moins" taille={17} epaisseur={2.1} /></button>
          </div>
        </>
      ) : (
        <>
          {/* ── Téléphone : en haut, la recherche et les filtres ── */}
          <div className={s.hautTel}>
            {/* La barre du haut du CRM est masquée ici : le menu s'ouvre d'ici. */}
            <div className={s.rangTel}>
              {onMenu && (
                <button type="button" className={s.menuTel} onClick={onMenu} aria-label="Ouvrir le menu">
                  <Icone nom="menu" taille={20} epaisseur={2} />
                </button>
              )}
              <label className={`${s.cherche} ${s.chercheTel}`}>
                <Ic n="loupe" t={15} />
                <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Un nom, une adresse…"
                  enterKeyHint="search" onKeyDown={e => { if (e.key === 'Enter' && q && !visibles.length) allerA(); }} />
                {recherche && <button type="button" onClick={() => setRecherche('')} aria-label="Effacer">×</button>}
              </label>
              {/* Qui est sur la carte, et qui n'y est pas : un appui (V3.28). */}
              {aideCarte(`${s.infoTel} ${s.infoTelQ}`)}
            </div>
            {/* Deux boutons plutôt qu'une bande à faire défiler : chacun
                déplie ses filtres, rangés sur plusieurs lignes. */}
            <div className={s.groupesTel}>
              {([['contacts', 'Mes contacts', 'groupe', CATS_CONTACTS], ['biens', 'Mes affaires', 'agence', CATS_BIENS]] as const)
                .filter(([, , , cats]) => cats.some(c => nbCrm[c.k]))
                .map(([k, lib, ico]) => {
                  const n = visibles.filter(p => (k === 'biens') === (p.genre === 'bien')).length;
                  return (
                    <button key={k} type="button" className={`${s.groupeTel} ${k === 'biens' ? s.groupeBiens : ''} ${pliTel === k ? s.groupeTelOn : ''}`}
                      aria-expanded={pliTel === k} onClick={() => setPliTel(x => (x === k ? null : k))}>
                      <span className={s.groupeIc}><Ic n={ico} t={17} e={2} /></span>
                      <span className={s.groupeLib}>{lib}<small>{`${n} sur la carte`}</small></span>
                      <span className={s.groupeCv}><Icone nom="chevron" taille={14} epaisseur={2.1} /></span>
                    </button>
                  );
                })}
            </div>
            {pliTel && (() => {
              const cats = pliTel === 'contacts' ? CATS_CONTACTS : CATS_BIENS;
              const tous = cats.every(c => !nbCat[c.k] || actifs[c.k]);
              return (
                <div className={s.pliTel} key={pliTel}>
                  <div className={s.sectionTete}>
                    <span>{pliTel === 'contacts' ? 'Quels contacts voir' : 'Quelles affaires voir'}</span>
                    <button type="button" onClick={() => toutSection(cats, !tous)}>{pliTel === 'biens' ? (tous ? 'Aucune' : 'Toutes') : tous ? 'Aucun' : 'Tous'}</button>
                  </div>
                  <div className={s.puces}>{puces(cats)}</div>
                  {pliTel === 'biens' && CATS_NATURES.some(c => nbCrm[c.k]) && <>
                    <div className={s.sectionTete}><span>Nature</span></div>
                    <div className={s.puces}>{puces(CATS_NATURES)}</div>
                  </>}
                  {pliTel === 'biens' && CATS_TYPES.some(c => nbCrm[c.k]) && <>
                    <div className={s.sectionTete}><span>Type de local</span></div>
                    <div className={s.puces}>{puces(CATS_TYPES)}</div>
                  </>}
                </div>
              );
            })()}
          </div>

          <div className={s.outilsTel}>
            <button type="button" onClick={autourDeMoi} aria-label="Autour de moi"><Ic n="boussole" t={18} /></button>
            <button type="button" onClick={toutVoir} aria-label="Tout voir"><Ic n="globe" t={18} /></button>
          </div>

          {/* ── En bas : les fiches de la zone, qu'on fait glisser ── */}
          <div className={s.basTel}>
            {liste.length ? (
              <div className={s.carrousel} ref={carrousel} onScroll={surGlisse} data-defile=""
                onTouchStart={() => { toucheBande.current = Date.now(); }} onPointerDown={() => { toucheBande.current = Date.now(); }}>
                {/* Des fiches courtes (V3.28) : qui ou quoi, son étiquette et sa
                    rue ; appeler (ou l'itinéraire) et la fiche. La carte garde
                    presque tout l'écran.
                    V3.74 (Alexandre : « on ne voit pas tout sur la carte ») :
                    une étiquette longue (« Acheteur · Propriétaire ») élargissait
                    la fiche au-delà de l'écran, la photo et le bouton coupés.
                    Le nom et son étiquette en haut, la rue et les boutons en
                    dessous ; la fiche ne dépasse plus jamais l'écran. */}
                {liste.slice(0, 60).map(p => {
                  /* V3.155 — Alexandre : « le prix est caché et le nom prend
                     trop de place : l'appartement, ses pièces et sa surface,
                     l'adresse en bas, et le prix à droite, toujours ».
                     V3.156 — « qu'on le voie tout d'un coup » : trois lignes.
                     Le nom (« Appartement 2 p. · 36,8 m² », ou le contact) et
                     le prix à droite ; l'adresse et son code postal ; ses
                     vignettes (l'étape du bien, les types du contact). */
                  const prix = p.genre === 'bien' && p.prix ? (p.prixLib || EUR(p.prix)) : '';
                  const vignettes = p.pastilles?.length ? p.pastilles : p.etiquette ? [{ lib: p.etiquette, c: p.couleur }] : [];
                  return (
                  <div key={p.id} data-id={p.id} className={`${s.carteTel} ${prix ? s.carteTelPrix : ''} ${sel === p.id ? s.carteTelSel : ''}`}
                    style={{ '--c': p.couleur } as React.CSSProperties}
                    role="button" tabIndex={0} aria-label={`Ouvrir la fiche de ${p.titre}`}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); ouvrirFiche(p); } }}
                    onClick={e => {
                      if (surSesBoutons(e)) return;
                      /* V3.218 : la fiche entière à l'écran (celle du milieu) s'ouvre ;
                         une fiche à moitié cachée au bord vient d'abord au milieu. */
                      const c = carrousel.current, r = e.currentTarget.getBoundingClientRect(), rc = c?.getBoundingClientRect();
                      const entiere = !rc || (r.left >= rc.left - 2 && r.right <= rc.right + 2);
                      if (sel === p.id || entiere) ouvrirFiche(p);
                      else choisir(p.id, { voler: true });
                    }}>
                    {p.genre === 'bien'
                      ? <span className={s.telVign} style={p.photo ? { backgroundImage: `url(${p.photo})` } : undefined}>{!p.photo && <Ic n="maison" t={17} e={2.1} />}</span>
                      : p.perso
                        ? <span className={`${s.telVign} ${s.telVignCle}`}><Ic n="cle" t={16} e={2.1} /></span>
                        : <AvatarContact c={(p.client || {}) as never} teinte={p.teinte || { bg: p.fond, fg: p.couleur }} taille={40} />}
                    <span className={s.telL1}><b>{p.genre === 'bien' ? nomCourt(p.titre) : p.titre}</b></span>
                    {prix && <span className={s.telPrix}>{prix}</span>}
                    <span className={s.telAdr}>{adresseCp(p.adresse)}</span>
                    <span className={s.telPast}>
                      {vignettes.map(v => <i key={v.lib} style={{ '--c': v.c } as React.CSSProperties}>{v.lib}</i>)}
                    </span>
                    <span className={s.telAct}>
                      {p.tel
                        ? <a href={`tel:${p.tel.replace(/\s/g, '')}`} aria-label={`Appeler ${p.titre}`} onClick={e => e.stopPropagation()}><Icone nom="tel" taille={16} epaisseur={1.9} /></a>
                        : <a href={lienItineraire(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" aria-label="Itinéraire" onClick={e => e.stopPropagation()}><Icone nom="envoyer" taille={16} epaisseur={1.9} /></a>}
                      <button type="button" className={s.telFiche} aria-label={`Ouvrir la fiche de ${p.titre}`}
                        onClick={e => { e.stopPropagation(); ouvrirFiche(p); }}><Ic n="droite" t={17} e={2.3} /></button>
                    </span>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className={s.videTel}>{charge ? 'Chargement…' : q
                ? (recherche.trim().length >= 4 ? <button type="button" className={s.allerA} onClick={allerA} disabled={cherche}><Ic n="lieu" t={14} />{cherche ? 'Recherche…' : `Aller à « ${recherche.trim()} »`}</button> : 'Personne ne correspond.')
                : 'Rien dans cette zone : déplace la carte.'}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
