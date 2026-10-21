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
   Le mail : la photo du local, son adresse exacte, ce qu'il est (type,
   surface, montant, référence), le lien de sa fiche, et comment joindre
   Werner (téléphone, e-mail). Pas de copie à Werner (Alexandre : « quel
   intérêt ? ») : son mail « Signé par tous » le lui dit, et le mail
   lui-même se relit dans l'historique (« Voir le mail »).
   Sans adresse exacte sur l'affaire (le numéro et la rue), rien ne part : il
   est prévenu, et « Lui envoyer l'adresse » l'attend une fois complétée.
   Tout se note, avec le mail lui-même (« Voir le mail ») : dans
   l'historique de l'affaire (`biens_vente_suivi`, `donnees.adresseEnvoyee`,
   que la fiche lit aussi pour ne plus proposer le bouton) et dans le suivi
   du client (`journal`, type `mail_envoye`). Côté serveur seulement. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { txt, lirePersonnes, type Donnees } from './actes';
import { envoyerMail, gabarit, echappe } from './mandat-serveur';
import { lienBienPublic } from './jeton';
import { euros } from './mandat';
import { annoncePourSite } from './annonces-site';
import type { BienVente } from './biens-vente';

export type DocReco = { id: string; modele: string; statut: string; titre: string | null; client_id: string | null; donnees: Donnees };

const TEL = '01 87 66 06 00';
const MAIL_AGENCE = 'contact@wernerimmobilier.com';
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const sansCourbes = (t: string) => t.replace(/’/g, "'");
const insec = (t: string) => echappe(t).replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;').replace(/(\d) €/g, '$1&nbsp;€');
const bouton = (href: string, texte: string) =>
  `<a href="${href}" style="display:inline-block;margin:6px 0 4px;background:#f08c42;color:#232528;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:800;font-size:15px">${echappe(texte)}</a>`;

/* Le local, tel que l'affaire le dit aujourd'hui (corrigée depuis, peut-être) :
   son adresse exacte, sa photo, ce qu'il est et son montant. */
type Local = { rue: string; ligne: string; reference: string; bienId: string; photo: string; quoi: string; montant: string };
async function localDe(sb: SupabaseClient, doc: DocReco): Promise<Local> {
  const d = doc.donnees || {};
  const bienId = txt(d, 'bienVenteId');
  let a = { adresse: txt(d, 'adresse'), cp: txt(d, 'cp'), ville: txt(d, 'ville') };
  let reference = txt(d, 'reference'), photo = '', quoi = txt(d, 'description'), montant = txt(d, 'montant');
  if (bienId) {
    const { data, error } = await sb.from('biens_vente').select('*').eq('id', bienId).maybeSingle();
    if (error) console.error('[reconnaissance] lire l’affaire', error.message);
    const b = data as BienVente | null;
    if (b) {
      const bd = (b.donnees || {}) as Donnees;
      a = { adresse: txt(bd, 'adresse'), cp: txt(bd, 'cp') || b.code_postal || '', ville: txt(bd, 'ville') || b.ville || '' };
      reference = b.reference || reference;
      const an = annoncePourSite(b);
      photo = an.photos[0] || '';
      quoi = [an.typeLib, an.surface ? `${String(an.surface).replace('.', ',')} m²` : '', an.natureCourt].filter(Boolean).join(' · ') || quoi;
      /* Une location au mois, comme sur le site ; au poste, le prix d'un poste. */
      montant = !an.montant ? montant
        : an.parPoste ? `${euros(an.montant / 12)} HT par poste et par mois${an.nbPostes ? ` · ${an.nbPostes} poste${an.nbPostes > 1 ? 's' : ''} disponible${an.nbPostes > 1 ? 's' : ''}` : ''}`
        : an.nature === 'location' ? `Loyer : ${euros(an.montant / 12)} HT HC par mois (${euros(an.montant)} HT HC par an)`
        : `${an.montantLib} : ${an.montantTexte}`;
    }
  }
  return { rue: a.adresse, ligne: [a.adresse, [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '), reference, bienId, photo, quoi, montant };
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

/* Le mail, en texte et en HTML (le texte est aussi celui qu'on garde dans
   les historiques, pour « Voir le mail »). */
export function mailAdresse(o: { prenom: string; local: Local; lien: string }) {
  const { local, lien } = o;
  const bonjour = o.prenom ? `Bonjour ${o.prenom},` : 'Bonjour,';
  const merci = 'Merci pour votre signature. Comme convenu, voici l’adresse du local :';
  const rappel = 'Comme prévu dans la reconnaissance que vous avez signée, merci de passer par nous pour toute visite ou toute démarche sur ce local.';
  const sujet = `L’adresse du local${local.reference ? ` (réf. ${local.reference})` : ''}`;
  const texte = [
    bonjour, '', merci, '', local.ligne, local.quoi, local.montant, local.reference ? `Réf. ${local.reference}` : '',
    ...(lien ? ['', `La fiche du local (photos, surfaces, informations) : ${lien}`] : []),
    '', 'Pour le visiter, ou pour toute question :', `Téléphone : ${TEL}`, `E-mail : ${MAIL_AGENCE}`, 'Ou répondez simplement à ce message.',
    '', rappel, '', 'À bientôt,', 'Werner', 'Werner Immobilier',
  ].filter((l, i, t) => l !== '' || t[i - 1] !== '').join('\n');
  const carte = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eaeae9;border-radius:14px;border-collapse:separate;overflow:hidden;margin:16px 0 6px;background:#ffffff">
      ${local.photo ? `<tr><td align="center" style="padding:0;background:#f4f4f5;line-height:0"><img src="${echappe(local.photo)}" alt="Le local" style="display:block;margin:0 auto;max-width:100%;max-height:300px;width:auto;height:auto;border:0"></td></tr>` : ''}
      <tr><td style="padding:16px 18px 17px">
        <div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:800;color:#c2621c">L’adresse</div>
        <div style="font-size:19px;line-height:1.35;font-weight:800;color:#232528;margin:4px 0 10px">${echappe(local.ligne)}</div>
        ${local.quoi ? `<div style="font-size:14px;color:#334155;line-height:1.5">${insec(local.quoi)}</div>` : ''}
        ${local.montant ? `<div style="font-size:14px;color:#334155;line-height:1.5">${insec(local.montant)}</div>` : ''}
        ${local.reference ? `<div style="font-size:12.5px;color:#64748b;margin-top:6px">Réf. ${echappe(local.reference)}</div>` : ''}
      </td></tr>
    </table>`;
  const contact = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border-collapse:separate;background:#f6f6f7;margin:18px 0">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.7;color:#334155">
        <div style="font-weight:800;color:#232528">Pour le visiter, ou pour toute question</div>
        <div>Téléphone : <a href="tel:+33187660600" style="color:#c2621c;font-weight:700;text-decoration:none">${TEL.replace(/ /g, '&nbsp;')}</a></div>
        <div>E-mail : <a href="mailto:${MAIL_AGENCE}" style="color:#c2621c;font-weight:700;text-decoration:none">${MAIL_AGENCE}</a></div>
        <div style="color:#64748b;font-size:13px">Ou répondez simplement à ce message.</div>
      </td></tr>
    </table>`;
  const html = gabarit('L’adresse du local', `<p>${echappe(bonjour)}</p><p>${echappe(merci)}</p>
      ${carte}
      ${lien ? `<p style="margin-top:14px">${bouton(lien, 'Voir la fiche du local')}</p><p style="margin-top:0;font-size:13px;color:#64748b">Les photos, les surfaces et toutes les informations.</p>` : ''}
      ${contact}
      <p>${echappe(rappel)}</p><p>À bientôt,<br>Werner<br>Werner Immobilier</p>`,
    'Cette adresse vous est communiquée dans le cadre de la reconnaissance d’information que vous avez signée.');
  return { sujet, texte, html };
}

/* Envoie l'adresse ; rend null, ou ce qui n'a pas marché. */
export async function envoyerAdresseReco(sb: SupabaseClient, doc: DocReco, o: { auto: boolean }): Promise<string | null> {
  if (doc.modele !== 'reconnaissance') return 'ce document n’est pas une reconnaissance';
  const qui = await destinataireDe(sb, doc);
  const local = await localDe(sb, doc);
  const nomQui = qui ? [qui.prenom, qui.nom].filter(Boolean).join(' ') || qui.email : (doc.titre || '').replace(/^Reconnaissance\s*·\s*/, '') || 'le demandeur';
  const le = new Date().toISOString();

  /* Rien ne part : il est prévenu, dans l'historique de l'affaire et dans le
     suivi du client (la signature, elle, est faite). */
  const echec = async (raison: string): Promise<string> => {
    if (o.auto) {
      if (local.bienId) {
        const { error } = await sb.from('biens_vente_suivi').insert({
          bien_id: local.bienId, type: 'note', le, client_id: doc.client_id || null, qui: nomQui,
          commentaire: `L’adresse du local n’a pas pu partir : ${raison}.`,
          donnees: { document: doc.id, reconnaissance: true, etape: 'adresse_echec' },
        });
        if (error) console.error('[reconnaissance] noter l’échec sur l’affaire', error.message);
      }
      if (doc.client_id) {
        const { error } = await sb.from('journal').insert({
          client_id: doc.client_id, type: 'mandat', titre: '⚠️ Adresse du local pas envoyée',
          description: `La reconnaissance est signée, mais l’adresse n’a pas pu partir : ${raison}.`, metadata: { document_id: doc.id },
        });
        if (error) console.error('[reconnaissance] noter l’échec chez le client', error.message);
      }
    }
    return raison;
  };

  if (!qui) return echec('pas d’adresse e-mail pour la lui envoyer — donne-la-lui de vive voix');
  if (!local.rue) return echec('l’affaire n’a pas d’adresse exacte (le numéro et la rue) — complète-la sur la fiche de l’affaire, puis « Lui envoyer l’adresse » (onglet Documents)');
  const lien = local.bienId ? lienBienPublic(local.bienId) : '';
  const m = mailAdresse({ prenom: qui.prenom, local, lien });
  const erreur = await envoyerMail({
    a: qui.email, nomA: [qui.prenom, qui.nom].filter(Boolean).join(' ') || undefined,
    repondreA: MAIL_AGENCE, sujet: m.sujet, texte: sansCourbes(m.texte), html: m.html,
  });
  if (erreur) return echec(`le mail n’est pas parti (${erreur}) — réessaie avec « Lui envoyer l’adresse » (onglet Documents)`);

  const pbs: string[] = [];
  if (local.bienId) {
    const { error } = await sb.from('biens_vente_suivi').insert({
      bien_id: local.bienId, type: 'note', le, client_id: doc.client_id || null, qui: nomQui,
      commentaire: `${local.ligne} · envoyée à ${qui.email}${o.auto ? ', toute seule, dès sa signature' : ''}`,
      donnees: { document: doc.id, reconnaissance: true, etape: 'adresse', adresseEnvoyee: true, auto: o.auto, a: qui.email, sujet: m.sujet, texte: m.texte },
    });
    if (error) pbs.push('historique de l’affaire : ' + error.message);
  }
  if (doc.client_id) {
    /* Un « mail envoyé » du suivi du client : « À : … », puis le texte —
       la frise le replie derrière « Voir le mail » (FriseSuivi.tsx). */
    const { error } = await sb.from('journal').insert({
      client_id: doc.client_id, type: 'mail_envoye', titre: `📍 Adresse du local envoyée — ${m.sujet}`,
      description: `À : ${qui.email}\n\n${m.texte}`,
      metadata: { document_id: doc.id, reconnaissance: true, auto: o.auto },
    });
    if (error) pbs.push('suivi du client : ' + error.message);
  }
  return pbs.length ? `l’adresse est partie, mais pas notée : ${pbs.join(' ; ')}` : null;
}
