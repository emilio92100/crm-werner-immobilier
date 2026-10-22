/* ═══ La reconnaissance d'information, depuis la fiche d'une affaire ═══════
   Werner, 21 octobre 2026 : « avant de donner l'adresse d'un local, un
   bouton : il met le mail du client, le client signe électroniquement, et
   moi je reçois la notification et le document signé ». Le modèle est dans
   src/lib/actes/reconnaissance.ts ; la fenêtre, FenReconnaissance.tsx.

   Ce que fait `faireReconnaissance`, dans l'ordre :
     1. le client : la fiche choisie, ou une fiche créée (demandeur,
        prospect : il arrive dans « Demandeurs non filtrés » tant que sa
        recherche n'est pas prise) ; une adresse e-mail nouvelle s'ajoute
        à sa fiche ;
     2. le document, prérempli avec le local, le montant, les honoraires ;
     3. en ligne : le PDF est figé, la signature part (lien et code par
        e-mail) ; sur place : le PDF est figé, Documents s'ouvre sur
        « Signer sur place » ; « Relire d'abord » : le brouillon s'ouvre ;
     4. une ligne dans l'historique de l'affaire.
   Une étape qui rate après la création du document ne défait rien : le
   document existe, l'écran dit ce qui reste à faire. */

import { supabase } from '@/lib/supabase';
import { PERSONNE_VIDE, type Donnees, type Personne } from '@/lib/actes';
import { RECONNAISSANCE, lieuDe } from '@/lib/actes/reconnaissance';
import { argentBien, contexteDocument, personneDepuisClient, pourcent, type BienVente } from '@/lib/biens-vente';
import { auPoste, estLocation, estMurs, localCourt, natureDe, nbPostesDe } from '@/lib/affaires';
import { euros } from '@/lib/mandat';
import { lirePro, lireStructure } from '@/lib/contacts';
import { appelSignature, colonnesListe, finaliser, identiteDuJour, type DocumentRow } from '@/components/documents/outils';
import { ajouterSuivi, creerFicheAcheteur, nomClient, type ClientMini } from './outils';

/* Les coordonnées du demandeur, telles que Werner les tape (23 octobre 2026 :
   civilité, prénom, nom, téléphone et e-mail obligatoires pour que la
   reconnaissance parte ; l'adresse et la société, s'il y en a). Elles vont
   dans le document, et complètent sa fiche. */
export type NouveauDestinataire = { civilite: '' | 'Madame' | 'Monsieur'; prenom: string; nom: string; societe: string; email: string; telephone: string; adresse: string };
export const COORD_VIDE: NouveauDestinataire = { civilite: '', prenom: '', nom: '', societe: '', email: '', telephone: '', adresse: '' };
/* Ce qui manque pour que la reconnaissance parte. */
export function coordManquantes(k: NouveauDestinataire): string[] {
  const out: string[] = [];
  if (!k.civilite) out.push('sa civilité');
  if (!k.prenom.trim()) out.push('son prénom');
  if (!k.nom.trim()) out.push('son nom');
  if (k.telephone.replace(/\D/g, '').length < 9) out.push('son téléphone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(k.email.trim())) out.push('son e-mail');
  return out;
}
export type ModeReco = 'en_ligne' | 'sur_place';
export type DemandeReconnaissance = {
  bien: BienVente;
  /* La fiche choisie, ou null : elle se crée avec ces coordonnées. */
  client: ClientMini | null;
  coord: NouveauDestinataire;
  duree: number;
  signature: ModeReco;
  /* Une fois signée, l'adresse part toute seule (auto), ou Werner la donne. */
  adresseApres: 'auto' | 'main';
  /* Le brouillon seulement : il s'ouvre dans Documents pour être relu. */
  relire?: boolean;
};
export type ResultatReconnaissance = {
  id: string; client: ClientMini;
  /* envoye : les liens sont partis ; pret : à signer sur place ; brouillon : à relire. */
  etat: 'envoye' | 'pret' | 'brouillon';
  avertissements: string[];
};

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const societeDe = (c: ClientMini | null | undefined) => (c ? lireStructure(lirePro(c.pro).structure)?.denomination || '' : '');

/* « Local commercial de 55 m², à louer » ; au poste : « Bureaux
   équipés, 4 postes disponibles ». */
export function descriptionLocal(b: BienVente): string {
  const d = b.donnees || {};
  const s = typeof d.surface === 'number' ? d.surface : Number(d.surface) || null;
  if (auPoste(d)) {
    const n = nbPostesDe(d);
    return `Bureaux équipés${s ? ` (${String(s).replace('.', ',')} m²)` : ''}${n ? `, ${n} poste${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''}` : ''}, loués au poste de travail`;
  }
  const local = d.typeBien === 'autre' ? 'Local' : localCourt(d.typeBien) || 'Local';
  const nat = natureDe(d);
  const suite = nat === 'location' ? 'à louer' : nat === 'cession_bail' ? 'droit au bail à céder' : nat === 'fonds' ? 'fonds de commerce à céder'
    : nat === 'murs' ? 'murs à vendre' : nat === 'murs_occupes' ? 'murs occupés à vendre' : '';
  return [`${local}${s ? ` de ${String(s).replace('.', ',')} m²` : ''}`, suite].filter(Boolean).join(', ');
}

/* Le montant, comme le site l'affiche : une location au mois, avec l'année. */
export function montantReconnaissance(b: BienVente): string {
  const d = b.donnees || {};
  const a = argentBien(d);
  if (!a.prix) return '';
  if (auPoste(d)) return `${euros(a.prix / 12)} HT par poste et par mois`;
  if (estLocation(d)) return `${euros(a.prix / 12)} HT HC par mois, soit ${euros(a.prix)} HT HC par an`;
  return `${euros(a.prix)}${a.acq && a.hono ? ' honoraires inclus' : ''}`;
}

/* Les honoraires, pour chiffrer l'indemnité s'il passait outre. */
export function honorairesReconnaissance(b: BienVente): string {
  const d = b.donnees || {};
  const a = argentBien(d);
  if (a.hono === null || !a.hono) return '';
  if (estLocation(d)) {
    return `${euros(a.hono)} HT${a.taux !== null ? `, soit ${pourcent(a.taux)} du loyer annuel HT HC` : ''}, à la charge du ${d.charge === 'vendeur' ? 'bailleur' : 'preneur'}`;
  }
  return `${euros(a.hono)} HT${a.taux !== null ? `, soit ${pourcent(a.taux)}` : ''}, à la charge ${d.charge === 'vendeur' ? (estMurs(d) ? 'du vendeur' : 'du cédant') : (estMurs(d) ? 'de l’acquéreur' : 'du cessionnaire')}`;
}

/* Ce que le document dira du lieu (le secteur, jamais l'adresse), pour
   l'aperçu de la fenêtre. */
export function lieuReconnaissance(b: BienVente): string {
  const d = b.donnees || {};
  return lieuDe({ cp: d.cp, ville: d.ville, quartier: d.quartier });
}

/* Les réponses du document, préremplies. */
async function donneesDe(x: DemandeReconnaissance, client: ClientMini, p: Personne): Promise<Donnees> {
  const identite = await identiteDuJour();
  const b = x.bien;
  const d = b.donnees || {};
  const base = RECONNAISSANCE.defaut({ identite, client: null, bien: contexteDocument(b), visite: null, recherche: null });
  return {
    ...base,
    bienVenteId: b.id,
    ...(natureDe(d) ? { nature: natureDe(d) } : {}),
    destinataires: [p],
    societe: x.coord.societe.trim() || societeDe(client),
    description: descriptionLocal(b),
    adresse: typeof d.adresse === 'string' ? d.adresse : '', cp: typeof d.cp === 'string' ? d.cp : '',
    ville: typeof d.ville === 'string' ? d.ville : '', quartier: typeof d.quartier === 'string' ? d.quartier : '',
    montant: montantReconnaissance(b),
    reference: b.reference || '',
    duree: x.duree,
    honoraires: honorairesReconnaissance(b),
    signature: x.signature,
    adresseApres: x.adresseApres,
  };
}

/* Le client : la fiche choisie, complétée de ce qui lui manquait (rien
   n'est écrasé : un téléphone ou un e-mail nouveau s'ajoute aux siens), ou
   une fiche créée avec ces coordonnées. */
async function leClient(x: DemandeReconnaissance, avert: string[]): Promise<ClientMini> {
  const k = x.coord;
  const email = k.email.trim().toLowerCase();
  if (x.client) {
    const c = x.client;
    const patch: Record<string, unknown> = {};
    if (k.civilite && !c.civilite) patch.civilite = k.civilite;
    if (k.prenom.trim() && !(c.prenom || '').trim()) patch.prenom = k.prenom.trim();
    if (k.nom.trim() && !(c.nom || '').trim()) patch.nom = k.nom.trim();
    if (k.adresse.trim() && !(c.adresse || '').trim()) patch.adresse = k.adresse.trim();
    if (email && !(c.emails || []).some(e => String(e || '').trim().toLowerCase() === email)) patch.emails = [...(c.emails || []), email];
    const cleTel = (t: string) => String(t || '').replace(/\D/g, '').slice(-9);
    const tel = k.telephone.trim();
    if (tel && !(c.telephones || []).some(t => cleTel(t) === cleTel(tel))) patch.telephones = [...(c.telephones || []), tel];
    const soc = k.societe.trim();
    if (soc && !societeDe(c)) {
      const brut = c.pro && typeof c.pro === 'object' && !Array.isArray(c.pro) ? c.pro as Record<string, unknown> : {};
      const st = brut.structure && typeof brut.structure === 'object' && !Array.isArray(brut.structure) ? brut.structure as Record<string, unknown> : {};
      patch.pro = { ...brut, structure: { forme: '', rcs: '', siege: '', qualite: '', associes: [], ...st, denomination: soc } };
    }
    if (!Object.keys(patch).length) return c;
    const { data, error } = await supabase.from('clients').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', c.id).select('id');
    if (error || !data?.length) {
      avert.push(`Sa fiche n’a pas pu être complétée${error ? ` (${error.message})` : ''} : ajoute ses coordonnées à la main. La reconnaissance, elle, les porte.`);
      return c;
    }
    return { ...c, ...patch } as ClientMini;
  }
  if (!(k.nom.trim() || k.prenom.trim())) throw new Error('Pour qui est la reconnaissance ? Choisis un contact, ou donne au moins son nom.');
  const p: Personne = { ...PERSONNE_VIDE, civilite: k.civilite, prenom: k.prenom.trim(), nom: k.nom.trim(), email, telephone: k.telephone.trim(), adresse: k.adresse.trim() };
  return creerFicheAcheteur(p, k.societe.trim() ? { denomination: k.societe.trim() } : null);
}

export async function faireReconnaissance(x: DemandeReconnaissance): Promise<ResultatReconnaissance> {
  const email = x.coord.email.trim().toLowerCase();
  const manque = coordManquantes(x.coord);
  if (manque.length) throw new Error(`Pour que la reconnaissance parte, il manque ${manque.join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
  if (!emailOk(email)) throw new Error(`« ${x.coord.email.trim()} » n’est pas une adresse e-mail valide.`);
  const avert: string[] = [];
  const client = await leClient(x, avert);
  /* Le document porte ce que Werner a tapé (la fiche, elle, n'est que complétée). */
  const p: Personne = {
    ...personneDepuisClient(client),
    civilite: x.coord.civilite || (personneDepuisClient(client).civilite),
    prenom: x.coord.prenom.trim() || client.prenom || '', nom: x.coord.nom.trim() || client.nom || '',
    adresse: x.coord.adresse.trim() || client.adresse || '', email, telephone: x.coord.telephone.trim(),
  };
  const donnees = await donneesDe(x, client, p);
  const m = RECONNAISSANCE;
  const { data, error } = await supabase.from('documents').insert({
    modele: m.id, categorie: m.categorie, statut: 'brouillon', donnees, ...colonnesListe(m, donnees),
    client_id: client.id, bien_id: null, recherche_id: null,
  }).select('*').single();
  if (error || !data) throw new Error('La reconnaissance n’a pas pu être créée : ' + (error?.message || 'rien n’est revenu'));
  const row = data as DocumentRow;
  const qui = [nomClient(client) !== 'Client' ? nomClient(client) : '', x.coord.societe.trim() || societeDe(client)].filter(Boolean).join(', ') || 'Le demandeur';
  /* `etape` : ce que l'historique de l'affaire en dit (FicheBien, historique). */
  const noter = async (commentaire: string, etape: 'preparee' | 'prete' | 'envoyee') => {
    try {
      await ajouterSuivi({ bien_id: x.bien.id, type: 'note', client_id: client.id, qui, commentaire, donnees: { document: row.id, reconnaissance: true, etape } });
    } catch (e) { avert.push((e as Error).message); }
  };
  if (x.relire) {
    await noter('À relire dans Documents, puis à faire signer.', 'preparee');
    return { id: row.id, client, etat: 'brouillon', avertissements: avert };
  }
  /* Le PDF figé. Raté : le brouillon reste, il s'ouvre dans Documents. */
  try { await finaliser(row, m, donnees); } catch (e) {
    avert.push(`Le document est créé, mais pas encore prêt à signer : ${(e as Error).message}`);
    await noter('Le document est créé : à terminer dans Documents.', 'preparee');
    return { id: row.id, client, etat: 'brouillon', avertissements: avert };
  }
  if (x.signature === 'sur_place') {
    await noter('À signer sur place, sur ton écran.', 'prete');
    return { id: row.id, client, etat: 'pret', avertissements: avert };
  }
  try {
    const r = await appelSignature<{ echecs?: string[] }>({ action: 'lancer', id: row.id, signataires: [{ cle: 'd0', email }] });
    if (r.echecs?.length) avert.push(`La signature est lancée, mais : ${r.echecs.join(' ; ')}`);
  } catch (e) {
    avert.push(`Le document est prêt, mais le lien de signature n’est pas parti : ${(e as Error).message} Envoie-le depuis Documents.`);
    await noter('Le lien de signature reste à envoyer, depuis Documents.', 'prete');
    return { id: row.id, client, etat: 'pret', avertissements: avert };
  }
  await noter(`À ${email} : signature en ligne, avec un code reçu par e-mail. Tu reçois le document signé${x.adresseApres === 'auto' ? ', et l’adresse du local part toute seule dès la signature' : ''}.`, 'envoyee');
  return { id: row.id, client, etat: 'envoye', avertissements: avert };
}
