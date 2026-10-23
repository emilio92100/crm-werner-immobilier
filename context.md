# CONTEXTE — Werner Immobilier, CRM de l'immobilier d'entreprise

**21 octobre 2026**

Ce fichier décrit **ce qui existe**, pas ce qu'on aimerait construire.
Les règles de travail (comment livrer, quels pièges éviter) sont dans **`AGENTS.md`** : à lire en
premier. L'histoire technique du code d'origine, écran par écran, est dans
**`docs/historique-code-origine.md`** (renvoyé plus bas sous le nom « l'historique »).

---

## 0. En deux minutes

**Werner Immobilier** est un agent en **immobilier d'entreprise à Paris** : bureaux, boutiques et
locaux commerciaux, restaurants, locaux d'activité, entrepôts. Il fait des **locations**, des
**cessions de droit au bail**, des **cessions de fonds de commerce** et des ventes de **murs**,
libres ou occupés. Werner travaille sous la **carte T de RT CONSEILS** (CPI 9201 2020 000 045 344) :
ses mandats sont au nom de RT CONSEILS. Ses coordonnées : **01 87 66 06 00**,
**contact@wernerimmobilier.com**. Depuis le 21 octobre 2026, **wernerimmobilier.com** est le
nouveau site de Werner (dépôt `werner-immobilier-site`, projet Vercel du même nom), qui lit ses
annonces dans `/api/site/annonces` et dépose ses formulaires par `/api/site/demande`. L'ancien
WordPress, piraté (fausse vérification Cloudflare), est débranché du domaine : ne jamais ouvrir
son hébergement IONOS.

L'outil a **trois faces** :

| Face | Adresse | Qui la voit |
|---|---|---|
| Le CRM | `/` — derrière la connexion | Werner |
| La page publique d'un local | `/bien/<id>` | Toute personne qui a le lien |
| L'espace client d'un demandeur | `/espace/<jeton>` | Le demandeur, par son lien privé |

S'y ajoutent `/signer/<jeton>` (un co-signataire signe un document) et `/proposer/<jeton>` (le
lien pour les agences : un confrère propose une annonce pour une recherche).

| Quoi | Où |
|---|---|
| Le CRM en ligne | https://crm-werner-immobilier.vercel.app |
| Dépôt GitHub | `emilio92100/crm-werner-immobilier` (public, voulu : aucune clé n'y figure) |
| Base | Supabase, projet « CRM Werner Immobilier » (`elnwfremyltynhbhwiir`) |
| Hébergement | Vercel, projet `crm-werner-immobilier` : déploiement automatique à chaque poussée sur `main` |

**L'origine, en une phrase** : ce dépôt est une copie du CRM d'Emilio Immobilier (chasse
immobilière résidentielle, dépôt `emilio92100/emilio-immo-chasseimmo`, code V3.220), adaptée les 20
et 21 octobre 2026. **Ne jamais toucher au dépôt ni à la base d'Emilio** (Supabase
`eutxmrdcykztjdyydmuo`) : ce sont deux CRM séparés.

---

## 1. Stack et accès

| Service | Usage |
|---|---|
| Next.js **16.3.7** + TypeScript | Framework. Next 16 : `middleware.ts` s'appelle `src/proxy.ts` (AGENTS.md §2.6) |
| Vercel | Hébergement. Quatre tâches planifiées dans `vercel.json` (point automatique, relances des signatures, diffusion, demandes SeLoger) |
| Supabase | Base + Storage. RLS actif sur toutes les tables (AGENTS.md §3.4) |
| Claude API | Lecture d'annonces, rédaction, analyse, rapprochement : **pas encore branchée** |
| Mailjet | E-mail transactionnel : **branché** (compte de Werner, domaine et DKIM validés, clés sur Vercel depuis le 22 octobre 2026 ; vérifié le 23) |
| Ringover | Téléphonie (`/api/ringover/…`) : pas encore branché |
| geo.api.gouv.fr · api-adresse.data.gouv.fr | Communes et adresses |

**Polices** : Plus Jakarta Sans (titres) · DM Sans (corps), dans `src/styles/globals.css`.
**Storage** (`outils/sql/structure-initiale.sql`) : `photos-biens` (public : les photos des locaux
proposés aux demandeurs, et des PDF sous `pdf/`) · `photos-vente` (public : les photos des affaires,
sous `<id de l'affaire>/`) · `mandats` (privé : documents, pièces des dossiers, signatures) ·
`agences-pdf` (privé, PDF seulement).

**La base** a été créée le 20 octobre 2026 avec `outils/sql/structure-initiale.sql` (la structure du
CRM d'Emilio, relevée en lecture seule, **sans aucune donnée** ; retirées : la table `partenaires`
et les colonnes `clients.vendeur_*`), puis `outils/sql/werner-commerce.sql` (§2). 28 tables.

### Les variables d'environnement (Vercel)

| Variable | État |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` | Posées : le CRM s'ouvre et la reprise SeLoger du 20 octobre est passée par le serveur |
| `WERNER_ACCESS_CODE` (l'ancien nom `EMILIO_ACCESS_CODE` est encore lu) | Facultative : sans elle, le badge est signé avec la seule clé de service (`codeAcces()`, `src/lib/badge.ts`). La changer invalide tous les badges. À vérifier sur Vercel |
| `WERNER_MAILS_AUTORISES` (ou `EMILIO_MAILS_AUTORISES`) | Facultative : la liste des adresses qui peuvent entrer. Vide, tout compte Supabase du projet entre |
| `MAILJET_API_KEY` · `MAILJET_API_SECRET` | **Posées** (22 octobre 2026, vérifié sur Vercel le 23). `MAILJET_FROM_EMAIL` · `MAILJET_FROM_NAME` ne le sont pas : replis contact@wernerimmobilier.com, « Werner Immobilier ». `ALERTES_EMAIL` non plus : les alertes vont à contact@ |
| `MAILJET_FROM_SIGNATURE` | **Posée** : `signature@wernerimmobilier.com`. Les mails d'une signature (lien, code, exemplaire signé, renonciation : l'option `expediteur: 'signature'` de `envoyerMail`) partent de cette adresse, réponses vers contact@. Vide, ils partent de `MAILJET_FROM_EMAIL` |
| `ANTHROPIC_API_KEY` · `CRON_SECRET` | **À poser** : la clé de l'IA ; le secret des tâches planifiées (sans lui, elles refusent de tourner, c'est voulu) |
| `RINGOVER_CLE_CONTACT` · `RINGOVER_CLE_RECHERCHE` · `NEXT_PUBLIC_HOTE_ESPACE` | **À poser** quand Ringover sera branché, et quand le sous-domaine de l'espace existera (§6) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | À poser pour les notifications de l'espace client |
| `SELOGER_*` (sept variables) | La diffusion SeLoger et ses demandes de contact, par l'API d'AVIV de l'origine : à ne poser qu'après vérification (§7) |
| `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_CRM_URL` · `CRM_URL` · `NEXT_PUBLIC_MAIL_IMAGES_URL` · `ALERTES_EMAIL` · `DEMANDES_EMAIL` | Facultatives : repli sur https://crm-werner-immobilier.vercel.app, ou sur l'adresse d'envoi |
| `JINKA_SFTP_*` · `JINKA_ZIP` · `EMI_VERSION` | Sans objet (Jinka est un portail résidentiel) ; `EMI_VERSION` est posée par `next.config.ts` |

Liste exacte : `grep -rhoE "process\.env\.[A-Z_0-9]+" src | sort -u`.

### Le portail d'accès — `src/proxy.ts`

Tout le CRM est derrière la connexion, sauf `PUBLIC_PATHS` (`/login`, `/api/login`, les quatre tâches
planifiées, qui demandent `CRON_SECRET` ou le badge, `/api/signer`, `/api/demandes-site/notifier`,
`/api/flux-site`, les deux routes Ringover) et `PUBLIC_PREFIXES` (`/bien/`, `/espace/`,
`/api/espace/`, `/signer/`, `/proposer/`, `/api/agences/`). Toute nouvelle route publique s'ajoute
là. Une action du CRM (`POST` sur `/api/…`) venue d'une autre origine que le CRM est refusée (403).
Les routes, une par une : l'historique, §5.

**Deux serrures** : le cookie `emilio_acces` (un badge signé et daté de 30 jours, posé par
`/api/login` après vérification de la session Supabase ; le nom d'origine est gardé) ouvre les
pages ; la **session Supabase** du navigateur ouvre les données. Les comptes sont créés à la main
dans Supabase, les inscriptions restent fermées. Les pages publiques lisent la base côté serveur,
avec la clé de service. Sans `NEXT_PUBLIC_HOTE_ESPACE`, les liens donnés aux clients passent par
l'adresse du CRM (`…/espace/<jeton>`, `…/bien/<id>`… : `basePublique()`, `src/lib/jeton.ts`).

### Couleurs

Choix d'Alexandre : « un noir grisé, pas trop noir, et un orange pas trop clair ». Anthracite
**`#2e3034`** pour les aplats sombres, encre **`#232528`**, orange **`#f08c42`** pour l'accent
(`#c2621c` pour un texte orange sur fond clair, `#f7b07a` sur fond sombre). Les variables ont gardé
leurs noms d'origine : `--emilio` et `--gold` dans `src/styles/globals.css`, `--marque` et `--or`
dans l'espace client ; les mails lisent `MAIL` dans `src/lib/mail-charte.ts`. Les couleurs qui
portent un sens (vert, rouge, ambre…) sont restées. Un seul accent par page. Voir AGENTS.md §5.

---

## 2. Le métier et les données

### Les mots de Werner, face aux clés internes

**Les clés internes n'ont pas changé** : la base et ses déclencheurs les lisent. Seuls les mots ont
changé (`outils/vocabulaire-werner.mjs`, relançable sans danger).

| Clé | Chez Werner |
|---|---|
| `acheteur` (type de contact) | **Demandeur** : il cherche un local, à louer, à reprendre ou à acheter |
| `vendeur` | **Bailleur, cédant** : un **mandant**, son affaire est confiée à l'agence |
| `vendeur_signe` | **Ancien mandant** : son affaire est signée |
| `proprietaire` | **Propriétaire** : il possède un local, des murs ou un fonds pas encore confiés |
| `notaire` · `confrere` · `gardien` · `partenaire` | Notaire, avocat · Confrère ou agence · Gardien, gestionnaire · Partenaire |
| `biens_vente` | Les **affaires** (rubrique « Affaires ») |
| `biens` | Les locaux proposés à un demandeur, dans une de ses recherches |

Les **étapes d'une affaire** (`biens_vente.etape`, `ETAPES_VENTE` dans `src/lib/biens-vente.ts`) :

| `etape` | Libellé · court · pluriel |
|---|---|
| `a_suivre` · `estimation` | À suivre (pas encore estimé) · Estimation, Estimations |
| `mandat` | Mandat en cours · **Disponible** · **Affaires en cours** |
| `suspendu` | En pause |
| `offre` | **Sous offre** |
| `compromis` | **En signature** : le bail, la promesse ou l'acte de cession se prépare |
| `vendu` · `retire` | **Affaire conclue** (Conclue, Conclues) · **Retirée du marché** (Retirée, Retirées) |
| `annonce_type` | Annonce type : une annonce pour faire venir des demandeurs, sans vraie affaire derrière (hors parcours, ni visite ni offre) |

« En cours » (le compteur du menu) = `mandat`, `offre`, `compromis`. Une affaire est diffusée aux
étapes `mandat`, `offre`, `compromis`, `annonce_type`. Sa référence : `WER-A-AAAA-NNN`
(`referenceSuivante()`).

### La nature d'une affaire et le type de local — `src/lib/affaires.ts`

Tout est dans ce fichier : les listes, `libPrix`, `montantAffaire`, `loyerM2`, `rentabilite`,
`proDuBien`. La colonne **`prix`** garde toujours **le** montant de l'affaire ; ce qu'il veut dire
dépend de la nature (`donnees.nature`) :

| Nature | Libellé | `prix` | À côté |
|---|---|---|---|
| `location` | Location | **Loyer annuel HT HC** | droit d'entrée, dépôt de garantie |
| `cession_bail` | Cession de droit au bail | Prix du droit au bail | `loyerAn` : le loyer du bail en cours |
| `fonds` | Cession de fonds de commerce | Prix du fonds | `loyerAn`, l'activité, CA HT, résultat, EBE |
| `murs` | Vente des murs | Prix de vente | |
| `murs_occupes` | Murs occupés | Prix de vente | `loyerAn` en place, rentabilité brute |

Le **type de local** (`donnees.typeBien` et la colonne `type_bien`, `TYPES_LOCAL`) : `bureaux`,
`local` (boutique, local commercial : la clé d'origine est gardée), `restaurant`, `activite`,
`entrepot`, `immeuble`, `terrain`, `parking`, `autre`. Une recherche écrit le libellé court
(« Bureaux, Local commercial »). Le même fichier tient les baux (3/6/9, professionnel, dérogatoire, précaire, civil ; indices ILC,
ILAT, ICC), les destinations, les emplacements d'un commerce et les **équipements** : les mêmes clés
pour l'affaire et pour les exigences d'un demandeur, le rapprochement compare clé à clé.

### `donnees` — le formulaire d'une affaire

`biens_vente.donnees` (jsonb) garde les réponses de l'éditeur (`ETAPES_BIEN`) : nature, type,
adresse (`cp`, `ville`, `quartier`, `gps`), surfaces (`divisible`, `surfDivMin`), montants (`prix`,
`loyerAn`, `chargesAn`, `taxeFonciere`, `depotMois`, `droitEntree`), bail (`bailType`, `bailFin`,
`destination`), commerce (`vitrine`, `emplacement`, `extraction`), fonds (`activite`, `caHt`,
`resultat`, `ebe`), équipements, honoraires, annonce, photos, diffusion, `portail` (§4), notes, le
mandant. Les colonnes de liste (`titre`, `prix`, `surface`, `ville`, `photo`, `client_id` = le
mandant…) sont recalculées à chaque enregistrement par `colonnesBien()`. Une société mandante est
rangée sous les clés d'origine d'une SCI : `donnees.qui = 'sci'`, `sciNom` = sa dénomination.

### Les critères d'un demandeur — `recherches.criteres_pro`

`werner-commerce.sql` a ajouté **`recherches.criteres_pro`** (jsonb) : `natures[]` (louer,
reprendre un bail, racheter un fonds, acheter des murs, investir), `activite`, `loyerMin`,
`loyerMax` (loyer annuel HT HC), `vitrineMin` (mètres de linéaire), `postesMin`, `emplacements[]`.
Écrit par `proPourBase()` (`CriteresRecherche.tsx`), lu par `lireCriteresPro()` (`correspondance.ts`).
Le reste tient dans les colonnes d'origine : `type_bien` (les types de local), `surface_min/max`,
`budget_min/max` (le prix d'une cession ou d'un achat, hors taxes), `secteurs`, les transports,
`apport` et `financement` (pour un achat : fonds propres, prêt, crédit-bail…), `urgence`, `notes`,
et **`exigences`** : le niveau de chaque exigence du commerce, souhaité ou indispensable
(`EXIGENCES_PRO` : rez-de-chaussée, vitrine, extraction, terrasse, réserve, climatisation, accès
PMR, parking, ascenseur, fibre, câblage, plancher technique, quai, cuisine équipée, chambre froide).
L'assistant a huit étapes : Son projet · Surfaces · Budget · Ce qu'il lui faut · Où chercher ·
Transports · Son parcours · Contexte du projet.

### Le rapprochement

`correspondance()` (`src/lib/correspondance.ts`) donne une note sur 100 et son détail, critère par
critère. Une affaire y arrive avec son résumé `pro` (`proDuBien()`, via `versCorrespondance()`) :
la nature (poids 3), le loyer annuel face à `loyerMax` et le prix face à `budget_max` (poids 2, et
« presque » jusqu'à 10 % au-dessus), la vitrine, l'emplacement, puis le secteur, le trajet, la
surface, l'étage, le DPE et les équipements clé à clé (`rdc` : le local est au rez-de-chaussée).
Moins de trois critères vérifiables : pas de note. Le CRM s'en sert dans l'onglet Rapprochement
d'une affaire et dans les alertes (`src/lib/rapprochement.ts`, `src/lib/alertes-rappro.ts`).
`werner-commerce.sql` a aussi ajouté **`biens.pro`** (jsonb) : ce résumé, copié quand une affaire est
proposée à un demandeur (`versBienAcheteur()`) ; rien de privé (ni mandant, ni chiffres du fonds).

**Écartés d'office** (`raisonEcart`, `src/lib/ecart-acheteur.ts`), quelle que soit la note : une
autre ville, un loyer ou un prix à plus de 10 % au-dessus (toutes les lignes de prix d'une affaire,
`LIGNES_PRIX` — avant le 21 octobre 2026, seule « Budget » était lue et un loyer trop haut n'écartait
jamais personne), **pas ce qu'il cherche** (`nature` : une location pour qui veut acheter des murs…,
« Pas ce qu'ils cherchent » dans le rapprochement), une surface sous 90 %, un indispensable qui manque.
Une recherche **sans budget ni loyer maximum, ou sans secteur**, est « à compléter » et n'est pas comptée
(`manqueRecherche`, `outils.ts`) — depuis le 21 octobre, `criteres_pro.loyerMax` compte comme un
budget : avant, tout demandeur « location » passait « à compléter ».

**La carte « Demandeurs potentiels »** de la vue d'ensemble d'une affaire (`CarteAcheteurs`,
`AcheteursBien.tsx`, repris du CRM d'Emilio le 21 octobre 2026) : « 23 **pistes à vérifier** »,
« À confirmer », le chiffre à peine plus gros que le texte ; « Premier tri automatique dans tes
demandeurs : 17 correspondent · 6 en partie. » ; puis « ✓ Vérifié le … : 3 oui · 2 à voir » (le
dernier rapprochement, `FicheBien` → `seance`) ou « Pas encore vérifié un par un. ». Son « ? » ouvre
« Comment lire ce chiffre » : une phrase, les deux chiffres, le tri en trois étapes, le secteur de
cette affaire (ville et quartier renseignés ou non, et ce que ça change), ce qui manque à sa fiche
(nature, loyer ou prix, surface), puis « Vérifier avec le rapprochement ».

**Le secteur précis** (21 octobre 2026, repris du CRM d'Emilio, sa V3.226). Une adresse tapée donne la
ville « Paris », les demandeurs choisissent « Paris 8ème » : comparées lettre à lettre, l'affaire était
écartée d'office pour tous ceux qui cherchent un arrondissement. `memeCommune()` (`correspondance.ts`)
lit Paris, Lyon et Marseille avec leur arrondissement (8, 8e, 8ème…) ou, à défaut, le code postal de
l'affaire (75116 = 16e) ; « Paris » entier comprend tous les arrondissements ; sans code postal,
« arrondissement à préciser » (presque). Les quartiers : un nom contenu dans l'autre suffit
(« Gallieni » ↔ « Silly-Gallieni »). **Hors des quartiers choisis, ou d'arrondissement inconnu, une
affaire ne « correspond » jamais** : note plafonnée à 69 %, « en partie », à juger dans le rapprochement.

**Le rappel du secteur** (`shared/RappelSecteur.tsx`, jamais bloquant, une fois par ouverture) : une
affaire créée ou modifiée avec une ville et sans quartier (`EditeurBien`, à « Terminer » ou à la
fermeture : les quartiers connus de sa ville se choisissent d'un clic, ou « Écrire le quartier ») ;
les critères d'une recherche (`FicheClient`) et la création d'un demandeur (`Clients`) sans aucun
secteur (« Ajouter un secteur » ouvre l'étape « Où chercher », ou « Enregistrer / Créer quand même »).

**Les quartiers de référence** (21 octobre 2026, repris du CRM d'Emilio, sa V3.227). `src/lib/quartiers.ts`
(`QUARTIERS_REF`) : pour chaque arrondissement de Paris ses 4 quartiers administratifs (les 80 de la Ville
de Paris), sous chacun les noms d'usage dont on est sûr qu'ils sont dedans (`lieux` : Triangle d'or dans les
Champs-Élysées, Saint-Lazare dans l'Europe, Opéra dans la Chaussée-d'Antin…), et dans `autres` ceux qui
chevauchent (Sentier, Haut Marais, Marais, Bastille…). Ils se choisissent d'un clic (`shared/ChoixQuartiers.tsx`) :
dans le champ Quartier d'une affaire (`ChampsBien`, toujours libre à côté), dans le rappel du secteur et
dans la recherche d'un demandeur (`SecteurPicker`). Le rapprochement (`quartierCouvre`) : un nom contenu
dans l'autre suffit, sans majuscules, accents, tirets ni petits mots, et un quartier de référence couvre
ses lieux (le demandeur qui veut les Champs-Élysées correspond à une affaire notée Triangle d'or).

**Le rapprochement relié des deux côtés** (22 octobre 2026, repris du CRM d'Emilio, sa V3.230).
Alexandre : « depuis une affaire et depuis un demandeur, est-ce que c'est synchronisé ? quand on
reclique, on voit qu'elle a déjà été envoyée ? et des explications étape par étape, jolies, fiables ».
- **Vu depuis tes affaires** (`lib/rapprochement.ts`, `vusDepuisBiens` ; `fiche/Rapprochement.tsx`,
  `VuDepuisBiens`) : l'onglet Rapprochement d'un demandeur relit les séances gardées sur les affaires
  (`biens_vente_suivi`, type « note », `donnees.rapprochement`, la ligne de SA recherche). Le dernier avis
  par affaire (« ressortie N fois »), Oui et À voir d'abord, Non replié ; où elle en est (« Dans sa
  sélection », « Présentée le … · intéressé », « Pas pour lui », plus proposée) ou « La mettre dans sa
  sélection ». Le Suivi du demandeur montre « Rapprochement depuis l'affaire · Oui · 84/100 » à chaque
  séance où l'avis change : construit à la lecture, rien n'est écrit en base.
- **Déjà dans son dossier** : `rapprocher` rend ces affaires (`deja`, `EtatDossier`) ; la fenêtre les
  range à part, repliées, sans case, avec ce qui en a été fait.
- **Mes estimations** (côté demandeur, décochée d'office) : les étapes `estimation` et `a_suivre` sont
  aussi cherchées, étiquette « Ton estimation » ; posée chez lui, elle part sans montant.
- **L'aide** (`shared/AideRapprochement.tsx`, « Comment marche le rapprochement ») : quatre étapes, une
  version depuis une affaire et une depuis un demandeur, aux règles de Werner (loyer ou prix, nature,
  type de local, jamais le mandant). Bouton « Comment ça marche ? » dans l'onglet d'une affaire et dans
  le guide d'un demandeur ; un « i » dans la fenêtre. ⚠️ Chaque phrase y décrit le code : une règle qui
  change change aussi là.
- **Les cartes** : chaque affaire trouvée est une carte d'un bord à l'autre (`.bc`) — la photo et sa
  note, le titre, le lieu, le montant ; la case et l'œil à droite ; l'avis à côté (ordinateur) ou
  dessous sur toute la largeur (téléphone). Même carte pour « Déjà dans son dossier » et « Vu depuis tes
  affaires » ; côté affaire, l'avis d'un demandeur passe sous son nom, sur toute la largeur. La fenêtre
  dit « 2 affaires pour Paul », « affaire cochée », « La mettre dans sa sélection ».

**L'onglet Rapprochement, au repos puis pas à pas** (22 octobre 2026, repris du CRM d'Emilio, sa V3.231).
Au repos : l'illustration animée (`FicheClient`, `illuRappro` : le demandeur et trois pistes, des traits qui
défilent, des cartes qui flottent, une étincelle), « Quelles affaires de ta base pourraient plaire à … ? »,
« Lancer un rapprochement », « Comment ça marche ? », le dernier rapprochement, et un rappel vert quand des
affaires l'ont fait ressortir depuis leur fiche sans être dans son dossier. Au clic, « Préparer le
rapprochement » se déplie : ① Où chercher (trois petites cases avec leur nombre et leur « ? » ; la période
des veilles seulement si elles sont cochées), ② Quoi montrer (après un premier rapprochement : nouveautés ou
tout revoir, chacun avec son « ? » qui décrit le code), ③ combien de locaux seront comparés, et le bouton.
Rien de coché : ② et ③ se replient. Le « ? » est `shared/Aide.tsx`. Les rapprochements faits : une carte,
deux onglets (`OngletsHisto`, « Depuis sa fiche » et « Depuis tes affaires ») ; trois d'abord, puis « Voir
les plus anciens » ; trois affaires par groupe dans « Depuis tes affaires ». L'ancienne carte « Vu depuis
tes affaires » du bas n'existe plus.

**L'espace : l'heure de la dernière recherche, et « Un imprévu ? » sur une visite calée** (22 octobre 2026,
repris du CRM d'Emilio, sa V3.232). En haut de l'espace, « mis à jour à … » est en heure de Paris (c'était
l'heure du serveur, 2 h de moins). Plus jamais « 0 annonce lue » : on compte la journée de la dernière
recherche (« Aujourd'hui : 21 annonces lues sur vos critères · dernière recherche à 17 h 56 » ; à zéro,
« aucune nouvelle annonce… depuis la recherche précédente ») ; sur ordinateur, cette ligne devient une bande
sous trois cases. « Votre recherche est à jour » : la loupe qui balaie, « Dernière recherche » (orange et
animée quand c'est aujourd'hui) et « Ces 7 derniers jours ». « Un imprévu ? » (carte de la visite, et sous
« Où en est Werner ») : le demandeur demande à décaler (ses disponibilités) ou à annuler (sa raison) ; il
ne change rien lui-même. Werner a une relance du jour « Imprévu — <local> · visite du … », une ligne au
Suivi (type message_client, `metadata.imprevu`), un mail (alerte « visite_imprevu »). Dans le CRM :
l'encadré orange sur la visite (onglet Visites : « Déplacer la visite », « Annuler la visite ») et en tête
de « Mon suivi avec l'agence » (« Imprévu : à décaler ») ; un créneau noté après l'imprévu y devient
« Déplacer la visite ici ». Déplacée, la relance se ferme et le Suivi note « Visite déplacée ». Annulée :
la relance se ferme ; « Le local ne m'intéresse plus » ou « J'ai trouvé un autre local » font passer le
local « Pas pour lui ». `src/lib/imprevus.ts`, `imprevusOuverts` dans `src/lib/visites.ts`. Depuis le
paragraphe suivant, le demandeur choisit aussi lui-même le nouveau créneau dans son espace.

**Le demandeur choisit lui-même son créneau, la 2e visite, et le mandat d'abord** (22 octobre 2026, repris
du CRM d'Emilio, ses V3.221, V3.222 et V3.233). Un appel noté avec des créneaux et « Lui montrer » coché :
le demandeur les voit dans son espace — en tête de l'accueil (« Un créneau de visite à choisir »), en haut
de « Vos visites » et sous « Où en est Werner » sur la fiche du local (`ChoixCreneau` : une carte par
créneau, une plage se découpe de demi-heure en demi-heure) — et en choisit un. `/api/espace/creneau` pose
la visite comme « Planifier une visite » (agenda, Visites, Suivi « Visite planifiée »), avec une relance du
jour « Créneau choisi — … : confirmer la visite à l'agence » et un mail (alerte « visite_creneau »). Même
règle à l'écran et au serveur (`creneauxAChoisir`, `src/lib/suivi-client.ts`). Après un imprévu « décaler »,
les créneaux notés depuis se choisissent aussi (« Choisir mon créneau » sur la carte de la visite) : la
visite est déplacée, pas doublée, et la relance de l'imprévu se ferme. **La 2e visite** suit le même
chemin : dans le CRM, « Caler la 2e visite » dès « Compte rendu à faire » (deux chemins : caler la date
maintenant, ou proposer les créneaux de l'agence) ; dans l'espace, « Je souhaite le revoir » sur un local
déjà visité (ses raisons, ses disponibilités, un mot ; `/api/espace/revoir`), puis « Où en est Werner »
avec les créneaux d'après la visite. **Le mandat d'abord** : comme « Je souhaite le visiter », un créneau
choisi alors qu'un mandat l'attend (à signer dans l'espace, ou préparé dans Documents) ouvre d'abord la
signature ; le créneau part tout seul une fois signé, et le serveur fait la même vérification (réponse
`mandat`). S'il a choisi d'attendre ses 14 jours de réflexion, un créneau avant la fin n'est pas posé.
Seule une visite posée par Werner dans le CRM s'en passe. `courtDuBien` (« Boutique 60 m² · Paris ») est
dans `src/lib/visites.ts`.

### Le marché, l'ancienneté d'une annonce

Savoir **depuis quand une annonce est en ligne** se lit dans les données de la page SeLoger Bureaux &
Commerces (`dateCreation`, `dateMiseAJour` dans `__NEXT_DATA__`), pas à l'écran ; la reprise ne garde
que `dateCreation` (§4). **Werner n'a pas Yanport** : rien de ce qui en dépend ne vaut pour lui.

### Les tables

L'architecture ne change pas : **`Contact → Recherche(s) → locaux proposés`**, et l'espace client
appartient au contact (`clients.token_espace`, AGENTS.md §3.3). **Biens, visites, envois, relances et
transactions se filtrent sur `recherche_id`** ; le journal sur `client_id` (AGENTS.md §3.1). Le
détail colonne par colonne : l'historique, §2.

| Table | Ce qu'elle porte |
|---|---|
| `clients` | Tous les contacts. `types[]`, `pro` (jsonb ; `structure` = sa société : dénomination, forme, RCS, siège, qualité, associés), `token_espace`, `archive`. Gardées pour compatibilité : `statut_occupation`, `bien_actuel_*`, `civilite` / `couple` / `conjoint`, et les colonnes de critères mortes depuis la V3.0 de l'origine (`type_bien`, `budget_*`, `chambres_min`, `balcon`, `jardin`, `cave`…) |
| `recherches` | Le pivot. Voir ci-dessus, plus `active` (la veille par recherche), `parcours`, `token_espace` (l'adresse interne d'une recherche), `espace_actif`, `token_agences`. Gardées pour compatibilité : `nb_pieces_min/max`, `chambres_min`, `surface_sejour_min`, `cuisine_type`, `exterieur_surface_min`, `balcon`, `jardin`, `cave`, `interphone`, `digicode`… |
| `biens` | Un local proposé à un demandeur : `etape` `selection` ou `presente`, `badge_retour` (sa réponse), `bien_vente_id` (la copie d'une affaire), `pro`. Gardées : `nb_pieces`, `nb_chambres`, `balcon`, `jardin`, `cave`, `exposition`… |
| `veille_propositions` · `veille_passages` · `annonces_client` · `espace_evenements` | La veille, ses tours, les annonces envoyées par le client, ce qu'il fait dans son espace : comme à l'origine |
| `visites` · `journal` · `envois` · `relances` · `transactions` · `rendez_vous` | Le suivi d'un demandeur et l'agenda. `relances` : `date_echeance`, `note`, `statut = 'en_attente'` (historique §2) |
| `biens_vente` · `biens_vente_suivi` | Les affaires, et leur historique (visites hors CRM, offres, étapes, prix, notes, envois de pièces) |
| `documents` · `documents_signataires` · `mandats_signatures` · `mandats_cosignataires` | Les documents juridiques et leurs signatures |
| `registre_depart` · `registre_mandats` · `registre_observations` | Le registre des mandats |
| `contact_submissions` · `geocodes` · `push_abonnements` · `suivis_agence` · `propositions_agences` · `parametres` | Demandes Internet, la carte, les notifications, le suivi avec une agence, le lien pour les agences, les réglages |

---

## 3. Les écrans

### La barre latérale (`src/components/layout/Sidebar.tsx`)

- **Principal** — Dashboard · **Contacts** (sous-menu : Mes demandeurs · Mes bailleurs et cédants ·
  Mes propriétaires) · **Affaires** (pastille : les affaires en cours, sous offre ou en signature ;
  sous-menu : Mes affaires en cours · Sous offre, en signature · Mes estimations).
- **Suivi** — Demandes Internet · Agenda · Visites · Relances.
- **Outils** — Carte · Documents (Créer un document · Liste des documents · Registre des mandats).
  **Analyse** — Mon activité · Paramètres.
- Sur téléphone, une barre en bas : Accueil · Contacts · « + » (contact, affaire, rendez-vous, mail)
  · Visites · Relances. Les logos sont provisoires (§6).

### Les écrans, en bref

- **Affaires** (`PageBiens.tsx`) — « Affaires en cours » à l'arrivée (elles comptent aussi celles
  sous offre et en signature : le mandat court toujours), « Sous offre, en signature », « Conclues » ;
  le reste dans « Autres étapes » ; « Toutes » et « Archivées ». La recherche lit aussi le mandant,
  l'enseigne et la référence SeLoger ; les filtres : nature, type de local, ville, surface, loyer,
  prix. L'affaire ouverte vit dans l'URL : `?page=biens&bien=<id>`.
- **La fiche d'une affaire** (`FicheBien.tsx`) — le bandeau (photo, montant, étape, « SeLoger n° … »,
  le mandant ou « Ajouter le propriétaire »), puis Résumé · Photos · **Le local** · Visites et offres
  · Rapprochement · Documents · Historique. « Le local » : Tout, Loyer (ou Prix), Surfaces, **Bail**
  (« proposé » ou « en cours », s'il y a un loyer), **Fonds**, Aménagement, Immeuble, Annexes, Accès,
  Énergie, Charges et taxes.
- **« Ajouter le propriétaire »** (`FenAjoutProprio`, `FenetresBien.tsx`) — une petite fenêtre : le
  mandant se cherche dans les contacts, ou se crée en quelques champs (une société et son
  interlocuteur, ou une personne) ; le reste se complète sur sa fiche.
- **Contacts** (`Clients.tsx`, `FicheContact.tsx`) — des tuiles par type, une ligne par contact. **La
  société d'abord** : un nouveau contact part « Pour une société » (SAS par défaut), et « Sa
  société » passe en premier dans le formulaire d'un demandeur ou d'un mandant (`ChampsPro`). À la
  création, plus de « Sa situation aujourd'hui » (le logement d'un particulier).
- **La fiche d'un demandeur** (`FicheClient.tsx`) — « Recherche active », le bloc des critères
  (l'assistant du §2), puis les onglets Veille · Sélection · Présentés · Visites · Transaction ·
  Suivi, comme à l'origine. La veille reçoit ses annonces par `/veille/import` (adresse directe).
- **Carte** (`PageCarte.tsx`) — contacts et affaires, filtrés par type de contact, étape, **nature** et
  **type de local** ; un loyer s'affiche « / an ».
- **Documents** — les catégories : Mandats de commercialisation (location, cession ou vente), Mandats
  de recherche, Offres et lettres d'intention, Bons de visite et reconnaissances, Courriers, Délégations ; le registre
  des mandats à part. Les textes des modèles sont encore ceux de l'origine (§6).
- **L'espace client** (`/espace/<jeton>`) — celui des acheteurs d'Emilio : un client = un lien = une
  application, les locaux proposés, ses avis, ses visites, ses critères. Textes revus le 21 octobre ;
  il ne lit pas encore les critères de l'immobilier d'entreprise (§7).
- **La page publique d'un local** (`/bien/<id>`) — la copie d'un local proposé à un demandeur, ou une
  affaire à son propre id (ce que montrerait cette copie : ni adresse exacte, ni mandant, ni prix
  avant le mandat). Pas de bouton d'avis : on donne de quoi appeler Werner.
- **Demandes Internet** — les demandes des formulaires du site (`contact_submissions`) et des
  portails. Rien n'y arrive pour l'instant : ni le site ni SeLoger ne sont branchés.

---

## 4. L'import des annonces SeLoger

### Ce qui a été repris, le 20 octobre 2026

Werner diffusait déjà sur **SeLoger Bureaux & Commerces**. Ses **63 annonces** y ont été reprises une
fois, en **63 affaires « en cours »** (étape `mandat`), sans mandant :

- une référence `WER-A-2026-NNN` chacune ; `en_vente_le` = la date de création de l'annonce
  (`dateCreation`) ; une ligne dans `biens_vente_suivi` (`type: 'etape'`, `donnees.depuis: 'seloger'`) ;
- les **photos** (20 au plus, dans l'ordre de l'annonce) **copiées dans le bucket `photos-vente`**,
  sous `<id de l'affaire>/` : la fiche les garde même quand l'annonce disparaît ;
- **`donnees.portail`** = `{ nom: 'seloger', id, url, reference, importeLe }`. La fiche affiche
  « SeLoger n° … », la liste le retrouve à la recherche ; **`donnees.diffusion`** la dit en ligne ;
- **`donnees.notes`** : « Reprise de l'annonce SeLoger <réf> le <date>. **À vérifier** : … » quand
  l'annonce publiait un loyer « toutes taxes comprises », un prix hors honoraires ou honoraires
  inclus, ou des honoraires « Nous consulter ». Une note interne, jamais dans l'annonce.

Ce que l'annonce ne dit pas ne s'invente pas (le mandant, l'adresse exacte, le numéro de mandat, les
honoraires « Nous consulter ») : la fiche les montre à renseigner.

### Comment ça marche

- **`src/lib/import-seloger.ts`** lit la fiche détaillée d'une annonce (`detailClassified`) et, en
  secours, sa carte de résultats (`resume`) : la nature (`natureSeLoger`), le type de local
  (`typeSeLoger`), l'adresse, les surfaces, les montants (un loyer mensuel × 12), le bail, les
  équipements, le DPE, les chiffres et l'activité d'un fonds, les transports, l'annonce, le mandat.
- **`src/lib/photos-portail.ts`** copie une photo : https, hôtes d'images de SeLoger seulement, une
  vraie image reconnue à ses premiers octets, 15 Mo au plus, aucune redirection suivie.
- **`POST /api/biens-vente/import-seloger`** — `{ annonce, resume? }`, une annonce par appel ; rend
  `{ ok, id, reference, deja, photos, sur, avertissements }`. **Une annonce déjà reprise** (même
  `donnees.portail.id`) **ne l'est pas deux fois** : la route rend l'affaire existante.

### Refaire un import

1. Relever la fiche détaillée de chaque annonce sur SeLoger Bureaux & Commerces. La façon dont les
   63 fiches ont été relevées le 20 octobre n'est pas écrite dans le dépôt (aucun script dans `outils/`).
2. Les envoyer une par une à la route **depuis le CRM connecté** : elle demande le badge, et le
   portail refuse un `POST` venu d'une autre origine. Relancer est sans risque.
3. Ensuite, dans le CRM : mettre en paragraphes les textes d'un seul bloc (le bandeau de la
   rubrique le propose), lire les notes « À vérifier », ajouter le mandant et le numéro de mandat.

---

## 5. Ce qui a été adapté (octobre 2026)

D'après `git log`, heure de Paris.

**20 octobre 2026** — la copie du CRM Emilio (V3.220) et la structure de la base, sans données ; la
connexion (`WERNER_ACCESS_CODE`, et démarrage sans lui) ; les couleurs (`outils/couleurs-werner.py`),
le logo provisoire (`outils/logos-werner.py`) et la page de connexion ; l'identité de Werner dans
tous les textes (`outils/identite-werner.mjs`) ; le vocabulaire de l'immobilier d'entreprise
(`outils/vocabulaire-werner.mjs`) ; les listes (`src/lib/affaires.ts`) et les règles du dépôt ; une
affaire version commerce (nature, local, bail, fonds, loyer HT) ; « Ajouter le propriétaire » et la
reprise SeLoger ; la fiche d'une affaire (« Disponible », « Le local ») ; les critères d'un
demandeur, les filtres des affaires, la diffusion (SeLoger Bureaux & Commerces et « Mon site » ;
Belles Demeures et Jinka ne sont plus proposés, `src/lib/diffusion.ts`) ; la carte, filtrée par
nature et par type de local.

**21 octobre 2026** — les textes des contacts, de la fiche d'un demandeur, de l'espace client et des
pages ; les documents renommés ; les coordonnées de Werner partout ; les critères de l'immobilier
d'entreprise sur la fiche d'un demandeur ; le retrait des écrans d'import ImmoFacile ; la référence
SeLoger sur les affaires ; le README, les règles de travail, l'ancien `context.md` rangé dans
`docs/historique-code-origine.md` et ce fichier.

**22 octobre 2026** — le registre commun avec Emilio (numérotation partagée, numéros des trous en
gris) ; le contrôle des montants d'une annonce avant diffusion (`src/lib/controle-montants.ts` :
un loyer mensuel écrit « annuel », un loyer au m² trop bas) ; les formulaires sans case seule sur sa
ligne (`src/components/shared/colonnes.ts`) ; le mandat de recherche en ligne en version
commerciale (`src/lib/mandat.ts` : 2,5 % HT par défaut, réglable par demandeur, `BAREME` 30 % n'est
qu'un garde-fou de saisie) et le mandat type dans Paramètres › Agence ; les « ? » (`Aide`, une
petite fenêtre, feuille du bas au téléphone) ; le bon de visite depuis l'agenda ; la carte (chaque
pastille s'allume et s'éteint, même la dernière ; carte vide expliquée ; « ? » des filtres) ; les
honoraires d'un mandat signé fermés (avenant, ou « Mettre fin au mandat » : ligne
`mandats_signatures.statut = 'termine'`, registre « Fin du mandat ») ; la signature manuscrite de
Werner, demandée à l'arrivée tant qu'elle manque et dessinée dans le CRM
(`src/lib/signature-agence.ts`, `SignatureBienvenue`).

**23 octobre 2026** — la reconnaissance d'information depuis la fiche d'un demandeur (« ⋯ ›
Reconnaissance d'information », et la rubrique Documents) : « Pour quelle affaire ? » (par le prix
ou l'adresse, rien listé avant de taper), civilité, nom, prénom, téléphone et e-mail exigés,
l'adresse et la société facultatives ; la fiche se complète sans rien écraser
(`NouvelleReconnaissance.tsx`, `FenReconnaissance.tsx`). L'adresse proposée pendant la frappe
partout où on la tape (`SaisieAdresse`). La société retrouvée au registre national
(`src/components/shared/RechercheSociete.tsx`, `src/lib/entreprises.ts`, API
recherche-entreprises.api.gouv.fr : par le nom ou le SIREN ; forme, SIREN, siège, dirigeants en
cartes ; « Sélectionner », puis « Société ajoutée ») dans les contacts, le propriétaire d'une
affaire, la reconnaissance et les documents. Les documents juridiques à la façon de Werner (§6),
avec « Modifier le texte » sur tous, « Choisir dans mes contacts » sur chaque personne d'un
document, et « Pour quel demandeur ? » avant de préparer une offre depuis une affaire. Puis les
offres de location dans l'espace client et le CRM (un loyer annuel HT HC, les honoraires à part)
et la relecture des mandats de recherche (§6).

---

## 6. Ce qui reste à faire

- **La relecture des textes** — en cours. Aucun mot du résidentiel (AGENTS.md §0), honoraires HT.
- **Les mandats et avenants de recherche de la rubrique Documents** (`src/lib/actes/mandat-recherche.ts`,
  `avenant-recherche.ts`) — relus le 23 octobre 2026 : honoraires en HT ou en TTC ; l'objet dit
  exactement ce qu'il a coché (« à prendre à bail ou à reprendre ») ; une question « Relève-t-il des
  règles du consommateur ? » (`conso`, exigée dans un nouveau mandat ; sans réponse, les règles
  s'appliquent comme avant) — à « Non » (une société pour son activité), ni rétractation, ni
  information précontractuelle, ni médiateur, ni Bloctel, ni L215 (`blocsInformations(…, { conso })`) ;
  le porte-fort ne parle plus de conjoint (« ses associés »), ici et dans le mandat en ligne ;
  l'avenant ne dit plus « à la charge du MANDANT » sans le cas de l'agence qui partage. Le mandat
  en ligne (`src/lib/mandat.ts`) garde, lui, la rétractation pour tous (plus protecteur). À faire
  relire par l'avocat.
- **Les offres de location** (23 octobre 2026) : un loyer annuel HT HC, les honoraires à part.
  `totalOffre` et `totalContre` (`src/lib/offres.ts`) rendent le loyer tel quel pour une location ;
  `montantDit` et `destOffre` (« le bailleur ») disent les montants partout : carte « Votre offre »
  de l'espace, historique, « Son offre » du CRM et sa fenêtre « Réponse du bailleur », mails au
  client et à Werner, relances. « Faire une offre » (`FaireOffre.tsx`) a sa version location (le
  loyer, par mois, nos honoraires à part ; son activité, l'entrée souhaitée, la franchise) ; les
  conditions à cocher sont celles que l'offre sait écrire, selon la nature (`conditionsPour`, et le
  même filtre côté serveur, `/api/espace/offre`). L'offre préparée seul dans l'espace reste coupée
  (`OFFRE_EN_LIGNE = false`, `EspaceClient.tsx`) : « Je veux faire une offre » prévient Werner ;
  l'écran sert après une contre-proposition (« Accepter », « Faire une autre offre »).
- **La relecture visuelle de chaque mail** — les gabarits de l'origine, aux couleurs converties : un
  par un, en 390 et 1280 px, quand Mailjet sera branché.
- **Les modules propres à l'origine sont retirés** (21 octobre 2026) : plus de route ni d'écran
  ImmoFacile, Jinka (`poliris.ts` supprimé) ni Belles Demeures ; l'onglet « Pub estimation » n'existe
  plus. Restent, voulus, les clés lues sur les données déjà enregistrées (`idImmofacile`, `bd`,
  `jinka`, la provenance `pub`) et le renvoi à ImmoFacile de `MandatEnLigne.tsx` (voir le registre,
  plus bas).
- **Les consignes de l'IA** parlent d'immobilier d'entreprise (21 octobre 2026), et les lectures de
  secours (sans IA) devinent un type de local (`typeLocalDuTexte`, `src/lib/lecture-annonce.ts`), plus
  « Appartement ». `yanport_id` reste une clé de dédoublonnage de la veille, sans rien à l'écran.
- **Les documents juridiques** — le **mandat de commercialisation** est fait (21 octobre 2026,
  `src/lib/actes/mandat-vente.ts`, id `mandat_vente` gardé) : location, cession de droit au bail,
  fonds de commerce, murs libres ou occupés, en simple, semi-exclusif ou exclusif, d'après les
  quatre mandats de Werner (n° 847, 856, 838, 859) ; durées, reconduction, honoraires HT/TTC, actions,
  délais, 12 mois d'interdiction et clauses particulières sont des questions. Ses deux clauses
  pénales et le rappel de l'article 78 sont toujours imprimés en capitales (son mandat de location
  n° 847 n'avait pas ce rappel : un mandat avec clause pénale sans lui est nul, Cass. 1re civ.,
  3 novembre 2016). `prix` garde le sens de l'affaire (honoraires compris quand l'acquéreur paie) ;
  `montant` est ce que le mandat écrit (le loyer, le prix hors honoraires en sus), tenus d'accord par
  `deduire`. Un mandant « consommateur » (`conso`) ajoute information précontractuelle, médiateur,
  Bloctel, rétractation et annexe L215. Le mandataire : RT CONSEILS (représentant légal, champ
  `representantLegal` de l'identité), représentée par Werner BONNETON, gérant de WB INVEST. Les PDF
  sont aux couleurs de Werner (`mandat-pdf.ts`, `registre-pdf.ts`).
  ⚠️ L'identité enregistrée dans Paramètres › Agence l'emporte sur celle du code : vérifier qu'elle
  dit bien Werner BONNETON.
  **Le 23 octobre 2026, le reste a suivi** : l'avenant du mandat de commercialisation, la
  délégation, le bon de visite (avec la nature de l'affaire, `avecPro` lit `biens.pro`), le courrier
  de reconduction (L215-1 : seulement pour un mandant consommateur) et les mandats de recherche.
  Chacun dit ses honoraires **en HT ou en TTC, au choix de Werner** (`champsBaseHono`, `selonBase`,
  `motBase`, `honoEnClair` dans `src/lib/actes/commun.ts`) : « 8 640 € TTC, soit 7 200 € HT ».
  **L'offre** (`offre-achat.ts`, id `offre_achat` gardé, titre « Offre ») change de mots avec la
  nature de l'affaire (`mots(d)`) : offre de location (PRENEUR, BAILLEUR : loyer, charges, bail,
  prise d'effet, activité, franchise, dépôt, garantie, travaux ; honoraires à part, pas de total),
  de reprise (CESSIONNAIRE, CÉDANT) ou d'achat des murs (ACQUÉREUR, VENDEUR). **Jamais le nom du
  propriétaire** (Alexandre, 23 octobre : Werner est l'intermédiaire) : « adresse la présente offre
  au BAILLEUR, par l'intermédiaire de l'Agence » ; seulement le local et les conditions. Depuis une
  affaire, « Préparer une offre » demande d'abord « Pour quel demandeur ? »
  (`FenOffreDemandeur.tsx`) : ses demandeurs sur l'affaire, les contacts, un nouveau contact, ou
  « Sans fiche ». L'offre se rattache à sa fiche (et au local de son dossier, `bien_id`) : signée,
  elle va dans son historique et dans ses documents ; sans local lié, une relance demande de la
  noter dans les offres de l'affaire (`offres-serveur.ts`).
  **« Modifier le texte »**, sur tous les documents (`src/lib/actes/retouches.ts`,
  `src/components/documents/EditionTexte.tsx`) : un avertissement d'abord (« Tu es responsable de
  chaque modification », « J'ai compris » ; la date est gardée dans `retouches.responsable_le`),
  puis l'aperçu se déverrouille. Chaque phrase se réécrit sur place (gras, italique, trois tailles,
  la police du document), une partie se retire, un paragraphe ou une partie s'ajoute ;
  « Enregistrer », un petit chargement, « Modification enregistrée. ». Les retouches sont dans
  `donnees.retouches`, retrouvées par le texte d'origine de chaque phrase, et s'appliquent partout
  où le document se lit (`avecRetouches` dans `src/lib/actes/index.ts` : aperçu, PDF, page de
  signature, espace ; `brut` garde l'original). Une phrase d'origine qui change ensuite avec les
  réponses (un loyer, une date) n'est plus retouchée : l'éditeur le dit en ambre (« Voir
  lesquelles », « Les oublier », « Réécrire »). Les signatures et la rétractation ne se touchent
  pas. Une signature lancée fige tout : pour retoucher, l'arrêter, puis « Repasser en brouillon »
  (l'historique le garde). ⚠️ Tous ces textes sont à faire relire par l'avocat avant le premier
  usage.
- **La reconnaissance d'information** (21 octobre 2026, `src/lib/actes/reconnaissance.ts`, id
  `reconnaissance`, rangée avec les bons de visite) — avant de donner l'adresse d'un local, le
  demandeur reconnaît que l'Agence le lui a présenté et s'engage, 6 à 24 mois, à ne pas traiter en
  direct (ni par une société à lui, ni par une autre agence) ; sinon, une indemnité égale aux
  honoraires (art. 1231-5). Pas de numéro du registre. Depuis la fiche d'une affaire : le geste
  « Reconnaissance », « ⋯ › Reconnaissance d'information », et la ligne « Les reconnaissances » de
  l'onglet Documents (`FenReconnaissance.tsx`, puis `src/components/biens/reconnaissance.ts`). Le
  client est choisi ou créé (demandeur, prospect : « Demandeurs non filtrés ») ; une adresse e-mail
  nouvelle s'ajoute à sa fiche. Par e-mail : le PDF est figé et le lien part (code par e-mail) ; sur
  place : Documents s'ouvre, il signe sans code (comme le bon de visite, `SANS_CODE_SUR_PLACE`).
  Jamais l'adresse dans le document (Alexandre, 21 octobre : il la lirait sans signer) : le
  secteur seulement (« Paris 11e, quartier Oberkampf »), la référence, la surface, le montant, et la
  phrase « l'adresse exacte sera communiquée après la signature ; elle est couverte par les mêmes
  engagements ». Signée par tous : mail « Signé par tous » avec le
  PDF, ligne dans le suivi du client et dans l'historique de l'affaire (`classer`,
  `signature-documents.ts`). **L'adresse du local** part ensuite toute seule au client, par e-mail
  (adresse exacte, local, référence, lien de sa fiche ; pas de copie à Werner) — sauf si Werner a
  décoché « Lui envoyer l'adresse tout seul » (`donnees.adresseApres = 'main'`) : alors « Lui
  envoyer l'adresse », d'un clic, sur la ligne « Les reconnaissances » de l'onglet Documents
  (`/api/documents/adresse`). Les deux chemins : `src/lib/reconnaissance-serveur.ts`. Le mail : la
  photo du local, l'adresse, le type, la surface, le montant (au mois pour une location), la
  référence, le lien de sa fiche, le téléphone et l'e-mail de Werner. Sans adresse exacte sur
  l'affaire (numéro et rue), rien ne part : la fenêtre le dit avant (« Compléter l'adresse »), et
  l'historique de l'affaire et le suivi du client le disent après. L'historique de l'affaire montre
  chaque pas (préparée, envoyée, signée, adresse envoyée ou pas partie : `donnees.etape`), à qui, et
  le mail envoyé (« Voir le mail », `EvtBien.message`) ; le suivi du client a la même ligne, en
  `mail_envoye` (« Voir le mail » de la frise). L'onglet Documents compte les demandeurs, les
  signées et les adresses envoyées. Werner est prévenu par mail à l'envoi (alerte
  `reconnaissance_envoyee`, coupable dans Paramètres) et à la signature (« Signé par tous », avec
  le PDF) ; à la signature, une relance du jour (« Relances », la cloche du menu) dit quoi faire :
  l'appeler pour la visite, ou d'abord lui donner l'adresse. « C'est fait » la ferme. Le mail
  d'invitation dit pourquoi on lui demande de signer. ⚠️ À faire relire par l'avocat d'Alexandre avant le premier usage.
- **Le registre des mandats sous la carte RT CONSEILS** — le registre commun (22 octobre 2026) :
  quand `REGISTRE_COMMUN_CLE` est posée (la même dans les deux projets Vercel), chaque mandat de
  Werner prend son numéro dans le registre d'Alexandre (CRM Emilio, `POST /api/registre/commun`), à
  la suite des siens, puis s'inscrit ici avec ce numéro (`src/lib/registre-commun.ts`, copie locale :
  `outils/sql/registre-commun.sql`, qui fait accepter le numéro donné, par le serveur seulement, et
  vérifie les empreintes sans chercher de trou). Ce qui arrive ensuite (signé, annulé…) s'écrit ici
  puis là-bas. Le navigateur passe par `/api/registre/action` (la clé reste au serveur). Sans clé :
  le registre d'avant, seul. Les anciens numéros de Werner (838, 847, 856, 859…) ne bougent pas : ils
  sont plus petits que le départ de la copie, donc « anciens » (`numeroAncien`). Branché le 22
  octobre 2026 : clé posée dans les deux projets, copie démarrée au n° 1001 (le registre d'Alexandre
  finissait au 1000). Page Registre : les numéros pris par Alexandre entre deux mandats de Werner
  s'affichent grisés dans la frise (« N° 1005 à 1008 · 4 mandats d'Alexandre », sans leur contenu :
  ce sont ses clients), entre le départ, les lignes et le prochain numéro. La fiche du mandat
  en ligne (`src/components/fiche/MandatEnLigne.tsx`) ne parle d'ImmoFacile que dans un commentaire
  (un numéro réservé avant le registre : impossible chez Werner) — rien à l'écran.
- **L'adresse de l'espace client** — fait le 21 octobre 2026 côté DNS : wernerimmobilier.com,
  www, espace et crm pointent sur Vercel (IONOS, TTL 5 minutes ; l'hébergement WordPress piraté
  est débranché du domaine). Chez IONOS, le contrat « WordPress Hosting Boost » (105224331) contient
  aussi le domaine et le DNS (sa boîte contact@ ne sert pas : les mails sont chez Microsoft 365,
  §8) : **ne jamais le résilier tel quel**, le domaine partirait avec (choix d'Alexandre, 21 octobre : on le garde pour l'instant). Le VPS (113365249),
  inutilisé, est résilié au 15 août 2027 (dossier K-148836641-43). espace et crm sont sur ce projet ;
  wernerimmobilier.com et www sont sur le projet du site (`werner-immobilier-site`). Sur Vercel (vérifié le
  21 octobre 2026) : `NEXT_PUBLIC_HOTE_ESPACE` = espace.wernerimmobilier.com (domaine validé ; les
  liens donnés aux clients portent cette adresse, et elle n'ouvre que l'espace : `/` et `/login` y
  mènent à « lien introuvable »), `NEXT_PUBLIC_MAIL_IMAGES_URL`, `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_CRM_URL` et `CRM_URL` sont posées.
  Anciens enregistrements, pour revenir en arrière : A @ et A www 217.160.0.153, AAAA @ et AAAA www
  2001:8d8:100f:f000::200 (service WordPress d'IONOS).
- **L'espace client, au choix de Werner** (21 octobre 2026) — `clients.espace_client`
  (`outils/sql/espace-client-choix.sql`, exécuté : la colonne est là, vérifié le 22 octobre 2026), faux par défaut. Sans espace :
  les locaux envoyés par mail mènent à leur fiche publique `/bien/<id>` (son bouton « Me contacter »
  porte le titre du local en objet), aucun mail ne parle d'espace, le lien d'espace mène à « Ce lien
  n'est plus actif » (`ouvrirEspace`, `src/lib/espace.ts`), et le point automatique, le mail de
  bienvenue, « Renvoyer le lien », le mandat en ligne et ses rappels ne partent pas. Werner l'active
  ou le coupe sur la fiche du demandeur, onglet « Son espace ». Avant le SQL, tout le monde est sans
  espace et l'activation échoue (message rouge).
  **Comme chez Emilio** (choix d'Alexandre) : « Actif » = avec son espace, « Prospect » = sans
  (`src/lib/espace-choix.ts`). La création d'un demandeur (interrupteur animé
  `shared/InterrupteurEspace.tsx`), le menu d'état de la fiche, le changement en lot et la réouverture
  écrivent aussi `espace_client` ; les passages automatiques (suspendu pendant une signature, local
  trouvé) n'y touchent pas. Passer Actif ou repasser Prospect ouvre d'abord une fenêtre qui explique
  (« J'ai compris », « Ne plus m'expliquer » retenu dans le navigateur) ; un espace qui s'ouvre propose
  le mail de bienvenue (`FenProposerBienvenue`, aussi juste après la création). Dans Contacts : la
  pastille « Espace » sur la ligne, et les filtres « Prospects · sans espace » / « Actifs · avec espace ».
  **Un conseil avant d'ouvrir un espace** (22 octobre 2026 ; Alexandre : « privilégier cet espace pour
  les clients qu'il suit de façon intensive : si on lui propose l'espace, le client attendra qu'il soit
  mis à jour régulièrement ») : `shared/ConseilEspace.tsx`, « Réserve l'espace aux demandeurs que tu suis
  de près… », sous l'interrupteur quand « Actif » est choisi à la création, dans la fenêtre « Passer en
  Actif », sur l'onglet « Son espace » d'un demandeur qui n'en a pas, et au changement en lot vers
  « Actif » (au pluriel). Le « ? » de l'interrupteur le dit aussi.
- **Les mails** — Mailjet est branché (§1, §8). Restent : un vrai envoi d'essai vers Alexandre,
  regardé sur téléphone et ordinateur ; le SPF à alléger chez IONOS (retirer `mailgun.org` et
  `_spf-eu.ionos.com`, garder Mailjet et Outlook).
- **Les clés qui manquent** — `ANTHROPIC_API_KEY` (l'IA : lire une annonce collée ou un PDF,
  reformuler une description, analyser un local, le rapprochement « intelligent » ; le rapprochement
  par critères, lui, marche sans), `CRON_SECRET` (les quatre tâches du matin : le point automatique
  aux demandeurs, les rappels de signature des mandats, la diffusion, les demandes SeLoger),
  Ringover, les notifications (§1).
- **Le premier accès de Werner** — fait (commit « Première connexion de Werner et mot de passe
  oublié », `src/app/api/acces/`, `MotDePasseOublie.tsx`) ; Paramètres › Sécurité pour changer son
  mot de passe.

En attente, sans rien à faire : le dépôt GitHub est **public**, c'est voulu (confirmé par
Alexandre) ; aucune clé n'y figure, elles vivent sur Vercel.

---

## 7. Anomalies connues

**Celles du code d'origine** : l'historique, §6, en tient vingt-deux, toutes réglées ou sans objet au
28 septembre 2026 ; le code est le même, leurs leçons valent toujours. Y relire aussi, avant de
conclure qu'un écran est cassé « sans raison » : « Colonnes écrites mais jamais relues » et « Les
types TypeScript ne décrivent plus le schéma » (§2), `relances.statut = 'reportee'` jamais écrite
(§2), le double découpage du texte en paragraphes (§3), la vérification des écritures (V3.17).

**Celles de Werner**, relevées en lisant le code le 21 octobre 2026 :

1. **Réglé le 21 octobre 2026 : l'espace client modifie les critères du commerce.** « Modifier mes
   critères » (`EspaceClient.tsx`, sept étapes) écrit `criteres_pro` (natures, activité, loyer,
   vitrine, emplacements) par `/api/espace/criteres`, qui fusionne avec ce qui existe et décrit le
   changement à Werner avec ces mots-là. Les anciennes clés restent lues.
2. **La page publique d'un local** lit `biens.pro` depuis le 21 octobre : « Loyer annuel HT HC »,
   « / an » et « €/m²/an » pour une location, le libellé de la nature sinon (prix du droit au bail,
   du fonds, de vente). Un local lu sur une annonce avant cette date n'a pas de `pro` : il garde
   « Montant demandé ».
3. **Des colonnes résidentielles encore lues** : `nb_pieces`, `nb_chambres` (« Espaces », « Bureaux »
   sur la page publique), `chambres_min`, `surface_sejour_min`, `balcon`, `jardin`, `cave`
   (`criteresDepuisRecherche()`, `correspondance()`). Pour une affaire, `versCorrespondance()` laisse
   vides les pièces, les chambres et le séjour : ces lignes ne sortent que pour la veille.
4. **Le rapprochement garde sans les comparer** `loyerMin`, `postesMin` et `activite`.
5. **Une société mandante passe pour une SCI** (`donnees.qui = 'sci'`, `sciNom`) : les modèles de
   l'origine la traiteront comme une SCI.
6. **Des liens vers https://www.wernerimmobilier.com** (piraté jusqu’au 21 octobre) : le barème des honoraires
   envoyé aux portails (`src/lib/seloger.ts`, `src/lib/poliris.ts`), `SITE_PUBLIC`
   (`src/lib/demandes-site.ts`), `/api/flux-site/sitemap`, et le site imprimé dans les documents et
   les mails (`IDENTITE_DEFAUT.site`). Aucun n'agit aujourd'hui (ni diffusion ni Mailjet branchés) ;
   Depuis le 21 octobre, ces liens mènent au nouveau site ; **reste la page `/honoraires`**, que
   le site n'a pas encore : il faut le barème de Werner (point 7) avant de brancher la diffusion. La redirection de l'adresse nue de l'espace (`src/proxy.ts`) a été retirée le
   21 octobre : elle mène à la page « lien introuvable ».
7. **Le barème des honoraires est celui d'Emilio** (`src/lib/mandat.ts` : 2,5 % et 5 %), désormais
   écrit « HT » ; les commentaires disent encore TTC. Celui de Werner reste à poser.
8. **Réglé le 21 octobre 2026 : plus de délai SRU nulle part.** Ni posé, ni affiché (fiche du
   demandeur, « L'accord est signé », carte de l'offre, agenda). Une location n'a ni financement,
   ni apport, ni condition de prêt ; sa date de signature est « Signature du bail » (un mois après
   l'accord), celle d'une cession ou d'une vente « Signature de l'acte » (trois mois). Le « prêt
   relais » n'est plus proposé. À la conclusion, le demandeur passe « Local trouvé » et le mandant
   « Ancien mandant », les mêmes mots que dans les Contacts.
9. **La diffusion SeLoger n'est pas vérifiée pour Werner.** `src/lib/seloger.ts` parle à l'API d'AVIV
   de l'origine. Avant de la brancher : vérifier que SeLoger Bureaux & Commerces passe par elle, et
   comment raccrocher les 63 annonces déjà en ligne sans les doubler (l'origine a perdu des annonces
   sur un « Duplicated classified » : voir le commentaire du fichier). En attendant (21 octobre
   2026), la diffusion n'envoie qu'au site (`SUPPORTS_BRANCHES = ['site']`, `src/lib/diffusion.ts`) :
   une affaire disponible, sous offre ou en signature sans réglage est « Diffusé · Mon site (réglage
   par défaut) », et SeLoger s'affiche grisé, « en attente du branchement ». Le jour venu : ajouter
   'seloger' à `SUPPORTS_BRANCHES` et le cocher dans `SUPPORTS_DEFAUT`.

Une anomalie nouvelle s'ajoute ici, datée, avant d'être corrigée.

---

## 8. Mailjet, règles d'affichage figées, hors périmètre

### Mailjet

**Le 21 octobre 2026** : le compte Mailjet de Werner existe (créé par Alexandre ; contact@ y est
une adresse d'expédition active). Le domaine wernerimmobilier.com y est ajouté (validation par le TXT
`mailjet._707c2960`, posé chez IONOS) et sa clé DKIM posée (TXT `mailjet._domainkey`, 2048 bits).
**Les mails de Werner sont chez Microsoft 365**, pas chez IONOS : le MX va à
`wernerimmobilier-com.mail.protection.outlook.com` (la boîte contact@ d'IONOS ne reçoit rien). Le SPF
garde donc `include:spf.protection.outlook.com` ; il faut y ajouter `include:spf.mailjet.com` (à faire
par Alexandre : `v=spf1 include:spf.mailjet.com include:mailgun.org include:_spf-eu.ionos.com
include:spf.protection.outlook.com ~all`). `mailgun.org`, la CNAME `email` et `k1._domainkey` sont
des restes d'anciens outils, laissés tels quels. Restent sur Vercel : `MAILJET_API_KEY`,
`MAILJET_API_SECRET`, puis `MAILJET_FROM_SIGNATURE` = signature@wernerimmobilier.com une fois le
domaine « Actif » dans Mailjet (aucune boîte à créer : le domaine validé suffit). Ce que l'origine a appris
(historique §8) : le SPF se crée en **TXT** (pas le type « SPF » déprécié), avec DKIM et DMARC ; le
suivi reste coupé (`TrackOpens` et `TrackClicks` sur `disabled`) ; Gmail retire les ombres et les
SVG : contraste et tableaux. Les images des mails se chargent depuis `NEXT_PUBLIC_MAIL_IMAGES_URL`
(repli : l'adresse vercel.app, un domaine partagé dont les anti-spam se méfient) : la poser sur le
domaine d'envoi de Werner.

### Règles d'affichage figées

- **Les montants s'écrivent en entier** : `1 500 000 €`, jamais `1,5 M€` ni `380 k€`
  (`Math.round(n).toLocaleString('fr-FR')` suivi de ` €`). Un loyer : `48 000 € HT HC / an`
  (`montantAffaire`), au mètre carré `€ HT HC / m² / an` (`loyerM2`). Les honoraires se disent HT.
- **Min/max** : `32–80 m²` si les deux, `min 32 m²` ou `max 80 m²` si un seul.
- **Les fenêtres de saisie** (contact, mandat, affaire) ne se ferment pas au clic à côté : par la
  croix ou « Annuler ».
- **Pas de noir pur dans le CRM** : l'anthracite `--emilio`. Un seul accent, l'orange. Icônes
  dessinées, pas d'émoji, dans les nouvelles interfaces (AGENTS.md §5).

Le reste, et leur raison d'être : l'historique, §9.

### Hors périmètre

Le dépôt et la base d'Emilio (jamais) ; le site wernerimmobilier.com (dépôt `werner-immobilier-site`) ;
la comptabilité ; le multi-utilisateur et le multi-agence.
