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

export type NouveauDestinataire = { prenom: string; nom: string; societe: string; email: string; telephone: string };
export type ModeReco = 'en_ligne' | 'sur_place';
export type DemandeReconnaissance = {
  bien: BienVente;
  client: ClientMini | null;
  nouveau: NouveauDestinataire | null;
  email: string;
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
  return `${euros(a.hono)} HT${a.taux !== null ? `, soit ${pourcent(a.taux)}` : ''}, à la charge ${d.charge === 'vendeur' ? (estMurs(d) ? 'du vendeur' : 'du cédant') : 'de l’acquéreur'}`;
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
    societe: societeDe(client) || x.nouveau?.societe.trim() || '',
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

/* Le client : la fiche choisie (son adresse e-mail ajoutée si elle est
   nouvelle), ou une fiche créée. */
async function leClient(x: DemandeReconnaissance, avert: string[]): Promise<ClientMini> {
  const email = x.email.trim().toLowerCase();
  if (x.client) {
    const c = x.client;
    if (email && !(c.emails || []).some(e => String(e || '').trim().toLowerCase() === email)) {
      const emails = [...(c.emails || []), email];
      const { data, error } = await supabase.from('clients').update({ emails, updated_at: new Date().toISOString() }).eq('id', c.id).select('id');
      if (error || !data?.length) avert.push(`Son adresse ${email} n’a pas pu être ajoutée à sa fiche${error ? ` (${error.message})` : ''} : ajoute-la à la main.`);
      else return { ...c, emails };
    }
    return c;
  }
  const n = x.nouveau;
  if (!n || !(n.nom.trim() || n.prenom.trim() || n.societe.trim())) throw new Error('Pour qui est la reconnaissance ? Choisis un contact, ou donne au moins son nom.');
  const p: Personne = { ...PERSONNE_VIDE, prenom: n.prenom.trim(), nom: n.nom.trim(), email, telephone: n.telephone.trim() };
  return creerFicheAcheteur(p, n.societe.trim() ? { denomination: n.societe.trim() } : null);
}

export async function faireReconnaissance(x: DemandeReconnaissance): Promise<ResultatReconnaissance> {
  const email = x.email.trim().toLowerCase();
  if (x.signature === 'en_ligne' && !x.relire && !emailOk(email)) throw new Error('Son adresse e-mail ? Le lien de signature et le code y partent.');
  if (email && !emailOk(email)) throw new Error(`« ${x.email.trim()} » n’est pas une adresse e-mail valide.`);
  const avert: string[] = [];
  const client = await leClient(x, avert);
  const p: Personne = { ...personneDepuisClient(client), ...(email ? { email } : {}) };
  const donnees = await donneesDe(x, client, p);
  const m = RECONNAISSANCE;
  const { data, error } = await supabase.from('documents').insert({
    modele: m.id, categorie: m.categorie, statut: 'brouillon', donnees, ...colonnesListe(m, donnees),
    client_id: client.id, bien_id: null, recherche_id: null,
  }).select('*').single();
  if (error || !data) throw new Error('La reconnaissance n’a pas pu être créée : ' + (error?.message || 'rien n’est revenu'));
  const row = data as DocumentRow;
  const qui = [nomClient(client) !== 'Client' ? nomClient(client) : '', societeDe(client) || x.nouveau?.societe.trim() || ''].filter(Boolean).join(', ') || 'Le demandeur';
  const noter = async (commentaire: string) => {
    try {
      await ajouterSuivi({ bien_id: x.bien.id, type: 'note', client_id: client.id, qui, commentaire, donnees: { document: row.id, reconnaissance: true } });
    } catch (e) { avert.push((e as Error).message); }
  };
  if (x.relire) {
    await noter(`🛡️ Reconnaissance d’information préparée pour ${qui} : à relire, puis à faire signer.`);
    return { id: row.id, client, etat: 'brouillon', avertissements: avert };
  }
  /* Le PDF figé. Raté : le brouillon reste, il s'ouvre dans Documents. */
  try { await finaliser(row, m, donnees); } catch (e) {
    avert.push(`Le document est créé, mais pas encore prêt à signer : ${(e as Error).message}`);
    await noter(`🛡️ Reconnaissance d’information préparée pour ${qui}.`);
    return { id: row.id, client, etat: 'brouillon', avertissements: avert };
  }
  if (x.signature === 'sur_place') {
    await noter(`🛡️ Reconnaissance d’information prête pour ${qui} : à signer sur place.`);
    return { id: row.id, client, etat: 'pret', avertissements: avert };
  }
  try {
    const r = await appelSignature<{ echecs?: string[] }>({ action: 'lancer', id: row.id, signataires: [{ cle: 'd0', email }] });
    if (r.echecs?.length) avert.push(`La signature est lancée, mais : ${r.echecs.join(' ; ')}`);
  } catch (e) {
    avert.push(`Le document est prêt, mais le lien de signature n’est pas parti : ${(e as Error).message} Envoie-le depuis Documents.`);
    await noter(`🛡️ Reconnaissance d’information prête pour ${qui} : le lien de signature reste à envoyer.`);
    return { id: row.id, client, etat: 'pret', avertissements: avert };
  }
  await noter(`🛡️ Reconnaissance d’information envoyée à ${qui} (${email}) : il la signe en ligne, avec un code reçu par e-mail. Tu reçois le document signé${x.adresseApres === 'auto' ? ', et l’adresse du local lui part toute seule' : ''}.`);
  return { id: row.id, client, etat: 'envoye', avertissements: avert };
}
