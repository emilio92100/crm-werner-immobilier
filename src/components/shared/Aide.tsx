'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import a from './Aide.module.css';

/* ═══ Le petit « ? » qui explique (22 octobre 2026) ════════════════════════
   Alexandre : « est-ce qu'il y a un petit point d'interrogation qui lui
   explique, à chaque étape, comment ça se passe ? ». Un appui ouvre une
   bulle sous le « ? » (au-dessus s'il n'y a pas la place) ; un appui
   ailleurs, Échap ou le « ? » la referment. Le texte dit ce que fait
   l'étape et ce que voit le client.

   La bulle est posée sur <body> (portail, position fixe) : dans une carte
   qui coupe ce qui dépasse (`overflow: hidden`, Paramètres › Agence), elle
   était tranchée net au bas de la carte. Elle suit le « ? » quand la page
   ou une fenêtre défile, et ne sort jamais de l'écran. */
type Pos = { left: number; top: number; fleche: number; dessus: boolean; haut: number | null };
const MARGE = 12;
const largeurBulle = () => Math.min(340, window.innerWidth - 2 * MARGE);

export default function Aide({ titre, children, label }: { titre: string; children: ReactNode; label?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);
  const defile = useRef<HTMLSpanElement>(null);

  const placer = useCallback(() => {
    const b = btn.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const l = largeurBulle();
    const centre = r.left + r.width / 2;
    const left = Math.max(MARGE, Math.min(centre > vw / 2 ? r.right + 10 - l : r.left - 10, vw - l - MARGE));
    /* Sa hauteur entière (même quand elle défile) : la place sous le « ? »,
       sinon au-dessus ; sinon le côté le plus grand, et elle défile. */
    const h = defile.current?.scrollHeight || 0;
    const sous = r.bottom + 9, placeSous = vh - MARGE - sous, placeDessus = r.top - 9 - MARGE;
    const fleche = Math.max(12, Math.min(centre - left - 5, l - 22));
    if (h <= placeSous) setPos({ left, top: sous, fleche, dessus: false, haut: null });
    else if (h <= placeDessus) setPos({ left, top: r.top - 9 - h, fleche, dessus: true, haut: null });
    else if (placeSous >= placeDessus) setPos({ left, top: sous, fleche, dessus: false, haut: Math.max(120, placeSous) });
    else setPos({ left, top: MARGE, fleche, dessus: true, haut: placeDessus });
  }, []);

  /* Ouverte : placée avant d'être peinte (sa hauteur se mesure au premier
     passage, invisible), puis replacée à chaque défilement de la page. */
  useLayoutEffect(() => { if (ouvert) placer(); else setPos(null); }, [ouvert, placer]);

  useEffect(() => {
    if (!ouvert) return;
    const hors = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || bulle.current?.contains(t)) return;
      setOuvert(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', hors);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', placer, true);
    window.addEventListener('resize', placer);
    return () => {
      document.removeEventListener('pointerdown', hors);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', placer, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert, placer]);

  return (
    <span ref={ref} className={a.aide}>
      <button ref={btn} type="button" className={a.q} aria-expanded={ouvert} aria-label={label || `Comment ça marche : ${titre}`}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOuvert(o => !o); }}>?</button>
      {ouvert && typeof document !== 'undefined' && createPortal(
        <span ref={bulle} className={`${a.bulle} ${pos?.dessus ? a.dessus : ''}`} role="note"
          onClick={e => e.stopPropagation()}
          style={{
            width: largeurBulle(), left: pos?.left ?? 0, top: pos?.top ?? 0,
            visibility: pos ? 'visible' : 'hidden', ['--fleche' as string]: `${pos?.fleche ?? 14}px`,
          }}>
          <span ref={defile} className={a.defile} style={{ maxHeight: pos?.haut ?? undefined }}>
            <b>{titre}</b>
            <span className={a.texte}>{children}</span>
          </span>
        </span>,
        document.body,
      )}
    </span>
  );
}
