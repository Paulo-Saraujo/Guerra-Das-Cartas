import { useState } from 'react'
import './App.css'
import GameScreen from './components/GameScreen'
import type { Mode } from './components/GameScreen'
import Lobby from './components/Lobby'
import type { OnlineSession } from './online/room'

type Screen =
  | { kind: 'menu' }
  | { kind: 'lobby' }
  | { kind: 'game'; mode: Mode; online?: OnlineSession; id: number }

// Link de convite: https://.../?sala=ABCDE  ->  abre direto na tela de entrar na sala.
function readInviteCode(): string {
  return new URLSearchParams(window.location.search).get('sala') ?? ''
}

function Menu({ onChoose }: { onChoose: (screen: Screen) => void }) {
  const play = (mode: Mode) => onChoose({ kind: 'game', mode, id: Date.now() })
  return (
    <div className="menu">
      <h1>Guerra das Cartas</h1>
      <p className="subtitle">Escolha como quer jogar</p>
      <div className="menu-buttons">
        <button type="button" className="btn btn-primary" onClick={() => play('cpu')}>
          Jogador contra computador
        </button>
        <button type="button" className="btn" onClick={() => onChoose({ kind: 'lobby' })}>
          Jogador contra jogador online
        </button>
        <button type="button" className="btn" onClick={() => play('local')}>
          Teste local (as duas mãos abertas)
        </button>
      </div>
    </div>
  )
}

function App() {
  const [inviteCode] = useState(readInviteCode)
  const [screen, setScreen] = useState<Screen>(() =>
    inviteCode ? { kind: 'lobby' } : { kind: 'menu' },
  )

  if (screen.kind === 'lobby') {
    return (
      <Lobby
        initialCode={inviteCode}
        onBack={() => setScreen({ kind: 'menu' })}
        onReady={(online) =>
          setScreen({ kind: 'game', mode: 'online', online, id: Date.now() })
        }
      />
    )
  }

  if (screen.kind === 'game') {
    return (
      <GameScreen
        key={screen.id}
        mode={screen.mode}
        online={screen.online}
        onExit={() => setScreen({ kind: 'menu' })}
      />
    )
  }

  return <Menu onChoose={setScreen} />
}

export default App
