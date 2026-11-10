// A "cabeça" do computador: escolhe qual carta jogar.
// Ele só olha a própria mão e os números da mesa (vida e último dano). Não espia a mão do adversário.

import type { Card, GameState, Team } from './types'
import { MAX_LIFE, QUEEN_HEAL, cardValue, otherTeam } from './deck'

// Dá uma nota para cada carta; o computador joga a de maior nota.
function scoreCard(card: Card, state: GameState, team: Team): number {
  const me = state.players[team]
  const foe = state.players[otherTeam(team)]

  switch (card.rank) {
    case 'Q': {
      // Dama: vale a pena quando falta vida; fica ainda mais urgente com vida baixa.
      const heal = Math.min(QUEEN_HEAL, MAX_LIFE - me.life)
      if (heal === 0) return -5
      let score = heal * (me.life <= 35 ? 1.2 : 0.5)
      if (me.life <= 15) score += 10
      return score
    }
    case 'K': {
      // Rei: só serve se houve dano para refletir. Se mata o adversário, é a jogada certa.
      if (me.lastDamage === 0) return -5
      if (me.lastDamage >= foe.life) return 1000
      const heal = Math.min(me.lastDamage, MAX_LIFE - me.life)
      return me.lastDamage + heal
    }
    case 'J':
      // Valete: bom, mas só quando não há ataque melhor.
      return 4
    default: {
      // Carta numérica: se mata o adversário, joga na hora; senão, quanto mais dano, melhor.
      const damage = cardValue(card.rank)
      return damage >= foe.life ? 1000 : damage
    }
  }
}

// Devolve o id da carta escolhida (ou null se a mão estiver vazia).
// O sorteio só desempata cartas com a mesma nota (o ruído é menor que 1 ponto).
export function chooseCard(
  state: GameState,
  team: Team,
  rng: () => number = Math.random,
): string | null {
  let best: Card | null = null
  let bestScore = -Infinity

  for (const card of state.players[team].hand) {
    const score = scoreCard(card, state, team) + rng() * 0.9
    if (score > bestScore) {
      best = card
      bestScore = score
    }
  }

  return best ? best.id : null
}
