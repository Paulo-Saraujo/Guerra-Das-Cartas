import type { Card, Rank, Team } from '../game/types'

interface CardViewProps {
  card: Card
  onClick?: () => void
  disabled?: boolean
  back?: Team // se informado, a carta aparece virada, com o verso dessa equipe
}

// Posição dos símbolos nas cartas numéricas: [coluna (0 a 2), linha (0 a 6)].
// É o desenho clássico de baralho: 2 a 10 com os naipes distribuídos.
const PIP_LAYOUT: Partial<Record<Rank, [number, number][]>> = {
  '2': [[1, 0], [1, 6]],
  '3': [[1, 0], [1, 3], [1, 6]],
  '4': [[0, 0], [2, 0], [0, 6], [2, 6]],
  '5': [[0, 0], [2, 0], [1, 3], [0, 6], [2, 6]],
  '6': [[0, 0], [2, 0], [0, 3], [2, 3], [0, 6], [2, 6]],
  '7': [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [0, 6], [2, 6]],
  '8': [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [1, 4.5], [0, 6], [2, 6]],
  '9': [[0, 0], [2, 0], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4], [0, 6], [2, 6]],
  '10': [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4], [1, 5], [0, 6], [2, 6]],
}

const COLUMN_X = [34, 50, 66] // posição horizontal (%) de cada coluna

// Cartas especiais: um emblema e o nome do poder, para o público entender de longe.
const FACE_EMBLEM: Record<'J' | 'Q' | 'K', string> = { J: '♞', Q: '♛', K: '♚' }
const FACE_POWER: Record<'J' | 'Q' | 'K', string> = {
  J: 'DESCARTE',
  Q: '+10 VIDA',
  K: 'REFLETE',
}

function CardCenter({ card }: { card: Card }) {
  if (card.rank === 'A') {
    return <span className="center-suit">{card.suit}</span>
  }

  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    return (
      <span className="face-panel">
        <span className="face-emblem">{FACE_EMBLEM[card.rank]}</span>
        <span className="face-power">{FACE_POWER[card.rank]}</span>
      </span>
    )
  }

  const pips = PIP_LAYOUT[card.rank] ?? []
  return (
    <>
      {pips.map(([col, row], i) => (
        <span
          key={i}
          className={`pip${row > 3 ? ' flip' : ''}`}
          style={{ left: `${COLUMN_X[col]}%`, top: `${18 + row * (64 / 6)}%` }}
        >
          {card.suit}
        </span>
      ))}
    </>
  )
}

// Desenha uma carta de baralho: valor e naipe nos cantos e o desenho no centro.
export default function CardView({ card, onClick, disabled = false, back }: CardViewProps) {
  if (back) {
    return <div className={`card card-back card-back-${back}`} aria-label="Carta virada" />
  }

  const color = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'
  const interactive = Boolean(onClick) && !disabled

  return (
    <button
      type="button"
      className={`card card-${color}${interactive ? ' interactive' : ''}${disabled ? ' dim' : ''}`}
      onClick={onClick}
      disabled={!interactive}
      aria-label={`${card.rank} de ${card.suit}`}
    >
      <span className="corner top">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
      <CardCenter card={card} />
      <span className="corner bottom">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
    </button>
  )
}
