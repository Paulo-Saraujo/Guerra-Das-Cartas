// Textos curtos para mostrar o efeito de uma jogada (letreiro da mesa e histórico).

import type { LogEntry } from './types'

export function describeEffect(entry: LogEntry): { text: string; kind: string; extra: boolean } {
  const extra = entry.extra
  switch (entry.effect) {
    case 'damage':
      return { text: `-${entry.amount}`, kind: 'damage', extra }
    case 'heal':
      return entry.amount > 0
        ? { text: `+${entry.amount}`, kind: 'heal', extra }
        : { text: 'VIDA CHEIA', kind: 'none', extra }
    case 'discard':
      return { text: 'DESCARTE', kind: 'discard', extra }
    case 'reflect':
      return { text: '⇄ REFLEXO', kind: 'reflect', extra }
    default:
      return { text: 'SEM EFEITO', kind: 'none', extra }
  }
}
