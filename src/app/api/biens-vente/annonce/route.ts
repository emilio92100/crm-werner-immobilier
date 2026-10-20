import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ═══ Reformuler l'annonce d'une affaire (V3.79 ; Werner : l'immobilier d'entreprise) ═══
   Alexandre : « un bouton Reformuler l'annonce, autant de fois que je veux ;
   ça reprend tous les éléments de la fiche du bien et ça me génère une
   présentation du logement », et « minimum 2 100 caractères, pour que ce soit
   bien référencé ».

   Le navigateur envoie les faits de la fiche (faitsAnnonce, src/lib/
   biens-vente.ts : jamais le propriétaire, l'adresse exacte, les codes ni les
   notes), le texte et le titre actuels, et un numéro de version (chaque clic
   en demande une autre). L'IA écrit la présentation et un titre, rien
   d'autre : le prix, les honoraires, la copropriété, le DPE et Géorisques
   sont ajoutés ensuite par le CRM, depuis la fiche (mentionsAnnonce).

   Protégée par le code d'accès, comme le reste du CRM (src/proxy.ts).
     POST { faits, texte?, titre?, version? }  →  { ok, titre, texte } | { ok: false, erreur } */

const MIN = 2000;
const MODELES = ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'];

const ko = (erreur: string, status = 200) => NextResponse.json({ ok: false, erreur }, { status });
const court = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '');

function consigne(faits: string, texte: string, titre: string, version: number, plusLong: boolean): string {
  return `Tu rédiges le texte d'une annonce d'immobilier d'entreprise pour Werner Immobilier (bureaux, boutiques et locaux commerciaux, restaurants, locaux d'activité, entrepôts ; en location, en cession de droit au bail, en cession de fonds de commerce ou en vente des murs), destiné aux portails (SeLoger Bureaux & Commerces, BureauxLocaux, Geolocaux, Leboncoin) et au site de l'agence. Il s'adresse à un commerçant, un restaurateur, une entreprise ou un investisseur : il doit donner envie de visiter et être bien référencé.

LES FAITS — la fiche de l'affaire, seule source de vérité :
${faits || '(fiche presque vide)'}
${texte ? `
LE TEXTE ACTUEL DE L'ANNONCE — il peut apporter des précisions absentes de la fiche ; ses phrases sur le loyer, le prix, le droit au bail, les honoraires, les charges, la taxe foncière, le dépôt de garantie, le DPE ou Géorisques ne sont pas à reprendre :
${texte}
` : ''}${titre ? `
LE TITRE ACTUEL : ${titre}
` : ''}
RÈGLES STRICTES :
- N'écris que des faits donnés ci-dessus. N'invente rien, ne déduis rien (pas de « lumineux » ni de « fort passage » si ce n'est pas écrit, pas d'enseigne voisine, de distance ni de station qui ne sont pas données, pas d'activité autorisée que la fiche ne dit pas).
- Longueur : entre 2 000 et 2 800 caractères, espaces compris. ${plusLong ? 'Ta version précédente était trop courte : développe davantage chaque partie, sans rien inventer.' : 'Développe chaque partie pour atteindre cette longueur, sans remplissage creux.'}
- Cinq à sept paragraphes, séparés par une ligne vide, dans cet ordre quand la matière existe : 1) l'accroche : ce qui est proposé (un local à louer, un droit au bail à céder, un fonds de commerce, des murs), le type de local, la ville et le quartier ou l'arrondissement, la surface, l'emplacement (angle, rue commerçante, emplacement n° 1) et ce qui le distingue ; 2) le local : la répartition des surfaces (rez-de-chaussée, sous-sol, mezzanine, réserve), la vitrine et son linéaire, la hauteur sous plafond, la configuration (plateau ouvert, bureaux cloisonnés, salle de réunion, nombre de postes), la divisibilité ; 3) l'aménagement et les équipements : l'état, la climatisation, l'extraction, la cuisine professionnelle, le câblage et la fibre, les sanitaires, l'accès des personnes à mobilité réduite ; 4) l'immeuble et les accès : l'étage, l'ascenseur, le monte-charge, le parking, le quai ou l'accès de livraison ; 5) le bail ou l'activité : le type de bail, la destination autorisée (les activités possibles, telles que la fiche les écrit), la durée qui reste pour une cession ; pour un fonds, l'activité, l'enseigne, l'ancienneté, la licence, l'accompagnement du cédant ; pour des murs occupés, le locataire en place et son activité, sans chiffre ; 6) le quartier, l'environnement commercial, les transports et la disponibilité.
- Référencement : reprends naturellement, deux ou trois fois dans le texte, ce qui est proposé (« local commercial à louer », « cession de droit au bail », « fonds de commerce », « bureaux à louer »…), le type de local, la ville, l'arrondissement ou le quartier, la surface et les atouts recherchés (vitrine, angle, extraction, terrasse, réserve, parking…) — sans bourrage.
- Ton professionnel et chaleureux, précis, phrases simples. Pas de formules creuses (« coup de cœur », « rare », « à saisir », « ne tardez pas », « idéalement situé » ou « emplacement premium » sans fait derrière). Pas de majuscules d'insistance, pas d'émoji, pas de markdown, pas de liste à puces, pas de titre dans le texte.
- N'écris jamais : le loyer, le prix du droit au bail, du fonds ou des murs, les honoraires, les charges, la taxe foncière, le dépôt de garantie, le chiffre d'affaires et les résultats d'un fonds, le loyer perçu de murs occupés, les valeurs du DPE, Géorisques (le CRM ajoute les mentions chiffrées après ton texte), ni l'adresse exacte (le nom de la rue seulement s'il est donné et utile), un nom de personne, un code, un téléphone, un nom d'agence.
- C'est la version n° ${version} : propose une rédaction nettement différente d'une version précédente (autre accroche, autres tournures, autre façon d'enchaîner).
- Le titre : 70 caractères au plus — ce qui est proposé, le type de local, la surface, la ville ou l'arrondissement et l'atout principal (par exemple « Cession de droit au bail · Boutique 75 m² · Paris 11e · vitrine d'angle »). Sans prix ni loyer.

Réponds UNIQUEMENT avec un objet JSON, sans rien autour : {"titre": "...", "texte": "..."}. Dans "texte", les paragraphes sont séparés par \\n\\n.`;
}

async function demander(cle: string, prompt: string, modeles = MODELES, delai = 42000): Promise<{ titre: string; texte: string } | { erreur: string }> {
  let derniere = '';
  const fin = Date.now() + delai;
  for (const model of modeles) {
    const reste = fin - Date.now();
    if (reste < 8000) break;
    let r: Response;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(reste),
      });
    } catch (e) { derniere = (e as Error).message || 'réseau'; continue; }
    /* Un modèle refusé (inconnu, surchargé) : le suivant. */
    if (!r.ok) { derniere = `api_${r.status}`; continue; }
    const j = await r.json().catch(() => null) as { content?: { text?: string }[] } | null;
    const brut = (j?.content?.[0]?.text || '').trim();
    const m = brut.match(/\{[\s\S]*\}/);
    if (!m) { derniere = 'réponse illisible'; continue; }
    try {
      const o = JSON.parse(m[0]) as { titre?: unknown; texte?: unknown };
      const texte = typeof o.texte === 'string' ? o.texte.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim() : '';
      const titre = typeof o.titre === 'string' ? o.titre.replace(/\s+/g, ' ').trim().slice(0, 90) : '';
      if (texte) return { titre, texte };
      derniere = 'texte vide';
    } catch { derniere = 'réponse illisible'; }
  }
  return { erreur: derniere || 'aucune réponse' };
}

export async function POST(req: NextRequest) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return ko('La clé de l’IA n’est pas posée sur le serveur.');
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return ko('Requête illisible', 400); }
  const faits = court(body.faits, 6000).trim();
  const texte = court(body.texte, 8000).trim();
  const titre = court(body.titre, 200).trim();
  const version = Math.max(1, Math.min(99, Math.round(Number(body.version) || 1)));
  if (faits.length < 20 && texte.length < 80) return ko('La fiche est presque vide : renseigne d’abord le local (type, ville, surface, vitrine…).');

  const debut = Date.now();
  let r = await demander(cle, consigne(faits, texte, titre, version, false));
  /* Trop court : une seconde demande, plus longue, au modèle rapide et
     seulement s'il reste le temps (la route a 60 secondes en tout). */
  if ('texte' in r && r.texte.length < MIN - 200 && Date.now() - debut < 28000) {
    const r2 = await demander(cle, consigne(faits, texte, titre, version, true), MODELES.slice(-1), 26000);
    if ('texte' in r2 && r2.texte.length > r.texte.length) r = r2;
  }
  if ('erreur' in r) return ko(`L’IA n’a pas pu écrire l’annonce (${r.erreur}). Réessaie dans un instant.`);
  return NextResponse.json({ ok: true, titre: r.titre, texte: r.texte });
}
