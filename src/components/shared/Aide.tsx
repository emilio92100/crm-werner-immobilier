'use client';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import a from './Aide.module.css';

/* ═══ Le petit « ? » qui explique (22 octobre 2026) ════════════════════════
   Alexandre : « est-ce qu'il y a un petit point d'interrogation qui lui
   explique, à chaque étape, comment ça se passe ? », puis : « les faire
   bien jolis, avec un petit pop-up, version PC et mobile ».

   Un appui sur le « ? » ouvre une petite fenêtre blanche, avec son titre et
   un × : sur ordinateur, posée sous le « ? » (au-dessus s'il n'y a pas la
   place, et elle défile si elle est plus haute que l'écran) ; au téléphone,
   une feuille qui monte du bas, sur un voile. Un appui ailleurs, Échap, le
   × ou le « ? » la referment. Le mouvement (src/lib/mouvement.ts) la fait
   sortir du « ? » et y rentrer : rien à animer ici.

   Elle est posée sur <body> (portail, position fixe) : dans une carte qui
   coupe ce qui dépasse (`overflow: hidden`), elle était tranchée net.
   `classe` : un autre dessin pour le bouton (le « ? » de la carte). */
type Pos = { left: number; top: number; fleche: number; dessus: boolean; haut: number | null };
const MARGE = 12;
const largeurBulle = () => Math.min(360, window.innerWidth - 2 * MARGE);
/* Les espaces insécables du français (« … », « : », « % ») : une ligne ne
   commence jamais par « » » ni par « : ». Appliquées à tout le texte de la
   fenêtre, sans rien demander aux écrans qui l'utilisent. */
const insecable = (t: string) => t.replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»').replace(/ ([:;?!%])/g, '\u00a0$1');
function soigner(n: ReactNode): ReactNode {
  if (typeof n === 'string') return insecable(n);
  if (!isValidElement(n)) return n;
  const c = (n.props as { children?: ReactNode }).children;
  if (c === undefined || c === null) return n;
  const el = n as ReactElement<{ children?: ReactNode }>;
  return Array.isArray(c) ? cloneElement(el, undefined, ...c.map(soigner)) : cloneElement(el, undefined, soigner(c));
}
const auTelephone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;

export default function Aide({ titre, children, label, classe }: { titre: string; children: ReactNode; label?: string; classe?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [feuille, setFeuille] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);
  const defile = useRef<HTMLSpanElement>(null);

  const placer = useCallback(() => {
    const b = btn.current;
    if (!b || auTelephone()) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const l = largeurBulle();
    const centre = r.left + r.width / 2;
    const left = Math.max(MARGE, Math.min(centre > vw / 2 ? r.right + 12 - l : r.left - 12, vw - l - MARGE));
    /* Sa hauteur entière (même quand elle défile) : la place sous le « ? »,
       sinon au-dessus ; sinon le côté le plus grand, et elle défile. */
    const h = defile.current?.scrollHeight || 0;
    const sous = r.bottom + 10, placeSous = vh - MARGE - sous, placeDessus = r.top - 10 - MARGE;
    const fleche = Math.max(14, Math.min(centre - left - 6, l - 26));
    if (h <= placeSous) setPos({ left, top: sous, fleche, dessus: false, haut: null });
    else if (h <= placeDessus) setPos({ left, top: r.top - 10 - h, fleche, dessus: true, haut: null });
    else if (placeSous >= placeDessus) setPos({ left, top: sous, fleche, dessus: false, haut: Math.max(140, placeSous) });
    else setPos({ left, top: MARGE, fleche, dessus: true, haut: placeDessus });
  }, []);

  /* Ouverte : placée avant d'être peinte (sa hauteur se mesure au premier
     passage, invisible), puis replacée quand la page défile. */
  useLayoutEffect(() => {
    if (!ouvert) { setPos(null); return; }
    setFeuille(auTelephone());
    placer();
  }, [ouvert, placer]);

  useEffect(() => {
    if (!ouvert) return;
    const hors = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || bulle.current?.contains(t)) return;
      setOuvert(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    const surDefilement = (e: Event) => { if (!bulle.current?.contains(e.target as Node)) placer(); };
    document.addEventListener('pointerdown', hors);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', surDefilement, true);
    window.addEventListener('resize', placer);
    return () => {
      document.removeEventListener('pointerdown', hors);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', surDefilement, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert, placer]);

  const fenetre = (
    <span ref={bulle} className={`${a.bulle} ${feuille ? a.feuille : pos?.dessus ? a.dessus : ''}`} role="dialog" aria-label={titre}
      onClick={e => e.stopPropagation()}
      style={feuille ? undefined : {
        width: largeurBulle(), left: pos?.left ?? 0, top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden', ['--fleche' as string]: `${pos?.fleche ?? 16}px`,
      }}>
      <span ref={defile} className={a.defile} style={!feuille && pos?.haut ? { maxHeight: pos.haut } : undefined}>
        {feuille && <span className={a.poignee} aria-hidden="true" />}
        <span className={a.tete}>
          <span className={a.pastille} aria-hidden="true">?</span>
          <b>{insecable(titre)}</b>
          <button type="button" className={a.fermer} aria-label="Fermer" onClick={() => setOuvert(false)}>×</button>
        </span>
        <span className={a.texte}>{Children.map(children, soigner)}</span>
      </span>
    </span>
  );

  return (
    <span ref={ref} className={classe ? a.aideLibre : a.aide}>
      <button ref={btn} type="button" className={classe || a.q} aria-expanded={ouvert} aria-label={label || `Comment ça marche : ${titre}`}
        title={label || `Comment ça marche : ${titre}`}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOuvert(o => !o); }}>?</button>
      {ouvert && typeof document !== 'undefined' && createPortal(
        feuille
          ? <><span className={a.voile} onClick={e => { e.stopPropagation(); setOuvert(false); }} />{fenetre}</>
          : fenetre,
        document.body,
      )}
    </span>
  );
}
