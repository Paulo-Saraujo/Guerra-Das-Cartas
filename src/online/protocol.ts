// O "idioma" que os dois jogadores usam para conversar no modo online,
// mais as regras de segurança: quem vê quais cartas e quais mensagens são aceitas.
//
// Como funciona: o ANFITRIÃO (Pretas) guarda o jogo de verdade e aplica as regras.
// O CONVIDADO (Vermelhas) só recebe uma versão "filtrada" do jogo, sem as cartas que não pode ver,
// e manda de volta apenas "quero jogar a carta tal".

import type { Card, GameState, Team } from '../game/types'
import { RANK_ORDER, TEAM_SUITS } from '../game/deck'
import { playCard } from '../game/engine'

export type Message =
  | { type: 'state'; state: GameState } // anfitrião -> convidado: o jogo atual
  | { type: 'play'; cardId: string } // convidado -> anfitrião: quero jogar esta carta
  | { type: 'sync' } // convidado -> anfitrião: me mande o jogo atual de novo
  | { type: 'rematch' } // convidado -> anfitrião: quero uma revanche

const TEAMS: Team[] = ['black', 'red']

// Carta "em branco" que ocupa o lugar de uma carta que o jogador não pode ver.
function hiddenCards(prefix: string, team: Team, count: number): Card[] {
  return Array.from({ length: count }, (_, i): Card => ({
    id: `hidden-${prefix}-${team}-${i}`,
    rank: 'A',
    suit: '♠',
  }))
}

// Devolve uma cópia do jogo como "viewer" pode vê-lo:
// a própria mão aparece, mas a mão do outro e a ordem de TODOS os baralhos ficam escondidas.
export function maskState(state: GameState, viewer: Team): GameState {
  const masked = structuredClone(state)
  for (const team of TEAMS) {
    const player = masked.players[team]
    player.deck = hiddenCards('deck', team, player.deck.length)
    if (team !== viewer) player.hand = hiddenCards('hand', team, player.hand.length)
  }
  return masked
}

// Aplica uma jogada pedida por "team", só se for mesmo a vez dele e a carta estiver na mão dele.
// Devolve o novo jogo, ou null se a jogada não vale.
export function tryPlay(state: GameState, team: Team, cardId: string): GameState | null {
  if (state.winner || state.current !== team) return null
  const next = playCard(state, cardId)
  return next === state ? null : next
}

// ---------- Validação do que chega pela internet ----------
// Nunca confiamos cegamente em dados de fora: se o formato estiver errado, a mensagem é ignorada.

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function isCard(x: unknown): x is Card {
  return (
    isRecord(x) &&
    typeof x.id === 'string' &&
    typeof x.rank === 'string' &&
    (RANK_ORDER as string[]).includes(x.rank) &&
    typeof x.suit === 'string' &&
    [...TEAM_SUITS.black, ...TEAM_SUITS.red].includes(x.suit as never)
  )
}

function isCardList(x: unknown): x is Card[] {
  return Array.isArray(x) && x.length <= 60 && x.every(isCard)
}

function isPlayer(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.life === 'number' &&
    typeof x.lastDamage === 'number' &&
    isCardList(x.hand) &&
    isCardList(x.deck) &&
    isCardList(x.discard)
  )
}

const EFFECTS = ['damage', 'heal', 'discard', 'reflect', 'none']

function isLogEntry(x: unknown): boolean {
  return (
    isRecord(x) &&
    typeof x.turn === 'number' &&
    TEAMS.includes(x.team as Team) &&
    isCard(x.card) &&
    EFFECTS.includes(x.effect as string) &&
    typeof x.amount === 'number' &&
    (x.discarded === null || isCard(x.discarded)) &&
    typeof x.extra === 'boolean' &&
    typeof x.text === 'string'
  )
}

export function isGameState(x: unknown): x is GameState {
  return (
    isRecord(x) &&
    isRecord(x.players) &&
    isPlayer(x.players.black) &&
    isPlayer(x.players.red) &&
    TEAMS.includes(x.current as Team) &&
    typeof x.turn === 'number' &&
    (x.winner === null || TEAMS.includes(x.winner as Team)) &&
    Array.isArray(x.log) &&
    x.log.length <= 500 &&
    x.log.every(isLogEntry)
  )
}

export function isMessage(x: unknown): x is Message {
  if (!isRecord(x)) return false
  if (x.type === 'sync' || x.type === 'rematch') return true
  if (x.type === 'play') return typeof x.cardId === 'string' && x.cardId.length <= 10
  if (x.type === 'state') return isGameState(x.state)
  return false
}
