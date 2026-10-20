import type { Metadata } from 'next';

/* Le nouveau site de Werner, en construction (maquette « Refonte du site »,
   variante C2). Visible seulement avec le code d'avant-première (src/proxy.ts). */
export const metadata: Metadata = { title: 'Werner Immobilier — nouveau site (avant-première)', robots: { index: false, follow: false } };

export default function NouveauSite() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#2e3034', color: '#fff', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: '#f7b07a' }}>Avant-première</p>
        <h1 style={{ margin: '12px 0 0', fontSize: 30, fontWeight: 800 }}>Le nouveau site de Werner Immobilier se construit ici.</h1>
        <p style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.6, color: '#d9dadc' }}>{'Vous le voyez grâce au code d’avant-première. Le public, lui, voit encore la page d’attente.'}</p>
      </div>
    </div>
  );
}
