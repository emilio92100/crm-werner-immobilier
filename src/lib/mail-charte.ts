/* La charte des mails (V3.118) : les couleurs de Werner Immobilier
   (anthracite et orange, AGENTS.md §5), la police, et le logo Werner en
   tête de chaque mail. Alexandre : « il faut vraiment que les mails soient
   jolis, toujours avec le logo ».

   Les grands mails (envoi de biens, bienvenue, point automatique) ont leur
   propre mise en page, en tableaux (send-mail, point-auto) : ils reprennent
   ces couleurs. Les mails courts (codes de signature, mandat, alertes
   internes, partage d'un local…) passent par `enveloppeMail` : la bande
   anthracite au logo, un filet orange, le titre, puis le texte. */

export const MAIL = {
  marque: '#2e3034', marqueFonce: '#2a2927', encre: '#232528',
  texte: '#363533', plume: '#5B6B80', plumeClair: '#aba7a3',
  or: '#f08c42', orTexte: '#c2621c', orClair: '#f7b07a', orFond: '#FFF6EC', orTrait: '#F7D5B0',
  fond: '#f6f6f7', fondPage: '#efeeed', trait: '#eeeeed', traitFort: '#e5e4e3',
};

/* Plus Jakarta Sans, la police du site, là où la messagerie sait la charger
   (Apple Mail, iPhone) ; sinon les polices du système, très proches. */
export const POLICE_MAIL = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const LIEN_POLICE_MAIL = '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap" rel="stylesheet" />';

/* Le logo blanc, posé sur la bande anthracite.
   V3.198 — Les images des mails (logo, icônes) se chargent depuis le domaine
   de Werner, celui qui envoie, plutôt que depuis l'adresse technique du CRM
   (…vercel.app) : un domaine partagé par beaucoup de sites, dont les filtres
   anti-spam se méfient. NEXT_PUBLIC_MAIL_IMAGES_URL le dira quand l'espace
   aura son domaine ; en attendant, les images viennent du CRM.
   22 octobre 2026 : seules les adresses de CE projet Vercel servent ces
   images (vérifié : crm., espace. et l'adresse vercel.app). Le site
   wernerimmobilier.com est un autre projet, sans elles : une variable qui y
   pointerait casserait le logo de tous les mails. Elle n'est donc suivie que
   si elle désigne une de ces adresses ; sinon, crm.wernerimmobilier.com. */
const IMAGES_BRUT = (process.env.NEXT_PUBLIC_MAIL_IMAGES_URL || '').trim().replace(/\/+$/, '');
export const IMAGES_MAIL = /^https:\/\/(?:(?:crm|espace)\.wernerimmobilier\.com|crm-werner-immobilier\.vercel\.app)$/i.test(IMAGES_BRUT)
  ? IMAGES_BRUT : 'https://crm.wernerimmobilier.com';
export const LOGO_BLANC_MAIL = `${IMAGES_MAIL}/logo_high_resolution_white.png`;

/* La hauteur du logo dans les en-têtes : `grand` pour les mails illustrés
   (sélection, bienvenue, point automatique…), `court` pour les mails courts.
   Le logo provisoire (outils/logos-werner.py) n'occupe que la moitié de son
   cadre de 2625 × 1101 : à 34 px de haut, « WERNER » ne faisait que 9 px et
   se lisait mal. Le cadre transparent fait office de marge : les bandes ont
   moins de rembourrage. Quand le vrai logo arrivera (mêmes dimensions),
   revoir ces deux valeurs s'il remplit mieux son cadre. */
export const LOGO_MAIL = { grand: 52, court: 44 };

/* Le logo en <img>, prêt à poser dans une bande anthracite. `mention` : un
   petit mot à droite (« CRM » pour les alertes envoyées à Werner). */
export function logoMail(mention = '', hauteur = LOGO_MAIL.court): string {
  const img = `<img src="${LOGO_BLANC_MAIL}" alt="Werner Immobilier" height="${hauteur}" style="height:${hauteur}px;width:auto;display:inline-block;vertical-align:middle;border:0;color:#ffffff;font-weight:800;font-size:15px;" />`;
  return mention
    ? `${img}<span style="display:inline-block;vertical-align:middle;margin-left:10px;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,.14);color:${MAIL.orClair};font-size:10px;font-weight:800;letter-spacing:1.5px;">${mention}</span>`
    : img;
}

/* L'enveloppe des mails courts. `titre` est déjà échappé par l'appelant. */
export function enveloppeMail(o: { titre?: string; corps: string; pied?: string; mention?: string }): string {
  return `<div style="font-family:${POLICE_MAIL};max-width:560px;margin:0 auto;color:${MAIL.texte};">
  <div style="background:${MAIL.marque};padding:12px 22px 16px;border-radius:14px 14px 0 0;border-bottom:3px solid ${MAIL.or};">
    ${logoMail(o.mention || '')}
    ${o.titre ? `<div style="color:#ffffff;font-weight:800;font-size:18px;line-height:1.3;margin-top:4px;">${o.titre}</div>` : ''}
  </div>
  <div style="background:#ffffff;border:1px solid ${MAIL.trait};border-top:none;border-radius:0 0 14px 14px;padding:20px 22px;font-size:14.5px;line-height:1.65;color:${MAIL.texte};">
    ${o.corps}
    ${o.pied ? `<div style="margin-top:18px;font-size:12px;color:${MAIL.plumeClair};">${o.pied}</div>` : ''}
  </div>
</div>`;
}
