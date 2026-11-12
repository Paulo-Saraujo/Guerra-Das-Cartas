import { useState } from 'react'
import './App.css'
import GameScreen from './components/GameScreen'
import type { Mode } from './components/GameScreen'
import Lobby from './components/Lobby'
import Matchmaking from './components/Matchmaking'
import Tutorial from './components/Tutorial'
import type { OnlineSession } from './online/room'

type Screen =
  | { kind: 'menu' }
  | { kind: 'lobby' } // online contra amigos (com código)
  | { kind: 'match' } // online contra estranhos (busca automática)
  | { kind: 'game'; mode: Mode; online?: OnlineSession; id: number }

// Link de convite: https://.../?sala=ABCDE  ->  abre direto na tela de entrar na sala.
function readInviteCode(): string {
  return new URLSearchParams(window.location.search).get('sala') ?? ''
}

// O tutorial abre sozinho na primeira visita; depois fica guardado que você já viu.
const SEEN_KEY = 'guerra-das-cartas-tutorial-visto'

function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // sem armazenamento (ex.: aba privada): sem problema, o tutorial só volta a abrir na próxima vez
  }
}

interface MenuProps {
  onChoose: (screen: Screen) => void
  onHelp: () => void
}

function Menu({ onChoose, onHelp }: MenuProps) {
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
          Online · contra amigos (com código)
        </button>
        <button type="button" className="btn" onClick={() => onChoose({ kind: 'match' })}>
          Online · contra estranhos (busca automática)
        </button>
        <button type="button" className="btn" onClick={() => play('local')}>
          Teste local (as duas mãos abertas)
        </button>
        <button type="button" className="btn" onClick={onHelp}>
          Como jogar
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
  const [showTutorial, setShowTutorial] = useState(() => !hasSeenTutorial())

  const openTutorial = () => setShowTutorial(true)
  const closeTutorial = () => {
    markTutorialSeen()
    setShowTutorial(false)
  }

  const renderScreen = () => {
    if (screen.kind === 'lobby') {
      return (
        <Lobby
          initialCode={inviteCode}
          onBack={() => setScreen({ kind: 'menu' })}
          onReady={(online) => setScreen({ kind: 'game', mode: 'online', online, id: Date.now() })}
        />
      )
    }
    if (screen.kind === 'match') {
      return (
        <Matchmaking
          onBack={() => setScreen({ kind: 'menu' })}
          onReady={(online) => setScreen({ kind: 'game', mode: 'online', online, id: Date.now() })}
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
          onHelp={openTutorial}
        />
      )
    }
    return <Menu onChoose={setScreen} onHelp={openTutorial} />
  }

  return (
    <>
      {renderScreen()}
      {showTutorial && <Tutorial onClose={closeTutorial} />}
    </>
  )
}

export default App
