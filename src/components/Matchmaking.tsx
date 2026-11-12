import { useEffect, useRef, useState } from 'react'
import { findMatch } from '../online/matchmaking'
import type { MatchSearch } from '../online/matchmaking'
import type { OnlineSession } from '../online/room'

interface MatchmakingProps {
  onBack: () => void
  onReady: (session: OnlineSession) => void
}

type Phase = 'idle' | 'searching' | 'found' | 'failed'

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function Matchmaking({ onBack, onReady }: MatchmakingProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [seconds, setSeconds] = useState(0)
  const searchRef = useRef<MatchSearch | null>(null)

  // Cronômetro enquanto a busca está rodando.
  useEffect(() => {
    if (phase !== 'searching') return
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  const startSearch = () => {
    searchRef.current?.cancel()
    setSeconds(0)
    setMessage('')
    setPhase('searching')
    searchRef.current = findMatch({
      onStatus: (text) => {
        setMessage(text)
        setPhase('found')
      },
      onMatched: onReady,
      onFail: (text) => {
        setMessage(text)
        setPhase('failed')
      },
    })
  }

  const cancelSearch = () => {
    searchRef.current?.cancel()
    searchRef.current = null
    setPhase('idle')
    setMessage('')
  }

  const goBack = () => {
    searchRef.current?.cancel()
    searchRef.current = null
    onBack()
  }

  return (
    <div className="menu">
      <h1>Online · contra estranhos</h1>

      {phase === 'idle' && (
        <>
          <p className="subtitle">
            Você será pareado com a próxima pessoa que também estiver procurando uma partida.
          </p>
          <p className="menu-note">
            Se ninguém mais estiver procurando agora, você ficará esperando. Combine com amigos para
            procurarem ao mesmo tempo!
          </p>
          <div className="menu-buttons">
            <button type="button" className="btn btn-primary" onClick={startSearch}>
              Procurar oponente
            </button>
            <button type="button" className="btn" onClick={goBack}>
              Voltar
            </button>
          </div>
        </>
      )}

      {phase === 'searching' && (
        <>
          <p className="status">Procurando oponente… {formatTime(seconds)}</p>
          <p className="menu-note">Mantenha esta página aberta. A partida começa sozinha quando alguém aparecer.</p>
          <div className="menu-buttons">
            <button type="button" className="btn" onClick={cancelSearch}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {phase === 'found' && <p className="status">{message || 'Oponente encontrado!'}</p>}

      {phase === 'failed' && (
        <>
          <p className="notice-error">{message}</p>
          <div className="menu-buttons">
            <button type="button" className="btn btn-primary" onClick={startSearch}>
              Procurar de novo
            </button>
            <button type="button" className="btn" onClick={goBack}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
