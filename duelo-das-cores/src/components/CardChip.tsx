import type { Card } from '../game/types'
import { cardLabel } from '../game/deck'

// Uma carta "em miniatura" (ex.: 7♠), usada no histórico e na tela de resultado.
export default function CardChip({ card }: { card: Card }) {
  const color = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'
  return <span className={`chip chip-${color}`}>{cardLabel(card)}</span>
}
