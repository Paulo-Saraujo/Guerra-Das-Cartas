import type { Team } from '../game/types'
import { MAX_LIFE } from '../game/deck'

interface HeartsProps {
  team: Team
  life: number
}

const LIFE_PER_HEART = 5

// 10 corações; cada um vale 5 de vida. Preto para as Pretas, vermelho para as Vermelhas.
export default function Hearts({ team, life }: HeartsProps) {
  const total = MAX_LIFE / LIFE_PER_HEART
  return (
    <div className={`hearts hearts-${team}`} aria-label={`${life} de vida`}>
      {Array.from({ length: total }, (_, i) => {
        const state =
          life >= (i + 1) * LIFE_PER_HEART ? 'full' : life > i * LIFE_PER_HEART ? 'half' : 'empty'
        return (
          <span key={i} className={`heart ${state}`}>
            ♥
          </span>
        )
      })}
    </div>
  )
}
