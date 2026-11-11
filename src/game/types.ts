// Tipos do jogo Duelo das Cores.
// Aqui só descrevemos "o formato" das coisas: o que é uma carta, um jogador, etc.

export type Team = 'black' | 'red'

export type Suit = '♠' | '♣' | '♥' | '♦'

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K'

export interface Card {
  id: string // identificador único, ex.: "7♠"
  rank: Rank
  suit: Suit
}

export interface Player {
  team: Team
  life: number
  hand: Card[] // cartas na mão
  deck: Card[] // baralho de compra (a primeira carta é o topo, a última é o fundo)
  discard: Card[] // cartas já jogadas
  lastDamage: number // último dano recebido (é o que o Rei reflete)
}

export type EffectType = 'damage' | 'heal' | 'discard' | 'reflect' | 'none'

// Uma linha do histórico da partida.
export interface LogEntry {
  turn: number
  team: Team
  card: Card
  effect: EffectType
  amount: number // dano causado, vida curada ou dano refletido
  discarded: Card | null // carta que o adversário perdeu (Valete)
  extra: boolean // Ás Veloz: quem jogou continua na vez (joga de novo)
  text: string // frase pronta para mostrar na tela
}

export interface GameState {
  players: Record<Team, Player>
  current: Team // de quem é a vez
  turn: number // número do turno atual (começa em 1)
  winner: Team | null
  log: LogEntry[]
}
