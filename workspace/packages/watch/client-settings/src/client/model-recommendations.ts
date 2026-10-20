import type { CatalogModel } from './binding-state.js'

/** Display recommendations only; the runtime catalogue and saved bindings stay intact. */
export function recommendedModels(
  provider: string,
  models: readonly CatalogModel[],
  selected: string,
): readonly CatalogModel[] {
  const direct = provider === 'minimax' || provider === 'minimax-cn'
  const router = provider === 'openrouter'
  const zen = provider === 'opencode'
  if (!direct && !router && !zen) return models

  const current = direct
    ? ['MiniMax-M3.1-Flash', 'MiniMax-M3']
    : router
      ? ['minimax/minimax-m3.1-flash:free', 'minimax/minimax-m3']
      : ['minimax-m3.1-flash-free', 'minimax-m3']
  const isMiniMaxText = (id: string): boolean => direct
    ? /^MiniMax-(?:M\d|Text-01$)/i.test(id)
    : router
      ? /^minimax\/(?:(?:minimax-)?m\d|minimax-01$)/i.test(id)
      : /^minimax-m\d/i.test(id)

  // Only advertise models the runtime already resolves. Unknown custom IDs and
  // other modalities survive; a saved legacy choice remains editable in place.
  const recommended = current.flatMap(id => models.filter(model => model.id === id))
  const remaining = models.filter(model => !current.includes(model.id)
    && (!isMiniMaxText(model.id) || model.id === selected))
  if (selected !== '' && !models.some(model => model.id === selected)) {
    remaining.push({ id: selected, name: `${selected} (saved selection)` })
  }
  return [...recommended, ...remaining]
}
