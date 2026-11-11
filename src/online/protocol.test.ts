// Testes do modo online (sem internet): privacidade das cartas e validação de mensagens.
// Rodam junto com os outros: npx vitest run
import { describe, it, expect } from 'vitest'
import { createGame, playCard } from '../game/engine'
import { isGameState, isMessage, maskState, tryPlay } from './protocol'
import type { Card, GameState, Team } from '../game/types'

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('o que cada jogador pode ver', () => {
  it('o convidado vê a própria mão, mas não a do anfitrião nem a ordem dos baralhos', () => {
    const game = createGame('black', seeded(4))
    const view = maskState(game, 'red')
    const json = JSON.stringify(view)

    // a mão do convidado (Vermelhas) aparece de verdade
    expect(view.players.red.hand).toEqual(game.players.red.hand)

    // nenhuma carta escondida vaza no texto enviado
    const secret: Card[] = [...game.players.black.hand, ...game.players.black.deck, ...game.players.red.deck]
    for (const card of secret) {
      expect(json.includes(`"id":"${card.id}"`)).toBe(false)
    }

    // mas as quantidades continuam certas (para desenhar as cartas viradas e o baralho)
    expect(view.players.black.hand).toHaveLength(5)
    expect(view.players.black.deck).toHaveLength(21)
    expect(view.players.red.deck).toHaveLength(21)
  })

  it('não altera o jogo original', () => {
    const game = createGame('black', seeded(4))
    const before = JSON.stringify(game)
    maskState(game, 'red')
    expect(JSON.stringify(game)).toBe(before)
  })
})

describe('jogadas vindas do convidado', () => {
  it('só valem na vez dele e com uma carta da mão dele', () => {
    const game = createGame('black', seeded(9))
    const redCard = (game.players.red.hand[0] as Card).id
    expect(tryPlay(game, 'red', redCard)).toBeNull() // não é a vez das Vermelhas

    const afterBlack = tryPlay(game, 'black', (game.players.black.hand[0] as Card).id) as GameState
    expect(afterBlack.current).toBe('red')

    expect(tryPlay(afterBlack, 'red', 'carta-inventada')).toBeNull()
    expect(tryPlay(afterBlack, 'red', (afterBlack.players.red.hand[0] as Card).id)).not.toBeNull()
  })

  it('depois que alguém venceu, nada mais vale', () => {
    const game = createGame('black', seeded(9))
    game.winner = 'black'
    expect(tryPlay(game, 'black', (game.players.black.hand[0] as Card).id)).toBeNull()
  })
})

describe('validação de mensagens', () => {
  it('aceita mensagens corretas', () => {
    const game = createGame('black', seeded(2))
    expect(isMessage({ type: 'sync' })).toBe(true)
    expect(isMessage({ type: 'play', cardId: '7♠' })).toBe(true)
    expect(isMessage({ type: 'state', state: maskState(game, 'red') })).toBe(true)
    expect(isGameState(game)).toBe(true)
  })

  it('rejeita mensagens estranhas', () => {
    expect(isMessage(null)).toBe(false)
    expect(isMessage('oi')).toBe(false)
    expect(isMessage({ type: 'play' })).toBe(false)
    expect(isMessage({ type: 'play', cardId: 123 })).toBe(false)
    expect(isMessage({ type: 'state', state: {} })).toBe(false)
    expect(isMessage({ type: 'hack' })).toBe(false)
    const broken = createGame('black', seeded(2)) as unknown as { players: { red: { life: unknown } } }
    broken.players.red.life = 'muita'
    expect(isMessage({ type: 'state', state: broken })).toBe(false)
  })
})

describe('partidas online simuladas', () => {
  it('o convidado consegue jogar só com a versão filtrada, e o anfitrião aceita todas as jogadas', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed)
      let host: GameState = createGame(undefined, rng)
      let safety = 0
      while (!host.winner && safety < 2000) {
        const team: Team = host.current
        let cardId: string
        if (team === 'red') {
          // o convidado escolhe olhando APENAS o que recebeu
          const view = maskState(host, 'red')
          expect(view.players.red.hand).toEqual(host.players.red.hand)
          const hand = view.players.red.hand
          cardId = (hand[Math.floor(rng() * hand.length)] as Card).id
        } else {
          const hand = host.players.black.hand
          cardId = (hand[Math.floor(rng() * hand.length)] as Card).id
        }
        const next = tryPlay(host, team, cardId)
        expect(next).not.toBeNull()
        host = next as GameState
        safety++
      }
      expect(host.winner).not.toBeNull()
    }
  })
})

// garante que o import de playCard é usado (mesma função que o anfitrião usa por dentro)
describe('motor', () => {
  it('playCard continua disponível', () => {
    expect(typeof playCard).toBe('function')
  })
})
