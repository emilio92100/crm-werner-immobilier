/* ═══ Les appels à l'IA : les modèles 5.5 (23 octobre 2026) ═══════════════
   Haiku 5.5 et Sonnet 5.5 réfléchissent d'office (« adaptive thinking ») :
   la réponse peut commencer par des blocs `thinking`, et ces jetons-là
   comptent dans `max_tokens`. Pour une lecture, une reformulation ou une
   rédaction courte, on n'en veut pas : réflexion coupée (Haiku) ou réduite
   au minimum (Sonnet, « between_tools »), effort bas — comme Haiku 4.5, qui
   ne réfléchissait pas. Et le texte se lit par TYPE de bloc, jamais au
   premier bloc (src : « Claude Haiku 5.5 migration guide »).

   Les appels qui forcent un outil (`tool_choice` nommé : la relecture du
   rapprochement, l'analyse d'un bien) n'ont pas de bloc de réflexion : ils
   n'ont besoin que d'un peu plus de place (le découpage en jetons compte
   environ 30 % de plus qu'avant). */

/** Les réglages d'un appel simple, selon le modèle. */
export function reglagesSimples(modele: string): Record<string, unknown> {
  if (modele.startsWith('claude-haiku-5')) return { thinking: { type: 'disabled' }, output_config: { effort: 'low' } };
  if (modele.startsWith('claude-sonnet-5')) return { thinking: { type: 'between_tools' }, output_config: { effort: 'low' } };
  return {};
}

/** Le texte d'une réponse : ses blocs `text`, dans l'ordre (les blocs de réflexion sont ignorés). */
export function texteReponse(data: unknown): string {
  const c = (data && typeof data === 'object' ? (data as { content?: unknown }).content : null);
  return (Array.isArray(c) ? c : [])
    .filter((b): b is { type: string; text: string } => !!b && typeof b === 'object' && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string')
    .map(b => b.text).join('').trim();
}
