// Textos curtos para mostrar o efeito de uma jogada (letreiro da mesa e histórico).

import type { LogEntry } from './types'

export function describeEffect(entry: LogEntry): { text: string; kind: string } {
  switch (entry.effect) {
    case 'damage':
      return { text: `-${entry.amount}`, kind: 'damage' }
    case 'heal':
      return entry.amount > 0
        ? { text: `+${entry.amount}`, kind: 'heal' }
        : { text: 'VIDA CHEIA', kind: 'none' }
    case 'discard':
      return { text: 'DESCARTE', kind: 'discard' }
    case 'reflect':
      return { text: '⇄ REFLEXO', kind: 'reflect' }
    default:
      return { text: 'SEM EFEITO', kind: 'none' }
  }
}
