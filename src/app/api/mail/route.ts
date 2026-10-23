import { NextRequest, NextResponse } from 'next/server';
import { coordonnees, reponseAgence } from '@/lib/coordonnees-serveur';
import { createClient } from '@supabase/supabase-js';
import { lireIdentiteAgence } from '@/lib/agence';
import { ecritServeur } from '@/lib/ecritures';
import { CLES_MAIL, conseillerDe } from '@/lib/mail-variables';
import { groupesAdresses, nomDeLAdresse, pourAdresses } from '@/lib/foyer';
import {
  habillageDe, htmlVersTexte, htmlVide, mailLibreHtml, nettoyerHtml, personnaliserHtml, personnaliserObjet, personnaliserTexte, pourGroupe, texteLiens,
  type LienPiece, type StyleMail,
} from '@/lib/mail-libre';
import { avecRemises, noterRemises, noterRemisesCopies } from '@/lib/remise-mail';

/**
 * « Nouveau mail » (V3.41) : un mail écrit à la main, à des contacts du CRM
 * et/ou à des adresses libres. Protégée par le code d'accès, comme le reste
 * du CRM (src/proxy.ts).
 *
 *   POST { action: 'depot', ext }   →  { ok, chemin, jeton }
 *        une pièce jointe part directement du navigateur vers le stockage
 *        privé (bucket « mandats », dossier mails/), comme les documents
 *   POST { action: 'envoyer', contacts, adresses, objet, html, style, pieces }
 *        →  { ok, envoyes, echecs, avertissements, mode }
 *
 * Un mail par destinataire, au nom d'Alexandre, {{prénom}} remplacé pour
 * chacun. Le HTML de l'éditeur est nettoyé ici aussi (src/lib/mail-libre.ts) :
 * le serveur ne fait confiance qu'à ce qu'il a lui-même filtré. Jusqu'à 10 Mo,
 * les pièces sont jointes ; au-delà, le mail porte des liens valables 7 jours.
 *
 * Ensuite, pour chaque contact du CRM (choisi dans la liste, ou retrouvé par
 * son adresse) : une ligne dans `envois` et une dans son Suivi (`journal`),
 * rangées dans sa recherche ouverte s'il en a une. Une adresse hors CRM ne
 * laisse pas de trace : il n'y a pas de fiche où la ranger.
 *
 * V3.234 — Cc et Cci (repris du CRM d'Emilio, 23 octobre 2026). Alexandre :
 * « si je mets des gens en copie, ils recevront aussi le mail, avec
 * l'affichage du destinataire à qui je l'ai envoyé, comme si j'envoyais un
 * vrai mail ». `cc` et `cci` : { contacts,
 * adresses }, comme « À ». Dès qu'il y a une copie, le mail part en UN seul
 * exemplaire, comme depuis une messagerie : « À » et « Cc » visibles de tous,
 * « Cci » de personne ; {{prénom}} prend le ou les prénoms en « À »
 * (`pourGroupe`). Chaque contact du CRM, en « À » ou en copie, a sa ligne
 * dans son Suivi. Sans copie, rien ne change : un mail par personne.
 *
 * V3.235 — `choix` (dans chaque ligne) : { [contact]: [adresses] }, les
 * adresses cochées d'un contact. Avant, un contact recevait le mail sur
 * TOUTES les adresses de sa fiche, celles du notaire du dossier comprises.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'mandats';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CHEMIN = /^mails\/\d{4}-\d{2}\/[a-z0-9]{6,32}-\d+\.[a-z0-9]{2,5}$/;
const TYPES_PIECES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
};
const MAX_JOINTS = 10_000_000;
const LIENS_JOURS = 7;
const MAX_DEST = 30;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm-werner-immobilier.vercel.app';
const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL || 'contact@wernerimmobilier.com';
const FROM_NAME = process.env.MAILJET_FROM_NAME || 'Werner Immobilier';

const ko = (erreur: string, status = 400) => NextResponse.json({ ok: false, erreur }, { status });
const nomPropre = (n: string) => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9._ -]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';

/* V3.234 : `role`, la ligne où la personne a été mise — « À », Cc ou Cci. */
type Role = 'a' | 'cc' | 'cci';
/* `nomMail` : le nom affiché à côté de chaque adresse dans le mail (V3.236 :
   celui de la personne 2 pour son adresse, aucun pour le notaire du dossier). */
type Dest = { a: string[]; nom: string; nomMail: Record<string, string>; prenom: string; famille: string; reference: string; clientId: string | null; role: Role };
/* Mailjet : 50 adresses au plus dans un même mail (À, Cc et Cci ensemble). */
const MAX_GROUPE = 50;
type Contact = { id: string; prenom: string | null; nom: string | null; reference: string | null; emails: string[] | null; conjoint?: unknown; adresses_dossier?: unknown };

/* V3.50 : les mails partent par lots, un appel Mailjet par lot (l'API v3.1
   en accepte 50 par appel). Sans pièce jointe, tout part en un seul appel.
   Avant, un appel par personne, l'un après l'autre, avec jusqu'à 10 Mo de
   pièces chacun : au-delà de 60 s, Vercel coupait (« Erreur 504 ») alors que
   les premiers mails étaient partis, et les renvoyer faisait des doubles.
   Un lot ne dépasse pas ~14 Mo (Mailjet refuse un mail de plus de 15 Mo,
   pièces comprises) ; on n'en lance plus quand le temps manque : ceux qui
   restent sont dits « pas partis », jamais « peut-être ».
   Mailjet répond message par message : chacun est noté selon SA réponse.
   `incertain` : Mailjet n'a pas répondu (délai dépassé, coupure, panne de
   son côté) — les mails du lot sont peut-être partis, on ne le sait pas. */
type Adresse = { email: string; nom: string };
type Message = { a: Adresse[]; cc?: Adresse[]; cci?: Adresse[]; sujet: string; texte: string; html: string; id: string };
const versMailjet = (l: Adresse[]) => l.map(x => ({ Email: x.email, ...(x.nom ? { Name: x.nom } : {}) }));
type Pj = { nom: string; type: string; base64: string };
const LOT_MAX_MESSAGES = 50;
const LOT_MAX_OCTETS = 14_000_000;
async function mailjetLot(messages: Message[], pj: Pj[], limite: number): Promise<{ erreurs: (string | null)[]; incertain: boolean; brut?: unknown }> {
  const k = process.env.MAILJET_API_KEY, s = process.env.MAILJET_API_SECRET;
  if (!k || !s) return { erreurs: messages.map(() => 'Mailjet non configuré'), incertain: false };
  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), Math.max(5_000, limite));
  try {
    const co = await coordonnees();
    const r = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${k}:${s}`).toString('base64')}` },
      body: JSON.stringify({
        Messages: messages.map(m => ({
          From: { Email: FROM_EMAIL, Name: FROM_NAME },
          ...reponseAgence(FROM_EMAIL, co),
          To: versMailjet(m.a),
          ...(m.cc?.length ? { Cc: versMailjet(m.cc) } : {}),
          ...(m.cci?.length ? { Bcc: versMailjet(m.cci) } : {}),
          Subject: m.sujet, TextPart: m.texte, HTMLPart: m.html, CustomID: m.id,
          ...(pj.length ? { Attachments: pj.map(p => ({ ContentType: p.type, Filename: p.nom, Base64Content: p.base64 })) } : {}),
          TrackOpens: 'disabled', TrackClicks: 'disabled',
        })),
      }),
      signal: arret.signal,
    });
    const j = await r.json().catch(() => null) as { Messages?: { Status?: string; Errors?: { ErrorMessage?: string }[] }[]; ErrorMessage?: string } | null;
    const l = j?.Messages;
    if (Array.isArray(l) && l.length === messages.length) {
      return { erreurs: l.map(m => (m?.Status === 'success' ? null : m?.Errors?.[0]?.ErrorMessage || `Mailjet ${r.status}`)), incertain: false, brut: j };
    }
    /* Pas de réponse message par message : refusé en bloc (rien n'est
       parti), ou une panne de Mailjet (on ne sait pas). */
    const err = j?.ErrorMessage || `Mailjet ${r.status}`;
    return { erreurs: messages.map(() => err), incertain: r.status >= 500 || !j };
  } catch (e) {
    const err = (e as Error).name === 'AbortError' ? 'Mailjet n’a pas répondu à temps' : ((e as Error).message || 'envoi impossible');
    return { erreurs: messages.map(() => err), incertain: true };
  } finally {
    clearTimeout(minuterie);
  }
}

/* V3.151 : les mails partis sont rendus avec la réponse (`remise`). */
export async function POST(req: NextRequest) { return avecRemises(() => envoyer(req)); }

async function envoyer(req: NextRequest) {
  /* Le temps qu'il reste : Mailjet doit avoir répondu assez tôt pour qu'on
     ait le temps de tout noter avant la limite de Vercel (maxDuration). */
  const debut = Date.now();
  /* Les mails sont partis vers Mailjet : une erreur après ce point ne veut
     pas dire « rien n'est parti ». */
  let parti = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return ko('Variables Supabase manquantes', 500);
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return ko('Requête illisible'); }
  const action = String(body.action || '');

  try {
    /* ── Une pièce jointe : un droit de dépôt, pour un seul fichier ── */
    if (action === 'depot') {
      const ext = String(body.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!TYPES_PIECES[ext]) return ko('Format refusé : PDF, image, Word, Excel ou texte.');
      const mois = new Date().toISOString().slice(0, 7);
      const hasard = Math.random().toString(36).slice(2, 12).padEnd(8, '0');
      const chemin = `mails/${mois}/${hasard}-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(chemin);
      if (error || !data) return ko(error?.message || 'Dépôt impossible', 500);
      return NextResponse.json({ ok: true, chemin: data.path, jeton: data.token });
    }

    if (action !== 'envoyer') return ko('Action inconnue');

    /* ── Ce qu'Alexandre a écrit ── */
    const objet = String(body.objet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const corps = nettoyerHtml(String(body.html || ''));
    const style: StyleMail = body.style === 'emilio' ? 'emilio' : 'simple';
    if (!objet) return ko('L’objet est vide.');
    if (htmlVide(corps)) return ko('Le message est vide.');

    /* Une ligne du mail (« À », Cc ou Cci) : les contacts choisis, les adresses tapées. */
    const lireLigne = (o: unknown) => {
      const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
      return {
        ids: (Array.isArray(x.contacts) ? x.contacts : []).map(String).filter(v => UUID.test(v)).slice(0, MAX_DEST),
        libres: (Array.isArray(x.adresses) ? x.adresses : []).map(v => String(v).trim().toLowerCase())
          .filter((v, i, l) => MAIL.test(v) && l.indexOf(v) === i).slice(0, MAX_DEST),
        /* V3.235 : les adresses cochées de chaque contact (sans choix : toutes, comme avant). */
        choix: Object.fromEntries(Object.entries(x.choix && typeof x.choix === 'object' ? x.choix as Record<string, unknown> : {})
          .filter(([id, l]) => UUID.test(id) && Array.isArray(l))
          .map(([id, l]) => [id, (l as unknown[]).map(v => String(v).trim().toLowerCase()).filter(v => MAIL.test(v))])) as Record<string, string[]>,
      };
    };
    const lignes: { role: Role; ids: string[]; libres: string[]; choix: Record<string, string[]> }[] = [
      { role: 'a', ...lireLigne(body) },
      { role: 'cc', ...lireLigne(body.cc) },
      { role: 'cci', ...lireLigne(body.cci) },
    ];
    if (!lignes[0].ids.length && !lignes[0].libres.length) return ko('Aucun destinataire en « À ».');

    /* ── Les destinataires : les contacts choisis (toutes leurs adresses),
          puis les adresses tapées — rattachées à leur contact si le CRM le
          connaît, pour le prénom et le Suivi. « À » d'abord, puis Cc, puis
          Cci : une adresse déjà prise plus haut n'est pas reprise. ── */
    const avertissements: string[] = [];
    const echecs: string[] = [];
    const dests: Dest[] = [];
    const deja = new Set<string>();
    const nomDe = (c: Contact) => `${c.prenom || ''} ${c.nom || ''}`.trim();
    for (const { role, ids, libres, choix } of lignes) {
      if (ids.length) {
        /* '*' : la personne 2 et les adresses du dossier (V3.236) ; une colonne
           pas encore créée (SQL « adresses-dossier ») ne fait pas échouer. */
        const { data, error } = await sb.from('clients').select('*').in('id', ids);
        if (error) return ko(`Les contacts n’ont pas pu être lus : ${error.message}`, 500);
        for (const c of (data || []) as Contact[]) {
          const net = (l: (string | null | undefined)[]) => l.map(e => String(e || '').trim().toLowerCase()).filter((e, i, x) => MAIL.test(e) && x.indexOf(e) === i);
          /* Les adresses de la personne 1 ; avec un choix, celles de toute la
             fiche (personne 2, autres adresses du dossier, V3.236). */
          const siennes = net(c.emails || []);
          const toutes = net(groupesAdresses(c).flatMap(g => g.emails));
          /* V3.235 : seulement les adresses cochées (une adresse qui n'est plus
             sur sa fiche est ignorée ; s'il n'en reste aucune, la première). */
          const voulues = choix[c.id];
          const retenues = voulues?.length ? (toutes.filter(e => voulues.includes(e)).length ? toutes.filter(e => voulues.includes(e)) : toutes.slice(0, 1)) : siennes;
          const a = retenues.filter(e => !deja.has(e));
          if (!a.length) {
            if (!retenues.some(e => deja.has(e))) echecs.push(`${nomDe(c) || 'Un contact'} (pas d’adresse e-mail)`);
            continue;
          }
          a.forEach(e => deja.add(e));
          /* {{prénom}} : la personne à qui l'on écrit (la 2, ou personne pour le notaire). */
          const pour = pourAdresses(c, a);
          dests.push({ a, nom: nomDe(c), nomMail: Object.fromEntries(a.map(e => [e, nomDeLAdresse(c, e)])), prenom: pour.prenom, famille: pour.nom, reference: pour.reference, clientId: c.id, role });
        }
      }
      const aChercher = libres.filter(e => !deja.has(e));
      const connus: Record<string, Contact> = {};
      if (aChercher.length) {
        const { data, error } = await sb.from('clients').select('id, prenom, nom, reference, emails').overlaps('emails', aChercher);
        if (error) console.error('[mail] contacts par adresse', error.message);
        for (const c of (data || []) as Contact[]) {
          for (const e of c.emails || []) { const k = String(e).trim().toLowerCase(); if (aChercher.includes(k) && !connus[k]) connus[k] = c; }
        }
      }
      for (const e of aChercher) {
        deja.add(e);
        const c = connus[e];
        dests.push(c
          ? { a: [e], nom: nomDe(c), nomMail: { [e]: nomDe(c) }, prenom: c.prenom || '', famille: c.nom || '', reference: c.reference || '', clientId: c.id, role }
          : { a: [e], nom: '', nomMail: {}, prenom: '', famille: '', reference: '', clientId: null, role });
      }
    }
    if (!dests.some(d => d.role === 'a')) return ko(`Personne à qui l’envoyer en « À » : ${echecs.join(' · ') || 'ajoute un destinataire'}`);
    /* V3.234 : une copie (Cc ou Cci) fait partir un seul mail, le même pour tous. */
    const groupe = dests.some(d => d.role !== 'a');
    if (groupe && dests.reduce((t, d) => t + d.a.length, 0) > MAX_GROUPE) {
      return ko(`Un mail avec des copies part à ${MAX_GROUPE} adresses au plus (À, Cc et Cci ensemble) : retire des destinataires.`);
    }

    /* ── L'habillage : le nom et le téléphone des Paramètres, l'identité de l'agence ── */
    const [reglages, identite] = await Promise.all([
      sb.from('parametres').select('cle, valeur').in('cle', CLES_MAIL),
      lireIdentiteAgence(sb),
    ]);
    const params = Object.fromEntries(((reglages.data || []) as { cle: string; valeur: string | null }[]).map(r => [r.cle, r.valeur || '']));
    const conseiller = conseillerDe(params);
    const h = habillageDe(params, identite, SITE);

    /* ── Les pièces jointes, lues dans le stockage privé ── */
    const pieces = (Array.isArray(body.pieces) ? body.pieces : []).slice(0, 15).map((x: unknown) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { chemin: String(o.chemin || ''), nom: nomPropre(String(o.nom || '')) };
    });
    if (pieces.some((p: { chemin: string }) => !CHEMIN.test(p.chemin))) return ko('Une pièce jointe est introuvable : ajoute-la à nouveau.');
    const fichiers: { nom: string; type: string; octets: Buffer; chemin: string }[] = [];
    for (const p of pieces) {
      const { data, error } = await sb.storage.from(BUCKET).download(p.chemin);
      if (error || !data) return ko(`« ${p.nom} » n’a pas été trouvée : ajoute-la à nouveau.`, 404);
      const ext = (p.chemin.split('.').pop() || '').toLowerCase();
      const nom = /\.[a-z0-9]{2,5}$/i.test(p.nom) ? p.nom : `${p.nom}.${ext}`;
      fichiers.push({ nom, type: TYPES_PIECES[ext] || 'application/octet-stream', octets: Buffer.from(await data.arrayBuffer()), chemin: p.chemin });
    }
    const total = fichiers.reduce((t, f) => t + f.octets.length, 0);
    const mode: 'pj' | 'liens' = total <= MAX_JOINTS ? 'pj' : 'liens';
    const pj = mode === 'pj' ? fichiers.map(f => ({ nom: f.nom, type: f.type, base64: f.octets.toString('base64') })) : [];
    const liens: LienPiece[] = [];
    if (mode === 'liens') {
      for (const f of fichiers) {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.chemin, LIENS_JOURS * 86_400, { download: f.nom });
        if (error || !data) return ko(`Le lien de « ${f.nom} » n’a pas pu être créé.`, 500);
        liens.push({ nom: f.nom, url: data.signedUrl, taille: f.octets.length });
      }
    }
    const noms = fichiers.map(f => f.nom);

    /* ── La recherche où ranger l'envoi, pour les contacts qui en ont une :
          la première dont la veille tourne, sinon la première (comme
          /api/send-mail). ── */
    const clientIds = Array.from(new Set(dests.map(d => d.clientId).filter((x): x is string => !!x)));
    const dossier: Record<string, string | null> = {};
    if (clientIds.length) {
      const { data: rs } = await sb.from('recherches').select('id, client_id, active, created_at').in('client_id', clientIds).order('created_at', { ascending: true });
      /* V3.51 : écrit depuis la fiche d'un acheteur, la recherche affichée
         (si elle est bien la sienne). */
      const voulues = (body.recherches && typeof body.recherches === 'object' ? body.recherches : {}) as Record<string, unknown>;
      for (const id of clientIds) {
        const siennes = (rs || []).filter((r: { client_id: string }) => r.client_id === id) as { id: string; active: boolean | null }[];
        const voulue = typeof voulues[id] === 'string' ? siennes.find(r => r.id === voulues[id]) : undefined;
        dossier[id] = (voulue || siennes.find(r => r.active !== false) || siennes[0])?.id || null;
      }
    }

    /* ── L'envoi : un message par destinataire, envoyés par lots (V3.50) ;
          avec des copies, un seul message pour tous (V3.234). `traces` :
          les personnes que ce message touche, pour leur Suivi. ── */
    const texteBrut = htmlVersTexte(corps);
    const marque = Date.now();
    const adressesDe = (role: Role) => dests.filter(d => d.role === role).flatMap(d => d.a.map(email => ({ email, nom: d.nomMail[email] || '' })));
    const fabriquer = (pour: ReturnType<typeof pourGroupe>) => ({
      sujet: personnaliserObjet(objet, pour, conseiller) || objet,
      html: mailLibreHtml({ style, corps: personnaliserHtml(corps, pour, conseiller), h, liens, jours: LIENS_JOURS }),
      texte: `${personnaliserTexte(texteBrut, pour, conseiller)}${texteLiens(liens, LIENS_JOURS)}`,
    });
    const lot = groupe
      ? [{
          traces: dests, a: adressesDe('a'), cc: adressesDe('cc'), cci: adressesDe('cci'),
          ...fabriquer(pourGroupe(dests.filter(d => d.role === 'a').map(d => ({ prenom: d.prenom, nom: d.famille, reference: d.reference })))),
          id: `mail-groupe-${marque}`,
        }]
      : dests.map((d, i) => ({
          traces: [d], a: d.a.map(email => ({ email, nom: d.nomMail[email] || '' })), cc: [] as Adresse[], cci: [] as Adresse[],
          ...fabriquer({ prenom: d.prenom, nom: d.famille, reference: d.reference }),
          id: `mail-${d.clientId || 'libre'}-${marque}-${i}`,
        }));
    /* Le nom d'un message dans les comptes rendus : la personne, ou tout « À ». */
    const nomMessage = (m: typeof lot[number]) => m.traces.filter(d => d.role === 'a').map(d => d.nom || d.a[0]).join(', ');
    /* Ce que le Suivi écrit en tête : « À : … », puis les copies. */
    const enTete = groupe ? [
      `À : ${lot[0].a.map(x => x.email).join(', ')}`,
      ...(lot[0].cc.length ? [`Cc : ${lot[0].cc.map(x => x.email).join(', ')}`] : []),
      ...(lot[0].cci.length ? [`Cci : ${lot[0].cci.map(x => x.email).join(', ')}`] : []),
    ].join('\n') : '';
    /* Les lots, dans l'ordre, tant qu'il reste le temps de noter ensuite. */
    const poidsPj = pj.reduce((t, p) => t + p.base64.length, 0);
    const lots: number[][] = [];
    let courant: number[] = [], poids = 0;
    lot.forEach((m, i) => {
      const p = poidsPj + m.html.length + m.texte.length;
      if (courant.length && (courant.length >= LOT_MAX_MESSAGES || poids + p > LOT_MAX_OCTETS)) { lots.push(courant); courant = []; poids = 0; }
      courant.push(i); poids += p;
    });
    if (courant.length) lots.push(courant);
    /* Par message : null = parti, un texte = pas parti (et pourquoi),
       'incertain' = on ne sait pas. */
    const etat: (string | null | 'incertain')[] = lot.map(() => 'le temps a manqué : renvoie-le-lui');
    const fin = debut + (maxDuration - 15) * 1000;
    for (const l of lots) {
      if (fin - Date.now() < 8_000) break;
      parti = true;
      const r = await mailjetLot(l.map(i => ({ a: lot[i].a, cc: lot[i].cc, cci: lot[i].cci, sujet: lot[i].sujet, texte: lot[i].texte, html: lot[i].html, id: lot[i].id })), pj, fin - Date.now());
      l.forEach((i, n) => {
        etat[i] = r.incertain ? 'incertain' : r.erreurs[n];
        if (etat[i] !== null) return;
        /* V3.151 : on vérifiera qu'il est bien arrivé (src/lib/remise-mail.ts). */
        const infoDe = (d: Dest) => ({ clientId: d.clientId, rechercheId: d.clientId ? dossier[d.clientId] || null : null, nom: d.nom, objet: lot[i].sujet });
        if (!groupe) noterRemises(r.brut, infoDe(lot[i].traces[0]), n);
        else {
          /* V3.234 : chaque adresse, en « À » comme en copie. */
          noterRemisesCopies(r.brut, n, email => {
            const d = lot[i].traces.find(x => x.a.includes(email));
            return d ? infoDe(d) : { objet: lot[i].sujet };
          });
        }
      });
    }

    /* La trace, pour un contact du CRM : l'envoi, et son Suivi. Tout en même
       temps (pas l'un après l'autre), pour finir bien avant la limite. */
    const lignePieces = noms.length ? `\n\n${mode === 'pj' ? 'Pièces jointes' : `Liens de téléchargement (${LIENS_JOURS} jours)`} : ${noms.join(', ')}` : '';
    const TITRES: Record<Role, string> = { a: '✉️ Mail envoyé', cc: '✉️ Mail en copie', cci: '✉️ Mail en copie cachée' };
    const noter = (m: typeof lot[number], d: Dest, incertain: boolean) => {
      if (!d.clientId) return Promise.resolve();
      const rid = dossier[d.clientId] || null;
      return Promise.all([
        incertain ? Promise.resolve(true) : ecritServeur('L’envoi (communications)', sb.from('envois').insert({
          client_id: d.clientId, recherche_id: rid, type: 'mail_libre', objet: m.sujet, corps: m.texte,
          destinataires: d.a, biens_ids: [], sms_envoye: false,
        }), avertissements),
        ecritServeur('Le Suivi du contact', sb.from('journal').insert({
          client_id: d.clientId, recherche_id: rid, type: 'mail_envoye',
          titre: incertain ? `✉️ Mail peut-être parti — ${m.sujet}` : `${TITRES[d.role]} — ${m.sujet}`,
          description: `${incertain ? 'Mailjet n’a pas répondu à temps : ce mail est peut-être parti, peut-être pas. Vérifie avec lui avant de le renvoyer.\n\n' : ''}${groupe ? enTete : `À : ${d.a.join(', ')}`}\n\n${m.texte}${lignePieces}`,
          metadata: { source: 'nouveau_mail', style, pieces: noms, ...(d.role !== 'a' ? { copie: d.role } : {}), ...(incertain ? { incertain: true } : {}) },
        }), avertissements),
      ]).then(() => undefined);
    };

    const envoyes: { nom: string; a: string[]; clientId: string | null; role: Role }[] = [];
    const incertains: string[] = [];
    lot.forEach((m, i) => {
      const e = etat[i];
      if (e === 'incertain') incertains.push(nomMessage(m));
      else if (e) echecs.push(`${nomMessage(m)} (${e})`);
      else m.traces.forEach(d => envoyes.push({ nom: d.nom, a: d.a, clientId: d.clientId, role: d.role }));
    });
    await Promise.all(lot.flatMap((m, i) => (etat[i] === null || etat[i] === 'incertain' ? m.traces.map(d => noter(m, d, etat[i] === 'incertain')) : [])));
    if (!envoyes.length && incertains.length) {
      return NextResponse.json({
        ok: false, incertain: true, incertains, echecs,
        erreur: 'L’envoi a peut-être été fait en partie : vérifie le Suivi des contacts avant de renvoyer.',
      }, { status: 502 });
    }
    if (!envoyes.length) return ko(`Le mail n’est pas parti : ${echecs.join(' · ')}`, 502);
    return NextResponse.json({ ok: true, envoyes, echecs, incertains, avertissements, mode });
  } catch (e) {
    /* Après le départ vers Mailjet, on ne sait pas : on le dit (V3.50). */
    if (parti) return NextResponse.json({ ok: false, incertain: true, erreur: `L’envoi a peut-être été fait en partie : vérifie le Suivi des contacts avant de renvoyer. (${(e as Error).message || 'erreur'})` }, { status: 500 });
    return ko((e as Error).message || 'Erreur', 500);
  }
}
