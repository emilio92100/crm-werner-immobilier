import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ecritServeur } from '@/lib/ecritures';
import { declarerFin } from '@/lib/fin-recherche-serveur';
import {
  envoiDuJeton, jetonValide, JETON_EXEMPLE, REPONSES, CRENEAUX_RAPPEL, TYPE_REPONSE, type Reponse,
} from '@/lib/point-auto';

/**
 * La réponse au point automatique d'un demandeur sans espace (23 octobre 2026).
 *
 *   POST /api/point/repondre { jeton, reponse, motif?, creneau?, mot? }
 *
 *   reponse  'toujours' | 'criteres' | 'trouve' | 'pause' | 'rappel'
 *   motif    'trouve_avec_vous' | 'trouve_ailleurs'   (trouve)
 *            'pause' | 'abandon'                      (pause)
 *   creneau  'matin' | 'apres_midi' | 'soir'          (rappel ; facultatif pour criteres)
 *   mot      ce qu'il veut ajouter, facultatif
 *
 * Publique dans src/proxy.ts : c'est le jeton de l'envoi qui fait la serrure
 * (tiré au hasard à chaque mail, rangé dans la ligne « point_auto » du suivi,
 * valable JOURS_REPONSE jours). Elle écrit comme l'espace :
 *   · une ligne dans le suivi du client, avec sa recherche ;
 *   · une relance du jour pour Werner, sauf « je cherche toujours » sans mot
 *     (il n'y a rien à faire : la recherche continue) ;
 *   · « j'ai trouvé », « pause », « j'arrête » : la même suite que depuis
 *     l'espace (src/lib/fin-recherche-serveur.ts) — le dossier change de
 *     rubrique, la veille s'arrête, la relance « à rappeler pour confirmer ».
 * Toutes ces réponses remettent à zéro le compteur du point automatique.
 * Le jeton « exemple » (la page de démonstration) n'écrit rien.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MOTIFS: Partial<Record<Reponse, string[]>> = {
  trouve: ['trouve_avec_vous', 'trouve_ailleurs'],
  pause: ['pause', 'abandon'],
};
const OU = 'en réponse au point automatique';

const nettoie = (s: unknown, max = 600) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const refus = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jeton = typeof body?.jeton === 'string' ? body.jeton : '';
  const reponse = REPONSES.includes(body?.reponse) ? (body.reponse as Reponse) : null;
  if (!jetonValide(jeton) || !reponse) return refus('demande incomplète', 400);

  const mot = nettoie(body.mot);
  const creneau = typeof body.creneau === 'string' && CRENEAUX_RAPPEL[body.creneau] ? body.creneau : '';
  const quand = creneau ? CRENEAUX_RAPPEL[creneau] : '';
  const motif = typeof body.motif === 'string' ? body.motif : '';
  if (MOTIFS[reponse] && !MOTIFS[reponse]!.includes(motif)) return refus('choix manquant', 400);
  if (reponse === 'rappel' && !creneau) return refus('créneau manquant', 400);

  /* La page de démonstration : rien ne s'écrit. */
  if (jeton === JETON_EXEMPLE) return NextResponse.json({ ok: true, exemple: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return refus('indisponible', 503);
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  let envoi;
  try { envoi = await envoiDuJeton(sb, jeton); } catch (e) {
    console.error('[point/repondre] lien', e instanceof Error ? e.message : String(e));
    return refus('indisponible', 503);
  }
  if (!envoi) return refus('lien inconnu', 404);
  if (envoi.expire) return refus('lien expiré', 410);

  /* Garde-fous : la même réponse à ce même mail ne s'écrit qu'une fois par
     jour (il reclique parce qu'il doute que ce soit parti) ; et pas plus de
     cinq réponses par jour à un même mail. */
  const depuis24h = new Date(Date.now() - 86_400_000).toISOString();
  const { data: deja, error: eDeja } = await sb.from('journal').select('id, metadata')
    .eq('client_id', envoi.clientId).eq('metadata->>point_envoi', envoi.id).gte('created_at', depuis24h);
  if (eDeja) { console.error('[point/repondre] réponses du jour', eDeja.message); return refus('indisponible', 503); }
  const lignes = (deja || []) as { id: string; metadata: Record<string, unknown> | null }[];
  if (lignes.some((l) => l.metadata?.reponse === reponse)) return NextResponse.json({ ok: true, deja: true });
  if (lignes.length >= 5) return refus('trop de réponses aujourd’hui', 429);

  const { clientId, rechercheId } = envoi;
  const meta = { reponse, via: 'page', point_envoi: envoi.id };
  const sonMot = mot ? ` Son mot : « ${mot} »` : '';
  const journal = (type: string, titre: string, description: string | null, plus: Record<string, unknown> = {}) =>
    ecritServeur(`[point/repondre] journal ${reponse}`, sb.from('journal').insert({
      client_id: clientId, recherche_id: rechercheId, type, titre, description, metadata: { ...meta, ...plus },
    }));
  const relance = (type: 'rappel_client' | 'message_client', note: string) =>
    ecritServeur(`[point/repondre] relance ${reponse}`, sb.from('relances').insert({
      client_id: clientId, recherche_id: rechercheId, type, statut: 'en_attente',
      date_echeance: new Date().toISOString(), note,
    }));

  switch (reponse) {
    case 'toujours': {
      if (!(await journal(TYPE_REPONSE, `✅ Le client cherche toujours, ${OU}`,
        `Réponse au mail « Où en est votre recherche ? », depuis le mail (sans espace).${sonMot}`, mot ? { mot } : {}))) break;
      /* Un mot laissé, c'est un message : Werner doit le lire. Sans mot, il
         n'y a rien à faire, la ligne du suivi suffit. */
      if (mot) await relance('message_client', `Point automatique — il cherche toujours, et il a laissé un mot : « ${mot} »`);
      return NextResponse.json({ ok: true });
    }
    case 'criteres': {
      if (!(await journal(TYPE_REPONSE, `🎯 Le client dit que ses critères ont changé, ${OU}`,
        `${mot ? `Ce qui a changé : « ${mot} ».` : 'Il n’a pas précisé quoi.'}${quand ? ` Souhaite être rappelé ${quand}.` : ''}`,
        { ...(mot ? { mot } : {}), ...(creneau ? { creneau } : {}) }))) break;
      await relance('rappel_client', `Point automatique — ses critères ont changé${mot ? ` : « ${mot} »` : ''}. À rappeler${quand ? ` ${quand}` : ''} pour mettre sa recherche à jour.`);
      return NextResponse.json({ ok: true });
    }
    case 'rappel': {
      if (!(await journal('demande_rappel', `📞 Demande de rappel, ${OU}`,
        `Souhaite être rappelé ${quand}.${sonMot}`, { creneau, ...(mot ? { mot } : {}) }))) break;
      await relance('rappel_client', `Demande de rappel, ${OU} — ${quand}.${sonMot}`);
      return NextResponse.json({ ok: true });
    }
    case 'trouve':
    case 'pause': {
      if (!(await declarerFin(sb, { clientId, rechercheId, motif, mot, ou: OU, metadata: meta }))) break;
      return NextResponse.json({ ok: true });
    }
  }
  return refus('enregistrement', 500);
}
