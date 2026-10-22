'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import a from './Aide.module.css';

/* ═══ Le petit « ? » qui explique (22 octobre 2026) ════════════════════════
   Alexandre : « est-ce qu'il y a un petit point d'interrogation qui lui
   explique, à chaque étape, comment ça se passe ? ». Un appui ouvre une
   bulle juste sous le « ? » (à gauche ou à droite selon la place) ; un
   appui ailleurs, Échap ou le « ? » la referment. Le texte dit ce que fait
   l'étape et ce que voit le client. */
export default function Aide({ titre, children, label }: { titre: string; children: ReactNode; label?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [droite, setDroite] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const hors = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', hors);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', hors); window.removeEventListener('keydown', esc); };
  }, [ouvert]);
  const basculer = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setDroite(r.left > window.innerWidth / 2);
    setOuvert(o => !o);
  };
  return (
    <span ref={ref} className={a.aide}>
      <button type="button" className={a.q} aria-expanded={ouvert} aria-label={label || `Comment ça marche : ${titre}`} onClick={basculer}>?</button>
      {ouvert && (
        <span className={`${a.bulle} ${droite ? a.droite : ''}`} role="note">
          <b>{titre}</b>
          <span className={a.texte}>{children}</span>
        </span>
      )}
    </span>
  );
}
