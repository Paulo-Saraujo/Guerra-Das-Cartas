// Testes do computador. Rodam junto com os outros: npx vitest run
import { describe, it, expect } from 'vitest'
import { createGame, playCard } from './engine'
import { chooseCard } from './ai'
import type { Card, GameState, Rank, Suit, Team } from './types'

function card(rank: Rank, suit: Suit = '♥'): Card {
  return { id: `${rank}${suit}`, rank, suit }
}

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Situação em que as Vermelhas (computador) estão na vez, com a mão que escolhermos.
function redTurn(hand: Card[], opts: { redLife?: number; blackLife?: number; redLastDamage?: number } = {}): GameState {
  const state = createGame('red', seeded(1))
  state.players.red.hand = hand
  if (opts.redLife !== undefined) state.players.red.life = opts.redLife
  if (opts.blackLife !== undefined) state.players.black.life = opts.blackLife
  if (opts.redLastDamage !== undefined) state.players.red.lastDamage = opts.redLastDamage
  return state
}

describe('computador', () => {
  it('joga a carta que vence a partida quando existe', () => {
    const state = redTurn([card('3'), card('9'), card('Q'), card('2'), card('K')], { blackLife: 9 })
    expect(chooseCard(state, 'red', seeded(5))).toBe('9♥')
  })

  it('usa o Rei quando há muito dano para refletir', () => {
    const state = redTurn([card('K'), card('3', '♦'), card('2'), card('4', '♦'), card('5')], {
      redLife: 40,
      redLastDamage: 10,
    })
    expect(chooseCard(state, 'red', seeded(5))).toBe('K♥')
  })

  it('joga o Ás primeiro, porque depois dele joga-se de novo', () => {
    const state = redTurn([card('A'), card('9', '♦'), card('Q'), card('8'), card('2', '♦')])
    expect(chooseCard(state, 'red', seeded(5))).toBe('A♥')
  })

  it('mas a carta que vence a partida vem antes do Ás', () => {
    const state = redTurn([card('A'), card('9', '♦'), card('3'), card('8'), card('2', '♦')], { blackLife: 9 })
    expect(chooseCard(state, 'red', seeded(5))).toBe('9♦')
  })

  it('não gasta o Rei quando não há dano para refletir', () => {
    const state = redTurn([card('K'), card('2', '♦'), card('A'), card('3', '♦'), card('4')])
    expect(chooseCard(state, 'red', seeded(5))).not.toBe('K♥')
  })

  it('usa a Dama quando está com pouca vida', () => {
    const state = redTurn([card('Q'), card('8', '♦'), card('9'), card('10', '♦'), card('2')], {
      redLife: 10,
    })
    expect(chooseCard(state, 'red', seeded(5))).toBe('Q♥')
  })

  it('não gasta a Dama com a vida cheia', () => {
    const state = redTurn([card('Q'), card('8', '♦'), card('2'), card('3', '♦'), card('4')])
    expect(chooseCard(state, 'red', seeded(5))).toBe('8♦')
  })

  it('devolve null com a mão vazia e sempre uma carta que está na mão', () => {
    const empty = redTurn([])
    expect(chooseCard(empty, 'red')).toBeNull()

    for (let seed = 1; seed <= 100; seed++) {
      const state = createGame('red', seeded(seed))
      const id = chooseCard(state, 'red', seeded(seed + 1000))
      expect(state.players.red.hand.some((c) => c.id === id)).toBe(true)
    }
  })
})

describe('partidas do computador', () => {
  it('computador contra computador sempre termina', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed)
      let game = createGame(undefined, rng)
      let safety = 0
      while (!game.winner && safety < 2000) {
        const id = chooseCard(game, game.current, rng)
        if (!id) break
        game = playCard(game, id, rng)
        safety++
      }
      expect(game.winner).not.toBeNull()
    }
  })

  it('o computador ganha da escolha aleatória na grande maioria das partidas', () => {
    let wins = 0
    const games = 200
    for (let seed = 1; seed <= games; seed++) {
      const rng = seeded(seed * 7)
      const smart: Team = seed % 2 === 0 ? 'red' : 'black'
      let game = createGame(undefined, rng)
      let safety = 0
      while (!game.winner && safety < 2000) {
        let id: string | null
        if (game.current === smart) {
          id = chooseCard(game, smart, rng)
        } else {
          const hand = game.players[game.current].hand
          id = (hand[Math.floor(rng() * hand.length)] as Card).id
        }
        if (!id) break
        game = playCard(game, id, rng)
        safety++
      }
      if (game.winner === smart) wins++
    }
    expect(wins).toBeGreaterThan(games * 0.7)
  })
})
