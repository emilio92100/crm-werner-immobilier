'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CLE_IDENTITE, coordonneesBrutes, coordonneesDe, type Coordonnees } from '@/lib/agence';

/* ═══ Les coordonnées de l'agence, dans le CRM (23 octobre 2026) ═══════════
   La même source que le serveur (src/lib/coordonnees-serveur.ts) :
   Paramètres › Agence. Lue une fois par ouverture du CRM, avec la session
   de Werner ; relue dès qu'Agence enregistre (`oublierCoordonnees`). Avant
   la première lecture, ou si elle échoue : les coordonnées d'origine. */

let enCours: Promise<Coordonnees> | null = null;
let connues: Coordonnees | null = null;
const abonnes = new Set<(c: Coordonnees) => void>();

export function lireCoordonnees(): Promise<Coordonnees> {
  if (!enCours) {
    enCours = Promise.resolve(supabase.from('parametres').select('valeur').eq('cle', CLE_IDENTITE).maybeSingle())
      .then(({ data, error }) => {
        if (error) { enCours = null; return coordonneesDe(null); }
        connues = coordonneesBrutes(data?.valeur ?? null);
        abonnes.forEach(f => f(connues!));
        return connues;
      })
      .catch(() => { enCours = null; return coordonneesDe(null); });
  }
  return enCours;
}

/** Agence vient d'enregistrer : tout ce qui est ouvert relit. */
export function oublierCoordonnees() { enCours = null; void lireCoordonnees(); }

/** Les coordonnées du jour, pour un composant du CRM. */
export function useCoordonnees(): Coordonnees {
  const [c, setC] = useState<Coordonnees>(() => connues || coordonneesDe(null));
  useEffect(() => {
    abonnes.add(setC);
    void lireCoordonnees().then(setC);
    return () => { abonnes.delete(setC); };
  }, []);
  return c;
}
