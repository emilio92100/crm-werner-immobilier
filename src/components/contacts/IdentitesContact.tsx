'use client';

/* ═══ Qui est-ce : une case par personne, et les autres adresses (V3.236) ══
   Repris du CRM d'Emilio (23 octobre 2026), avec les mots de Werner. Alexandre
   y demandait « un encadré de l'identité 1, un encadré de l'identité 2, un
   petit bouton plus pour en ajouter une, chaque personne avec ses mails, et
   une rubrique en bas pour les autres mails du dossier […] plus joli, plus
   moderne », et pour Werner « la même jolie présentation, pas de gros blocs ».

   Le même bloc partout où l'on écrit une personne : la création d'un
   contact (Clients), « Modifier le contact » de la fiche d'un demandeur
   (FicheClient) et celle des autres contacts (FicheContact).

     · Personne 1 : civilité, prénom, nom, SES e-mails, SES numéros. C'est
       elle qui reçoit les mails et qui a l'espace client.
     · « + Ajouter une personne » → Personne 2 : son lien (associés,
       co-propriétaires, autre lien), son identité, ses e-mails, ses
       numéros, et « Signe aussi les mandats » (`couple` en base,
       src/lib/foyer.ts). Werner choisit à chaque fois : deux associés
       signent tous les deux, une assistante, non.
     · Les autres adresses du dossier : une étiquette (Notaire, Avocat,
       Expert-comptable, Banque, Syndic, Autre) et l'adresse. Elles ne
       reçoivent rien d'office.
     · Une flèche sur chaque adresse la range ailleurs (personne 2, dossier) :
       pour démêler une fiche où tout était dans la même liste.

   `identitesDe` remplit le bloc depuis une fiche ; `colonnesDe` rend ce qui
   s'écrit dans `clients` ; `dossierDe` les adresses du dossier, qui
   s'écrivent à part (outils/sql/adresses-dossier.sql : sans ce SQL, la
   colonne n'existe pas et le reste doit passer). */

import { Ic } from '@/components/documents/ApercuActe';
import { ListeCoordonnees, lignesDe, nettoyer } from '@/components/shared/ListeCoordonnees';
import { adressesDossierDe, conjointDe, ETIQUETTES_DOSSIER, LIENS_P2, lienLisible, type AdresseDossier, type LienP2 } from '@/lib/foyer';
import s from './IdentitesContact.module.css';

type Civ = '' | 'Monsieur' | 'Madame';
export type Personne2 = { civilite: Civ; prenom: string; nom: string; emails: string[]; tels: string[]; lien: LienP2; precision: string; signe: boolean };
export type Identites = {
  civilite: Civ; prenom: string; nom: string; emails: string[]; tels: string[];
  p2: Personne2 | null;
  dossier: AdresseDossier[];
};

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const civDe = (x: unknown): Civ => (x === 'Monsieur' || x === 'Madame' ? x : '');
const ETIQ: readonly string[] = ETIQUETTES_DOSSIER;

export const identitesVides = (): Identites => ({ civilite: '', prenom: '', nom: '', emails: [''], tels: [''], p2: null, dossier: [] });
const nouvelleP2 = (x: Partial<Personne2> = {}): Personne2 => ({ civilite: '', prenom: '', nom: '', emails: [''], tels: [''], lien: 'couple', precision: '', signe: true, ...x });

/* Le bloc rempli depuis une fiche. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function identitesDe(c: any): Identites {
  const j = conjointDe(c?.conjoint);
  return {
    civilite: civDe(c?.civilite), prenom: c?.prenom || '', nom: c?.nom || '',
    emails: lignesDe(c?.emails), tels: lignesDe(c?.telephones),
    p2: j ? nouvelleP2({
      civilite: civDe(j.civilite), prenom: j.prenom || '', nom: j.nom || '',
      emails: lignesDe(j.emails || [j.email || '']), tels: lignesDe(j.telephones || [j.telephone || '']),
      lien: j.lien || 'couple', precision: j.precision || '', signe: !!c?.couple,
    }) : null,
    dossier: adressesDossierDe(c?.adresses_dossier),
  };
}

const p2Remplie = (v: Identites) => (v.p2 && (v.p2.prenom.trim() || v.p2.nom.trim()) ? v.p2 : null);

/* Ce qui s'écrit dans `clients` (sans les adresses du dossier). `avant` : le
   `conjoint` d'avant, dont on garde ce que le bloc ne montre pas (sa date et
   son lieu de naissance, donnés en signant). */
export function colonnesDe(v: Identites, avant?: unknown) {
  const p2 = p2Remplie(v);
  const ancien = conjointDe(avant) || {};
  const { precision: _pr, ...garde } = ancien as Record<string, unknown>;
  void _pr;
  const emails2 = p2 ? nettoyer(p2.emails, 'mail') : [];
  const tels2 = p2 ? nettoyer(p2.tels, 'tel') : [];
  return {
    civilite: v.civilite || null,
    couple: !!p2 && p2.signe,
    conjoint: p2 ? {
      ...garde, civilite: p2.civilite, prenom: p2.prenom.trim(), nom: p2.nom.trim(),
      email: emails2[0] || '', telephone: tels2[0] || '', emails: emails2, telephones: tels2, lien: p2.lien,
      ...(p2.lien === 'autre' && p2.precision.trim() ? { precision: p2.precision.trim() } : {}),
    } : null,
    emails: nettoyer(v.emails, 'mail'),
    telephones: nettoyer(v.tels, 'tel'),
  };
}

/* Les autres adresses du dossier, prêtes à écrire. */
export const dossierDe = (v: Identites): AdresseDossier[] => adressesDossierDe(v.dossier.map(d => ({ email: d.email.trim().toLowerCase(), etiquette: d.etiquette.trim() })));

/* Ce qui empêche d'enregistrer (vide : rien). */
export function erreurIdentites(v: Identites): string {
  if (v.p2 && !v.p2.prenom.trim() && !v.p2.nom.trim() && (nettoyer(v.p2.emails, 'mail').length || nettoyer(v.p2.tels, 'tel').length)) {
    return 'Écris au moins le prénom ou le nom de la personne 2 (ou retire-la).';
  }
  const fausse = v.dossier.find(d => d.email.trim() && !MAIL.test(d.email.trim()));
  if (fausse) return `Une adresse du dossier n’est pas complète : « ${fausse.email.trim()} ».`;
  return '';
}

/* Les lignes du Suivi : ce qui a changé côté personne 2 et adresses du dossier. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function changementsIdentites(avant: any, v: Identites): string[] {
  const out: string[] = [];
  const j = conjointDe(avant?.conjoint);
  const p2 = p2Remplie(v);
  const nom2 = p2 ? `${p2.prenom} ${p2.nom}`.trim() : '';
  const lien = (x: { lien?: string; precision?: string } | null) => lienLisible(x);
  const col = colonnesDe(v, avant?.conjoint);
  if (!j && p2) out.push(`Personne 2 ajoutée : ${nom2} (${lien(col.conjoint)})`);
  else if (j && !p2) out.push(`Personne 2 retirée (${`${j.prenom || ''} ${j.nom || ''}`.trim()})`);
  else if (j && p2 && JSON.stringify(conjointDe(avant?.conjoint)) !== JSON.stringify(conjointDe(col.conjoint))) out.push(`Personne 2 mise à jour : ${nom2} (${lien(col.conjoint)})`);
  if (p2 && !!avant?.couple !== col.couple) out.push(col.couple ? `${p2.prenom || nom2} signe aussi les mandats` : `${p2.prenom || nom2} ne signe plus les mandats`);
  const d0 = adressesDossierDe(avant?.adresses_dossier), d1 = dossierDe(v);
  if (JSON.stringify(d0) !== JSON.stringify(d1)) {
    out.push(d1.length ? `Autres adresses du dossier : ${d1.map(d => `${d.etiquette} ${d.email}`).join(', ')}` : 'Autres adresses du dossier retirées');
  }
  return out;
}

/* L'étiquette devinée d'une adresse rangée dans le dossier. */
function devine(e: string): string {
  const d = e.toLowerCase().split('@')[1] || '';
  if (/notaire/.test(d)) return 'Notaire';
  if (/avocat/.test(d)) return 'Avocat';
  if (/expert|comptab|fiducia|kpmg|fiducial|in-extenso|inextenso/.test(d)) return 'Expert-comptable';
  if (/syndic|foncia|nexity|citya|loiselet|oralia|immo-de-france/.test(d)) return 'Syndic';
  if (/banque|credit|bnp|lcl|caisse-epargne|societegenerale|boursorama|cic\.|bred|hsbc/.test(d)) return 'Banque';
  return 'Autre';
}

const sans = (l: string[], i: number) => { const r = l.filter((_, j) => j !== i); return r.length ? r : ['']; };
const avec = (l: string[], e: string) => [...l.filter(x => x.trim()), e];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Civilites({ v, onV }: { v: Civ; onV: (c: Civ) => void }) {
  return (
    <span className={s.civ} role="group" aria-label="Civilité">
      {(['Monsieur', 'Madame'] as const).map(c => (
        <button key={c} type="button" aria-pressed={v === c} onClick={() => onV(v === c ? '' : c)}>{c}</button>
      ))}
    </span>
  );
}

export default function IdentitesContact({ v, onChange, autoFocus = false, sansDossier = false, cls = {} }: {
  v: Identites; onChange: (v: Identites) => void;
  autoFocus?: boolean;
  /* Un professionnel n'a ni personne 2 ni dossier : ce bloc ne sert pas. */
  sansDossier?: boolean;
  /* Les classes du formulaire qui l'accueille, pour lui ressembler. */
  cls?: { in?: string; lib?: string };
}) {
  const cIn = `${s.in} ${cls.in || ''}`;
  const cLib = `${s.lib} ${cls.lib || ''}`;
  const maj = (x: Partial<Identites>) => onChange({ ...v, ...x });
  const p2 = v.p2;
  const maj2 = (x: Partial<Personne2>) => { if (p2) onChange({ ...v, p2: { ...p2, ...x } }); };
  const nom1 = v.prenom.trim() || 'la personne 1';
  const nom2 = p2?.prenom.trim() || 'la personne 2';

  /* Où une adresse (ou un numéro) de la personne 1 peut aller. */
  const deplacer1 = (genre: 'mail' | 'tel') => [
    ...(p2
      ? [{ lib: p2.prenom.trim() ? `Vers ${p2.prenom.trim()} (personne 2)` : 'Vers la personne 2', vers: (e: string, i: number) => onChange(genre === 'mail'
        ? { ...v, emails: sans(v.emails, i), p2: { ...p2, emails: avec(p2.emails, e) } }
        : { ...v, tels: sans(v.tels, i), p2: { ...p2, tels: avec(p2.tels, e) } }) }]
      : sansDossier ? [] : [{ lib: 'Vers une 2e personne, à créer', vers: (e: string, i: number) => onChange(genre === 'mail'
        ? { ...v, emails: sans(v.emails, i), p2: nouvelleP2({ emails: [e] }) }
        : { ...v, tels: sans(v.tels, i), p2: nouvelleP2({ tels: [e] }) }) }]),
    ...(genre === 'mail' && !sansDossier
      ? [{ lib: 'Vers les autres adresses du dossier', vers: (e: string, i: number) => onChange({ ...v, emails: sans(v.emails, i), dossier: [...v.dossier, { email: e, etiquette: devine(e) }] }) }]
      : []),
  ];
  const deplacer2 = (genre: 'mail' | 'tel') => (!p2 ? [] : [
    { lib: v.prenom.trim() ? `Vers ${v.prenom.trim()} (personne 1)` : 'Vers la personne 1', vers: (e: string, i: number) => onChange(genre === 'mail'
      ? { ...v, emails: avec(v.emails, e), p2: { ...p2, emails: sans(p2.emails, i) } }
      : { ...v, tels: avec(v.tels, e), p2: { ...p2, tels: sans(p2.tels, i) } }) },
    ...(genre === 'mail'
      ? [{ lib: 'Vers les autres adresses du dossier', vers: (e: string, i: number) => onChange({ ...v, p2: { ...p2, emails: sans(p2.emails, i) }, dossier: [...v.dossier, { email: e, etiquette: devine(e) }] }) }]
      : []),
  ]);

  function retirerP2() {
    const rempli = p2 && (p2.prenom.trim() || p2.nom.trim() || nettoyer(p2.emails, 'mail').length || nettoyer(p2.tels, 'tel').length);
    if (rempli && !confirm(`Retirer ${p2!.prenom.trim() || 'la personne 2'} de la fiche ? Ses adresses et ses numéros partent avec elle.`)) return;
    maj({ p2: null });
  }
  const majD = (i: number, x: Partial<AdresseDossier>) => maj({ dossier: v.dossier.map((d, j) => (j === i ? { ...d, ...x } : d)) });

  return (
    <div className={s.zone}>
      {/* ── Personne 1 ── */}
      <section className={s.carte} aria-label="Personne 1">
        <header className={s.tete}>
          <span className={s.num}>1</span>
          <span className={s.titre}>
            <b>{p2 ? 'Personne 1' : 'La personne'}</b>
            {p2 && <small>{'Contact principal : reçoit les mails, a l’espace client'}</small>}
          </span>
          <Civilites v={v.civilite} onV={c => maj({ civilite: c })} />
        </header>
        <div className={s.duo}>
          <label className={s.ch}><span className={cLib}>Prénom</span><input className={cIn} value={v.prenom} autoFocus={autoFocus} onChange={e => maj({ prenom: e.target.value })} /></label>
          <label className={s.ch}><span className={cLib}>Nom</span><input className={cIn} value={v.nom} onChange={e => maj({ nom: e.target.value })} /></label>
        </div>
        <div className={`${s.duo} ${s.duoCo}`}>
          <ListeCoordonnees genre="mail" etiquette="E-mails" valeurs={v.emails} onChange={x => maj({ emails: x })} classeBloc={s.ch} classeEtiquette={cLib} classeChamp={cIn} deplacer={deplacer1('mail')} />
          <ListeCoordonnees genre="tel" etiquette="Téléphones" valeurs={v.tels} onChange={x => maj({ tels: x })} classeBloc={s.ch} classeEtiquette={cLib} classeChamp={cIn} deplacer={p2 ? deplacer1('tel') : undefined} />
        </div>
      </section>

      {/* ── Personne 2, ou le bouton pour l'ajouter ── */}
      {!sansDossier && (p2 ? (
        <section className={`${s.carte} ${s.carte2}`} aria-label="Personne 2">
          <header className={s.tete}>
            <span className={`${s.num} ${s.num2}`}>2</span>
            <span className={s.titre}><b>Personne 2</b><small>{p2.signe ? 'Signe aussi les mandats' : 'Sur le dossier, sans signer'}</small></span>
            <Civilites v={p2.civilite} onV={c => maj2({ civilite: c })} />
            <button type="button" className={s.fermer} aria-label="Retirer la personne 2" title="Retirer la personne 2" onClick={retirerP2}><Ic n="croix" t={14} e={2.3} /></button>
          </header>
          <div className={s.liens} role="radiogroup" aria-label={`Son lien avec ${nom1}`}>
            {LIENS_P2.map(l => (
              <button key={l.k} type="button" role="radio" aria-checked={p2.lien === l.k} className={s.lien}
                onClick={() => maj2({ lien: l.k })}>
                <Ic n={l.ic} t={15} e={2} /><span>{l.lib}</span>
              </button>
            ))}
          </div>
          {p2.lien === 'autre' && (
            <label className={s.ch}><span className={cLib}>{`Son lien avec ${nom1}`}</span>
              <input className={cIn} value={p2.precision} placeholder="son gérant, son assistante, son frère…" onChange={e => maj2({ precision: e.target.value })} />
            </label>
          )}
          <div className={s.duo}>
            <label className={s.ch}><span className={cLib}>Prénom</span><input className={cIn} value={p2.prenom} onChange={e => maj2({ prenom: e.target.value })} /></label>
            <label className={s.ch}><span className={cLib}>Nom</span><input className={cIn} value={p2.nom} onChange={e => maj2({ nom: e.target.value })} /></label>
          </div>
          <div className={`${s.duo} ${s.duoCo}`}>
            <ListeCoordonnees genre="mail" etiquette="E-mails" valeurs={p2.emails} onChange={x => maj2({ emails: x })} classeBloc={s.ch} classeEtiquette={cLib} classeChamp={cIn} deplacer={deplacer2('mail')} />
            <ListeCoordonnees genre="tel" etiquette="Téléphones" valeurs={p2.tels} onChange={x => maj2({ tels: x })} classeBloc={s.ch} classeEtiquette={cLib} classeChamp={cIn} deplacer={deplacer2('tel')} />
          </div>
          <button type="button" role="switch" aria-checked={p2.signe} className={s.signe} onClick={() => maj2({ signe: !p2.signe })}>
            <span className={s.interr} aria-hidden="true"><i /></span>
            <span className={s.signeTx}>
              <b>Signe aussi les mandats</b>
              <small>{p2.signe
                ? `Associés, co-propriétaires, co-preneurs : le mandat est préparé à leurs deux noms, et ${nom2} reçoit son propre lien pour signer.`
                : `${cap(nom2)} a sa place sur la fiche et ses adresses, mais ne signe rien.`}</small>
            </span>
          </button>
        </section>
      ) : (
        <button type="button" className={s.ajouterP} onClick={() => maj({ p2: nouvelleP2() })}>
          <span className={s.ajouterIc}><Ic n="plus" t={16} e={2.4} /></span>
          <span className={s.ajouterTx}><b>Ajouter une personne</b><small>Un associé, un co-gérant, un co-propriétaire…</small></span>
        </button>
      ))}

      {/* ── Les autres adresses du dossier ── */}
      {!sansDossier && (
        <section className={`${s.carte} ${s.dossier}`} aria-label="Autres adresses du dossier">
          <header className={s.tete}>
            <span className={`${s.num} ${s.numD}`}><Ic n="dossier" t={15} e={2} /></span>
            <span className={s.titre}>
              <b>Autres adresses du dossier</b>
              <small>{'Notaire, avocat, expert-comptable… Elles ne reçoivent rien d’office : tu les choisis dans « Nouveau mail ».'}</small>
            </span>
          </header>
          {v.dossier.length > 0 && (
            <ul className={s.listeD}>
              {v.dossier.map((d, i) => {
                const etiq = ETIQ.includes(d.etiquette) ? d.etiquette : 'Autre';
                return (
                  <li key={i} className={s.ligneD}>
                    <select className={`${cIn} ${s.etiq}`} value={etiq} aria-label="Qui est-ce"
                      onChange={e => majD(i, { etiquette: e.target.value })}>
                      {ETIQ.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <input className={`${cIn} ${s.mailD}`} type="email" inputMode="email" autoComplete="off" placeholder="Adresse e-mail" aria-label="Adresse e-mail"
                      value={d.email} onChange={e => majD(i, { email: e.target.value })} />
                    <button type="button" className={s.retirerD} aria-label={`Retirer ${d.email || 'cette adresse'}`} title="Retirer"
                      onClick={() => maj({ dossier: v.dossier.filter((_, j) => j !== i) })}><Ic n="croix" t={14} e={2.3} /></button>
                    {etiq === 'Autre' && (
                      <input className={`${cIn} ${s.precD}`} placeholder="Qui ? (facultatif : comptable, gestionnaire…)" aria-label="Qui est-ce, en quelques mots"
                        value={d.etiquette === 'Autre' ? '' : d.etiquette} onChange={e => majD(i, { etiquette: e.target.value || 'Autre' })} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className={s.ajouterD} onClick={() => maj({ dossier: [...v.dossier, { email: '', etiquette: 'Notaire' }] })}>
            <Ic n="plus" t={14} e={2.4} /><span>Ajouter une adresse</span>
          </button>
        </section>
      )}
    </div>
  );
}
