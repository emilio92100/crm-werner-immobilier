'use client';
/* ═══ « Modifier le texte », sur l'aperçu même (23 octobre 2026) ════════════
   Alexandre : « depuis l'aperçu, tout est sélectionnable » ; « quand il fait
   enregistrer, un petit chargement, et ensuite changement effectué » ; « une
   aide : le gras, l'italique, la taille ; par défaut, la même écriture que le
   mandat ». Une fois le texte déverrouillé (EditeurDocument), chaque phrase
   de l'aperçu se survole et s'ouvre au clic, sur place : un cadre où l'écrire,
   Gras, Italique, la taille (petit, normal, grand), puis « Enregistrer ».
   Chaque partie se retire (sauf les signatures et la rétractation), reçoit
   des paragraphes ; ses parties à lui vont avant les signatures.
   Les retouches : src/lib/actes/retouches.ts. Un seul cadre ouvert à la
   fois. Composants au niveau du module (AGENTS.md §2.4). */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Bloc, Partie, Section } from '@/lib/mandat';
import {
  blocsDe, cleSection, morceaux, placePartiesLibres, sansBalises, sectionFixe,
  type Paragraphe, type PartieLibre, type Retouches, type Taille,
} from '@/lib/actes/retouches';
import { BlocVue, Croix, Ic, T, TitreSection } from './ApercuActe';
import s from './Documents.module.css';

export type Edition = {
  /* Le texte tel que les réponses le rédigent (m.brut). */
  brut: Partie[];
  r: Retouches;
  /* Enregistre les retouches ; rend false si ça a raté. */
  enregistrer: (r: Retouches) => Promise<boolean>;
};

type Ctx = { r: Retouches; ouvert: string; ouvrir: (id: string) => void; sauver: (r: Retouches, dit?: string) => Promise<boolean> };
const Contexte = createContext<Ctx | null>(null);
const useEd = () => useContext(Contexte)!;
const uid = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ── Le cadre d'écriture : du HTML du navigateur à notre texte, et retour ── */
type Seg = { t: string; g: boolean; i: boolean };
function segments(n: Node, g: boolean, i: boolean, out: Seg[]) {
  if (n.nodeType === 3) { out.push({ t: (n.textContent || '').replace(/ /g, ' '), g, i }); return; }
  if (n.nodeType !== 1) return;
  const el = n as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') { out.push({ t: '\n', g: false, i: false }); return; }
  const gg = g || tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(el.style?.fontWeight || '');
  const ii = i || tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic';
  if ((tag === 'DIV' || tag === 'P') && out.length && !out[out.length - 1].t.endsWith('\n')) out.push({ t: '\n', g: false, i: false });
  el.childNodes.forEach(c => segments(c, gg, ii, out));
}
function lireCadre(el: HTMLElement): string {
  const l: Seg[] = [];
  el.childNodes.forEach(c => segments(c, false, false, l));
  const brut = l.map(x => (x.t === '\n' ? '\n' : `${x.g ? '<b>' : ''}${x.i ? '<i>' : ''}${x.t}${x.i ? '</i>' : ''}${x.g ? '</b>' : ''}`)).join('')
    .replace(/<\/i><\/b><b><i>/g, '').replace(/<\/b><b>/g, '').replace(/<\/i><i>/g, '')
    .replace(/<b><\/b>|<i><\/i>/g, '');
  return brut.split('\n').map(x => x.replace(/[ \t]+/g, ' ').trim()).filter(x => sansBalises(x).trim()).join('\n');
}
const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function versHtml(texte: string): string {
  return texte.split('\n').map(l => morceaux(l).map(m => {
    const t = echapper(m.t);
    return m.g && m.i ? `<b><i>${t}</i></b>` : m.g ? `<b>${t}</b>` : m.i ? `<i>${t}</i>` : t;
  }).join('')).join('<br>');
}

type Geste = { l: string; ic: string; rouge?: boolean; go: () => void };

function Cadre({ initial, taille0, simple, encadre, titre0, avecTitre, entete, gestes, onEnregistrer, onAnnuler }: {
  initial: string; taille0?: Taille;
  /* Une puce de liste, une case : du texte seul, sans mise en forme. */
  simple?: boolean;
  /* Une phrase qui engage (encadré) : en gras d'un bout à l'autre. */
  encadre?: boolean;
  /* Une partie à lui : son titre au-dessus. */
  titre0?: string; avecTitre?: boolean;
  entete: string;
  gestes?: Geste[];
  onEnregistrer: (texte: string, taille?: Taille, titre?: string) => Promise<boolean>;
  onAnnuler: () => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const [taille, setTaille] = useState<Taille>(taille0 || 'normal');
  const [texteSimple, setTexteSimple] = useState(initial);
  const [titre, setTitre] = useState(titre0 || '');
  const [travail, setTravail] = useState(false);
  const [vide, setVide] = useState('');
  useLayoutEffect(() => {
    const el = cadre.current;
    if (el) {
      el.innerHTML = versHtml(initial);
      if (!avecTitre || titre0) {
        el.focus();
        const sel = window.getSelection();
        if (sel) { const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg); }
      }
    }
    const z = zone.current;
    if (z) { z.style.height = 'auto'; z.style.height = `${z.scrollHeight + 2}px`; z.focus(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mettre = (cmd: 'bold' | 'italic') => {
    try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* sans effet ailleurs */ }
    document.execCommand(cmd);
    cadre.current?.focus();
  };
  async function enregistrer() {
    const texte = simple ? texteSimple.replace(/\s*\n\s*/g, ' ').trim() : cadre.current ? lireCadre(cadre.current) : '';
    if (avecTitre && !titre.trim() && !sansBalises(texte).trim()) { setVide('Un titre et un texte, ou annule.'); return; }
    if (!avecTitre && !sansBalises(texte).trim()) { setVide('Le texte est vide : écris-le, ou « Supprimer ».'); return; }
    setTravail(true); setVide('');
    const ok = await onEnregistrer(texte, taille === 'normal' ? undefined : taille, titre.trim());
    if (!ok) setTravail(false);
  }
  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !travail) { e.preventDefault(); onAnnuler(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enregistrer(); }
  };
  return (
    <div className={s.etCadre} onClick={e => e.stopPropagation()} onKeyDown={clavier} data-emi-anim="non">
      <div className={s.etCadreT}><Ic n="crayon" t={13} /><span>{entete}</span></div>
      {avecTitre && (
        <input className={`${s.input} ${s.etTitre}`} value={titre} disabled={travail} autoFocus={!titre0} placeholder="Le titre de ta partie : Conditions particulières, Travaux…"
          aria-label="Le titre de ta partie" onChange={e => { setTitre(e.target.value); setVide(''); }} />
      )}
      {!simple && !encadre && (
        <div className={s.etOutils} role="toolbar" aria-label="Mise en forme">
          <button type="button" className={s.etOutil} disabled={travail} onMouseDown={e => e.preventDefault()} onClick={() => mettre('bold')} title="Gras : sélectionne des mots, puis clique">
            <b>G</b><span>Gras</span>
          </button>
          <button type="button" className={s.etOutil} disabled={travail} onMouseDown={e => e.preventDefault()} onClick={() => mettre('italic')} title="Italique : sélectionne des mots, puis clique">
            <i>I</i><span>Italique</span>
          </button>
          <span className={s.etSep} aria-hidden="true" />
          <div className={s.etTailles} role="radiogroup" aria-label="Taille du texte">
            {(['petit', 'normal', 'grand'] as Taille[]).map(t => (
              <button key={t} type="button" role="radio" aria-checked={taille === t} disabled={travail} onMouseDown={e => e.preventDefault()} onClick={() => setTaille(t)}>
                {t === 'petit' ? 'Petit' : t === 'grand' ? 'Grand' : 'Normal'}
              </button>
            ))}
          </div>
        </div>
      )}
      {simple ? (
        <textarea ref={zone} className={`${s.input} ${s.etZoneSimple}`} value={texteSimple} disabled={travail} rows={2} aria-label="Le texte"
          onChange={e => { setTexteSimple(e.target.value); setVide(''); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight + 2}px`; }} />
      ) : (
        <div ref={cadre} className={`${s.etZone} ${taille === 'petit' ? s.etPetit : taille === 'grand' ? s.etGrand : ''} ${encadre ? s.etEnc : ''}`}
          contentEditable={!travail} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Le texte"
          data-vide={initial ? undefined : 'oui'}
          onInput={e => { setVide(''); (e.currentTarget as HTMLElement).dataset.vide = (e.currentTarget.textContent || '').trim() ? '' : 'oui'; }}
          onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }} />
      )}
      <div className={s.etAide}>{simple
        ? 'Du texte seul ici (une puce, une case). Ctrl + Entrée enregistre, Échap annule.'
        : encadre
          ? 'Une phrase qui engage : elle reste encadrée et en gras. Entrée commence un nouveau paragraphe.'
          : 'Sélectionne des mots, puis Gras ou Italique. Entrée commence un nouveau paragraphe. La police reste celle du document.'}</div>
      {vide && <div className={s.etVide}>{vide}</div>}
      <div className={s.etBoutons}>
        <div className={s.etGestes}>
          {gestes?.map(g => (
            <button key={g.l} type="button" className={`${s.etLien} ${g.rouge ? s.etLienRouge : ''}`} disabled={travail} onClick={g.go}><Ic n={g.ic} t={13} />{g.l}</button>
          ))}
        </div>
        <button type="button" className={s.btn} disabled={travail} onClick={onAnnuler}>Annuler</button>
        <button type="button" className={`${s.btn} ${s.btnNavy}`} disabled={travail} onClick={() => { void enregistrer(); }}>
          {travail ? <><span className={s.etTourne} aria-hidden="true" />Enregistrement…</> : <><Ic n="check" t={14} e={2.4} />Enregistrer</>}
        </button>
      </div>
    </div>
  );
}

/* ── Un passage qu'on peut ouvrir ── */
function Touchable({ id, modifie, children, cadre }: { id: string; modifie?: boolean; children: ReactNode; cadre: ReactNode }) {
  const ed = useEd();
  if (ed.ouvert === id) return <>{cadre}</>;
  return (
    <div className={`${s.etBloc} ${modifie ? s.etModifie : ''}`} role="button" tabIndex={0} aria-label="Modifier ce passage"
      onClick={e => { e.stopPropagation(); ed.ouvrir(id); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ed.ouvrir(id); } }}>
      {children}
      <span className={s.etCrayon} aria-hidden="true"><Ic n="crayon" t={11} />{modifie ? 'Modifié' : 'Modifier'}</span>
    </div>
  );
}

/* Remplace (ou oublie) la retouche d'une phrase d'origine. */
const avecPhrase = (r: Retouches, avant: string, x: { apres: string; taille?: Taille } | null): Retouches => {
  const phrases = r.phrases.filter(p => p.avant !== avant);
  return { ...r, phrases: x ? [...phrases, { avant, apres: x.apres, ...(x.taille ? { taille: x.taille } : {}) }] : phrases };
};

/* Un paragraphe du document (« p ») : tel quel, ou retouché. */
function ParagrapheEd({ id, b }: { id: string; b: Extract<Bloc, { t: 'p' }> }) {
  const ed = useEd();
  const x = ed.r.phrases.find(p => p.avant === b.x);
  const fermer = () => ed.ouvrir('');
  if (x && x.apres === '') {
    return (
      <div className={s.etSupprime}>
        <del>{b.x}</del>
        <button type="button" className={s.etLien} onClick={() => { void ed.sauver(avecPhrase(ed.r, b.x, null), 'Paragraphe remis.'); }}><Ic n="retour" t={13} />Remettre</button>
      </div>
    );
  }
  const vue = x ? blocsDe(x.apres, x.taille, { g: b.g, petit: b.petit }) : [b];
  return (
    <Touchable id={id} modifie={!!x} cadre={(
      <Cadre entete={b.g ? 'Une phrase qui engage' : 'Ce paragraphe'} initial={x ? x.apres : b.x} taille0={x?.taille ?? (b.petit ? 'petit' : undefined)} encadre={b.g}
        gestes={[
          ...(x ? [{ l: 'Texte d’origine', ic: 'retour', go: () => { void ed.sauver(avecPhrase(ed.r, b.x, null), 'Texte d’origine remis.').then(ok => { if (ok) fermer(); }); } }] : []),
          { l: 'Supprimer', ic: 'corbeille', rouge: true, go: () => { void ed.sauver(avecPhrase(ed.r, b.x, { apres: '' }), 'Paragraphe supprimé.').then(ok => { if (ok) fermer(); }); } },
        ]}
        onAnnuler={fermer}
        onEnregistrer={async (texte, taille) => {
          const memeQuOrigine = texte === b.x && (taille ?? (b.petit ? 'petit' : undefined)) === (b.petit ? 'petit' : undefined);
          const ok = await ed.sauver(avecPhrase(ed.r, b.x, memeQuOrigine ? null : { apres: texte, taille }));
          if (ok) fermer();
          return ok;
        }} />
    )}>
      {vue.map((v, k) => <BlocVue key={k} b={v} />)}
    </Touchable>
  );
}

/* Une phrase simple (une puce, une case, une étape) : du texte seul. */
function PhraseSimple({ id, x, rendu }: { id: string; x: string; rendu: (texte: string) => ReactNode }) {
  const ed = useEd();
  const r = ed.r.phrases.find(p => p.avant === x);
  const fermer = () => ed.ouvrir('');
  if (r && r.apres === '') {
    return (
      <div className={s.etSupprime}>
        <del>{x}</del>
        <button type="button" className={s.etLien} onClick={() => { void ed.sauver(avecPhrase(ed.r, x, null), 'Remis.'); }}><Ic n="retour" t={13} />Remettre</button>
      </div>
    );
  }
  const texte = r ? sansBalises(r.apres) : x;
  return (
    <Touchable id={id} modifie={!!r} cadre={(
      <Cadre simple entete="Cette ligne" initial={texte}
        gestes={[
          ...(r ? [{ l: 'Texte d’origine', ic: 'retour', go: () => { void ed.sauver(avecPhrase(ed.r, x, null), 'Texte d’origine remis.').then(ok => { if (ok) fermer(); }); } }] : []),
          { l: 'Supprimer', ic: 'corbeille', rouge: true, go: () => { void ed.sauver(avecPhrase(ed.r, x, { apres: '' }), 'Ligne supprimée.').then(ok => { if (ok) fermer(); }); } },
        ]}
        onAnnuler={fermer}
        onEnregistrer={async t => { const ok = await ed.sauver(avecPhrase(ed.r, x, t === x ? null : { apres: t })); if (ok) fermer(); return ok; }} />
    )}>
      {rendu(texte)}
    </Touchable>
  );
}

/* Un bloc du document, en retouche. */
function BlocEd({ id, b }: { id: string; b: Bloc }) {
  if (b.t === 'p') return <ParagrapheEd id={id} b={b} />;
  if (b.t === 'case') return <PhraseSimple id={id} x={b.x} rendu={t => <p className={s.caseP}><span className={`${s.bx} ${b.coche ? s.bxOn : ''}`} /><span><T x={t} /></span></p>} />;
  if (b.t === 'l') return <ul>{b.items.map((x, n) => <li key={n}><PhraseSimple id={`${id}.${n}`} x={x} rendu={t => <T x={t} />} /></li>)}</ul>;
  if (b.t === 'coches') return (
    <div className={s.coches}>
      {b.items.map((x, n) => <PhraseSimple key={n} id={`${id}.${n}`} x={x} rendu={t => <div><span className={s.k}><Ic n="check" t={11} e={2.6} /></span><span><T x={t} /></span></div>} />)}
    </div>
  );
  if (b.t === 'etapes') return (
    <ol className={s.etapes}>
      {b.items.map((e, n) => (
        <li key={n}><span className={s.n}>{String(n + 1).padStart(2, '0')}</span><span><b>{e.titre}</b><span className={s.x}><PhraseSimple id={`${id}.${n}`} x={e.x} rendu={t => <T x={t} />} /></span></span></li>
      ))}
    </ol>
  );
  /* Les fiches (les identités) : elles viennent des questions. */
  if (b.t === 'fiches') return <div className={s.etFige} title="Les identités se changent dans les questions"><BlocVue b={b} /><span className={s.etFigeNote}><Ic n="info" t={11} />Se change dans les questions</span></div>;
  return <BlocVue b={b} />;
}

/* Ses paragraphes à lui (à la fin d'une partie, ou dans une partie à lui). */
function ParasAjoutes({ base, paras, onChange }: { base: string; paras: Paragraphe[]; onChange: (l: Paragraphe[], dit?: string) => Promise<boolean> }) {
  const ed = useEd();
  const fermer = () => ed.ouvrir('');
  const idNouveau = `n:${base}`;
  return (
    <>
      {paras.map(x => {
        const id = `a:${base}:${x.id}`;
        return (
          <Touchable key={x.id} id={id} modifie cadre={(
            <Cadre entete="Ton paragraphe" initial={x.texte} taille0={x.taille}
              gestes={[{ l: 'Supprimer', ic: 'corbeille', rouge: true, go: () => { void onChange(paras.filter(y => y.id !== x.id), 'Paragraphe supprimé.').then(ok => { if (ok) fermer(); }); } }]}
              onAnnuler={fermer}
              onEnregistrer={async (texte, taille) => {
                const ok = await onChange(paras.map(y => (y.id === x.id ? { id: y.id, texte, ...(taille ? { taille } : {}) } : y)));
                if (ok) fermer();
                return ok;
              }} />
          )}>
            {blocsDe(x.texte, x.taille).map((v, k) => <BlocVue key={k} b={v} />)}
          </Touchable>
        );
      })}
      {ed.ouvert === idNouveau ? (
        <Cadre entete="Un nouveau paragraphe" initial=""
          onAnnuler={fermer}
          onEnregistrer={async (texte, taille) => {
            const ok = await onChange([...paras, { id: uid(), texte, ...(taille ? { taille } : {}) }], 'Paragraphe ajouté.');
            if (ok) fermer();
            return ok;
          }} />
      ) : (
        <button type="button" className={s.etAjouter} onClick={e => { e.stopPropagation(); ed.ouvrir(idNouveau); }}><Ic n="plus" t={12} e={2.6} />Ajouter un paragraphe</button>
      )}
    </>
  );
}

/* Ses parties à lui, avant les signatures. */
function PartiesLibres() {
  const ed = useEd();
  const fermer = () => ed.ouvrir('');
  const majParties = (parties: PartieLibre[], dit?: string) => ed.sauver({ ...ed.r, parties }, dit);
  return (
    <div className={s.etLibres}>
      {ed.r.parties.map(x => {
        const idT = `t:${x.id}`;
        return (
          <div key={x.id} className={s.etLibre}>
            {ed.ouvert === idT ? (
              <Cadre avecTitre titre0={x.titre} entete="Le titre de ta partie" simple initial="" onAnnuler={fermer}
                onEnregistrer={async (_t, _ta, titre) => { const ok = await majParties(ed.r.parties.map(y => (y.id === x.id ? { ...y, titre: titre || y.titre } : y))); if (ok) fermer(); return ok; }} />
            ) : (
              <TitreSection titre={x.titre.trim() || 'Précisions'} ic="plume">
                <span className={s.etSecGestes}>
                  <button type="button" className={s.etLien} onClick={e => { e.stopPropagation(); ed.ouvrir(idT); }}><Ic n="crayon" t={12} />Titre</button>
                  <button type="button" className={`${s.etLien} ${s.etLienRouge}`} onClick={e => { e.stopPropagation(); void majParties(ed.r.parties.filter(y => y.id !== x.id), 'Partie retirée.'); }}><Croix t={11} />Retirer</button>
                </span>
              </TitreSection>
            )}
            <ParasAjoutes base={`libre:${x.id}`} paras={x.paras} onChange={(paras, dit) => majParties(ed.r.parties.map(y => (y.id === x.id ? { ...y, paras } : y)), dit)} />
          </div>
        );
      })}
      {ed.ouvert === 'nouvelle-partie' ? (
        <Cadre avecTitre entete="Une nouvelle partie" initial="" onAnnuler={fermer}
          onEnregistrer={async (texte, taille, titre) => {
            const ok = await majParties([...ed.r.parties, { id: uid(), titre: titre || 'Précisions', paras: texte ? [{ id: uid(), texte, ...(taille ? { taille } : {}) }] : [] }], 'Partie ajoutée.');
            if (ok) fermer();
            return ok;
          }} />
      ) : (
        <button type="button" className={`${s.etAjouter} ${s.etAjouterPartie}`} onClick={e => { e.stopPropagation(); ed.ouvrir('nouvelle-partie'); }}>
          <Ic n="plus" t={13} e={2.6} />Ajouter une partie<em>{'avant les signatures'}</em>
        </button>
      )}
    </div>
  );
}

/* Une rubrique du document, en retouche. */
function SectionEd({ p, sec, pi, si }: { p: Partie; sec: Section; pi: number; si: number }) {
  const ed = useEd();
  const cle = cleSection(pi, si, sec);
  const fixe = sectionFixe(p, sec);
  const retiree = ed.r.retirees.includes(cle);
  const [confirmer, setConfirmer] = useState(false);
  const nom = sec.titre || 'Le début de la partie';
  const gestes = fixe
    ? <span className={s.etFixe}><Ic n="cadenas" t={11} />Toujours imprimée</span>
    : retiree ? null
      : <button type="button" className={`${s.etLien} ${s.etLienRouge}`} onClick={e => { e.stopPropagation(); setConfirmer(true); }}><Croix t={11} />Retirer la partie</button>;
  return (
    <div className={`${s.etSec} ${retiree ? s.etSecRetiree : ''}`}>
      {sec.titre ? <TitreSection titre={sec.titre} ic={sec.ic}><span className={s.etSecGestes}>{gestes}</span></TitreSection>
        : <div className={s.etSecSans}><span className={s.etSecGestes}>{gestes}</span></div>}
      {confirmer && !retiree && (
        <div className={s.etConfirme} onClick={e => e.stopPropagation()}>
          <span>{`Retirer « ${nom} » du document ? Elle ne sera plus imprimée ; tu pourras la remettre.`}</span>
          <span className={s.etConfirmeB}>
            <button type="button" className={s.btn} onClick={() => setConfirmer(false)}>Garder</button>
            <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => { void ed.sauver({ ...ed.r, retirees: [...ed.r.retirees, cle] }, `« ${nom} » retirée.`).then(() => setConfirmer(false)); }}>Retirer</button>
          </span>
        </div>
      )}
      {retiree ? (
        <div className={s.etRetiree}>
          <span>{`« ${nom} » ne sera pas imprimée.`}</span>
          <button type="button" className={s.etLien} onClick={() => { void ed.sauver({ ...ed.r, retirees: ed.r.retirees.filter(x => x !== cle) }, `« ${nom} » remise.`); }}><Ic n="retour" t={13} />La remettre</button>
        </div>
      ) : fixe ? (
        sec.blocs.map((b, k) => <BlocVue key={k} b={b} />)
      ) : (
        <>
          {sec.blocs.map((b, k) => <BlocEd key={k} id={`b:${cle}:${k}`} b={b} />)}
          <ParasAjoutes base={cle} paras={ed.r.ajouts[cle] || []}
            onChange={(paras, dit) => {
              const ajouts = { ...ed.r.ajouts };
              if (paras.length) ajouts[cle] = paras; else delete ajouts[cle];
              return ed.sauver({ ...ed.r, ajouts }, dit);
            }} />
        </>
      )}
    </div>
  );
}

/* Le petit message « Modification enregistrée », en bas de l'écran. */
function Bulle({ msg }: { msg: { t: string; ok: boolean; n: number } | null }) {
  if (!msg) return null;
  return (
    <div key={msg.n} className={`${s.etBulle} ${msg.ok ? '' : s.etBulleKo}`} role="status" aria-live="polite" data-emi-anim="non">
      <span className={s.etBulleIc}>{msg.ok ? <Ic n="check" t={13} e={2.8} /> : <Ic n="info" t={13} />}</span>{msg.t}
    </div>
  );
}

/* L'état partagé (le cadre ouvert, le message) vit au niveau du document :
   un seul cadre ouvert, même d'une partie à l'autre (ApercuActe l'enveloppe). */
export function EditionDocument({ edition, children }: { edition: Edition; children: ReactNode }) {
  const [ouvert, setOuvert] = useState('');
  const [msg, setMsg] = useState<{ t: string; ok: boolean; n: number } | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dire = (t: string, ok: boolean) => {
    setMsg(m => ({ t, ok, n: (m?.n || 0) + 1 }));
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setMsg(null), ok ? 2400 : 5200);
  };
  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current); }, []);
  const ctx: Ctx = {
    r: edition.r, ouvert, ouvrir: setOuvert,
    sauver: async (r, dit) => {
      const ok = await edition.enregistrer(r);
      dire(ok ? (dit || 'Modification enregistrée.') : 'Pas enregistré : vérifie ta connexion, puis réessaie.', ok);
      return ok;
    },
  };
  return (
    <Contexte.Provider value={ctx}>
      {children}
      <Bulle msg={msg} />
    </Contexte.Provider>
  );
}

/* Une partie du document, en retouche (ApercuActe). Ses parties à lui
   s'insèrent avant les signatures. */
export default function BlocsEdition({ partie, pi, edition }: { partie: Partie; pi: number; edition: Edition }) {
  const place = placePartiesLibres(edition.brut);
  const ici = place.pi === pi;
  return (
    <>
      {partie.sections.map((sec, si) => (
        <div key={si}>
          {ici && si === place.si && <PartiesLibres />}
          <SectionEd p={partie} sec={sec} pi={pi} si={si} />
        </div>
      ))}
      {ici && place.si >= partie.sections.length && <PartiesLibres />}
    </>
  );
}
