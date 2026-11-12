// Um "PeerJS de mentira", que funciona só na memória do computador.
// Serve apenas para os testes: simula o servidor público (IDs únicos, erros de sala inexistente)
// e as conexões entre jogadores, sem precisar de internet.

type Handler = (...args: unknown[]) => void

class Emitter {
  private handlers = new Map<string, Handler[]>()

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return this
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of [...(this.handlers.get(event) ?? [])]) handler(...args)
  }
}

const LATENCY_MS = 2

// O "servidor": quem está registrado com qual ID. Um fantasma é um ID que o servidor acha que
// existe, mas que nunca responde (como um jogador que fechou a aba de repente).
class Ghost {
  readonly isGhost = true
}
const registry = new Map<string, FakePeer | Ghost>()
let counter = 0

export function resetFakeNetwork(): void {
  registry.clear()
  counter = 0
}

export function addGhost(id: string): void {
  registry.set(id, new Ghost())
}

export class FakeConn extends Emitter {
  open = false
  closed = false
  other: FakeConn | null = null

  send(data: unknown): void {
    const target = this.other
    if (!this.open || this.closed || !target) return
    const copy: unknown = JSON.parse(JSON.stringify(data)) // como na internet: só chega texto
    setTimeout(() => {
      if (!target.closed) target.emit('data', copy)
    }, LATENCY_MS)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.open = false
    const target = this.other
    setTimeout(() => {
      if (target && !target.closed) {
        target.closed = true
        target.open = false
        target.emit('close')
      }
    }, LATENCY_MS)
    this.emit('close')
  }
}

export class FakePeer extends Emitter {
  id: string
  destroyed = false
  connections = new Set<FakeConn>()

  constructor(id?: string) {
    super()
    counter += 1
    this.id = id ?? `anonimo-${counter}`
    setTimeout(() => {
      if (this.destroyed) return
      if (registry.has(this.id)) {
        this.emit('error', { type: 'unavailable-id', message: `ID ${this.id} já está em uso` })
        return
      }
      registry.set(this.id, this)
      this.emit('open', this.id)
    }, LATENCY_MS)
  }

  connect(id: string, _options?: unknown): FakeConn {
    const local = new FakeConn()
    this.connections.add(local)
    setTimeout(() => {
      if (this.destroyed || local.closed) return
      const target = registry.get(id)
      if (!target) {
        this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${id}` })
        return
      }
      if (target instanceof Ghost) return // silêncio total
      const remote = new FakeConn()
      remote.other = local
      local.other = remote
      target.connections.add(remote)
      target.emit('connection', remote)
      setTimeout(() => {
        if (local.closed || remote.closed) return
        local.open = true
        remote.open = true
        local.emit('open')
        remote.emit('open')
      }, LATENCY_MS)
    }, LATENCY_MS)
    return local
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (registry.get(this.id) === this) registry.delete(this.id)
    for (const conn of [...this.connections]) conn.close()
    this.emit('close')
  }
}
