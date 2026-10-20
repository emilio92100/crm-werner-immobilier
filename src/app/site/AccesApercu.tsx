'use client';
import { useState } from 'react';

/* Le petit bouton « Accès avant-première » de la page d'attente : un code
   (src/lib/apercu-site.ts) ouvre le nouveau site en cours de construction. */
export default function AccesApercu() {
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'faux'>('');
  async function entrer(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || etat === 'envoi') return;
    setEtat('envoi');
    try {
      const r = await fetch('/api/site/apercu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (!r.ok) { setEtat('faux'); return; }
      const surLeSite = /(^|\.)wernerimmobilier\.com$/i.test(window.location.hostname);
      window.location.href = surLeSite ? '/' : '/site/v2';
    } catch { setEtat('faux'); }
  }
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)}
        style={{ background: 'none', border: '1px solid rgba(255,255,255,.22)', color: '#d9dadc', borderRadius: 99, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Accès avant-première
      </button>
    );
  }
  return (
    <form onSubmit={entrer} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <label htmlFor="code-apercu" style={{ fontSize: 13, color: '#d9dadc', fontWeight: 600 }}>Code</label>
      <input id="code-apercu" value={code} onChange={e => { setCode(e.target.value); setEtat(''); }} inputMode="numeric" autoComplete="off" autoFocus
        style={{ width: 110, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${etat === 'faux' ? '#f7b07a' : 'rgba(255,255,255,.3)'}`, background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 16, fontFamily: 'inherit' }} />
      <button type="submit" disabled={etat === 'envoi'}
        style={{ background: '#f08c42', color: '#232528', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
        {etat === 'envoi' ? '…' : 'Entrer'}
      </button>
      {etat === 'faux' && <span role="alert" style={{ fontSize: 13, color: '#f7b07a', fontWeight: 600 }}>Code incorrect.</span>}
    </form>
  );
}
