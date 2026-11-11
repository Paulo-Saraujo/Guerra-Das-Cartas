// A "sala" online: cuida da conexão direta entre os dois navegadores usando o PeerJS.
// O servidor público do PeerJS só serve para os dois se encontrarem; depois as jogadas
// vão direto de um computador para o outro.

import { Peer } from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { GameState } from '../game/types'
import { isMessage } from './protocol'
import type { Message } from './protocol'

const ID_PREFIX = 'duelo-das-cores-'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O e 1/I, para não confundir
export const CODE_LENGTH = 5
const CONNECT_TIMEOUT_MS = 20000

export interface RoomHandlers {
  onMessage?: (message: Message) => void
  onClosed?: (reason: string) => void // a conexão caiu depois de estabelecida
}

export interface Room {
  readonly role: 'host' | 'guest'
  readonly code: string
  send: (message: Message) => void
  setHandlers: (handlers: RoomHandlers) => void
  close: () => void
}

// O que o jogo precisa saber da sala quando a partida começa.
export interface OnlineSession {
  role: 'host' | 'guest'
  room: Room
  initialState?: GameState // o convidado já recebe o jogo inicial
}

// Deixa só letras e números permitidos, em maiúsculas, até 5 caracteres.
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((ch) => CODE_CHARS.includes(ch))
    .join('')
    .slice(0, CODE_LENGTH)
}

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_CHARS.charAt(b % CODE_CHARS.length)).join('')
}

function describeError(type: string): string {
  switch (type) {
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Não consegui falar com o servidor de conexão. Verifique a internet e tente de novo.'
    case 'browser-incompatible':
      return 'Este navegador não suporta o modo online.'
    case 'webrtc':
      return 'A conexão direta falhou. Algumas redes (Wi-Fi de empresa ou escola, alguns planos de dados) bloqueiam esse tipo de conexão.'
    default:
      return `Erro de conexão (${type}).`
  }
}

// ---------- Quem cria a sala (anfitrião, joga de Pretas) ----------

interface HostCallbacks {
  onCode: (code: string) => void // a sala foi criada; este é o código
  onConnected: () => void // o convidado entrou
  onFail: (text: string) => void
}

export function hostRoom(callbacks: HostCallbacks): Room {
  let handlers: RoomHandlers = {}
  let conn: DataConnection | null = null
  let peer: Peer | null = null
  let closedByUs = false
  let code = makeCode()
  let attempts = 0

  const wire = (c: DataConnection) => {
    c.on('open', () => callbacks.onConnected())
    c.on('data', (data) => {
      if (isMessage(data)) handlers.onMessage?.(data)
    })
    c.on('close', () => {
      if (!closedByUs) handlers.onClosed?.('O outro jogador saiu da partida.')
    })
    c.on('error', () => {
      if (!closedByUs) handlers.onClosed?.('A conexão com o outro jogador foi perdida.')
    })
  }

  const start = () => {
    const p = new Peer(ID_PREFIX + code)
    peer = p
    p.on('open', () => callbacks.onCode(code))
    p.on('connection', (incoming) => {
      if (conn) {
        // a sala é só para dois: qualquer terceiro é dispensado
        incoming.on('open', () => incoming.close())
        return
      }
      conn = incoming
      wire(incoming)
    })
    p.on('error', (err) => {
      const type = String(err.type)
      if (type === 'unavailable-id' && attempts < 3) {
        // alguém já usa esse código: tenta outro
        attempts++
        p.destroy()
        code = makeCode()
        start()
        return
      }
      if (!conn && !closedByUs) callbacks.onFail(describeError(type))
    })
  }
  start()

  return {
    role: 'host',
    get code() {
      return code
    },
    send: (message) => {
      if (conn && conn.open) conn.send(message)
    },
    setHandlers: (next) => {
      handlers = next
    },
    close: () => {
      closedByUs = true
      conn?.close()
      peer?.destroy()
    },
  }
}

// ---------- Quem entra na sala (convidado, joga de Vermelhas) ----------

interface GuestCallbacks {
  onConnected: () => void
  onFail: (text: string) => void
}

export function joinRoom(rawCode: string, callbacks: GuestCallbacks): Room {
  const code = normalizeCode(rawCode)
  let handlers: RoomHandlers = {}
  let conn: DataConnection | null = null
  let closedByUs = false
  let connected = false
  let timeout: number | undefined

  const peer = new Peer()

  const fail = (text: string) => {
    window.clearTimeout(timeout)
    callbacks.onFail(text)
  }

  timeout = window.setTimeout(() => {
    if (!connected) {
      fail('Não foi possível conectar a tempo. Confira o código e se o seu amigo continua com a sala aberta.')
    }
  }, CONNECT_TIMEOUT_MS)

  peer.on('open', () => {
    const c = peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' })
    conn = c
    c.on('open', () => {
      connected = true
      window.clearTimeout(timeout)
      callbacks.onConnected()
    })
    c.on('data', (data) => {
      if (isMessage(data)) handlers.onMessage?.(data)
    })
    c.on('close', () => {
      if (!closedByUs) handlers.onClosed?.('O outro jogador saiu da partida.')
    })
    c.on('error', () => {
      if (!closedByUs) handlers.onClosed?.('A conexão com o outro jogador foi perdida.')
    })
  })

  peer.on('error', (err) => {
    const type = String(err.type)
    if (type === 'peer-unavailable') {
      fail('Sala não encontrada. Confira o código e se o seu amigo continua com a sala aberta.')
    } else if (!connected) {
      fail(describeError(type))
    }
  })

  return {
    role: 'guest',
    code,
    send: (message) => {
      if (conn && conn.open) conn.send(message)
    },
    setHandlers: (next) => {
      handlers = next
    },
    close: () => {
      closedByUs = true
      window.clearTimeout(timeout)
      conn?.close()
      peer.destroy()
    },
  }
}
