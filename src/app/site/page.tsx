import type { Metadata } from 'next';
import { IDENTITE_DEFAUT } from '@/lib/agence';
import AccesApercu from './AccesApercu';

/* ═══ La page d'attente de wernerimmobilier.com (21 octobre 2026) ═══════════
   L'ancien site (WordPress chez IONOS) a été piraté : le domaine pointe
   désormais sur ce projet Vercel, et src/proxy.ts sert cette page pour
   wernerimmobilier.com et www. Elle reste en place jusqu'au nouveau site
   (maquette « Refonte du site », variante C2). Publique, statique, sans
   lecture de la base. */

export const metadata: Metadata = {
  title: 'Werner Immobilier — Immobilier d’entreprise à Paris et dans les Hauts-de-Seine',
  description: 'Bureaux, boutiques, restaurants, locaux d’activité : location, cession de droit au bail, fonds de commerce et murs, à Paris et dans les Hauts-de-Seine.',
};

const ENCRE = '#232528', ANTHRACITE = '#2e3034', ORANGE = '#f08c42', ORANGE_TEXTE = '#c2621c', FOND = '#f6f6f7', PLUME = '#5b6470';
const POLICE = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const METIERS: { t: string; s: string }[] = [
  { t: 'Louer un local', s: 'Bureaux, boutique, restaurant, local d’activité.' },
  { t: 'Céder un bail ou un fonds', s: 'Droit au bail, fonds de commerce, restaurant.' },
  { t: 'Vendre ou acheter des murs', s: 'Libres ou occupés, pour s’installer ou investir.' },
  { t: 'Confier une affaire', s: 'Estimation, commercialisation, suivi jusqu’à la signature.' },
];

export default function PageAttente() {
  const id = IDENTITE_DEFAUT;
  const tel = id.tel || '01 87 66 06 00';
  const telLien = `tel:+33${tel.replace(/\s/g, '').replace(/^0/, '')}`;
  const mail = id.mail || 'contact@wernerimmobilier.com';
  return (
    <div style={{ minHeight: '100vh', background: FOND, color: ENCRE, fontFamily: POLICE, display: 'flex', flexDirection: 'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        .wa-metiers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .wa-actions{display:flex;flex-wrap:wrap;gap:12px}
        .wa-actions a{transition:transform .15s ease, box-shadow .15s ease}
        .wa-actions a:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(18,18,17,.18)}
        @media (max-width:640px){.wa-metiers{grid-template-columns:1fr}.wa-h1{font-size:34px!important}.wa-actions a{flex:1 1 100%;justify-content:center}}`}</style>

      <header style={{ background: ANTHRACITE, color: '#fff' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '26px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_high_resolution_white.png" alt="Werner Immobilier" style={{ height: 52, width: 'auto', display: 'block' }} />
          <a href={telLien} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{tel}</a>
        </div>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '56px 20px 64px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: '#f7b07a' }}>Immobilier d’entreprise · Paris &amp; Hauts-de-Seine</p>
          <h1 className="wa-h1" style={{ margin: 0, fontSize: 48, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1.2, maxWidth: 720 }}>
            {'Le bon local, au bon endroit, '}<span style={{ boxShadow: `inset 0 -0.18em 0 ${ORANGE}` }}>au bon prix.</span>
          </h1>
          <p style={{ margin: '20px 0 0', fontSize: 17, lineHeight: 1.6, color: '#d9dadc', maxWidth: 640 }}>
            {'Commerçants, enseignes, propriétaires, investisseurs : Werner vous accompagne de la recherche à la signature, pour un bureau, une boutique, un restaurant ou un local d’activité.'}
          </p>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1040, margin: '0 auto', padding: '0 20px 56px', boxSizing: 'border-box' }}>
        <section style={{ marginTop: -28, background: '#fff', borderRadius: 18, border: '1px solid #ebebea', boxShadow: '0 12px 36px rgba(18,18,17,.08)', padding: '26px 26px 24px' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -.3 }}>Notre nouveau site arrive très bientôt.</h2>
          <p style={{ margin: '10px 0 20px', fontSize: 15.5, lineHeight: 1.6, color: PLUME }}>
            {'En attendant, Werner vous répond directement : un local à louer ou à céder, une recherche, une estimation.'}
          </p>
          <div className="wa-actions">
            <a href={telLien} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderRadius: 12, background: ANTHRACITE, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.2 3h3.1l1.5 3.9-2 1.3a13.4 13.4 0 0 0 6.9 6.9l1.3-2 3.9 1.5v3.1a1.9 1.9 0 0 1-2.1 1.9A17.6 17.6 0 0 1 3.1 5.1 1.9 1.9 0 0 1 5 3z" /></svg>
              {`Appeler le ${tel}`}
            </a>
            <a href={`mailto:${mail}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderRadius: 12, background: '#fff', color: ENCRE, border: `1.5px solid ${ORANGE}`, textDecoration: 'none', fontWeight: 700, fontSize: 15.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ORANGE_TEXTE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>
              {mail}
            </a>
          </div>
        </section>

        <section style={{ marginTop: 34 }}>
          <div className="wa-metiers">
            {METIERS.map(m => (
              <div key={m.t} style={{ background: '#fff', border: '1px solid #ebebea', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: ORANGE, flexShrink: 0 }} />
                  <b style={{ fontSize: 16, fontWeight: 800 }}>{m.t}</b>
                </div>
                <p style={{ margin: '6px 0 0 18px', fontSize: 14.5, lineHeight: 1.55, color: PLUME }}>{m.s}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={{ background: ANTHRACITE, color: '#aeb0b4', fontSize: 12.5, lineHeight: 1.7 }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '26px 20px' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{'Werner Immobilier · Immobilier d’entreprise · Paris & Hauts-de-Seine'}</div>
          <div style={{ marginTop: 6 }}>
            {`${id.societe}, ${id.forme}, ${id.siege}, ${id.rcs}. Carte professionnelle ${id.carte} (${id.carteMention.toLowerCase()}), délivrée par ${id.carteDelivree}. ${id.fonds === 'non' ? 'L’agence ne détient aucun fonds.' : ''}`}
          </div>
          <div style={{ marginTop: 16 }}><AccesApercu /></div>
        </div>
      </footer>
    </div>
  );
}
