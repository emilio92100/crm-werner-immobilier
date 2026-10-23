import type { SupabaseClient } from '@supabase/supabase-js';
import { relanceAGarder } from '@/lib/relances-garder';
import { reventePossible } from '@/lib/contacts';
import { maintenantParis, visitePasseeParis } from '@/lib/visites';
import { ecritServeur } from '@/lib/ecritures';
import { colonneSuspensionAbsente } from '@/lib/suspension';

/* ═══ Le client dit que sa recherche est finie (côté serveur) ═════════════
   Il a trouvé son local, il met sa recherche en pause, ou il l'arrête. Il le
   dit depuis son espace (/api/espace/fin) ou depuis la page de réponse au
   point automatique, sans espace (/api/point/repondre, 23 octobre 2026) : les
   deux passent par `declarerFin`, pour que le dossier réagisse pareil quelle
   que soit la porte. Seule change la fin des phrases (`ou`) : « depuis son
   espace », « en réponse au point automatique ».

   Le code vient tel quel de la route de l'espace (V3.50 et suivantes). */

type Base = SupabaseClient;

/** Ce que le client a choisi, dit comme le CRM l'écrit (« Le client a trouvé son local avec nous »). */
export const MOTIFS_FIN: Record<string, string> = {
  trouve_avec_vous: 'a trouvé son local avec nous',
  trouve_ailleurs: 'a trouvé son local par un autre biais',
  pause: 'souhaite mettre sa recherche en pause',
  /* Distinct de la pause, et la nuance compte : une pause se relance,
     un arrêt se clôture. Le rappel ne se prépare pas pareil. */
  abandon: 'arrête sa recherche',
};

/* ── V3.50 : le client a trouvé, ou il arrête ─────────────────────────────
   Comme quand Alexandre clôt le dossier dans le CRM :
   1. ses relances en attente se soldent, avec la règle de
      solderRelancesAcheteur (src/lib/relances.ts) : s'il vend aussi un bien
      avec nous (pas vendu, pas retiré), ses relances de vendeur restent et
      seules celles de ses recherches se soldent. Dans le doute (lecture
      impossible), on garde aussi celles de vendeur ;
   2. ses visites à venir s'annulent (src/lib/annuler-visites.ts, version
      serveur) : leur rappel se ferme quand plus aucune visite prévue ne s'en
      sert, et une ligne « Visite annulée » va au Suivi de sa recherche.
   Avant, l'espace ne fermait rien : les relances tombaient sur un client qui
   avait ses clés, et ses visites restaient dans la pastille Visites, puis
   en « compte rendu à faire » pour toujours. Jamais bloquant : un échec
   reste dans les journaux du serveur. */
const MOIS_FIN = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export type JournalServeur = { client_id: string; recherche_id?: string | null; bien_id?: string | null; type: string; titre: string; description?: string | null; metadata?: Record<string, unknown> };
/* Comme addJournal : un type que la base refuse (liste fermée, code 23514)
   est gardé sous « statut_change », le type voulu en metadata. */
export async function journalServeur(sb: Base, quoi: string, ligne: JournalServeur) {
  const { error } = await sb.from('journal').insert(ligne);
  if (!error) return;
  if ((error as { code?: string }).code === '23514' && ligne.type !== 'statut_change') {
    await ecritServeur(quoi, sb.from('journal').insert({ ...ligne, type: 'statut_change', metadata: { ...(ligne.metadata || {}), type_voulu: ligne.type } }));
    return;
  }
  console.error(`[écriture] ${quoi} : ${error.message}`);
}
export async function solderFinDeRecherche(sb: Base, clientId: string, quoi: string, ou = 'depuis son espace'): Promise<number> {
  try {
    const v = await sb.from('biens_vente').select('id').eq('client_id', clientId).not('etape', 'in', '(vendu,retire)').limit(1);
    if (v.error) console.error('[fin] biens en vente du client', v.error.message);
    const vendeur = !!v.error || !!v.data?.length;
    let q = sb.from('relances').select('id, note').eq('client_id', clientId).eq('statut', 'en_attente');
    if (vendeur) q = q.not('recherche_id', 'is', null);
    const { data: rel, error: eRel } = await q;
    if (eRel) console.error('[fin] relances en attente', eRel.message);
    /* Pas les rappels d'un compromis en cours ni ceux de l'agenda (V3.50). */
    const aClore = ((rel || []) as { id: string; note: string | null }[]).filter(r => !relanceAGarder(r.note)).map(r => r.id);
    if (aClore.length) await ecritServeur('[fin] relances en attente', sb.from('relances').update({ statut: 'cloturee' }).in('id', aClore).eq('statut', 'en_attente'));

    type V = { id: string; recherche_id: string | null; bien_id: string | null; date_visite: string | null; heure: string | null; rappel_relance_id: string | null; biens?: { titre?: string | null; ville?: string | null } | null };
    const { data: vis, error: eV } = await sb.from('visites')
      .select('id, recherche_id, bien_id, date_visite, heure, rappel_relance_id, biens(titre, ville)')
      .eq('client_id', clientId).eq('statut', 'a_venir');
    if (eV) { console.error('[fin] visites', eV.message); return 0; }
    /* Celles déjà passées attendent le compte rendu d'Alexandre : on n'y touche pas. */
    const mParis = maintenantParis();
    const aVenir = ((vis || []) as unknown as V[]).filter(x => !visitePasseeParis(x, mParis));
    if (!aVenir.length) return 0;
    const { data: faites, error: eA } = await sb.from('visites').update({ statut: 'annulee' })
      .in('id', aVenir.map(x => x.id)).eq('statut', 'a_venir').select('id');
    if (eA) { console.error('[écriture] [fin] visites à venir', eA.message); return 0; }
    const ok = new Set(((faites || []) as { id: string }[]).map(x => x.id));
    const annulees = aVenir.filter(x => ok.has(x.id));

    const rappels = Array.from(new Set(annulees.map(x => x.rappel_relance_id).filter((x): x is string => !!x)));
    if (rappels.length) {
      const encore = await sb.from('visites').select('rappel_relance_id').in('rappel_relance_id', rappels).eq('statut', 'a_venir');
      if (encore.error) console.error('[fin] rappels des visites', encore.error.message);
      else {
        const gardes = new Set(((encore.data || []) as { rappel_relance_id: string | null }[]).map(x => x.rappel_relance_id));
        const aFermer = rappels.filter(r => !gardes.has(r));
        if (aFermer.length) {
          await ecritServeur('[fin] rappels des visites', sb.from('relances').update({ statut: 'cloturee' }).in('id', aFermer).eq('statut', 'en_attente'));
        }
      }
    }
    for (const x of annulees) {
      const d = x.date_visite ? String(x.date_visite).slice(0, 10).split('-').map(Number) : null;
      const h = x.heure && /^\d{2}:\d{2}/.test(x.heure) ? ` à ${x.heure.slice(0, 5).replace(':', ' h ')}` : '';
      const prevue = d ? `Prévue le ${d[2]} ${MOIS_FIN[(d[1] || 1) - 1]} ${d[0]}${h}. ` : '';
      await journalServeur(sb, '[fin] journal visite annulée', {
        client_id: clientId, recherche_id: x.recherche_id, bien_id: x.bien_id, type: 'visite_annulee',
        titre: `✕ Visite annulée — ${x.biens?.titre || x.biens?.ville || 'le local'}`,
        description: `${prevue}Le client ${quoi}, ${ou}.`,
      });
    }
    return annulees.length;
  } catch (e) {
    console.error('[fin] clôture', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/**
 * Tout ce qui suit la déclaration du client : la ligne du suivi, le dossier
 * qui change de rubrique (et la veille qui s'arrête), ses relances et ses
 * visites soldées s'il a trouvé ou s'il arrête, et la relance « à rappeler
 * pour confirmer ».
 *
 * Rend `false` si la ligne du suivi n'a pas pu s'écrire : rien d'autre n'est
 * fait alors, la page dit au client que ce n'est pas parti. Le reste n'est
 * jamais bloquant (un échec reste dans les journaux du serveur).
 */
export async function declarerFin(sb: Base, o: {
  clientId: string; rechercheId: string | null; motif: string; mot: string;
  /** « depuis son espace », « en réponse au point automatique » */
  ou: string;
  /** Ajouté au metadata de la ligne du suivi (la page de réponse y met son envoi). */
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const { clientId, rechercheId, motif, mot, ou } = o;
  const quoi = MOTIFS_FIN[motif];
  if (!quoi) return false;

  if (!(await ecritServeur('[fin] journal', sb.from('journal').insert({
    client_id: clientId, recherche_id: rechercheId,
    type: 'fin_recherche',
    titre: `🏁 Le client ${quoi}, ${ou}`,
    description: mot || null, metadata: { motif, ...(o.metadata || {}) },
  })))) return false;

  /* Il a dit lui-même qu'il ne cherche plus : la veille s'arrête tout de
     suite et le dossier change de rubrique, sans attendre l'appel. Règle
     d'Alexandre (27 septembre 2026) : ce n'est pas la peine de continuer
     à lui chercher des biens. La relance, elle, reste : on l'appelle
     quand même pour confirmer, et un clic dans la fiche le remet en
     « Actif » si besoin (ce qui relance la veille).
     Un dossier déjà clos (bien trouvé, perdu) ne change pas de rubrique.
     `updated_at` n'est pas touché : c'est lui qui dit à l'espace si la
     déclaration du client est toujours la dernière parole. */
  const BASCULE: Record<string, { statut: string; nom: string; raison: string | null }> = {
    /* V3.240 : les mots de src/lib/etats-acheteur.ts (et ses motifs de clôture). */
    trouve_avec_vous: { statut: 'bien_trouve', nom: 'Local trouvé avec moi', raison: 'Local trouvé avec moi' },
    trouve_ailleurs: { statut: 'perdu', nom: 'Recherche arrêtée', raison: 'Trouvé ailleurs' },
    abandon: { statut: 'perdu', nom: 'Recherche arrêtée', raison: 'Projet abandonné' },
    pause: { statut: 'suspendu', nom: 'En pause', raison: null },
  };
  const cible = BASCULE[motif];
  let bascule = '';
  const { data: avant } = await sb.from('clients')
    .select('statut').eq('id', clientId).maybeSingle();
  if (avant && avant.statut !== 'bien_trouve' && avant.statut !== 'perdu') {
    /* Une date de reprise posée avant (« Suspendu jusqu'au… ») s'efface :
       c'est le client qui vient de parler (src/lib/suspension.ts). */
    const majClient: Record<string, unknown> = cible.raison
      ? { statut: cible.statut, raison_perte: `${cible.raison} — déclaré par le client ${ou}` }
      : { statut: cible.statut };
    let { error: eClient } = await sb.from('clients')
      .update({ ...majClient, suspension: null }).eq('id', clientId);
    if (eClient && colonneSuspensionAbsente(eClient.message)) {
      ({ error: eClient } = await sb.from('clients').update(majClient).eq('id', clientId));
    }
    const { error: eVeille } = eClient ? { error: null } : await sb.from('recherches')
      .update({ active: false }).eq('client_id', clientId);
    const echec = eClient || eVeille;
    if (echec) {
      bascule = ` ⚠️ Le dossier n'a pas pu changer de rubrique tout seul (${echec.message}) : à faire depuis la fiche.`;
    } else {
      /* V3.240 : « la veille est arrêtée » seulement s'il était Actif. */
      const tournait = avant.statut === 'actif';
      bascule = ` Le dossier est passé en « ${cible.nom} »${tournait ? ' et la veille est arrêtée' : ''}.`;
      await ecritServeur('[fin] journal statut', sb.from('journal').insert({
        client_id: clientId, recherche_id: rechercheId,
        type: 'statut_change',
        titre: `Statut → ${cible.nom} (automatique)`,
        description: `Le client ${quoi}, ${ou}.${tournait ? ' La veille est arrêtée sur ce dossier.' : ''}`,
      }));
    }
  }

  /* Il a trouvé et il est propriétaire avec une revente possible : c'est
     le moment de lui parler de son logement actuel. La relance le dit. */
  let revente = false;
  if (motif === 'trouve_avec_vous' || motif === 'trouve_ailleurs') {
    /* V3.50 : un vendeur signé a déjà vendu, sa case d'avant ne compte plus. */
    const lu = await sb.from('clients')
      .select('bien_actuel_a_vendre, types').eq('id', clientId).maybeSingle();
    let cl: unknown = lu.data;
    if (lu.error) ({ data: cl } = await sb.from('clients')
      .select('bien_actuel_a_vendre').eq('id', clientId).maybeSingle());
    revente = reventePossible(cl as { bien_actuel_a_vendre?: unknown; types?: string[] | null } | null);
  }

  /* V3.50 : il a trouvé ou il arrête (pas une pause, qui se reprend) :
     ses anciennes relances se soldent et ses visites à venir s'annulent
     (solderFinDeRecherche, plus haut). AVANT la relance « à rappeler
     pour confirmer » ci-dessous, qui, elle, doit rester. */
  let visitesAnnulees = 0;
  if (motif !== 'pause') visitesAnnulees = await solderFinDeRecherche(sb, clientId, quoi, ou);
  const annulees = visitesAnnulees ? ` ${visitesAnnulees > 1 ? `Ses ${visitesAnnulees} visites prévues sont annulées` : 'Sa visite prévue est annulée'}.` : '';

  await ecritServeur('[fin] relance', sb.from('relances').insert({
    client_id: clientId, recherche_id: rechercheId,
    type: 'rappel_client', statut: 'en_attente',
    date_echeance: new Date().toISOString(),
    note: `Le client ${quoi}, ${ou}.${bascule}${annulees} À rappeler pour confirmer${motif === 'pause' ? ' et savoir quand reprendre' : ''}.${revente ? ' 🔑 Cession possible : c’est le moment de lui parler de son local actuel.' : ''}${mot ? ` Son mot : « ${mot} »` : ''}`,
  }));
  return true;
}
