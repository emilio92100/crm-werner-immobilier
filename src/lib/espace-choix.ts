/* ═══ L'espace client et le statut d'un demandeur (Werner, 21 octobre 2026) ═══
   Alexandre : « comme chez Emilio » — un demandeur « Actif » a son espace, un
   « Prospect » n'en a pas. Les gestes de statut faits à la main (création,
   menu d'état de la fiche, changement en lot, réouverture) écrivent donc
   aussi `clients.espace_client` (outils/sql/espace-client-choix.sql). Les
   passages automatiques (suspendu pendant une signature, local trouvé) n'y
   touchent pas : l'espace reste tel quel.

   Isomorphe : le CRM et les routes le lisent. */

export const espaceSelonStatut = (statut: string): { espace_client?: boolean } =>
  statut === 'actif' ? { espace_client: true } : statut === 'prospect' ? { espace_client: false } : {};

/* La colonne n'existe qu'après le SQL : sans elle, on réécrit sans. */
export const colonneEspaceAbsente = (m?: string | null) => !!m && /espace_client/.test(m);

export const aUnEspace = (c: { espace_client?: boolean | null } | null | undefined) => c?.espace_client === true;

/* Le mail de bienvenue à proposer à l'ouverture de la fiche, juste après la
   création d'un demandeur avec son espace (Clients.tsx → FicheClient.tsx). */
export const CLE_BIENVENUE = 'werner-bienvenue-a-proposer';
export function marquerBienvenue(clientId: string) {
  try { sessionStorage.setItem(`${CLE_BIENVENUE}:${clientId}`, '1'); } catch { /* navigation privée */ }
}
export function prendreBienvenue(clientId: string): boolean {
  try {
    const k = `${CLE_BIENVENUE}:${clientId}`;
    const v = sessionStorage.getItem(k);
    if (v) sessionStorage.removeItem(k);
    return !!v;
  } catch { return false; }
}
