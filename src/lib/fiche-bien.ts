import { NATURES, TYPES_LOCAL, proDuBien, type ProBien } from '@/lib/affaires';
/* ═══ La ligne `biens` tirée du formulaire « Ajouter un bien » ═══════════
   V3.185 : sortie de FicheClient (saveBien) pour servir aussi aux annonces
   envoyées par le client. « Remplir la fiche » garde cette ligne sur
   l'annonce (annonces_client.fiche) ; « Retenir » la pose dans `biens`,
   exactement comme « Ajouter un bien » (AnnoncesClient).

   Sans client, recherche, étape ni retour : celui qui l'enregistre les
   ajoute. Rien ici ne lit ni n'écrit la base. */

/* Le prix acquéreur : le prix vendeur plus la commission (en % ou en €). */
export function prixAcquereurDe(f: Record<string, any>): number {
  const pv = parseFloat(f?.prix_vendeur) || 0;
  const cv = parseFloat(f?.commission_val) || 0;
  return f?.commission_type === 'pourcentage' ? Math.round(pv * (1 + cv / 100)) : pv + cv;
}

export function ligneBienDepuisFormulaire(f: Record<string, any>, photos: string[]): Record<string, unknown> {
  return {
    url: f.url || null,
    titre: f.titre,
    ville: f.ville,
    code_postal: f.code_postal,
    quartier: f.quartier || null,
    // V3.186 : les transports et l'environnement cités par l'annonce
    situation: String(f.situation || '').trim() || null,
    type_bien: f.type_bien,
    surface: parseFloat(f.surface) || null,
    surface_sejour: parseFloat(f.surface_sejour) || null,
    nb_pieces: parseInt(f.nb_pieces) || null,
    nb_chambres: parseInt(f.nb_chambres) || null,
    nb_salles_bain: parseInt(f.nb_salles_bain) || null,
    nb_wc: parseInt(f.nb_wc) || null,
    etage: f.etage !== '' && f.etage !== null && f.etage !== undefined ? parseInt(f.etage) : null,
    etage_total: parseInt(f.etage_total) || null,
    annee_construction: parseInt(f.annee_construction) || null,
    exposition: f.exposition || null,
    // DPE / GES
    dpe: f.dpe || null,
    dpe_conso: parseInt(f.dpe_conso) || null,
    ges: f.ges || null,
    ges_emissions: parseInt(f.ges_emissions) || null,
    chauffage: f.chauffage || null,
    source_energie: f.source_energie || null,
    chauffage_emetteurs: f.chauffage_emetteurs || null,
    // Caractéristiques booléennes
    parking: f.parking || false,
    balcon: f.balcon || false,
    terrasse: f.terrasse || false,
    jardin: f.jardin || false,
    cave: f.cave || false,
    ascenseur: f.ascenseur || false,
    gardien: f.gardien || false,
    cuisine_equipee: f.cuisine_equipee || false,
    climatisation: f.climatisation || false,
    traversant: f.traversant || false,
    // Surfaces annexes
    surface_balcon: parseFloat(f.surface_balcon) || null,
    surface_terrasse: parseFloat(f.surface_terrasse) || null,
    // État
    etat_general: f.etat_general || null,
    // Description et prix
    description: f.description,
    prix_vendeur: parseFloat(f.prix_vendeur) || null,
    commission_type: f.commission_type,
    commission_val: parseFloat(f.commission_val) || null,
    prix_acquereur: prixAcquereurDe(f) || null,
    charges_trimestrielles: parseInt(f.charges_trimestrielles) || null,
    charges_comprises: String(f.charges_comprises || '').trim() || null,
    taxe_fonciere: parseInt(f.taxe_fonciere) || null,
    // Photos et source
    photos,
    source_portail: f.source_portail,
    agence_nom: f.agence_nom,
    agence_tel: f.agence_tel || null,
    /* Werner : ce que le local dit de lui en immobilier d'entreprise (biens.pro). */
    pro: proDepuisLecture(f),
  };
}

/* La lecture d'une annonce (src/lib/lecture-annonce.ts) en résumé d'affaire
   (`ProBien`, src/lib/affaires.ts) : la nature, le loyer annuel HT HC ou le
   prix, le bail, la destination, la vitrine, l'extraction, les équipements.
   Vide quand l'annonce n'en dit rien. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function proDepuisLecture(f: Record<string, any>): ProBien | Record<string, never> {
  const nature = NATURES.some(n => n.v === f.nature) ? String(f.nature) : null;
  const type = TYPES_LOCAL.find(t => t.court === f.type_bien || t.l === f.type_bien || t.v === f.type_bien)?.v || null;
  const num = (v: unknown) => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };
  const loyer = num(f.loyer_annuel_ht_hc), prixC = num(f.prix_cession);
  const d: Record<string, unknown> = {
    nature, typeBien: type,
    prix: nature === 'location' ? loyer : prixC,
    loyerAn: nature && nature !== 'location' ? loyer : null,
    droitEntree: num(f.droit_entree), chargesAn: num(f.charges_annuelles), taxeFonciere: num(f.taxe_fonciere),
    depotMois: num(f.depot_garantie_mois), divisible: f.divisible === true ? 'oui' : null, vitrine: num(f.vitrine_ml),
    emplacement: f.emplacement || null, extraction: ['oui', 'possible', 'non'].includes(f.extraction) ? f.extraction : null,
    destination: f.destination || null, bailType: f.bail_type || null, bailFin: f.bail_fin || null, activite: f.activite || null,
    clim: f.climatisation === true ? 'reversible' : null,
    equipements: [f.terrasse === true && 'terrasse', f.parking === true && 'parking', f.ascenseur === true && 'ascenseur'].filter(Boolean),
  };
  if (!nature && !type && !loyer && !prixC && !d.vitrine && !d.destination && !d.extraction) return {};
  /* Sans nature, le loyer d'une annonce ne se range nulle part : on le garde comme loyer annuel. */
  const p = proDuBien(d);
  return !nature && loyer ? { ...p, loyerAn: loyer } : p;
}
