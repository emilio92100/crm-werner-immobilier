/* ═══ Un acheteur écarté d'un bien (V3.45) ═════════════════════════════════
   Alexandre : « l'onglet Acheteurs montre des gens qui n'ont aucun rapport ».
   La note seule ne suffit pas : un budget trop court ou une autre ville ne
   pèsent que 2 sur 15, et un acheteur pouvait sortir à 60 % sans pouvoir
   acheter. Un critère essentiel nettement raté l'écarte, quelle que soit sa
   note. « Presque » reste (« En partie ») : c'est un appel à passer.

   Pour le CRM seulement (l'onglet Acheteurs d'un bien, les alertes, les
   mandats d'un client) : l'espace de l'acheteur garde la note telle quelle.
   Ce que la fiche ne dit pas ne se juge pas : un équipement « non annoncé »
   n'écarte personne tant que les annexes (ou l'immeuble) ne sont pas
   remplies. Les villes se comparent comme les communes (« Paris 16e » =
   « Paris 16ème »). */
import { grouperSecteurs, memeCommune, type BienCorr, type Correspondance, type CriteresCorr } from '@/lib/correspondance';

export type RaisonEcart = 'budget' | 'secteur' | 'surface' | 'chambres' | 'indispensable' | 'nature';
export const RAISONS_ECART: Record<RaisonEcart, string> = {
  budget: 'budget trop court', secteur: 'autre secteur', surface: 'trop petit',
  chambres: 'pas assez de bureaux fermés', indispensable: 'il manque un indispensable',
  nature: 'il cherche autre chose',
};
/* Werner (21 octobre 2026) : une affaire n'a pas de ligne « Budget » mais
   « Loyer annuel », « Droit au bail », « Prix du fonds » ou « Prix »
   (correspondance.ts). Seul « Budget » était lu : un loyer à 50 % au-dessus
   de ce que le demandeur peut payer ne l'écartait jamais. Toutes ces lignes
   comptent maintenant comme le budget. */
export const LIGNES_PRIX = ['Budget', 'Loyer annuel', 'Droit au bail', 'Prix du fonds', 'Prix'];
const DE_L_IMMEUBLE = new Set(['Ascenseur', 'Gardien']);

export function raisonEcart(corr: Correspondance, b: BienCorr, c: CriteresCorr): RaisonEcart | null {
  const non = (lib: string) => corr.lignes.some(l => l.lib === lib && l.etat === 'non');
  if (LIGNES_PRIX.some(non)) return 'budget';
  /* Et ce qu'il cherche : une location pour qui veut acheter des murs, un
     fonds pour qui veut louer… n'est pas « un peu moins bien », c'est autre
     chose (la ligne « Ce qu'il cherche », poids 3, restait une simple note). */
  if (non('Ce qu’il cherche')) return 'nature';
  /* V3.226 : la commune avec son arrondissement (« Paris » + 75008 = Paris 8e,
     memeCommune) : avant, un bien tapé « Paris » écartait tous ceux qui
     cherchent « Paris 8ème ». */
  if (non('Secteur') && b.ville) {
    if (!grouperSecteurs(c.secteurs || []).some(v => memeCommune(v.ville, b.ville as string, b.code_postal))) return 'secteur';
  }
  if (c.surfaceMin && b.surface && b.surface < c.surfaceMin * 0.9) return 'surface';
  if (non('Chambres')) return 'chambres';
  const connus = b.equipConnus;
  if (connus && corr.lignes.some(l => l.poids === 3 && l.etat === 'non' && (DE_L_IMMEUBLE.has(l.lib) ? connus.immeuble : connus.annexes))) return 'indispensable';
  return null;
}
