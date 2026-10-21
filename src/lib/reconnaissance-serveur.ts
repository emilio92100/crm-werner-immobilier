/* ═══ La reconnaissance d'information signée : l'adresse du local ═════════
   Alexandre (21 octobre 2026) : « quand c'est signé, il a la notification
   et il peut donner les informations : en un seul clic, ou tout seul ? ».
   Le document ne dit jamais l'adresse (src/lib/actes/reconnaissance.ts) :
   elle part ici, par e-mail, au client qui a signé —
     · toute seule, dès la dernière signature (`classer`,
       src/lib/signature-documents.ts), sauf si Werner a choisi de la donner
       lui-même (`donnees.adresseApres === 'main'`) ;
     · ou d'un clic, « Lui envoyer l'adresse » sur la fiche de l'affaire
       (/api/documents/adresse).
   Le mail donne l'adresse exacte, le local, sa référence et le lien de sa
   fiche ; Werner en reçoit une copie cachée. Une ligne va dans l'historique
   de l'affaire (`donnees.adresseEnvoyee`, que la fiche lit pour ne plus
   proposer le bouton) et dans le suivi du client. Côté serveur seulement
   (clé de service). */

import type { SupabaseClient } from '@supabase/supabase-js';
import { txt, lirePersonnes, type Donnees } from './actes';
import { envoyerMail, gabarit, echappe, ALERTES } from './mandat-serveur';
import { lienBienPublic } from './jeton';

export type DocReco = { id: string; modele: string; statut: string; titre: string | null; client_id: string | null; donnees: Donnees };

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const sansCourbes = (t: string) => t.replace(/’/g, "'");
const bouton = (href: string, texte: string) =>
  `<a href="${href}" style="display:inline-block;margin:6px 0 4px;background:#f08c42;color:#232528;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:800;font-size:15px">${echappe(texte)}</a>`;

/* L'adresse exacte : celle de l'affaire aujourd'hui (corrigée depuis,
   peut-être), sinon celle des réponses du document. */
async function adresseDe(sb: SupabaseClient, doc: DocReco): Promise<{ ligne: string; reference: string; bienId: string }> {
  const d = doc.donnees || {};
  const bienId = txt(d, 'bienVenteId');
  let a = { adresse: txt(d, 'adresse'), cp: txt(d, 'cp'), ville: txt(d, 'ville') };
  let reference = txt(d, 'reference');
  if (bienId) {
    const { data, error } = await sb.from('biens_vente').select('reference, donnees').eq('id', bienId).maybeSingle();
    if (error) console.error('[reconnaissance] lire l’affaire', error.message);
    const bd = ((data as { donnees?: Donnees } | null)?.donnees || {}) as Donnees;
    if (txt(bd, 'adresse')) a = { adresse: txt(bd, 'adresse'), cp: txt(bd, 'cp'), ville: txt(bd, 'ville') };
    reference = (data as { reference?: string | null } | null)?.reference || reference;
  }
  return { ligne: [a.adresse, [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), reference, bienId };
}

/* À qui : celui qui a signé (son adresse au moment de signer), sinon celle
   du document, sinon celle de sa fiche. */
async function destinataireDe(sb: SupabaseClient, doc: DocReco): Promise<{ email: string; prenom: string; nom: string } | null> {
  const { data } = await sb.from('documents_signataires').select('cle, statut, personne').eq('document_id', doc.id).eq('statut', 'signe');
  for (const s of (data || []) as { cle: string; personne?: { email?: string; prenom?: string; nom?: string } | null }[]) {
    if (s.cle !== 'agence' && s.personne?.email && emailOk(s.personne.email)) return { email: s.personne.email.trim().toLowerCase(), prenom: s.personne.prenom || '', nom: s.personne.nom || '' };
  }
  const p = lirePersonnes(doc.donnees?.destinataires).find(x => emailOk(x.email || ''));
  if (p) return { email: p.email.trim().toLowerCase(), prenom: p.prenom, nom: p.nom };
  if (doc.client_id) {
    const { data: c } = await sb.from('clients').select('prenom, nom, emails').eq('id', doc.client_id).maybeSingle();
    const cl = c as { prenom?: string | null; nom?: string | null; emails?: string[] | null } | null;
    const e = (cl?.emails || []).find(x => emailOk(String(x || '')));
    if (e) return { email: e.trim().toLowerCase(), prenom: cl?.prenom || '', nom: cl?.nom || '' };
  }
  return null;
}

/* Envoie l'adresse ; rend null, ou ce qui n'a pas marché. */
export async function envoyerAdresseReco(sb: SupabaseClient, doc: DocReco, o: { auto: boolean }): Promise<string | null> {
  if (doc.modele !== 'reconnaissance') return 'ce document n’est pas une reconnaissance';
  const qui = await destinataireDe(sb, doc);
  if (!qui) return 'pas d’adresse e-mail pour lui envoyer l’adresse du local : donne-la-lui de vive voix';
  const { ligne, reference, bienId } = await adresseDe(sb, doc);
  if (!ligne) return 'l’affaire n’a pas d’adresse à lui envoyer';
  const d = doc.donnees || {};
  const local = [txt(d, 'description'), reference ? `réf. ${reference}` : ''].filter(Boolean).join(' · ');
  const lien = bienId ? lienBienPublic(bienId) : '';
  const prenom = qui.prenom || [qui.prenom, qui.nom].filter(Boolean).join(' ') || '';
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const merci = 'Merci pour votre signature. Comme convenu, voici l’adresse du local :';
  const suite = 'Pour le visiter ou pour toute question, répondez simplement à ce message, ou appelez-moi au 01 87 66 06 00. Comme prévu dans la reconnaissance que vous avez signée, merci de passer par nous pour toute démarche sur ce local.';
  const erreur = await envoyerMail({
    a: qui.email, nomA: [qui.prenom, qui.nom].filter(Boolean).join(' ') || undefined,
    repondreA: 'contact@wernerimmobilier.com', cci: ALERTES(),
    sujet: `L’adresse du local${reference ? ` (réf. ${reference})` : ''}`,
    texte: sansCourbes(`${bonjour}\n\n${merci}\n\n${ligne}\n${local}${lien ? `\n\nLa fiche du local : ${lien}` : ''}\n\n${suite}\n\nWerner\nWerner Immobilier`),
    html: gabarit('L’adresse du local', `<p>${echappe(bonjour)}</p><p>${echappe(merci)}</p>
      <p style="font-size:17px;font-weight:800;color:#232528;margin:14px 0 2px">${echappe(ligne)}</p>
      ${local ? `<p style="margin-top:0;color:#5B6B80">${echappe(local)}</p>` : ''}
      ${lien ? `<p>${bouton(lien, 'Voir la fiche du local')}</p>` : ''}
      <p>${echappe(suite)}</p><p>Werner<br>Werner Immobilier</p>`,
      'Cette adresse vous est communiquée dans le cadre de la reconnaissance d’information que vous avez signée.'),
  });
  if (erreur) return `l’adresse du local n’est pas partie (${erreur})`;
  const le = new Date().toISOString();
  const nom = [qui.prenom, qui.nom].filter(Boolean).join(' ') || qui.email;
  const pbs: string[] = [];
  if (bienId) {
    const { error } = await sb.from('biens_vente_suivi').insert({
      bien_id: bienId, type: 'note', le, client_id: doc.client_id || null, qui: nom,
      commentaire: `📍 Adresse du local envoyée à ${nom} (${qui.email})${o.auto ? ', toute seule, dès sa signature' : ''} : ${ligne}.`,
      donnees: { document: doc.id, reconnaissance: true, adresseEnvoyee: true, a: qui.email },
    });
    if (error) pbs.push('historique de l’affaire : ' + error.message);
  }
  if (doc.client_id) {
    const { error } = await sb.from('journal').insert({
      client_id: doc.client_id, type: 'mandat', titre: '📍 Adresse du local envoyée',
      description: `${ligne}${local ? ` · ${local}` : ''} · envoyée à ${qui.email}${o.auto ? ', dès la signature de la reconnaissance' : ''}`,
      metadata: { document_id: doc.id },
    });
    if (error) pbs.push('suivi du client : ' + error.message);
  }
  return pbs.length ? `l’adresse est partie, mais pas notée : ${pbs.join(' ; ')}` : null;
}
