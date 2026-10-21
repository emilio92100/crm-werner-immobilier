import { NextResponse } from 'next/server';
import { annoncerDemandes } from '@/lib/demandes-annonce';

/* ═══ « Nouvelle demande du site » : le mail à Alexandre (V3.37) ═══════════
   Le site, après chaque formulaire, appelle la fonction send-contact-email du
   projet Supabase du CRM ; elle appelle cette route. Aucune clé à fournir :
   la route ne reçoit rien et ne croit personne. Elle lit elle-même les
   demandes pas encore annoncées (notifie_le vide, reçues depuis moins de
   deux jours), se réserve chacune (mise à jour sous condition « encore
   vide »), puis envoie le mail par Mailjet, avec les réglages du CRM.
   L'appeler mille fois n'envoie rien de plus : c'est pour ça qu'elle peut
   être publique (src/proxy.ts).

   Un robot (src/lib/demandes-site.ts, robot()) est marqué annoncé sans mail.
   Un envoi raté remet la demande « à annoncer » : le prochain appel réessaie. */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* La logique vit dans src/lib/demandes-annonce.ts (21 octobre 2026). */
export async function POST() {
  const { statut, ...bilan } = await annoncerDemandes();
  return NextResponse.json(bilan, statut ? { status: statut } : undefined);
}
