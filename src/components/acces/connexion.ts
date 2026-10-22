import { supabase } from '@/lib/supabase';

/* Les deux serrures du CRM (AGENTS.md §3.4), dans l'ordre : la session
   Supabase est déjà ouverte (`token`), le serveur la revérifie et pose le
   badge. Rend null si tout va bien, sinon le message d'erreur ; un refus
   referme la session, pour ne pas laisser une demi-connexion. */
export async function poserBadge(token: string): Promise<string | null> {
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const r = await res.json().catch(() => null);
    if (r?.ok) return null;
    await supabase.auth.signOut();
    return r?.error || 'Connexion refusée par le serveur.';
  } catch {
    return 'Erreur réseau. Réessayez.';
  }
}

/* Se connecter avec une adresse et un mot de passe, jusqu'au badge. */
export async function connecter(mail: string, motDePasse: string): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: mail.trim(), password: motDePasse });
  if (error || !data?.session) {
    return /invalid login/i.test(error?.message || '') ? 'Adresse ou mot de passe incorrect.' : (error?.message || 'Connexion impossible.');
  }
  return poserBadge(data.session.access_token);
}

/* Lire une réponse de /api/acces/… sans jamais lever. */
export async function appelAcces(action: string, corps?: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  try {
    const res = await fetch(`/api/acces/${action}`, corps
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }
      : { cache: 'no-store' });
    const r = await res.json().catch(() => null);
    return r && typeof r === 'object' ? r : { ok: false, error: `Réponse illisible du serveur (${res.status}).` };
  } catch {
    return { ok: false, error: 'Erreur réseau. Réessayez.' };
  }
}
