import type { Metadata, Viewport } from 'next';
import { createClient } from '@supabase/supabase-js';
import { coordonnees } from '@/lib/coordonnees-serveur';
import { envoiDuJeton, jetonValide, resumeRecherche, JETON_EXEMPLE, REPONSES, type Reponse } from '@/lib/point-auto';
import ReponsePoint, { type DonneesPoint } from '@/components/point/ReponsePoint';

/**
 * La page de réponse au point automatique, pour un demandeur sans espace
 * (23 octobre 2026) : <CRM>/point/<jeton>?r=<réponse>.
 *
 * Les boutons du mail « Où en est votre recherche ? » y mènent quand le
 * client n'a pas d'espace. Elle pose la question, déjà ouverte sur le bouton
 * choisi, et c'est le client qui répond : les messageries et les antivirus
 * ouvrent les liens des mails pour les vérifier, un lien qui enregistrerait
 * en arrivant répondrait à sa place.
 *
 * Publique dans src/proxy.ts. La base se lit ici, côté serveur, avec la clé
 * service (AGENTS.md §3.4). Le jeton est celui de l'envoi (src/lib/point-auto.ts,
 * envoiDuJeton) : la page ne montre que le prénom et le résumé de la
 * recherche, comme le mail lui-même. « exemple » : la page de démonstration
 * des exemples envoyés à Werner, rien ne s'y enregistre.
 */

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Votre recherche — Werner Immobilier',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#2e3034' };

/* La recherche de la page de démonstration : un exemple, dit comme tel. */
const RECHERCHE_EXEMPLE = {
  created_at: new Date(Date.now() - 75 * 86_400_000).toISOString(),
  type_bien: 'Restaurant, Local commercial',
  surface_min: 80, surface_max: 140,
  secteurs: ['Paris 11e', 'Paris 10e'],
  criteres_pro: { natures: ['cession_bail'], activite: 'Restauration traditionnelle', loyerMax: 60000 },
  budget_max: 250000,
  exigences: { extraction: 'indispensable', terrasse: 'souhaite' },
};

export default async function PagePoint({ params, searchParams }: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ r?: string | string[] }>;
}) {
  const { jeton } = await params;
  const { r } = await searchParams;
  const voulu = Array.isArray(r) ? r[0] : r;
  const co = await coordonnees();
  const base: DonneesPoint = {
    jeton, etat: 'introuvable', prenom: '', resume: null, derniere: null,
    choix: REPONSES.includes(voulu as Reponse) ? (voulu as Reponse) : null,
    co: { agence: co.agence, tel: co.tel, telLien: co.telLien, mail: co.mail },
  };
  if (!jetonValide(jeton)) return <ReponsePoint d={base} />;
  if (jeton === JETON_EXEMPLE) {
    return <ReponsePoint d={{ ...base, etat: 'exemple', prenom: 'Camille', resume: resumeRecherche(RECHERCHE_EXEMPLE) }} />;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return <ReponsePoint d={{ ...base, etat: 'indisponible' }} />;
  const sb = createClient(url, cle, { auth: { persistSession: false } });

  let envoi;
  try { envoi = await envoiDuJeton(sb, jeton); } catch (e) {
    console.error('[point] page', e instanceof Error ? e.message : String(e));
    return <ReponsePoint d={{ ...base, etat: 'indisponible' }} />;
  }
  if (!envoi) return <ReponsePoint d={base} />;

  const [cl, rech, rep] = await Promise.all([
    sb.from('clients').select('prenom').eq('id', envoi.clientId).maybeSingle(),
    envoi.rechercheId ? sb.from('recherches').select('*').eq('id', envoi.rechercheId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    /* Sa dernière réponse à ce mail, s'il en a déjà donné une. */
    sb.from('journal').select('metadata, created_at')
      .eq('client_id', envoi.clientId).eq('metadata->>point_envoi', envoi.id)
      .order('created_at', { ascending: false }).limit(1),
  ]);
  if (cl.error) console.error('[point] page, client', cl.error.message);
  if (rech.error) console.error('[point] page, recherche', rech.error.message);
  const prenom = (cl.data as { prenom?: string | null } | null)?.prenom || '';
  if (envoi.expire) return <ReponsePoint d={{ ...base, etat: 'expire', prenom }} />;

  const d0 = (rep.data || [])[0] as { metadata?: Record<string, unknown> | null; created_at: string } | undefined;
  const r0 = d0?.metadata?.reponse;
  return <ReponsePoint d={{
    ...base, etat: 'ouvert', prenom,
    resume: rech.data ? resumeRecherche(rech.data) : null,
    derniere: d0 && REPONSES.includes(r0 as Reponse)
      ? { reponse: r0 as Reponse, motif: typeof d0.metadata?.motif === 'string' ? d0.metadata.motif : null, le: d0.created_at }
      : null,
  }} />;
}
