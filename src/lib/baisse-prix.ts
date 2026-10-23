/* ══ Le prix d'un bien déjà présenté qui change (V3.242) ══════════════════

   Alexandre, 24 octobre (repris du CRM Emilio) : quand la veille voit un
   nouveau loyer ou un nouveau prix sur un local déjà présenté, il se met à
   jour partout — la fiche du CRM, l'onglet Veille, l'espace du demandeur.
   Dans l'espace, une baisse se voit : une pastille « Baisse de loyer » (ou
   « de prix »), l'ancien montant barré, le nouveau en grand. Pas de
   notification : le demandeur la découvre en revenant sur la fiche. Le
   bouton « Prévenir le client » ouvre le mail habituel, prérempli, et
   c'est Werner qui décide de l'envoyer.

   Le montant d'un local est dans `prix_vendeur` : le loyer annuel HT HC pour
   une location, le prix pour une cession ou des murs. `pro` (la nature de
   l'affaire) suit : `pro.loyerAn` pour une location, `pro.prix` sinon.

   Rien de neuf dans la base : chaque changement s'ajoute à `historique_prix`
   en ligne { type: 'prix', date, prix, avant }. La courbe du CRM la lit
   déjà (seriePrix ne laisse de côté que les lignes « diffuseur »).
   `avant` est le prix que le client avait sous les yeux : le premier `avant`
   est donc le prix auquel le bien lui a été présenté. C'est lui qu'on barre,
   quel que soit le nombre de baisses.

   Un mandat de l'agence (copie portant `bien_vente_id`) n'est pas concerné :
   son prix suit l'avenant de baisse, qui le porte déjà chez les acheteurs.

   Pur, sans dépendance : servi à la veille, au CRM, à l'espace et aux mails. */

type Ligne = Record<string, unknown>;

export type ChangementPrix = { date: string; prix: number; avant: number };

const nb = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Les changements de prix notés depuis la présentation, du plus ancien au plus récent. */
export function changementsPrix(historique: unknown): ChangementPrix[] {
  const l = Array.isArray(historique) ? (historique as Ligne[]) : [];
  return l
    .filter((x) => !!x && x.type === 'prix' && nb(x.prix) > 0 && nb(x.avant) > 0)
    .map((x) => ({ date: String(x.date || ''), prix: nb(x.prix), avant: nb(x.avant) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Le prix à barrer : celui auquel le bien a été présenté, quand le prix
    d'aujourd'hui est plus bas. Rien pour un mandat de l'agence. */
export function prixAvantBaisse(
  b: { historique_prix?: unknown; bien_vente_id?: string | null } | null | undefined,
  prixActuel: number | null | undefined,
): number | null {
  if (!b || b.bien_vente_id || !prixActuel || !(prixActuel > 0)) return null;
  const c = changementsPrix(b.historique_prix);
  if (!c.length) return null;
  return c[0].avant > prixActuel ? c[0].avant : null;
}

type BienAPrix = {
  prix_vendeur?: number | string | null; prix_acquereur?: number | string | null;
  commission_type?: string | null; commission_val?: number | string | null;
  historique_prix?: unknown; nb_baisses?: number | string | null; prix_initial?: number | string | null;
  url?: string | null;
  /* Werner : la nature de l'affaire et ses montants (biens.pro). */
  pro?: unknown;
};

/** Ce qu'il faut écrire sur la fiche quand le prix de l'annonce change.
    Null quand rien ne change (même prix, prix illisible). */
export function champsNouveauPrix(b: BienAPrix, nouveau: number, date: string): {
  champs: Record<string, unknown>; avant: number; prix: number; baisse: boolean;
} | null {
  const avant = nb(b.prix_vendeur);
  const prix = Math.round(nb(nouveau));
  if (!(prix > 0) || !(avant > 0) || prix === avant) return null;

  /* Ses honoraires suivent le prix : un taux se recalcule sur le nouveau prix,
     un forfait reste le même. Rien ne s'ajoutait (inter-cabinet) : le prix
     acquéreur reste égal au prix de l'annonce. */
  const acq = nb(b.prix_acquereur);
  let prixAcquereur: number | null = null;
  if (acq > avant) {
    const val = nb(b.commission_val);
    prixAcquereur = b.commission_type === 'pourcentage' && val > 0
      ? prix + Math.round(prix * val / 100)
      : prix + Math.round(acq - avant);
  } else if (acq > 0) {
    prixAcquereur = prix;
  }

  const hist: Ligne[] = Array.isArray(b.historique_prix) ? (b.historique_prix as Ligne[]).map((x) => ({ ...x })) : [];
  /* L'annonce retenue, dans la liste de ceux qui vendent, prend le nouveau prix. */
  const lien = String(b.url || '').trim();
  if (lien) {
    const i = hist.findIndex((x) => x?.type === 'diffuseur' && !x.retiree_le && x.url === lien);
    if (i >= 0) hist[i] = { ...hist[i], prix };
  }
  hist.push({ type: 'prix', date, prix, avant });

  const baisse = prix < avant;
  const champs: Record<string, unknown> = { prix_vendeur: prix, historique_prix: hist, date_derniere_baisse: date };
  if (prixAcquereur !== null) champs.prix_acquereur = prixAcquereur;
  if (baisse) champs.nb_baisses = (nb(b.nb_baisses) || 0) + 1;
  if (!nb(b.prix_initial)) champs.prix_initial = avant;

  /* Werner : `pro` dit la même chose que la fiche — le loyer annuel d'une
     location, le prix d'une cession ou de murs. Il suit, s'il disait l'ancien. */
  if (b.pro && typeof b.pro === 'object' && !Array.isArray(b.pro)) {
    const pro: Ligne = { ...(b.pro as Ligne) };
    if (pro.nature === 'location') {
      if (!nb(pro.loyerAn) || nb(pro.loyerAn) === avant) { pro.loyerAn = prix; champs.pro = pro; }
    } else if (nb(pro.prix) === avant) {
      pro.prix = prix; champs.pro = pro;
    }
  }
  return { champs, avant, prix, baisse };
}
