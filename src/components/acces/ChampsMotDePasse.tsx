'use client';
import a from './Acces.module.css';

/* Le nouveau mot de passe, deux fois, avec ce qui manque dit tout de suite
   (premier accès et mot de passe oublié). Au niveau du module : l'<input> ne
   perd pas le focus à chaque lettre (AGENTS.md §2.4). */

export const MDP_MIN = 8;
export const mdpValide = (mdp: string, encore: string) => mdp.length >= MDP_MIN && mdp === encore;

export default function ChampsMotDePasse({ mdp, encore, voir, onMdp, onEncore, onVoir }: {
  mdp: string; encore: string; voir: boolean;
  onMdp: (v: string) => void; onEncore: (v: string) => void; onVoir: (v: boolean) => void;
}) {
  const manque = MDP_MIN - mdp.length;
  return (
    <>
      <div className={a.bloc}>
        <label className={a.etiquette} htmlFor="mdp-1">Votre mot de passe</label>
        <input id="mdp-1" className={a.champ} type={voir ? 'text' : 'password'} autoComplete="new-password" value={mdp} onChange={e => onMdp(e.target.value)} />
        {mdp.length > 0 && manque > 0
          ? <p className={a.aide}>{`Encore ${manque} caractère${manque > 1 ? 's' : ''} au moins.`}</p>
          : mdp.length === 0
            ? <p className={a.note}>{`${MDP_MIN} caractères au moins. Une courte phrase que vous seul connaissez se retient mieux qu’un mot compliqué.`}</p>
            : <p className={a.aide} data-ton="ok">{'Longueur suffisante.'}</p>}
      </div>
      <div className={a.bloc}>
        <label className={a.etiquette} htmlFor="mdp-2">Répétez votre mot de passe</label>
        <input id="mdp-2" className={a.champ} type={voir ? 'text' : 'password'} autoComplete="new-password" value={encore} onChange={e => onEncore(e.target.value)} />
        {encore.length > 0 && (encore === mdp
          ? <p className={a.aide} data-ton="ok">{'Les deux sont identiques.'}</p>
          : <p className={a.aide}>{'Les deux ne sont pas identiques.'}</p>)}
      </div>
      <label className={a.voir}>
        <input type="checkbox" checked={voir} onChange={e => onVoir(e.target.checked)} />
        <span>Afficher le mot de passe</span>
      </label>
    </>
  );
}
