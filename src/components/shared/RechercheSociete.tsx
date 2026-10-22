'use client';
/* ═══ Retrouver une société dans le registre national (23 octobre 2026) ═════
   Alexandre, pour Werner : « il peut mettre le début du nom de la société et
   voir si ça la retrouve, soit par le numéro, soit par le nom ; que ce soit
   joli, bien présenté ; il clique sur Sélectionner, et il a bien le message,
   société ajoutée ». La source : l'API Recherche d'entreprises de l'État
   (src/lib/entreprises.ts), sans clé, appelée du navigateur — la même que
   la signature d'un mandat dans l'espace client.

   Le composant cherche et montre ; ce qu'on fait de la société choisie
   (remplir une fiche, un document, une affaire) appartient à qui l'appelle
   (`onChoisir`). Au niveau du module (AGENTS.md §2.4). */
import { useEffect, useState } from 'react';
import { Ic } from '@/components/documents/ApercuActe';
import { chercherSocietes, fonctionCourte, nomDirigeant, sirenAere, type SocieteTrouvee } from '@/lib/entreprises';
import s from './RechercheSociete.module.css';

export default function RechercheSociete({ onChoisir, etiquette = 'Retrouve-la dans le registre : son nom ou son SIREN', aide, off, classeChamp }: {
  onChoisir: (x: SocieteTrouvee) => void;
  etiquette?: string;
  /* Ce que le choix a rempli, dit sous « Société ajoutée ». */
  aide?: string;
  off?: boolean;
  /* La classe des champs du formulaire qui l'accueille, pour lui ressembler. */
  classeChamp?: string;
}) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SocieteTrouvee[]>([]);
  const [etat, setEtat] = useState<'' | 'cherche' | 'vide' | 'erreur'>('');
  const [ajoutee, setAjoutee] = useState<SocieteTrouvee | null>(null);
  const court = q.trim().replace(/\s/g, '').length < 3;

  useEffect(() => {
    const t = q.trim();
    if (t.replace(/\s/g, '').length < 3) { setRes([]); setEtat(''); return; }
    const c = new AbortController();
    const minuteur = setTimeout(async () => {
      setEtat('cherche');
      try {
        const r = await chercherSocietes(t, c.signal);
        setRes(r); setEtat(r.length ? '' : 'vide');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') { setRes([]); setEtat('erreur'); }
      }
    }, 350);
    return () => { clearTimeout(minuteur); c.abort(); };
  }, [q]);

  const choisir = (x: SocieteTrouvee) => {
    onChoisir(x);
    setAjoutee(x); setQ(''); setRes([]); setEtat('');
  };

  if (ajoutee) {
    return (
      <div className={s.ajoutee} role="status">
        <span className={s.ajouteeIc}><Ic n="check" t={17} e={2.6} /></span>
        <span className={s.ajouteeTx}>
          <b>{`Société ajoutée : ${ajoutee.denomination}`}</b>
          <small>{[ajoutee.forme !== 'Autre' ? ajoutee.forme : '', `SIREN ${sirenAere(ajoutee.siren)}`, ajoutee.siege].filter(Boolean).join(' · ')}</small>
          <small>{aide || 'Les cases sont remplies depuis le registre : vérifie-les, tout reste modifiable.'}</small>
        </span>
        <button type="button" className={s.autre} disabled={off} onClick={() => setAjoutee(null)}>Une autre</button>
      </div>
    );
  }

  return (
    <div className={s.boite}>
      <label className={s.lib}>
        {etiquette && <span>{etiquette}</span>}
        <span className={s.champ}>
          <span className={s.loupe}><Ic n="loupe" t={16} e={2.2} /></span>
          <input className={`${classeChamp || ''} ${s.input}`} value={q} disabled={off} autoComplete="off" inputMode="search" enterKeyHint="search" aria-label={etiquette || 'Retrouver la société : son nom ou son SIREN'}
            placeholder="Le Comptoir, ou 732 829 320…" onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (res.length === 1) choisir(res[0]); } if (e.key === 'Escape') setQ(''); }} />
          {etat === 'cherche' && !court && <span className={s.tourne} aria-label="Recherche en cours" />}
        </span>
      </label>
      {!court && etat === 'vide' && <div className={s.etat}>{'Aucune société en activité ne correspond : vérifie l’orthographe, essaie le SIREN, ou écris son nom dans la case.'}</div>}
      {!court && etat === 'erreur' && <div className={s.etat}>{'Le registre ne répond pas pour le moment : écris son nom dans la case, tu la retrouveras plus tard.'}</div>}
      {!court && res.length > 0 && (
        <div className={s.liste} role="listbox" aria-label="Sociétés trouvées">
          {res.map(x => {
            const d = x.dirigeants[0];
            return (
              <button key={x.siren} type="button" role="option" aria-selected={false} className={s.res} disabled={off} onClick={() => choisir(x)}>
                <span className={s.av}><Ic n="immeuble" t={18} /></span>
                <span className={s.tx}>
                  <b>{x.denomination}</b>
                  <span className={s.puces}>
                    {x.forme !== 'Autre' && <i>{x.forme}</i>}
                    <i>{`SIREN ${sirenAere(x.siren)}`}</i>
                  </span>
                  {x.siege && <small>{x.siege}</small>}
                  {d && <small>{`${nomDirigeant(d)}${d.qualite ? `, ${fonctionCourte(d.qualite).toLowerCase()}` : ''}`}</small>}
                </span>
                <span className={s.choisir}><Ic n="plus" t={13} e={2.6} />Sélectionner</span>
              </button>
            );
          })}
          <div className={s.source}>{'Registre national des entreprises (INSEE et INPI) : les sociétés en activité.'}</div>
        </div>
      )}
    </div>
  );
}
