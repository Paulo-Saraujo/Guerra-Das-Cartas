import { useRef, useState } from 'react'
import { CODE_LENGTH, hostRoom, joinRoom, normalizeCode } from '../online/room'
import type { OnlineSession, Room } from '../online/room'

interface LobbyProps {
  initialCode: string // código vindo do link de convite (?sala=ABCDE), se houver
  onBack: () => void
  onReady: (session: OnlineSession) => void
}

type View = 'choose' | 'hosting' | 'joining'

export default function Lobby({ initialCode, onBack, onReady }: LobbyProps) {
  const [view, setView] = useState<View>(initialCode ? 'joining' : 'choose')
  const [code, setCode] = useState('') // código da sala que você criou
  const [input, setInput] = useState(normalizeCode(initialCode))
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const roomRef = useRef<Room | null>(null)

  const closeRoom = () => {
    roomRef.current?.close()
    roomRef.current = null
  }

  const failWith = (text: string) => {
    closeRoom()
    setError(text)
    setStatus('')
  }

  const goChoose = () => {
    closeRoom()
    setCode('')
    setStatus('')
    setError('')
    setCopied(false)
    setView('choose')
  }

  const startHosting = () => {
    closeRoom()
    setView('hosting')
    setCode('')
    setError('')
    setCopied(false)
    setStatus('Criando a sala…')
    const room = hostRoom({
      onCode: (c) => {
        setCode(c)
        setStatus('Aguardando o seu amigo entrar…')
      },
      onConnected: () => onReady({ role: 'host', room }),
      onFail: failWith,
    })
    roomRef.current = room
  }

  const startJoining = () => {
    const clean = normalizeCode(input)
    if (clean.length !== CODE_LENGTH) {
      setError(`O código tem ${CODE_LENGTH} letras ou números.`)
      return
    }
    closeRoom()
    setError('')
    setStatus('Conectando…')
    const room = joinRoom(clean, {
      onConnected: () => {
        setStatus('Conectado! Aguardando a partida começar…')
        // garantia extra: se o jogo não chegar, pede de novo
        window.setTimeout(() => room.send({ type: 'sync' }), 2000)
      },
      onFail: failWith,
    })
    room.setHandlers({
      onMessage: (message) => {
        if (message.type === 'state') {
          onReady({ role: 'guest', room, initialState: message.state })
        }
      },
      onClosed: failWith,
    })
    roomRef.current = room
  }

  const link = `${window.location.origin}${window.location.pathname}?sala=${code}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Não consegui copiar. Selecione o link e copie manualmente.')
    }
  }

  return (
    <div className="menu">
      <h1>Jogo online</h1>

      {view === 'choose' && (
        <>
          <p className="subtitle">Jogue contra um amigo em outro computador ou celular.</p>
          <div className="menu-buttons">
            <button type="button" className="btn btn-primary" onClick={startHosting}>
              Criar sala (você joga de Pretas)
            </button>
            <button type="button" className="btn" onClick={() => setView('joining')}>
              Entrar em uma sala (você joga de Vermelhas)
            </button>
            <button type="button" className="btn" onClick={onBack}>
              Voltar
            </button>
          </div>
        </>
      )}

      {view === 'hosting' && (
        <>
          {code ? (
            <>
              <p className="subtitle">Envie este código (ou o link) para o seu amigo:</p>
              <div className="code-box">{code}</div>
              <input
                className="link-input"
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Link de convite"
              />
              <div className="menu-buttons">
                <button type="button" className="btn btn-primary" onClick={copyLink}>
                  {copied ? 'Link copiado!' : 'Copiar link de convite'}
                </button>
              </div>
              <p className="subtitle">Mantenha esta página aberta até ele entrar.</p>
            </>
          ) : null}
          {status && <p className="status">{status}</p>}
          {error && <p className="notice-error">{error}</p>}
          <div className="menu-buttons">
            {error && (
              <button type="button" className="btn btn-primary" onClick={startHosting}>
                Tentar de novo
              </button>
            )}
            <button type="button" className="btn" onClick={goChoose}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {view === 'joining' && (
        <>
          <p className="subtitle">Digite o código que o seu amigo enviou:</p>
          <input
            className="code-input"
            value={input}
            maxLength={CODE_LENGTH}
            onChange={(e) => setInput(normalizeCode(e.target.value))}
            placeholder="ABCDE"
            autoFocus
            aria-label="Código da sala"
          />
          {status && <p className="status">{status}</p>}
          {error && <p className="notice-error">{error}</p>}
          <div className="menu-buttons">
            <button
              type="button"
              className="btn btn-primary"
              onClick={startJoining}
              disabled={Boolean(status)}
            >
              Entrar na sala
            </button>
            <button type="button" className="btn" onClick={goChoose}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
