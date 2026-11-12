// Testes automáticos das regras. Rodam com: npx vitest run
import { describe, it, expect } from 'vitest'
import { createGame, nextGame, playCard, resetScore } from './engine'
import { createDeck, shuffle, cardStrength } from './deck'
import type { Card, GameState, Rank, Suit, Team } from './types'

function card(rank: Rank, suit: Suit = '♠'): Card {
  return { id: `${rank}${suit}`, rank, suit }
}

// Sorteador previsível (sempre dá a mesma sequência), para os testes serem repetíveis.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Monta uma situação específica: as Pretas começam, com as mãos que escolhermos.
function setup(opts: {
  blackHand?: Card[]
  redHand?: Card[]
  blackLife?: number
  redLife?: number
  blackLastDamage?: number
}): GameState {
  const state = createGame('black', seeded(1))
  if (opts.blackHand) state.players.black.hand = opts.blackHand
  if (opts.redHand) state.players.red.hand = opts.redHand
  if (opts.blackLife !== undefined) state.players.black.life = opts.blackLife
  if (opts.redLife !== undefined) state.players.red.life = opts.redLife
  if (opts.blackLastDamage !== undefined) state.players.black.lastDamage = opts.blackLastDamage
  return state
}

describe('baralho', () => {
  it('cada equipe tem 26 cartas dos naipes certos', () => {
    const black = createDeck('black')
    const red = createDeck('red')
    expect(black).toHaveLength(26)
    expect(red).toHaveLength(26)
    expect(black.every((c) => c.suit === '♠' || c.suit === '♣')).toBe(true)
    expect(red.every((c) => c.suit === '♥' || c.suit === '♦')).toBe(true)
  })

  it('embaralhar mantém as mesmas cartas', () => {
    const original = createDeck('black')
    const mixed = shuffle(original, seeded(7))
    expect(mixed).toHaveLength(26)
    expect(new Set(mixed.map((c) => c.id)).size).toBe(26)
  })
})

describe('início da partida', () => {
  it('cada jogador começa com 50 de vida, 5 cartas na mão e 21 no baralho', () => {
    const game = createGame('black', seeded(3))
    for (const team of ['black', 'red'] as Team[]) {
      expect(game.players[team].life).toBe(50)
      expect(game.players[team].hand).toHaveLength(5)
      expect(game.players[team].deck).toHaveLength(21)
    }
    expect(game.current).toBe('black')
    expect(game.turn).toBe(1)
    expect(game.winner).toBeNull()
  })
})

describe('cartas numéricas', () => {
  it('causam dano igual ao valor, compram carta e passam a vez', () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')] })
    const after = playCard(game, '7♠', seeded(2))
    expect(after.players.red.life).toBe(43)
    expect(after.players.red.lastDamage).toBe(7)
    expect(after.players.black.hand).toHaveLength(5)
    expect(after.players.black.discard).toHaveLength(1)
    expect(after.current).toBe('red')
    expect(after.turn).toBe(2)
    expect(after.log).toHaveLength(1)
  })

  it('o Ás causa 1 de dano', () => {
    const game = setup({ blackHand: [card('A'), card('2'), card('3'), card('4'), card('5')] })
    expect(playCard(game, 'A♠', seeded(2)).players.red.life).toBe(49)
  })

  it('o 10 causa 10 de dano', () => {
    const game = setup({ blackHand: [card('10'), card('2'), card('3'), card('4'), card('5')] })
    expect(playCard(game, '10♠', seeded(2)).players.red.life).toBe(40)
  })
})

describe('Ás Veloz', () => {
  it('causa 1 de dano, repõe a mão e quem jogou continua na vez', () => {
    const game = setup({ blackHand: [card('A'), card('2'), card('3'), card('4'), card('5')] })
    const after = playCard(game, 'A♠', seeded(2))
    expect(after.players.red.life).toBe(49)
    expect(after.current).toBe('black')
    expect(after.turn).toBe(2)
    expect(after.players.black.hand).toHaveLength(5)
    expect(after.log[0]?.extra).toBe(true)
  })

  it('a jogada seguinte passa a vez normalmente', () => {
    const game = setup({ blackHand: [card('A'), card('2'), card('3'), card('4'), card('5')] })
    const afterAce = playCard(game, 'A♠', seeded(2))
    const next = afterAce.players.black.hand[0] as Card
    const after = playCard(afterAce, next.id, seeded(2))
    expect(after.current).toBe('red')
    expect(after.log[1]?.extra).toBe(false)
  })

  it('dois Ases seguidos dão duas jogadas extras', () => {
    const game = setup({ blackHand: [card('A', '♠'), card('A', '♣'), card('3'), card('4'), card('5')] })
    const one = playCard(game, 'A♠', seeded(2))
    const two = playCard(one, 'A♣', seeded(2))
    expect(two.current).toBe('black')
    expect(two.players.red.life).toBe(48)
    expect(two.log[1]?.extra).toBe(true)
  })

  it('se o Ás vence a partida, não há jogada extra', () => {
    const game = setup({ blackHand: [card('A'), card('2'), card('3'), card('4'), card('5')], redLife: 1 })
    const after = playCard(game, 'A♠', seeded(2))
    expect(after.winner).toBe('black')
    expect(after.log[0]?.extra).toBe(false)
    expect(after.turn).toBe(1)
  })

  it('o dano do Ás passa a ser o "último dano" do adversário (para o Rei dele)', () => {
    const game = setup({ blackHand: [card('A'), card('2'), card('3'), card('4'), card('5')] })
    game.players.red.lastDamage = 9
    expect(playCard(game, 'A♠', seeded(2)).players.red.lastDamage).toBe(1)
  })
})

describe('Dama', () => {
  it('cura 10 de vida', () => {
    const game = setup({ blackHand: [card('Q'), card('2'), card('3'), card('4'), card('5')], blackLife: 30 })
    expect(playCard(game, 'Q♠', seeded(2)).players.black.life).toBe(40)
  })

  it('não passa de 50 de vida', () => {
    const game = setup({ blackHand: [card('Q'), card('2'), card('3'), card('4'), card('5')], blackLife: 45 })
    expect(playCard(game, 'Q♠', seeded(2)).players.black.life).toBe(50)
  })
})

describe('Valete', () => {
  it('manda a carta mais forte da mão adversária para o fundo do baralho dele', () => {
    const game = setup({
      blackHand: [card('J'), card('2'), card('3'), card('4'), card('5')],
      redHand: [card('3', '♥'), card('Q', '♥'), card('10', '♦'), card('J', '♦'), card('2', '♥')],
    })
    const after = playCard(game, 'J♠', seeded(2))
    const red = after.players.red
    expect(red.hand).toHaveLength(4)
    expect(red.hand.some((c) => c.id === 'Q♥')).toBe(false)
    expect(red.deck[red.deck.length - 1]?.id).toBe('Q♥')
  })

  it('o Rei é mais forte que a Dama, que é mais forte que o Valete', () => {
    expect(cardStrength(card('K'))).toBeGreaterThan(cardStrength(card('Q')))
    expect(cardStrength(card('Q'))).toBeGreaterThan(cardStrength(card('J')))
    expect(cardStrength(card('J'))).toBeGreaterThan(cardStrength(card('10')))
    expect(cardStrength(card('2'))).toBeGreaterThan(cardStrength(card('A')))
  })
})

describe('Rei', () => {
  it('reflete o último dano: recupera a vida perdida e o adversário recebe o mesmo dano', () => {
    const game = setup({
      blackHand: [card('K'), card('2'), card('3'), card('4'), card('5')],
      blackLife: 43,
      blackLastDamage: 7,
    })
    const after = playCard(game, 'K♠', seeded(2))
    expect(after.players.black.life).toBe(50)
    expect(after.players.red.life).toBe(43)
    expect(after.players.black.lastDamage).toBe(0)
    expect(after.players.red.lastDamage).toBe(7)
  })

  it('sem dano recebido, não faz nada', () => {
    const game = setup({ blackHand: [card('K'), card('2'), card('3'), card('4'), card('5')] })
    const after = playCard(game, 'K♠', seeded(2))
    expect(after.players.black.life).toBe(50)
    expect(after.players.red.life).toBe(50)
  })
})

describe('fim da partida', () => {
  it('quando a vida do adversário chega a zero, o jogador vence e a partida trava', () => {
    const game = setup({
      blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')],
      redLife: 5,
    })
    const after = playCard(game, '7♠', seeded(2))
    expect(after.players.red.life).toBe(0)
    expect(after.winner).toBe('black')
    expect(after.turn).toBe(1)
    const again = playCard(after, '2♠', seeded(2))
    expect(again).toBe(after)
  })
})

describe('jogadas inválidas e segurança', () => {
  it('carta que não está na mão não faz nada', () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')] })
    expect(playCard(game, 'K♥', seeded(2))).toBe(game)
  })

  it('não altera o estado anterior', () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')] })
    playCard(game, '7♠', seeded(2))
    expect(game.players.red.life).toBe(50)
    expect(game.players.black.hand).toHaveLength(5)
    expect(game.log).toHaveLength(0)
  })
})

describe('compra e reembaralhamento', () => {
  it('quando o baralho acaba, o descarte é embaralhado e volta ao baralho', () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')] })
    game.players.black.deck = []
    game.players.black.discard = [card('6'), card('8'), card('9')]
    const after = playCard(game, '7♠', seeded(2))
    expect(after.players.black.hand).toHaveLength(5)
    // descarte (3) + a carta recém-jogada (1) foram embaralhados; 1 foi comprada, sobram 3
    expect(after.players.black.deck.length + after.players.black.discard.length).toBe(3)
  })
})

describe('placar', () => {
  const wonByBlack = () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')], redLife: 5 })
    return playCard(game, '7♠', seeded(2))
  }

  it('começa zerado', () => {
    expect(createGame('black', seeded(1)).score).toEqual({ black: 0, red: 0 })
  })

  it('quem vence ganha 1 ponto, e jogadas comuns não mudam o placar', () => {
    const game = setup({ blackHand: [card('7'), card('2'), card('3'), card('4'), card('5')] })
    expect(playCard(game, '7♠', seeded(2)).score).toEqual({ black: 0, red: 0 })
    expect(wonByBlack().score).toEqual({ black: 1, red: 0 })
  })

  it('depois da vitória, nada soma de novo', () => {
    const won = wonByBlack()
    expect(playCard(won, '2♠', seeded(2))).toBe(won)
    expect(won.score.black).toBe(1)
  })

  it('a partida seguinte começa limpa, mas guarda o placar', () => {
    const next = nextGame(wonByBlack(), seeded(4))
    expect(next.score).toEqual({ black: 1, red: 0 })
    expect(next.winner).toBeNull()
    expect(next.log).toHaveLength(0)
    expect(next.turn).toBe(1)
    expect(next.players.black.life).toBe(50)
    expect(next.players.red.life).toBe(50)
  })

  it('zerar o placar não altera o jogo original', () => {
    const won = wonByBlack()
    expect(resetScore(won).score).toEqual({ black: 0, red: 0 })
    expect(won.score.black).toBe(1)
  })

  it('uma série de 50 partidas soma exatamente 50 pontos', () => {
    const rng = seeded(11)
    let game = createGame(undefined, rng)
    for (let round = 1; round <= 50; round++) {
      let safety = 0
      while (!game.winner && safety < 3000) {
        const hand = game.players[game.current].hand
        game = playCard(game, (hand[Math.floor(rng() * hand.length)] as Card).id, rng)
        safety++
      }
      expect(game.winner).not.toBeNull()
      expect(game.score.black + game.score.red).toBe(round)
      if (round < 50) game = nextGame(game, rng)
    }
  })
})

describe('partidas completas', () => {
  it('200 partidas aleatórias terminam e nunca perdem nem duplicam cartas', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed)
      let game = createGame(undefined, rng)
      let safety = 0
      while (!game.winner && safety < 3000) {
        const hand = game.players[game.current].hand
        const pick = hand[Math.floor(rng() * hand.length)] as Card
        game = playCard(game, pick.id, rng)
        safety++

        for (const team of ['black', 'red'] as Team[]) {
          const p = game.players[team]
          const all = [...p.hand, ...p.deck, ...p.discard]
          expect(all).toHaveLength(26)
          expect(new Set(all.map((c) => c.id)).size).toBe(26)
          expect(p.life).toBeGreaterThanOrEqual(0)
          expect(p.life).toBeLessThanOrEqual(50)
        }
      }
      expect(game.winner).not.toBeNull()
    }
  })
})
