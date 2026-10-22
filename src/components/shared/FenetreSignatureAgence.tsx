'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { deposerSignatureAgence, signatureDeposee } from '@/lib/signature-agence';
import f from './FenetreSignatureAgence.module.css';

/* ═══ Ta signature, dessinée dans le CRM (22 octobre 2026) ══════════════════
   Alexandre : « la signature de Werner à sa première connexion, avec des
   explications ». Werner n'a pas d'image PNG de sa signature sur fond
   transparent : il la dessine ici, au doigt, au stylet ou à la souris, et
   le CRM la range où les documents la cherchent (src/lib/signature-agence.ts).

   `premiere` : la fenêtre d'accueil (SignatureBienvenue), avec « Plus
   tard » ; sinon, celle de Paramètres › Agence. Après l'enregistrement, elle
   montre la signature telle qu'elle sera posée, et dit où elle servira. */

export default function FenetreSignatureAgence({ premiere = false, nom, onFermer, onPlusTard, onEnregistree }: {
  premiere?: boolean; nom: string;
  onFermer: () => void; onPlusTard?: () => void; onEnregistree?: () => void;
}) {
  const [trace, setTrace] = useState<{ png: string; blob: Blob } | null>(null);
  const [cle, setCle] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [faite, setFaite] = useState<{ png: string; note: string } | null>(null);
  const prenom = nom.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !envoi) (premiere && !faite ? onPlusTard || onFermer : onFermer)(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [envoi, premiere, faite, onPlusTard, onFermer]);

  async function enregistrer() {
    if (!trace || envoi) return;
    setEnvoi(true); setErreur('');
    const avant = (await signatureDeposee()) === true;
    const r = await deposerSignatureAgence(trace.blob, avant, 'dessinée dans le CRM');
    setEnvoi(false);
    if (r.erreur) { setErreur(`Ta signature n’a pas pu être enregistrée : ${r.erreur}. Réessaie dans un instant.`); return; }
    setFaite({ png: trace.png, note: r.histoire ? `Elle est enregistrée, mais l’historique de Paramètres › Agence n’a pas pu le noter (${r.histoire}).` : '' });
    onEnregistree?.();
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={f.fond}>
      <div className={f.voile} onClick={() => { if (!envoi && faite) onFermer(); }} />
      <section className={f.fenetre} role="dialog" aria-modal="true" aria-label="Ta signature">
        {faite ? (
          <>
            <span className={f.ic} data-ton="ok"><Coche /></span>
            <h2 className={f.titre}>C’est enregistré</h2>
            <p className={f.intro}>{'Voici ta signature, telle qu’elle sera posée dans la case de l’agence.'}</p>
            <div className={f.apercu}><img src={faite.png} alt="Ta signature" /></div>
            <ul className={f.points}>
              <li>{'Elle apparaîtra dès le prochain document signé : mandats, bons de visite, et mandats de recherche que tes demandeurs signent seuls.'}</li>
              <li>{'Les documents déjà signés ne changent pas.'}</li>
              <li>{'Pour la refaire\u00a0: Paramètres\u00a0› Agence\u00a0› Signataire.'}</li>
            </ul>
            {faite.note && <p className={f.erreur}>{faite.note}</p>}
            <div className={f.pied}><button type="button" className={f.btnOr} onClick={onFermer}>Fermer</button></div>
          </>
        ) : (
          <>
            <span className={f.ic}><Plume /></span>
            <h2 className={f.titre}>{premiere ? `Bienvenue${prenom ? `, ${prenom}` : ''} : il manque ta signature` : 'Ta signature manuscrite'}</h2>
            <p className={f.intro}>{premiere
              ? 'Une seule fois, et c’est fini. Elle signe pour l’agence les documents que tes clients signent en ligne.'
              : 'Dessine-la ici : elle remplace l’ancienne pour les prochains documents signés.'}</p>
            <ol className={f.etapes}>
              <li><b>{'Signe dans le cadre'}</b>{', au doigt, au stylet ou à la souris, comme sur papier. «\u00a0Effacer\u00a0» pour recommencer.'}</li>
              <li><b>{'Où elle sert : '}</b>{'dans la case de l’agence, sur ce qui se signe depuis le CRM (mandats, bons de visite) et sur les mandats que tes demandeurs signent seuls depuis leur espace.'}</li>
              <li><b>{'Où elle est rangée : '}</b>{'dans un dossier privé. Ni les clients ni le site n’y ont accès ; elle ne sort que sur les documents signés.'}</li>
            </ol>
            <Pad key={cle} nom={nom} bloque={envoi} onTrace={setTrace} />
            {erreur && <p className={f.erreur}>{erreur}</p>}
            <div className={f.pied}>
              <button type="button" className={f.btn} disabled={envoi} onClick={premiere ? onPlusTard || onFermer : onFermer}>{premiere ? 'Plus tard' : 'Annuler'}</button>
              <button type="button" className={f.btn} disabled={envoi || !trace} onClick={() => { setTrace(null); setCle(k => k + 1); }}>Effacer</button>
              <button type="button" className={f.btnOr} disabled={envoi || !trace} onClick={() => { void enregistrer(); }}>{envoi ? 'Enregistrement…' : 'Enregistrer ma signature'}</button>
            </div>
            {premiere && <p className={f.plusTard}>{'«\u00a0Plus tard\u00a0»\u00a0: la question revient dans trois jours. Tu peux aussi la faire dans Paramètres\u00a0› Agence.'}</p>}
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}

/* Le cadre où l'on signe (au niveau du module, AGENTS.md §2.4). Le tracé,
   recadré au plus près, sur fond transparent, rendu à chaque fois que le
   doigt se lève, s'il est assez long. Un cadre neuf (`key`) pour effacer. */
function Pad({ nom, bloque, onTrace }: { nom: string; bloque: boolean; onTrace: (t: { png: string; blob: Blob } | null) => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const boite = useRef({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const longueur = useRef(0);
  const rendre = useRef(onTrace);
  const [vide, setVide] = useState(true);
  useEffect(() => { rendre.current = onTrace; }, [onTrace]);

  const preparer = useCallback(() => {
    const c = toile.current; if (!c) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    const x = c.getContext('2d'); if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1f2a44'; x.fillStyle = '#1f2a44'; x.lineWidth = 2.6;
    boite.current = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    longueur.current = 0; dernier.current = null; setVide(true); rendre.current(null);
  }, []);
  useEffect(() => {
    preparer();
    window.addEventListener('resize', preparer);
    return () => window.removeEventListener('resize', preparer);
  }, [preparer]);

  const etendre = (p: { x: number; y: number }) => {
    const b = boite.current;
    b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y);
  };
  const poser = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (bloque) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sans effet */ }
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }, x = e.currentTarget.getContext('2d');
    if (x) { x.beginPath(); x.arc(p.x, p.y, 1.3, 0, Math.PI * 2); x.fill(); }
    dernier.current = p; etendre(p); setVide(false);
  };
  const tracer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const a = dernier.current, x = e.currentTarget.getContext('2d');
    if (!a || !x || bloque) return;
    e.preventDefault();
    const evs = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
    const r = e.currentTarget.getBoundingClientRect();
    const pts = (evs.length ? evs : [e.nativeEvent]).map(v => ({ x: v.clientX - r.left, y: v.clientY - r.top }));
    let prec = a;
    x.beginPath(); x.moveTo(prec.x, prec.y);
    for (const p of pts) { x.lineTo(p.x, p.y); longueur.current += Math.hypot(p.x - prec.x, p.y - prec.y); etendre(p); prec = p; }
    x.stroke();
    dernier.current = prec;
  };
  const lever = () => {
    if (!dernier.current) return;
    dernier.current = null;
    const c = toile.current; if (!c) return;
    if (longueur.current <= 80) { rendre.current(null); return; }
    const r = c.getBoundingClientRect(), dpr = c.width / (r.width || 1), b = boite.current, m = 8;
    const x0 = Math.max(0, (b.x0 - m) * dpr), y0 = Math.max(0, (b.y0 - m) * dpr);
    const x1 = Math.min(c.width, (b.x1 + m) * dpr), y1 = Math.min(c.height, (b.y1 + m) * dpr);
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), k = Math.min(1, 900 / w);
    const o = document.createElement('canvas');
    o.width = Math.max(1, Math.round(w * k)); o.height = Math.max(1, Math.round(h * k));
    o.getContext('2d')?.drawImage(c, x0, y0, w, h, 0, 0, o.width, o.height);
    const png = o.toDataURL('image/png');
    o.toBlob(blob => { if (blob) rendre.current({ png, blob }); }, 'image/png');
  };

  return (
    <div className={f.pad}>
      <canvas ref={toile} aria-label="Cadre de signature" onPointerDown={poser} onPointerMove={tracer} onPointerUp={lever} onPointerCancel={lever} />
      <span className={f.ligne} />
      <span className={f.x}>×</span>
      {vide && <span className={f.aide}>Signe ici</span>}
      <span className={f.nom}>{nom}</span>
    </div>
  );
}

function Plume() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 7l3 3" /><path d="M3 21.5h8" /></svg>;
}
function Coche() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.5 5 5L19.5 7" /></svg>;
}
