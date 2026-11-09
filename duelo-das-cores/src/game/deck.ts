// Tudo sobre cartas e baralhos: criar, embaralhar, valores e constantes do jogo.

import type { Card, Rank, Suit, Team } from './types'

export const MAX_LIFE = 50
export const HAND_SIZE = 5
export const QUEEN_HEAL = 10

export const TEAM_NAME: Record<Team, string> = {
  black: 'Pretas',
  red: 'Vermelhas',
}

export const TEAM_SUITS: Record<Team, Suit[]> = {
  black: ['♠', '♣'],
  red: ['♥', '♦'],
}

// Do mais fraco para o mais forte. O Valete usa essa ordem (K, Q, J, 10 ... A).
export const RANK_ORDER: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]

export function otherTeam(team: Team): Team {
  return team === 'black' ? 'red' : 'black'
}

// Dano de uma carta numérica. Valete, Dama e Rei não causam dano direto (0).
export function cardValue(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 0
  return Number(rank)
}

export function cardStrength(card: Card): number {
  return RANK_ORDER.indexOf(card.rank)
}

export function cardLabel(card: Card): string {
  return `${card.rank}${card.suit}`
}

// Cria o baralho de 26 cartas de uma equipe (sem embaralhar).
export function createDeck(team: Team): Card[] {
  const cards: Card[] = []
  for (const suit of TEAM_SUITS[team]) {
    for (const rank of RANK_ORDER) {
      cards.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  return cards
}

// Embaralha (método Fisher-Yates) e devolve uma lista nova.
// "rng" é o sorteador; por padrão usa Math.random, mas nos testes usamos um fixo.
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = result[i] as T
    result[i] = result[j] as T
    result[j] = temp
  }
  return result
}
