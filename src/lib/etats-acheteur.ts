/* ═══ Les états d'un demandeur : un seul vocabulaire (V3.240) ═══════════════
   Comme chez Emilio (V3.237). Alexandre (23 octobre 2026) : « sur Werner,
   faire pareil un peu comme moi, comme ça c'est un peu plus lisible […] lui
   donner les précisions : pourquoi ça reste en recherche, pourquoi
   accompagné. Accompagné, c'est les clients à qui tu souhaites offrir un
   espace, un accompagnement sur mesure ». Avant : Prospect, Actif, Suspendu,
   Local trouvé, Perdu — « Prospect » faisait penser à quelqu'un qui n'est pas
   encore client, « Actif » ne disait pas ce qu'il déclenche, « Perdu » était
   dur à lire.

   Les clés en base ne changent pas (`clients.statut`, lues par la veille, le
   point automatique, l'espace client, la reprise d'une suspension, les
   filtres) : seuls les mots changent, et chacun dit ce qu'il fait.

     prospect     En recherche           il cherche un local : rapprochements,
                                         sans espace client ni veille
     actif        Accompagné             l'accompagnement sur mesure : son
                                         espace client, la veille chaque jour,
                                         le point automatique
     suspendu     En pause               il reprendra plus tard
     bien_trouve  Local trouvé avec moi  bail ou acte signé grâce à Werner : clos
     perdu        Recherche arrêtée      trouvé ailleurs, ou abandonné : clos

   Ce que fait chaque état (vérifié dans le code, octobre 2026) : les
   rapprochements regardent « En recherche », « Accompagné » et « En pause »
   (src/components/biens/outils.ts, STATUTS_ATTENTE) ; la veille et l'espace
   client, « Accompagné » seulement (FicheClient, appliquerStatut, et
   src/lib/espace-choix.ts) ; le point automatique, « Accompagné », et « En
   recherche » aussi si Werner l'a réglé (Paramètres › Point automatique ›
   Pour qui). */

export type EtatAcheteur = 'prospect' | 'actif' | 'suspendu' | 'bien_trouve' | 'perdu';

export type DefEtat = {
  cle: EtatAcheteur;
  nom: string;
  /* Pour un filtre de liste (« Accompagnés »). */
  pluriel: string;
  /* Ce que l'état veut dire, en une ligne : sous son nom dans les menus. */
  quand: string;
  point: string;
  /* Ce qu'il fait tourner. */
  fait: { rappro: boolean; espace: boolean; veille: boolean; pointAuto: boolean };
  clos?: boolean;
};

export const ETATS_ACHETEUR: DefEtat[] = [
  { cle: 'prospect', nom: 'En recherche', pluriel: 'En recherche', point: '#8b5cf6',
    quand: 'Il cherche un local : dans tes rapprochements, sans espace client ni veille',
    fait: { rappro: true, espace: false, veille: false, pointAuto: false } },
  { cle: 'actif', nom: 'Accompagné', pluriel: 'Accompagnés', point: '#10b981',
    quand: 'Accompagnement sur mesure : son espace client, la veille chaque jour, le point automatique',
    fait: { rappro: true, espace: true, veille: true, pointAuto: true } },
  { cle: 'suspendu', nom: 'En pause', pluriel: 'En pause', point: '#f59e0b',
    quand: 'Il reprendra plus tard : ni veille, ni point automatique',
    fait: { rappro: true, espace: false, veille: false, pointAuto: false } },
  { cle: 'bien_trouve', nom: 'Local trouvé avec moi', pluriel: 'Locaux trouvés avec moi', point: '#3b82f6',
    quand: 'Bail ou acte signé grâce à toi : dossier clos',
    fait: { rappro: false, espace: false, veille: false, pointAuto: false }, clos: true },
  { cle: 'perdu', nom: 'Recherche arrêtée', pluriel: 'Recherches arrêtées', point: '#ef4444',
    quand: 'Trouvé ailleurs, ou projet abandonné : dossier clos',
    fait: { rappro: false, espace: false, veille: false, pointAuto: false }, clos: true },
];

export const etatDe = (k: unknown): DefEtat | undefined => ETATS_ACHETEUR.find(e => e.cle === k);

/* Le nom d'un état, pour une étiquette (un ancien « offre_ecrite » aussi). */
export function nomEtat(k: unknown): string {
  const e = etatDe(k);
  if (e) return e.nom;
  return k === 'offre_ecrite' ? 'Offre écrite' : String(k || '');
}

/* Les façons de clore une recherche : ce qui s'est passé, en clair. Le nom
   est écrit tel quel dans `clients.raison_perte` et dans le Suivi : sans
   pronom, il vaut pour un client, une cliente ou une société. */
export const MOTIFS_CLOTURE: { cle: string; nom: string; quoi: string; statut: 'bien_trouve' | 'perdu'; point: string }[] = [
  { cle: 'trouve_avec_moi', nom: 'Local trouvé avec moi', quoi: 'Le local a été trouvé grâce à toi : bail ou acte signé', statut: 'bien_trouve', point: '#10b981' },
  { cle: 'trouve_ailleurs', nom: 'Trouvé ailleurs', quoi: 'Avec une autre agence, ou tout seul', statut: 'perdu', point: '#f59e0b' },
  { cle: 'renonce', nom: 'Projet abandonné', quoi: 'Reporté, plus de budget, plus de nouvelles…', statut: 'perdu', point: '#94a3b8' },
  { cle: 'autre', nom: 'Autre raison', quoi: 'À préciser dans la note ci-dessous', statut: 'perdu', point: '#64748b' },
];

/* « Il », « Elle » ou « Ils » : pour parler du client dans une phrase. */
export type Pronom = 'Il' | 'Elle' | 'Ils';
export function pronomDe(c: { civilite?: string | null; couple?: boolean | null } | null | undefined): Pronom {
  if (c?.couple) return 'Ils';
  return c?.civilite === 'Madame' ? 'Elle' : 'Il';
}
