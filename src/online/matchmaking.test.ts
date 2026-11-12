// Testes da busca de oponentes, numa rede simulada (sem internet).
// Rodam junto com os outros: npx vitest run
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('peerjs', async () => {
  const mod = await import('./fakePeer')
  return { Peer: mod.FakePeer }
})

import { findMatch } from './matchmaking'
import type { MatchSearch } from './matchmaking'
import { addGhost, resetFakeNetwork } from './fakePeer'
import { createGame } from '../game/engine'
import type { OnlineSession } from './room'

// Tempos curtos para os testes não demorarem.
const FAST = {
  openTimeoutMs: 500,
  probeTimeoutMs: 120,
  handoffTimeoutMs: 700,
  maxSearchMs: 1500,
  rescanDelayMs: 40,
  syncDelayMs: 60,
}

const NOTHING = 'nada aconteceu'
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Um jogador procurando partida.
function seek(options: Partial<typeof FAST> = {}) {
  let resolveSession!: (session: OnlineSession) => void
  let resolveFailure!: (text: string) => void
  const session = new Promise<OnlineSession>((resolve) => (resolveSession = resolve))
  const failure = new Promise<string>((resolve) => (resolveFailure = resolve))
  const search: MatchSearch = findMatch(
    {
      onMatched: (s) => {
        // Na prática é a tela do jogo que envia o primeiro estado; aqui fazemos isso à mão.
        if (s.role === 'host') s.room.send({ type: 'state', state: createGame('black') })
        resolveSession(s)
      },
      onFail: resolveFailure,
    },
    { ...FAST, ...options },
  )
  return { session, failure, search }
}

// Espera uma promessa por um tempo; devolve NOTHING se ela não terminar.
async function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof NOTHING> {
  return Promise.race([promise, pause(ms).then(() => NOTHING)])
}

beforeEach(() => {
  resetFakeNetwork()
})

describe('busca de oponentes', () => {
  it('dois jogadores que procuram ao mesmo tempo se encontram', async () => {
    const a = seek()
    const b = seek()
    const sessions = await Promise.all([a.session, b.session])
    const roles = sessions.map((s) => s.role).sort()
    expect(roles).toEqual(['guest', 'host'])

    const host = sessions.find((s) => s.role === 'host') as OnlineSession
    const guest = sessions.find((s) => s.role === 'guest') as OnlineSession
    expect(host.kind).toBe('match')
    expect(guest.kind).toBe('match')
    expect(host.room.code).toBe(guest.room.code) // a mesma sala
    expect(guest.initialState?.players.black.hand).toHaveLength(5) // o convidado recebeu o jogo
  })

  it('seis jogadores ao mesmo tempo formam três duplas, sem repetir ninguém', async () => {
    const seekers = Array.from({ length: 6 }, () => seek())
    const sessions = await Promise.all(seekers.map((s) => s.session))
    const hosts = sessions.filter((s) => s.role === 'host')
    const guests = sessions.filter((s) => s.role === 'guest')
    expect(hosts).toHaveLength(3)
    expect(guests).toHaveLength(3)
    const hostCodes = new Set(hosts.map((s) => s.room.code))
    const guestCodes = new Set(guests.map((s) => s.room.code))
    expect(hostCodes.size).toBe(3)
    expect([...guestCodes].sort()).toEqual([...hostCodes].sort())
  })

  it('o terceiro jogador continua esperando e entra quando o quarto chega', async () => {
    const a = seek()
    const b = seek()
    await Promise.all([a.session, b.session])

    const c = seek()
    expect(await within(c.session, 300)).toBe(NOTHING) // ninguém para jogar ainda

    const d = seek()
    const [sc, sd] = await Promise.all([c.session, d.session])
    expect([sc.role, sd.role].sort()).toEqual(['guest', 'host'])
    expect(sc.room.code).toBe(sd.room.code)
  })

  it('quem cancela libera a vaga e não "sequestra" os próximos', async () => {
    const a = seek()
    await pause(120)
    a.search.cancel()

    const b = seek()
    const c = seek()
    const [sb, sc] = await Promise.all([b.session, c.session])
    expect(sb.room.code).toBe(sc.room.code)
    expect(await within(a.session, 200)).toBe(NOTHING)
  })

  it('a sala de espera é liberada depois do pareamento (mesmo existindo uma só)', async () => {
    const one = { slotCount: 1 }
    const a = seek(one)
    const b = seek(one)
    await Promise.all([a.session, b.session])

    // se a única sala de espera não tivesse sido liberada, estes dois nunca se encontrariam
    const c = seek(one)
    const d = seek(one)
    const [sc, sd] = await Promise.all([c.session, d.session])
    expect(sc.room.code).toBe(sd.room.code)
  })

  it('uma sala de espera "fantasma" é ignorada', async () => {
    addGhost('guerra-das-cartas-fila-0')
    const a = seek()
    const b = seek()
    const [sa, sb] = await Promise.all([a.session, b.session])
    expect(sa.room.code).toBe(sb.room.code)
  })

  it('sem ninguém por perto, a busca termina com um aviso', async () => {
    const a = seek({ maxSearchMs: 400 })
    const text = await a.failure
    expect(text.includes('Não encontramos ninguém')).toBe(true)
  })

  it('cancelar não deixa a busca avisar nada depois', async () => {
    const a = seek({ maxSearchMs: 300 })
    a.search.cancel()
    expect(await within(a.failure, 500)).toBe(NOTHING)
    expect(await within(a.session, 50)).toBe(NOTHING)
  })
})
