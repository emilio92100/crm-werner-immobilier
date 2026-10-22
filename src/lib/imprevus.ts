import { addJournal, supabase } from '@/lib/supabase';
import { signalerEchec } from '@/lib/ecritures';
import { imprevusOuverts, type ImprevuOuvert } from '@/lib/visites';

/* ═══ Les imprévus signalés par le client sur une visite calée (V3.232) ═══
   Il les envoie de son espace (« Un imprévu ? », /api/espace/imprevu) : une
   ligne du journal (type message_client, `metadata.imprevu`), une relance du
   jour « Imprévu — <local> · visite du … », un mail. Ici, ce que le CRM en
   fait : les relire (onglet Visites, « Mon suivi avec l'agence »), et fermer
   la relance quand la visite est déplacée ou annulée. */

/** Les imprévus ouverts de ces visites, lus au journal. */
export async function chargerImprevus(visites: { id: string; statut?: string | null; date_visite?: string | null; heure?: string | null }[]): Promise<Record<string, ImprevuOuvert>> {
  const ids = Array.from(new Set(visites.map(v => v.id).filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await supabase.from('journal').select('metadata, created_at')
    .eq('type', 'message_client').in('metadata->imprevu->>visite_id', ids);
  if (error) { console.error('[imprévus] lecture', error.message); return {}; }
  return imprevusOuverts((data || []) as { metadata?: unknown; created_at?: string | null }[], visites);
}

const echappe = (t: string) => t.replace(/[\\%_]/g, x => '\\' + x);
/** La relance « Imprévu — … » de ce local se ferme. `titre` : le même que la route
    (le titre de l'affaire, sinon sa ville, sinon « le local »). */
export async function solderImprevu(clientId: string | null | undefined, titre: string) {
  if (!clientId) return;
  const r = await supabase.from('relances').update({ statut: 'cloturee' })
    .eq('client_id', clientId).eq('type', 'rappel_client').eq('statut', 'en_attente')
    .ilike('note', `Imprévu — ${echappe(titre)}%`);
  if (r.error) signalerEchec('La relance de l’imprévu', r.error.message);
}

/** Une visite déplacée après un imprévu : sa relance se ferme, et une ligne au Suivi. */
export async function apresDeplacement(v: { client_id?: string | null; recherche_id?: string | null; bien_id?: string | null }, titre: string, quand: string) {
  await solderImprevu(v.client_id, titre);
  if (v.client_id) {
    await addJournal(v.client_id, 'visite_planifiee', `📅 Visite déplacée — ${titre}`, `Nouvelle date : ${quand}. Suite à son imprévu.`, undefined,
      { rechercheId: v.recherche_id || null, bienId: v.bien_id || null });
  }
}
