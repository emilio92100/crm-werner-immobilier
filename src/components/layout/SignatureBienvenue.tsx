'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CLE_IDENTITE, lireIdentite } from '@/lib/agence';
import { signatureDeposee } from '@/lib/signature-agence';
import FenetreSignatureAgence from '@/components/shared/FenetreSignatureAgence';

/* ═══ La signature, demandée à l'arrivée (22 octobre 2026) ══════════════════
   Alexandre : « la signature de Werner à sa première connexion, avec des
   explications ». Tant que la signature manuscrite de l'agence manque
   (src/lib/signature-agence.ts), le CRM la demande en s'ouvrant, une fois
   par visite. « Plus tard » la range trois jours (ce navigateur seulement).
   Une lecture ratée (dossier injoignable) ne demande rien : on ne dérange
   pas pour une signature peut-être déjà là. */

const CLE_PLUS_TARD = 'werner_signature_plus_tard';
const TROIS_JOURS = 3 * 24 * 3600 * 1000;

export default function SignatureBienvenue() {
  const [nom, setNom] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    try {
      const t = Number(localStorage.getItem(CLE_PLUS_TARD) || 0);
      if (t && Date.now() - t < TROIS_JOURS) return;
    } catch { /* navigation privée : on demande */ }
    (async () => {
      /* Laisser le CRM s'afficher d'abord. */
      await new Promise(r => setTimeout(r, 1200));
      const deja = await signatureDeposee();
      if (!vivant || deja !== false) return;
      const { data } = await supabase.from('parametres').select('valeur').eq('cle', CLE_IDENTITE).maybeSingle();
      if (!vivant) return;
      setNom(lireIdentite(data?.valeur ?? null).signataireNom || 'Werner');
    })();
    return () => { vivant = false; };
  }, []);

  if (!nom) return null;
  return (
    <FenetreSignatureAgence premiere nom={nom}
      onPlusTard={() => { try { localStorage.setItem(CLE_PLUS_TARD, String(Date.now())); } catch { /* rien */ } setNom(null); }}
      onFermer={() => setNom(null)} />
  );
}
