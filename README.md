# Werner Immobilier — CRM de l'immobilier d'entreprise

L'outil de travail de Werner Immobilier, agent en immobilier d'entreprise à Paris :
bureaux, boutiques et locaux commerciaux, restaurants, locaux d'activité, entrepôts.
Locations, cessions de droit au bail, fonds de commerce, murs libres ou occupés.

Werner travaille sous la carte T de RT CONSEILS (CPI 9201 2020 000 045 344).
Contact : 01 87 66 06 00 · contact@wernerimmobilier.com.

En ligne : https://crm-werner-immobilier.vercel.app

## Les trois faces

| Adresse | Pour qui | Ce qu'on y trouve |
|---|---|---|
| `/` | Werner, derrière son accès | Le **CRM** : affaires, contacts (demandeurs, mandants, propriétaires), visites, relances, agenda, carte, documents |
| `/bien/<id>` | Toute personne qui reçoit le lien | La **page publique d'un local** |
| `/espace/<jeton>` | Un demandeur, sans compte (le lien fait l'identification) | Son **espace client** : les locaux retenus pour lui, ses visites, ses offres |

⚠️ Le lien de l'espace appartient au **demandeur**, pas à sa recherche : un client = un lien,
quel que soit le nombre de recherches. Voir `AGENTS.md` §3.3.

## Le métier, en bref

- Une **affaire** (rubrique « Affaires ») a une **nature** — location, cession de droit au bail,
  cession de fonds de commerce, vente des murs, murs occupés — et un **type de local** — bureaux,
  local commercial, restaurant, local d'activité, entrepôt… Tout est dans `src/lib/affaires.ts`.
- Ses étapes : à suivre, estimation, **disponible** (« Affaires en cours »), en pause,
  **sous offre**, **en signature**, **conclue**, retirée du marché.
- Pour une location, le montant est un **loyer annuel HT HC** ; les honoraires se disent **HT**.
- Un **demandeur** cherche un local (à louer, à reprendre ou à acheter) ; un **mandant** (bailleur
  ou cédant) confie une affaire ; un **propriétaire** possède un local pas encore confié.
- Les 63 annonces de Werner sur SeLoger Bureaux & Commerces ont été reprises le 20 octobre 2026,
  avec leurs photos (`src/lib/import-seloger.ts`).

## Les documents du dépôt

| Fichier | Ce qu'il contient | Quand le lire |
|---|---|---|
| **`AGENTS.md`** | Les règles de travail, le vocabulaire et les pièges du dépôt | **En premier, avant d'écrire une ligne** |
| **`context.md`** | Le produit, le métier, le modèle de données, ce qui reste à faire | Quand il faut comprendre l'existant |
| `docs/historique-code-origine.md` | L'historique technique du code d'origine | Pour un détail technique ancien |
| `README.md` | Ce sommaire | Maintenant |

`CLAUDE.md` ne fait que pointer vers `AGENTS.md`.

## Stack

Next.js 16 + TypeScript · Supabase (base + Storage, projet « CRM Werner Immobilier ») ·
Mailjet (à brancher) · Claude API (à brancher) · Vercel (déploiement automatique à chaque
poussée sur `main`).

Couleurs : anthracite `#2e3034`, encre `#232528`, orange `#f08c42`. Police : Plus Jakarta Sans.

## Démarrer en local

```bash
npm install
npm run dev
```

Il faut les variables d'environnement listées dans `context.md` §1 : sans elles, le build compile
mais la collecte des pages échoue sur `supabaseUrl is required` (normal en local).

## Migrations SQL

Dans `outils/sql/`, à passer dans Supabase → SQL Editor. Toutes relançables sans risque
(`if not exists`). La base de Werner a été créée avec `structure-initiale.sql`, puis
`werner-commerce.sql` (les critères et les fiches de l'immobilier d'entreprise).

## Outils

| Fichier | Rôle |
|---|---|
| `outils/espaces-jsx.py` | Détecte les espaces JSX que le compilateur de Next (SWC) supprime (voir `AGENTS.md` §2.1) |
| `outils/vocabulaire-werner.mjs` | Le passage des textes au vocabulaire de l'immobilier d'entreprise (relançable) |
| `outils/identite-werner.mjs` | L'identité de Werner Immobilier dans les textes (relançable) |
| `outils/couleurs-werner.py` | La conversion des couleurs vers l'anthracite et l'orange |
| `outils/logos-werner.py` | Les logos provisoires (à remplacer par le vrai logo, mêmes noms, mêmes tailles) |

```bash
python3 outils/espaces-jsx.py $(find src -name '*.tsx' -o -name '*.ts')
```
