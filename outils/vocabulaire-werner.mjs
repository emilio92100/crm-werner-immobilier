#!/usr/bin/env node
/* Le vocabulaire de l'immobilier d'entreprise dans les TEXTES du CRM.

   Même méthode que outils/identite-werner.mjs : l'arbre syntaxique de
   TypeScript, seuls les textes (chaînes, gabarits `…`, texte JSX) changent ;
   jamais les commentaires, jamais les noms internes. Une chaîne qui n'est
   qu'un mot en minuscules ('acheteur', 'vendeur') est une CLÉ que la base ou
   la logique lisent : elle n'est jamais touchée.

   Ne passe pas dans src/lib/actes/ : les documents juridiques (mandats,
   offres) se réécrivent à part, mot par mot.

       node outils/vocabulaire-werner.mjs            # remplace
       node outils/vocabulaire-werner.mjs --essai    # compte seulement
       node outils/vocabulaire-werner.mjs --voir     # montre chaque changement */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const A = '[’\']';
const REMPLACEMENTS = [
  /* Ceux qui cherchent un local : des demandeurs. */
  [/\bACHETEURS\b/g, 'DEMANDEURS'], [/\bACHETEUR\b/g, 'DEMANDEUR'],
  [/\bAcheteurs\b/g, 'Demandeurs'], [/\bAcheteur\b/g, 'Demandeur'],
  [/\bacheteurs\b/g, 'demandeurs'], [/\bacheteur\b/g, 'demandeur'],
  [/\bacheteuses?\b/g, m => m.replace('acheteuse', 'demandeuse')],
  [new RegExp(`\\bde l${A}acquéreur\\b`, 'g'), 'du demandeur'], [new RegExp(`\\bDe l${A}acquéreur\\b`, 'g'), 'Du demandeur'],
  [new RegExp(`\\bà l${A}acquéreur\\b`, 'g'), 'au demandeur'], [new RegExp(`\\bÀ l${A}acquéreur\\b`, 'g'), 'Au demandeur'],
  [new RegExp(`\\bl${A}acquéreur\\b`, 'g'), 'le demandeur'], [new RegExp(`\\bL${A}acquéreur\\b`, 'g'), 'Le demandeur'],
  [new RegExp(`\\bd${A}acquéreurs\\b`, 'g'), 'de demandeurs'], [new RegExp(`\\bd${A}acquéreur\\b`, 'g'), 'de demandeur'],
  [new RegExp(`\\bD${A}acquéreur`, 'g'), 'De demandeur'],
  [/\bAcquéreurs\b/g, 'Demandeurs'], [/\bAcquéreur\b/g, 'Demandeur'],
  [/\bacquéreurs\b/g, 'demandeurs'], [/\bacquéreur\b/g, 'demandeur'],
  /* Ceux qui confient un local, un bail, un fonds, des murs : des mandants. */
  [/\b([Vv])endeurs signés\b/g, (m, v) => (v === 'V' ? 'Anciens mandants' : 'anciens mandants')],
  [/\b([Vv])endeur signé\b/g, (m, v) => (v === 'V' ? 'Ancien mandant' : 'ancien mandant')],
  [/\bVENDEURS\b/g, 'MANDANTS'], [/\bVENDEUR\b/g, 'MANDANT'],
  [/\bVendeurs\b/g, 'Mandants'], [/\bVendeur\b/g, 'Mandant'],
  [/(?<!\bnet )\bvendeurs\b/g, 'mandants'], [/(?<!\bnet )\bvendeur\b/g, 'mandant'],
  [/\bvendeuses?\b/g, m => m.replace('vendeuse', 'mandante')],
  /* Le local, jamais le logement. */
  [/\bLogements\b/g, 'Locaux'], [/\blogements\b/g, 'locaux'],
  [/\bLogement\b/g, 'Local'], [/\blogement\b/g, 'local'],
  /* Les étapes : « sous compromis » devient « en signature ». */
  [/\bSous compromis\b/g, 'En signature'], [/\bsous compromis\b/g, 'en signature'],
  [/\bSOUS COMPROMIS\b/g, 'EN SIGNATURE'],
  /* Les honoraires d'un professionnel se disent hors taxes. */
  [/\bTTC\b/g, 'HT'],
];

const NOEUDS = new Set([
  ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);
/* Une clé : un seul mot, en minuscules, sans espace ('vendeur', 'mandat_vente'). */
const estCle = (brut) => /^['"`][a-z0-9_\-./]*['"`]$/.test(brut);

function remplacer(t) {
  let n = 0;
  for (const [re, par] of REMPLACEMENTS) {
    t = t.replace(re, (...a) => { n++; return typeof par === 'function' ? par(...a) : par; });
  }
  return [t, n];
}

function traiter(fichier, mode) {
  const src = fs.readFileSync(fichier, 'utf8');
  const sf = ts.createSourceFile(fichier, src, ts.ScriptTarget.Latest, true,
    fichier.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const zones = [];
  const visite = (noeud) => {
    if (NOEUDS.has(noeud.kind)) {
      const brut = noeud.getText(sf);
      /* Un import, une clé d'objet entre guillemets : jamais. */
      const parent = noeud.parent;
      const enImport = parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent));
      if (!enImport && !estCle(brut)) zones.push([noeud.getStart(sf), noeud.getEnd()]);
    }
    ts.forEachChild(noeud, visite);
  };
  visite(sf);
  zones.sort((a, b) => b[0] - a[0]);
  let sortie = src, total = 0;
  for (const [debut, fin] of zones) {
    const avant = sortie.slice(debut, fin);
    const [neuf, n] = remplacer(avant);
    if (n) {
      sortie = sortie.slice(0, debut) + neuf + sortie.slice(fin);
      total += n;
      if (mode === 'voir') console.log(`${fichier}: ${avant.replace(/\s+/g, ' ').slice(0, 140)}\n   → ${neuf.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
  }
  if (total && mode === 'ecrire') fs.writeFileSync(fichier, sortie);
  return total;
}

function* fichiers(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) { if (p !== path.join('src', 'lib', 'actes')) yield* fichiers(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}

const mode = process.argv.includes('--essai') ? 'essai' : process.argv.includes('--voir') ? 'voir' : 'ecrire';
let total = 0, nb = 0;
for (const f of fichiers('src')) {
  const n = traiter(f, mode);
  if (n) { total += n; nb++; }
}
console.log(`${mode === 'ecrire' ? '' : '(essai) '}${nb} fichiers, ${total} remplacements dans les textes`);
