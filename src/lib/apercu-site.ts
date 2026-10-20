/* ═══ L'accès avant-première au nouveau site de Werner (21 octobre 2026) ════
   Tant que le nouveau site n'est pas ouvert, wernerimmobilier.com montre la
   page d'attente (src/app/site/page.tsx). Un code (SITE_CODE_APERCU sur
   Vercel, jamais dans le dépôt, qui est public) pose un cookie : avec lui,
   le domaine sert le nouveau site (src/app/site/v2/). Sans code posé sur
   Vercel, l'avant-première est fermée. Fonctionne côté proxy et côté route. */

export const COOKIE_APERCU = 'werner_apercu';

async function empreinte(texte: string): Promise<string> {
  const o = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(o)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const codeApercu = () => (process.env.SITE_CODE_APERCU || '').trim();

/** La valeur du cookie pour ce code, ou null si l'avant-première est fermée. */
export async function jetonApercu(code: string): Promise<string | null> {
  const attendu = codeApercu();
  if (!attendu || code.trim() !== attendu) return null;
  return empreinte(`apercu-werner:${attendu}`);
}

/** Le cookie ouvre-t-il l'avant-première ? */
export async function apercuOuvert(cookie: string | undefined): Promise<boolean> {
  const attendu = codeApercu();
  if (!attendu || !cookie) return false;
  return cookie === await empreinte(`apercu-werner:${attendu}`);
}
