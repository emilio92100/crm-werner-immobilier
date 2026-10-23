'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { appelAcces } from '@/components/acces/connexion';
import { Carte, Hero, Ico, Note, Pastille, Tuiles, fr, initiales, styles as p } from './ParamUI';

/* ═══ Paramètres › Sécurité : ton compte et ton mot de passe (22 octobre 2026) ═══
   Le compte de Werner est le sien (premier accès, src/lib/acces-serveur.ts).
   Ici, il change son mot de passe sans passer par Supabase.

   Le mot de passe actuel est d'abord vérifié (une connexion Supabase avec
   lui : ratée, elle ne touche pas à la session ouverte) : un ordinateur
   laissé ouvert ne suffit pas pour changer le mot de passe. Puis
   `auth.updateUser`. Chaque refus est dit en français.

   23 octobre 2026 — Alexandre : « mot de passe actuel oublié, réinitialise-le,
   et faut pas que mon nom soit affiché ». Le mot de passe oublié se règle
   d'ici, par le même mail que l'écran de connexion (`appelAcces('oubli')`,
   un lien valable une heure, la page /mot-de-passe) : plus personne à
   prévenir. */

const MIN = 8;

/* La force, en quatre traits : la longueur d'abord, puis le mélange. */
function force(m: string): number {
  if (!m) return 0;
  let n = m.length >= MIN ? 1 : 0;
  if (m.length >= 12) n++;
  if (/[a-zà-ÿ]/i.test(m) && /\d/.test(m)) n++;
  if (/[^a-zà-ÿ0-9]/i.test(m) || m.length >= 16) n++;
  return Math.min(4, n);
}
const FORCE_LIB = ['', 'Correct', 'Bien', 'Solide', 'Très solide'];

export default function ParamSecurite() {
  const [mail, setMail] = useState<string | null>(null);
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [encore, setEncore] = useState('');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState(false);
  /* Le mot de passe oublié : fermé, ouvert (confirmer l'envoi), parti. */
  const [oubli, setOubli] = useState<'' | 'ouvert' | 'envoi' | 'parti'>('');
  const [erreurOubli, setErreurOubli] = useState('');

  useEffect(() => {
    let vivant = true;
    supabase.auth.getUser().then(({ data }) => { if (vivant) setMail(data.user?.email || ''); });
    return () => { vivant = false; };
  }, []);

  const tropCourt = nouveau.length > 0 && nouveau.length < MIN;
  const different = encore.length > 0 && encore !== nouveau;
  const pret = !!mail && actuel.length > 0 && nouveau.length >= MIN && encore === nouveau && !envoi;
  const f = force(nouveau);

  async function changer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || !mail) return;
    setEnvoi(true); setErreur(''); setFait(false);
    try {
      if (nouveau === actuel) { setErreur('Le nouveau mot de passe est le même que l’actuel : choisis-en un autre.'); return; }
      const v = await supabase.auth.signInWithPassword({ email: mail, password: actuel });
      if (v.error || !v.data?.session) {
        setErreur(/invalid login/i.test(v.error?.message || '')
          ? 'Ton mot de passe actuel n’est pas le bon. Rien n’a changé. Tu l’as oublié ? Clique sur « Réinitialise-le », juste en dessous.'
          : `Vérification impossible : ${v.error?.message || 'réessaie dans un instant'}. Rien n’a changé.`);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nouveau, current_password: actuel });
      if (error) {
        const m = error.message || '';
        setErreur(/same|different from the old/i.test(m) ? 'Le nouveau mot de passe est le même que l’actuel : choisis-en un autre.'
          : /weak|short|characters/i.test(m) ? `Ce mot de passe est trop simple : allonge-le, mélange lettres et chiffres. (${m})`
          : /reauth|nonce/i.test(m) ? 'Pour ta sécurité, une connexion récente est demandée : déconnecte-toi, reconnecte-toi, puis recommence.'
          : `Le mot de passe n’a pas pu être changé : ${m}. L’ancien reste valable.`);
        return;
      }
      setActuel(''); setNouveau(''); setEncore(''); setVoir(false); setFait(true);
    } catch {
      setErreur('Erreur réseau : le mot de passe n’a pas été changé. Réessaie dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyerLien() {
    if (!mail || oubli === 'envoi') return;
    setOubli('envoi'); setErreurOubli('');
    const r = await appelAcces('oubli', { mail });
    if (!r.ok) { setOubli('ouvert'); setErreurOubli(r.error || 'Le mail n’a pas pu partir. Réessaie dans un instant.'); return; }
    setOubli('parti');
  }

  const type = voir ? 'text' : 'password';
  const effacer = () => { setErreur(''); setFait(false); };
  const oeil = (
    <button type="button" className={p.oeil} onClick={() => setVoir(v => !v)} aria-label={voir ? 'Cacher les mots de passe' : 'Afficher les mots de passe'} title={voir ? 'Cacher' : 'Afficher'}>
      <Ico n={voir ? 'oeilBarre' : 'oeil'} t={17} />
    </button>
  );

  return (
    <div className={p.rubrique}>
      <Hero ic="cadenas" titre="Sécurité"
        texte={fr('Ton compte et ton mot de passe. Toi seul le connais : il n’est écrit nulle part en clair, pas même dans la base.')}
        droite={mail ? <Pastille ton="vert">Connecté</Pastille> : undefined} />

      {/* Le compte */}
      <Carte ic="personne" titre="Ton compte" sous="L’adresse avec laquelle tu te connectes au CRM.">
        {mail === null ? <div className={p.aideChamp}>Lecture de ton compte…</div>
          : mail ? (
            <div className={p.compte}>
              <span className={p.compteAvatar}>{initiales(mail.split('@')[0])}</span>
              <div className={p.compteTx}>
                <b>{mail}</b>
                <span>{fr('Ton identifiant de connexion. C’est aussi là qu’arrive le lien si tu oublies ton mot de passe.')}</span>
              </div>
            </div>
          ) : <Note ton="erreur">{'Ton compte n’a pas pu être lu : recharge la page.'}</Note>}
      </Carte>

      {/* Le mot de passe */}
      <form onSubmit={changer}>
        <Carte ic="cle" titre="Changer mon mot de passe"
          sous={fr(`${MIN} caractères au moins. Une phrase courte que toi seul connais se retient mieux qu’un mot compliqué.`)}>
          <div className={p.champs} style={{ maxWidth: 620 }}>
            <label className={`${p.champ} ${p.champLarge}`} style={{ maxWidth: 300 }}>
              <span>Mot de passe actuel</span>
              <span className={p.inputMot}>
                <input className={p.input} type={type} autoComplete="current-password" value={actuel}
                  onChange={e => { setActuel(e.target.value); effacer(); }} />
                {oeil}
              </span>
            </label>
            <label className={p.champ}>
              <span>Nouveau mot de passe</span>
              <span className={p.inputMot}>
                <input className={p.input} type={type} autoComplete="new-password" value={nouveau}
                  onChange={e => { setNouveau(e.target.value); effacer(); }} />
                {oeil}
              </span>
              <span className={p.jauge} aria-hidden="true">
                {[1, 2, 3, 4].map(i => <i key={i} data-on={i <= f ? (f >= 3 ? 'ok' : '') : undefined} />)}
              </span>
              <span className={`${p.aideChamp} ${tropCourt ? p.aideChampAttention : ''}`}>
                {tropCourt ? `Encore ${MIN - nouveau.length} caractère${MIN - nouveau.length > 1 ? 's' : ''} au moins.` : nouveau ? FORCE_LIB[f] : `${MIN} caractères au moins`}
              </span>
            </label>
            <label className={p.champ}>
              <span>Le nouveau, une deuxième fois</span>
              <span className={p.inputMot}>
                <input className={p.input} type={type} autoComplete="new-password" value={encore}
                  onChange={e => { setEncore(e.target.value); effacer(); }} />
                {oeil}
              </span>
              <span className={`${p.aideChamp} ${different ? p.aideChampAttention : ''}`}>
                {different ? 'Les deux ne sont pas pareils.' : encore && encore === nouveau ? 'Les deux sont pareils.' : 'Pour éviter une faute de frappe.'}
              </span>
            </label>
          </div>

          {erreur && <div style={{ marginTop: 14, maxWidth: 620 }}><Note ton="erreur">{fr(erreur)}</Note></div>}
          {fait && <div style={{ marginTop: 14, maxWidth: 620 }} role="status"><Note ton="ok">{fr('C’est fait. La prochaine fois, connecte-toi avec ce nouveau mot de passe.')}</Note></div>}

          <div className={p.actions}>
            <button type="submit" className={`${p.btn} ${p.btnFonce}`} disabled={!pret}>
              <Ico n="cle" t={16} />{envoi ? 'Changement…' : 'Changer mon mot de passe'}
            </button>
            {oubli === '' && (
              <span style={{ fontSize: 13, color: '#71717a' }}>
                {'Mot de passe actuel oublié ?'}{' '}
                <button type="button" className={p.lien} onClick={() => { setOubli('ouvert'); setErreurOubli(''); }} disabled={!mail}>Réinitialise-le</button>
              </span>
            )}
          </div>

          {/* Le mot de passe oublié, sur place */}
          {(oubli === 'ouvert' || oubli === 'envoi') && mail && (
            <div className={p.oubli}>
              <span className={p.oubliIc}><Ico n="mail" t={19} /></span>
              <div className={p.oubliTx}>
                <b>{'Réinitialiser mon mot de passe'}</b>
                <p>{fr('Tu reçois un mail « Réinitialiser votre mot de passe » à ')}<b>{mail}</b>{fr(' : clique sur son bouton, puis choisis ton nouveau mot de passe deux fois. Le lien est valable une heure. Ton mot de passe actuel reste valable tant que tu n’as pas choisi le nouveau.')}</p>
                {erreurOubli && <div style={{ marginTop: 10 }}><Note ton="erreur">{erreurOubli}</Note></div>}
                <div className={p.boutons} style={{ marginTop: 12 }}>
                  <button type="button" className={`${p.btn} ${p.btnOr}`} onClick={() => { void envoyerLien(); }} disabled={oubli === 'envoi'}>
                    <Ico n="avion" t={15} />{oubli === 'envoi' ? 'Envoi…' : 'Recevoir le lien'}
                  </button>
                  <button type="button" className={p.btn} onClick={() => setOubli('')} disabled={oubli === 'envoi'}>Annuler</button>
                </div>
              </div>
            </div>
          )}
          {oubli === 'parti' && mail && (
            <div className={`${p.oubli} ${p.oubliOk}`} role="status">
              <span className={p.oubliIc}><Ico n="check" t={19} e={2.4} /></span>
              <div className={p.oubliTx}>
                <b>{'Le mail est parti'}</b>
                <p>{'Regarde ta boîte '}<b>{mail}</b>{fr(' (et les courriers indésirables). Le lien est valable une heure.')}</p>
                <div className={p.boutons} style={{ marginTop: 10 }}>
                  <button type="button" className={p.lien} onClick={() => { setOubli('ouvert'); setErreurOubli(''); }}>Renvoyer le mail</button>
                </div>
              </div>
            </div>
          )}
        </Carte>
      </form>

      {/* La protection des données */}
      <Carte ic="bouclier" titre="Comment tes données sont protégées" sous="Ce qui tient ton CRM à l’abri, sans rien à régler de ton côté.">
        <Tuiles items={[
          { ic: 'serveur', t: 'Tes données sont chez Supabase, chiffrées (AES-256).', ton: 'oui' },
          { ic: 'globe', t: 'Connexion chiffrée (HTTPS) uniquement.', ton: 'oui' },
          { ic: 'cadenas', t: 'Base fermée : sans ton compte, rien ne se lit.', ton: 'oui' },
          { ic: 'ecran', t: 'Hébergé sur Vercel, une infrastructure sécurisée.', ton: 'oui' },
          { ic: 'groupe', t: 'Aucune donnée revendue : seuls les services du CRM (mails, IA) en voient le nécessaire.', ton: 'oui' },
          { ic: 'attention', t: 'Sur un ordinateur partagé, pense à te déconnecter.', ton: 'neutre' },
        ]} />
      </Carte>
    </div>
  );
}
