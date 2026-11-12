// Busca de oponentes ("contra estranhos").
//
// O servidor gratuito do PeerJS não permite listar quem está online, então usamos um truque:
// existem poucas "salas de espera" com nomes fixos (fila-0, fila-1, ...).
//
//   • Quem procura bate em todas as salas de espera, uma por uma:
//       - alguém esperando  -> a sala responde com o código de uma partida nova: é só entrar nela;
//       - sala vazia        -> guarda o número;
//       - sala ocupada      -> ela fecha a conexão ou não responde: segue para a próxima.
//   • Se ninguém estava esperando, a pessoa ocupa a primeira sala vazia e espera.
//   • Quando alguém bate na sala dela, ela cria uma partida normal (igual à de amigos),
//     manda o código para quem chegou e libera a sala de espera na hora.

import { Peer } from 'peerjs'
import { isMessage } from './protocol'
import { describeError, hostRoom, joinRoom } from './room'
import type { OnlineSession, Room } from './room'

const SLOT_PREFIX = 'guerra-das-cartas-fila-'

export interface MatchOptions {
  slotCount: number // quantas salas de espera existem
  openTimeoutMs: number // quanto esperar o servidor responder
  probeTimeoutMs: number // quanto esperar a resposta de cada sala de espera
  handoffTimeoutMs: number // quanto esperar o oponente chegar na partida criada
  maxSearchMs: number // depois disso, desiste e avisa
  rescanDelayMs: number // pausa antes de procurar de novo quando tudo está ocupado
  syncDelayMs: number // pedido de reenvio do jogo, por garantia
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  slotCount: 4,
  openTimeoutMs: 10000,
  probeTimeoutMs: 6000,
  handoffTimeoutMs: 15000,
  maxSearchMs: 180000,
  rescanDelayMs: 2000,
  syncDelayMs: 2000,
}

export interface MatchCallbacks {
  onStatus?: (text: string) => void
  onMatched: (session: OnlineSession) => void // a partida começou (o jogo chega logo depois)
  onFail: (text: string) => void
}

export interface MatchSearch {
  cancel: () => void
}

type ProbeResult = { kind: 'match'; code: string } | { kind: 'empty' } | { kind: 'busy' }
type WaitResult = 'matched' | 'taken' | 'timeout' | 'stopped'

const slotId = (i: number) => `${SLOT_PREFIX}${i}`
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function findMatch(
  callbacks: MatchCallbacks,
  overrides: Partial<MatchOptions> = {},
): MatchSearch {
  const opt: MatchOptions = { ...DEFAULT_MATCH_OPTIONS, ...overrides }
  let cancelled = false
  let finished = false // já entregamos a partida (ou falhamos)
  const closers = new Set<() => void>() // tudo que está aberto e precisa fechar se cancelar

  const stopped = () => cancelled || finished

  const track = (close: () => void) => {
    closers.add(close)
    return () => {
      closers.delete(close)
    }
  }

  const cancel = () => {
    cancelled = true
    for (const close of [...closers]) close()
    closers.clear()
  }

  const fail = (text: string) => {
    if (stopped()) return
    finished = true
    for (const close of [...closers]) close()
    closers.clear()
    callbacks.onFail(text)
  }

  // ---------- 1) Bater nas salas de espera ----------
  const scan = async (): Promise<{ code: string | null; emptySlot: number | null }> => {
    let onProbeError: ((type: string) => void) | null = null
    const peer = new Peer() // identidade anônima, só para sondar
    const untrack = track(() => peer.destroy())
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(describeError('network'))), opt.openTimeoutMs)
        peer.on('open', () => {
          clearTimeout(timer)
          resolve()
        })
        peer.on('error', (err) => {
          const type = String(err.type)
          if (onProbeError) {
            onProbeError(type)
          } else {
            clearTimeout(timer)
            reject(new Error(describeError(type)))
          }
        })
      })

      let emptySlot: number | null = null
      for (let i = 0; i < opt.slotCount && !stopped(); i++) {
        const result = await new Promise<ProbeResult>((resolve) => {
          let done = false
          let timer: ReturnType<typeof setTimeout> | undefined
          const conn = peer.connect(slotId(i), { reliable: true, serialization: 'json' })
          // se a busca for cancelada no meio, esta sondagem termina na hora
          const untrackProbe = track(() => finish({ kind: 'busy' }))

          function finish(r: ProbeResult) {
            if (done) return
            done = true
            clearTimeout(timer)
            untrackProbe()
            onProbeError = null
            try {
              conn.close()
            } catch {
              // já estava fechada
            }
            resolve(r)
          }

          timer = setTimeout(() => finish({ kind: 'busy' }), opt.probeTimeoutMs)
          onProbeError = (type) => {
            if (type === 'peer-unavailable') finish({ kind: 'empty' })
          }
          conn.on('data', (data) => {
            if (isMessage(data) && data.type === 'match') finish({ kind: 'match', code: data.code })
          })
          conn.on('close', () => finish({ kind: 'busy' }))
        })
        if (result.kind === 'match') return { code: result.code, emptySlot }
        if (result.kind === 'empty' && emptySlot === null) emptySlot = i
      }
      return { code: null, emptySlot }
    } finally {
      untrack()
      peer.destroy()
    }
  }

  // ---------- 2) Entrar na partida que alguém criou para nós ----------
  const joinAsGuest = (code: string): Promise<boolean> =>
    new Promise((resolve) => {
      let settled = false
      let syncTimer: ReturnType<typeof setTimeout> | undefined
      let giveUpTimer: ReturnType<typeof setTimeout> | undefined

      const room = joinRoom(code, {
        onConnected: () => {
          syncTimer = setTimeout(() => room.send({ type: 'sync' }), opt.syncDelayMs)
        },
        onFail: () => end(false),
      })
      const untrack = track(() => end(false))

      function end(ok: boolean) {
        if (settled) return
        settled = true
        clearTimeout(syncTimer)
        clearTimeout(giveUpTimer)
        untrack()
        if (!ok) room.close()
        resolve(ok)
      }

      giveUpTimer = setTimeout(() => end(false), opt.handoffTimeoutMs)
      room.setHandlers({
        onMessage: (message) => {
          if (message.type === 'state' && !settled) {
            finished = true
            end(true)
            callbacks.onMatched({ role: 'guest', room, initialState: message.state, kind: 'match' })
          }
        },
        onClosed: () => end(false),
      })
    })

  // ---------- 3) Ocupar uma sala de espera e aguardar alguém ----------
  const waitInSlot = (slot: number, deadline: number): Promise<WaitResult> =>
    new Promise((resolve) => {
      const lobby = new Peer(slotId(slot))
      let settled = false
      let handedOff = false
      let gameRoom: Room | null = null
      let incomingConn: { close: () => void } | null = null
      let handoffTimer: ReturnType<typeof setTimeout> | undefined
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined

      const untrack = track(() => finish('stopped'))

      function finish(result: WaitResult) {
        if (settled) return
        settled = true
        clearTimeout(handoffTimer)
        clearTimeout(deadlineTimer)
        untrack()
        lobby.destroy() // libera a sala de espera para os próximos
        if (result !== 'matched') gameRoom?.close()
        resolve(result)
      }

      // Alguém chegou, mas não entrou na partida a tempo: volta a esperar outra pessoa.
      function abortHandoff() {
        if (settled || !handedOff) return
        clearTimeout(handoffTimer)
        gameRoom?.close()
        gameRoom = null
        try {
          incomingConn?.close()
        } catch {
          // já estava fechada
        }
        incomingConn = null
        handedOff = false
      }

      deadlineTimer = setTimeout(() => finish('timeout'), Math.max(0, deadline - Date.now()))

      lobby.on('error', (err) => {
        const type = String(err.type)
        if (type === 'unavailable-id') {
          finish('taken') // outra pessoa ocupou esta sala antes de nós
        } else {
          fail(describeError(type))
          finish('stopped')
        }
      })

      lobby.on('connection', (incoming) => {
        if (settled || handedOff) {
          // já estamos atendendo alguém: quem chegou agora procura em outra sala
          incoming.on('open', () => incoming.close())
          return
        }
        handedOff = true
        incomingConn = incoming
        callbacks.onStatus?.('Oponente encontrado! Preparando a partida…')

        let code: string | null = null
        let opened = incoming.open
        const trySend = () => {
          if (code && opened && !settled) incoming.send({ type: 'match', code })
        }
        incoming.on('open', () => {
          opened = true
          trySend()
        })

        const room = hostRoom({
          onCode: (c) => {
            code = c
            trySend()
          },
          onConnected: () => {
            if (settled) return
            gameRoom = null // a partida segue com esta sala; não fechar
            finished = true
            finish('matched')
            callbacks.onMatched({ role: 'host', room, kind: 'match' })
          },
          onFail: abortHandoff,
        })
        gameRoom = room
        handoffTimer = setTimeout(abortHandoff, opt.handoffTimeoutMs)
      })
    })

  // ---------- A busca em si ----------
  const run = async () => {
    const deadline = Date.now() + opt.maxSearchMs
    while (!stopped() && Date.now() < deadline) {
      const { code, emptySlot } = await scan()
      if (stopped()) return

      if (code) {
        if (await joinAsGuest(code)) return
        continue // não deu certo: procura de novo
      }

      if (emptySlot !== null) {
        const result = await waitInSlot(emptySlot, deadline)
        if (result === 'matched' || stopped()) return
        if (result === 'timeout') break
        continue // "taken": alguém ocupou antes de nós; procura de novo
      }

      await wait(opt.rescanDelayMs) // todas as salas ocupadas: espera um pouco
    }
    fail('Não encontramos ninguém agora. Chame um amigo para procurar ao mesmo tempo, ou tente de novo mais tarde.')
  }

  run().catch((error: unknown) => {
    fail(error instanceof Error ? error.message : 'Algo deu errado na busca por oponentes.')
  })

  return { cancel }
}
