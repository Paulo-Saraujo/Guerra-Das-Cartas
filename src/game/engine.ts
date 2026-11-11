// As regras do Duelo das Cores. Não tem nada de visual aqui: só lógica.
// A tela (React) vai apenas chamar createGame() e playCard().

import type { Card, EffectType, GameState, LogEntry, Player, Team } from './types'
import {
  HAND_SIZE,
  MAX_LIFE,
  QUEEN_HEAL,
  TEAM_NAME,
  cardLabel,
  cardStrength,
  cardValue,
  createDeck,
  otherTeam,
  shuffle,
} from './deck'

type Rng = () => number

// Compra cartas até a mão ter 5. Se o baralho acabar, embaralha o descarte e volta a comprar.
function refillHand(player: Player, rng: Rng): void {
  while (player.hand.length < HAND_SIZE) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) return
      player.deck = shuffle(player.discard, rng)
      player.discard = []
    }
    const card = player.deck.shift()
    if (card) player.hand.push(card)
  }
}

function createPlayer(team: Team, rng: Rng): Player {
  const player: Player = {
    team,
    life: MAX_LIFE,
    hand: [],
    deck: shuffle(createDeck(team), rng),
    discard: [],
    lastDamage: 0,
  }
  refillHand(player, rng)
  return player
}

// Começa uma partida nova. Se "startingTeam" não for informado, sorteia quem começa.
export function createGame(startingTeam?: Team, rng: Rng = Math.random): GameState {
  const first: Team = startingTeam ?? (rng() < 0.5 ? 'black' : 'red')
  return {
    players: {
      black: createPlayer('black', rng),
      red: createPlayer('red', rng),
    },
    current: first,
    turn: 1,
    winner: null,
    log: [],
  }
}

// Joga uma carta da mão de quem está na vez e devolve o NOVO estado do jogo.
// Se a jogada for inválida (jogo acabou ou carta não está na mão), devolve o estado sem mudar nada.
export function playCard(state: GameState, cardId: string, rng: Rng = Math.random): GameState {
  if (state.winner) return state

  const handIndex = state.players[state.current].hand.findIndex((c) => c.id === cardId)
  if (handIndex === -1) return state

  // Trabalhamos numa cópia para nunca estragar o estado anterior.
  const next = structuredClone(state)
  const team = next.current
  const me = next.players[team]
  const foe = next.players[otherTeam(team)]
  const foeName = TEAM_NAME[otherTeam(team)]

  const [card] = me.hand.splice(handIndex, 1) as [Card]
  me.discard.push(card)

  let effect: EffectType = 'none'
  let amount = 0
  let discarded: Card | null = null
  let result = ''

  if (card.rank === 'Q') {
    // Dama: cura 10, sem passar do máximo.
    amount = Math.min(QUEEN_HEAL, MAX_LIFE - me.life)
    me.life += amount
    effect = 'heal'
    result = amount > 0 ? `recuperaram ${amount} de vida` : 'já estavam com a vida cheia'
  } else if (card.rank === 'J') {
    // Valete: a carta mais forte da mão adversária vai para o fundo do baralho dele.
    if (foe.hand.length === 0) {
      result = 'mas a mão adversária estava vazia'
    } else {
      let strongest = 0
      foe.hand.forEach((c, i) => {
        if (cardStrength(c) > cardStrength(foe.hand[strongest] as Card)) strongest = i
      })
      discarded = foe.hand.splice(strongest, 1)[0] as Card
      foe.deck.push(discarded)
      effect = 'discard'
      result = `${foeName} perderam ${cardLabel(discarded)} para o fundo do baralho`
    }
  } else if (card.rank === 'K') {
    // Rei: devolve o último dano recebido e cura esse mesmo valor.
    const reflected = me.lastDamage
    if (reflected === 0) {
      result = 'mas não havia dano para refletir'
    } else {
      const healed = Math.min(reflected, MAX_LIFE - me.life)
      me.life += healed
      me.lastDamage = 0
      foe.life = Math.max(0, foe.life - reflected)
      foe.lastDamage = reflected
      amount = reflected
      effect = 'reflect'
      result = `refletiram ${reflected} de dano (+${healed} de vida)`
    }
  } else {
    // Carta numérica (Ás a 10): causa dano igual ao valor. (O Ás ainda ganha uma jogada extra, mais abaixo.)
    amount = cardValue(card.rank)
    foe.life = Math.max(0, foe.life - amount)
    foe.lastDamage = amount
    effect = 'damage'
    result = `${amount} de dano nas ${foeName}`
  }

  // Ás Veloz: depois de um Ás que não venceu a partida, quem jogou joga de novo.
  const extra = card.rank === 'A' && foe.life > 0
  if (extra) result += ' e jogam de novo'

  const entry: LogEntry = {
    turn: state.turn,
    team,
    card,
    effect,
    amount,
    discarded,
    extra,
    text: `${TEAM_NAME[team]} jogaram ${cardLabel(card)}: ${result}`,
  }
  next.log.push(entry)

  if (foe.life <= 0) {
    next.winner = team // a partida acaba; o contador de turnos fica no último turno jogado
    return next
  }

  refillHand(me, rng)
  if (extra) {
    next.turn += 1 // a vez continua com quem jogou o Ás
    return next
  }
  next.current = otherTeam(team)
  next.turn += 1
  return next
}
