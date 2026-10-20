#!/usr/bin/env node
/* Remplace l'identité d'Emilio par celle de Werner Immobilier dans les TEXTES
   du code (chaînes, gabarits `…`, texte JSX), sans toucher aux commentaires
   ni aux noms internes (variables, clés, classes CSS).

   Lit l'arbre syntaxique de TypeScript : seuls les nœuds StringLiteral,
   NoSubstitutionTemplateLiteral, TemplateHead/Middle/Tail et JsxText sont
   modifiés.

       node outils/identite-werner.mjs            # remplace
       node outils/identite-werner.mjs --essai    # compte seulement

   Les coordonnées de Werner encore inconnues (téléphone, nom complet) sont
   des repères faciles à retrouver : « 01 87 66 06 00 », « Werner ». */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REMPLACEMENTS = [
  // le conseiller
  [/Alexandre ROGELET/g, 'Werner'],
  [/Alexandre Rogelet/g, 'Werner'],
  [/ROGELET Alexandre/g, 'Werner'],
  [/Alexandre R\./g, 'Werner'],
  [/Alexandre/g, 'Werner'],
  // adresses e-mail
  [/arogelet@emilio-immo\.com/g, 'contact@wernerimmobilier.com'],
  [/agence@emilio-immo\.com/g, 'contact@wernerimmobilier.com'],
  // téléphone (repère à remplacer par le vrai numéro de Werner)
  [/06 58 95 76 32/g, '01 87 66 06 00'],
  [/\+33658957632/g, '+33187660600'],
  [/33658957632/g, '33100000000'],
  [/0658957632/g, '0187660600'],
  // adresses web
  [/emilio-immo-chasseimmo\.vercel\.app/g, 'crm-werner-immobilier.vercel.app'],
  [/crm\.emilio-immo\.com/g, 'crm-werner-immobilier.vercel.app'],
  [/espace\.emilio-immo\.com/g, 'crm-werner-immobilier.vercel.app'],
  [/www\.emilio-immo\.com/g, 'www.wernerimmobilier.com'],
  [/emilio-immo\.com/g, 'wernerimmobilier.com'],
  // l'agence
  [/Emilio conseil immobilier/g, 'Werner Immobilier'],
  [/EMILIO IMMOBILIER/g, 'WERNER IMMOBILIER'],
  [/Emilio Immobilier/g, 'Werner Immobilier'],
  [/Emilio Immo\b/g, 'Werner Immobilier'],
  [/\bEmilio\b/g, 'Werner'],
  [/\bEMILIO\b/g, 'WERNER'],
  [/EmilioImmoCRM/g, 'WernerImmoCRM'],
  [/\bVanves\b/g, 'Paris'],
];

const NOEUDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

function remplacer(t) {
  let n = 0;
  for (const [re, par] of REMPLACEMENTS) {
    t = t.replace(re, () => { n++; return par; });
  }
  return [t, n];
}

function traiter(fichier, essai) {
  const src = fs.readFileSync(fichier, 'utf8');
  const sf = ts.createSourceFile(fichier, src, ts.ScriptTarget.Latest, true,
    fichier.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const zones = [];
  const visite = (noeud) => {
    if (NOEUDS.has(noeud.kind)) zones.push([noeud.getStart(sf), noeud.getEnd()]);
    ts.forEachChild(noeud, visite);
  };
  visite(sf);
  zones.sort((a, b) => b[0] - a[0]);
  let sortie = src, total = 0;
  for (const [debut, fin] of zones) {
    const [neuf, n] = remplacer(sortie.slice(debut, fin));
    if (n) { sortie = sortie.slice(0, debut) + neuf + sortie.slice(fin); total += n; }
  }
  if (total && !essai) fs.writeFileSync(fichier, sortie);
  return total;
}

function* fichiers(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(p);
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}

const essai = process.argv.includes('--essai');
let total = 0, nb = 0;
for (const f of fichiers('src')) {
  const n = traiter(f, essai);
  if (n) { total += n; nb++; }
}
console.log(`${essai ? '(essai) ' : ''}${nb} fichiers, ${total} remplacements dans les textes`);
