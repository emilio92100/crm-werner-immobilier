/* ══ Une personne, ou deux ═══════════════════════════════════════════════

   Une fiche peut réunir deux personnes : deux associés qui cherchent un
   local, deux co-propriétaires des murs… Posée à la création, dans
   « Modifier le contact », ou toute seule quand le client ajoute la 2e
   personne en signant son mandat dans son espace.

     clients.civilite   'Monsieur' | 'Madame' — la personne 1, le contact principal
     clients.couple     vrai : la personne 2 SIGNE les mandats avec la personne 1
     clients.conjoint   la personne 2 { civilite, prenom, nom, email, telephone,
                        emails[], telephones[], lien, precision?,
                        naissanceDate?, naissanceLieu? }

   (Les clés `couple` et `conjoint` viennent du code d'origine : la base les
   lit, elles ne changent pas ; seuls les mots ont changé, AGENTS.md §0.)

   Les e-mails et téléphones de la fiche (emails, telephones) sont ceux de
   la personne 1 : c'est elle qui reçoit les mails et qui a l'espace. La
   personne 2, si elle signe, signe le mandat avec son propre lien.

   Colonnes posées par outils/sql/signature-plusieurs.sql : avant ce SQL,
   elles n'existent pas, et tout se lit comme « une personne ».

   V3.236 (repris du CRM d'Emilio, 23 octobre 2026) :
     · la personne 2 peut être là sans signer : `conjoint` porte toujours
       ses données, `couple` dit seulement qu'elle signe les mandats
       (« Signe aussi les mandats », coché par Werner) ;
     · `conjoint.lien` : 'couple' = associés, 'separes' = co-propriétaires,
       'autre' (+ `precision` : « son gérant », « son assistante ») ;
       absent = associés (fiches d'avant) ;
     · `conjoint.emails` / `conjoint.telephones` : toutes ses adresses et
       tous ses numéros ; `email` / `telephone` restent le premier, pour
       tout ce qui les lisait déjà (signature, mandat, recherche) ;
     · `clients.adresses_dossier` : [{ email, etiquette }], les autres
       adresses du dossier (notaire, avocat, expert-comptable…),
       outils/sql/adresses-dossier.sql.
   ════════════════════════════════════════════════════════════════════════ */

export type LienP2 = 'couple' | 'separes' | 'autre';
export const LIENS_P2: { k: LienP2; lib: string; ic: string }[] = [
  { k: 'couple', lib: 'Associés', ic: 'couple' },
  { k: 'separes', lib: 'Co-propriétaires', ic: 'cle' },
  { k: 'autre', lib: 'Autre lien', ic: 'groupe' },
];

export type Conjoint = {
  civilite?: string; prenom?: string; nom?: string; email?: string; telephone?: string;
  naissanceDate?: string; naissanceLieu?: string;
  /* V3.236 */
  emails?: string[]; telephones?: string[]; lien?: LienP2; precision?: string;
};

const liste = (v: unknown, un: unknown): string[] => {
  const l = (Array.isArray(v) ? v : [un]).map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  return l.filter((x, i) => l.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i);
};

export function conjointDe(v: unknown): Conjoint | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const emails = liste(o.emails, o.email);
  const telephones = liste(o.telephones, o.telephone);
  const lien = o.lien === 'separes' || o.lien === 'autre' || o.lien === 'couple' ? o.lien : undefined;
  const c: Conjoint = {
    civilite: t(o.civilite), prenom: t(o.prenom), nom: t(o.nom), email: emails[0] || '', telephone: telephones[0] || '',
    ...(t(o.naissanceDate) ? { naissanceDate: t(o.naissanceDate) } : {}),
    ...(t(o.naissanceLieu) ? { naissanceLieu: t(o.naissanceLieu) } : {}),
    ...(emails.length ? { emails } : {}), ...(telephones.length ? { telephones } : {}),
    ...(lien ? { lien } : {}), ...(t(o.precision) ? { precision: t(o.precision) } : {}),
  };
  return c.prenom || c.nom ? c : null;
}

/* V3.236 — La personne 2, qu'elle signe ou non (`couple` : elle signe). */
export function personne2De(c: { conjoint?: unknown } | null | undefined): Conjoint | null {
  return c ? conjointDe(c.conjoint) : null;
}

/* Le lien en mots : « associés », « co-propriétaires », « son gérant ». */
export function lienLisible(j: { lien?: string; precision?: string } | null): string {
  if (!j) return '';
  if (j.lien === 'autre') return j.precision || 'autre lien';
  return j.lien === 'separes' ? 'co-propriétaires' : 'associés';
}

/* ── Les autres adresses du dossier (V3.236) ── */
export type AdresseDossier = { email: string; etiquette: string };
export const ETIQUETTES_DOSSIER = ['Notaire', 'Avocat', 'Expert-comptable', 'Banque', 'Syndic', 'Autre'] as const;
const MAIL_D = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function adressesDossierDe(v: unknown): AdresseDossier[] {
  if (!Array.isArray(v)) return [];
  const vus = new Set<string>();
  const out: AdresseDossier[] = [];
  for (const x of v) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const email = String(o.email || '').trim().toLowerCase();
    if (!MAIL_D.test(email) || vus.has(email)) continue;
    vus.add(email);
    out.push({ email, etiquette: String(o.etiquette || '').trim() || 'Autre' });
  }
  return out;
}

/* Toutes les adresses d'une fiche, rangées par personne (« Nouveau mail ») :
   la personne 1, la personne 2, puis chaque adresse du dossier. */
export type GroupeAdresses = { qui: 'p1' | 'p2' | 'dossier'; lib: string; emails: string[] };
export function groupesAdresses(c: { prenom?: string | null; nom?: string | null; emails?: string[] | null; conjoint?: unknown; adresses_dossier?: unknown }): GroupeAdresses[] {
  const net = (l: (string | null | undefined)[]) => l.map(x => String(x || '').trim()).filter(x => MAIL_D.test(x));
  const g: GroupeAdresses[] = [];
  const vus = new Set<string>();
  const garder = (l: string[]) => l.filter(e => { const k = e.toLowerCase(); if (vus.has(k)) return false; vus.add(k); return true; });
  const p1 = garder(net(c.emails || []));
  if (p1.length) g.push({ qui: 'p1', lib: `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Personne 1', emails: p1 });
  const j = conjointDe(c.conjoint);
  const p2 = j ? garder(net(j.emails || [j.email])) : [];
  if (j && p2.length) g.push({ qui: 'p2', lib: `${j.prenom || ''} ${j.nom || ''}`.trim() || 'Personne 2', emails: p2 });
  for (const a of adressesDossierDe(c.adresses_dossier)) {
    const e = garder([a.email]);
    if (e.length) g.push({ qui: 'dossier', lib: a.etiquette, emails: e });
  }
  return g;
}

/* « Paul et Claire Martin », « Paul Martin et Claire Durand », ou « Paul Martin ». */
export function nomFoyer(c: { prenom?: string | null; nom?: string | null; couple?: boolean | null; conjoint?: unknown }): string {
  const p = `${c.prenom || ''} ${c.nom || ''}`.trim();
  const j = c.couple ? conjointDe(c.conjoint) : null;
  if (!j) return p;
  const memeNom = (j.nom || '').toLowerCase() === String(c.nom || '').trim().toLowerCase();
  if (memeNom && c.prenom && j.prenom) return `${c.prenom} et ${j.prenom} ${c.nom || ''}`.trim();
  return `${p} et ${`${j.prenom || ''} ${j.nom || ''}`.trim()}`;
}

/* À qui l'on écrit, pour {{prénom}} (« Nouveau mail ») : les adresses
   choisies sont toutes à la personne 2 → elle ; toutes du dossier (l'avocat,
   l'expert-comptable…) → personne, « Bonjour, » ; sinon la personne 1. */
export function pourAdresses(
  c: { prenom?: string | null; nom?: string | null; reference?: string | null; emails?: string[] | null; conjoint?: unknown; adresses_dossier?: unknown },
  choisies: string[],
): { prenom: string; nom: string; reference: string } {
  const l = choisies.map(e => e.trim().toLowerCase()).filter(Boolean);
  const g = groupesAdresses(c);
  const de = (qui: GroupeAdresses['qui']) => g.filter(x => x.qui === qui).flatMap(x => x.emails.map(e => e.toLowerCase()));
  const ref = c.reference || '';
  if (l.length) {
    const p2 = de('p2'), dos = de('dossier');
    const j = conjointDe(c.conjoint);
    if (j && l.every(e => p2.includes(e))) return { prenom: j.prenom || '', nom: j.nom || '', reference: ref };
    if (l.every(e => dos.includes(e))) return { prenom: '', nom: '', reference: ref };
    /* Les deux personnes : « Karim et Sofiane » (le nom, s'il est commun). */
    const p1 = de('p1');
    if (j && j.prenom && c.prenom && l.some(e => p1.includes(e)) && l.some(e => p2.includes(e))) {
      const memeNom = (j.nom || '').trim().toLowerCase() === String(c.nom || '').trim().toLowerCase();
      return { prenom: `${c.prenom} et ${j.prenom}`, nom: memeNom ? c.nom || '' : '', reference: ref };
    }
  }
  return { prenom: c.prenom || '', nom: c.nom || '', reference: ref };
}

/* Le nom à côté d'une adresse dans le mail : la personne 1, la personne 2,
   ou rien pour une adresse du dossier (l'avocat n'est pas le client). */
export function nomDeLAdresse(c: { prenom?: string | null; nom?: string | null; emails?: string[] | null; conjoint?: unknown; adresses_dossier?: unknown }, email: string): string {
  const e = email.trim().toLowerCase();
  const g = groupesAdresses(c).find(x => x.emails.some(y => y.toLowerCase() === e));
  if (!g || g.qui === 'dossier') return g ? '' : `${c.prenom || ''} ${c.nom || ''}`.trim();
  return g.lib === 'Personne 1' || g.lib === 'Personne 2' ? '' : g.lib;
}

/* La colonne `adresses_dossier` manque tant que outils/sql/adresses-dossier.sql
   n'a pas été lancé : le reste de la fiche s'enregistre quand même. */
export const colonneDossierAbsente = (m: string) => /adresses_dossier/i.test(m);
export const MESSAGE_SQL_DOSSIER = 'Les autres adresses du dossier n’ont pas été enregistrées : lancez d’abord outils/sql/adresses-dossier.sql dans Supabase (le reste de la fiche est enregistré).';
