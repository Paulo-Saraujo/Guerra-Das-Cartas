import { useEffect, useState } from 'react'
import './App.css'
import { createGame, playCard } from './game/engine'
import { chooseCard } from './game/ai'
import { MAX_LIFE, TEAM_NAME, cardLabel, otherTeam } from './game/deck'
import { describeEffect } from './game/format'
import type { GameState, Team } from './game/types'
import CardView from './components/CardView'
import Hearts from './components/Hearts'
import HistoryPanel from './components/HistoryPanel'
import ResultScreen from './components/ResultScreen'

// Modos de jogo: contra o computador, ou teste local com as duas mãos abertas.
type Mode = 'cpu' | 'local'

const HUMAN: Team = 'black' // no modo contra o computador, você joga de Pretas
const CPU: Team = 'red'
const CPU_THINKING_MS = 1200 // tempo "pensando" antes de o computador jogar

// ---------- Efeitos visuais (números flutuantes, brilhos) ----------

type PopupKind = 'damage' | 'heal' | 'discard'

interface Popup {
  team: Team // em qual jogador o efeito aparece
  text: string // ex.: "-7", "+10", "-K♥"
  kind: PopupKind
}

interface Fx {
  id: number // muda a cada jogada, para a animação rodar de novo
  popups: Popup[]
}

// Compara o estado antes e depois da jogada e descobre o que mostrar na tela.
function buildFx(prev: GameState, next: GameState): Fx | null {
  const entry = next.log[next.log.length - 1]
  if (!entry) return null

  const foe = otherTeam(entry.team)
  const popups: Popup[] = []

  if (entry.effect === 'damage') {
    popups.push({ team: foe, text: `-${entry.amount}`, kind: 'damage' })
  }
  if (entry.effect === 'heal' && entry.amount > 0) {
    popups.push({ team: entry.team, text: `+${entry.amount}`, kind: 'heal' })
  }
  if (entry.effect === 'reflect') {
    const healed = next.players[entry.team].life - prev.players[entry.team].life
    popups.push({ team: foe, text: `-${entry.amount}`, kind: 'damage' })
    if (healed > 0) popups.push({ team: entry.team, text: `+${healed}`, kind: 'heal' })
  }
  if (entry.effect === 'discard' && entry.discarded) {
    popups.push({ team: foe, text: `-${cardLabel(entry.discarded)}`, kind: 'discard' })
  }

  return { id: entry.turn, popups }
}

// ---------- Área de um jogador ----------

interface PlayerAreaProps {
  team: Team
  label: string // nome mostrado (ex.: "Pretas (você)")
  game: GameState
  fx: Fx | null
  interactive: boolean // o usuário pode clicar nas cartas desta mão?
  hidden: boolean // cartas viradas (mão do computador)
  onPlay: (cardId: string) => void
}

function PlayerArea({ team, label, game, fx, interactive, hidden, onPlay }: PlayerAreaProps) {
  const player = game.players[team]
  const active = game.current === team && !game.winner
  const popups = fx ? fx.popups.filter((p) => p.team === team) : []
  const firstPopup = popups[0]

  return (
    <section className={`player player-${team}${active ? ' active' : ''}`}>
      {fx && firstPopup && (
        <span key={`flash-${fx.id}`} className={`flash flash-${firstPopup.kind}`} />
      )}
      {fx &&
        popups.map((p, i) => (
          <span key={`${fx.id}-${i}`} className={`float float-${p.kind}`}>
            {p.text}
          </span>
        ))}

      <div className="player-head">
        <h2>{label}</h2>
        <Hearts team={team} life={player.life} />
        <span key={player.life} className="life-number">
          {player.life}/{MAX_LIFE}
        </span>
        {active && <span className="turn-badge">{hidden ? 'Pensando…' : 'Jogando agora'}</span>}
      </div>
      <div className="hand">
        {player.hand.map((card) => (
          <CardView
            key={card.id}
            card={card}
            back={hidden ? team : undefined}
            disabled={!active || !interactive}
            onClick={interactive ? () => onPlay(card.id) : undefined}
          />
        ))}
      </div>
      <p className="deck-info">
        Baralho: {player.deck.length} · Descarte: {player.discard.length}
      </p>
    </section>
  )
}

// ---------- Menu inicial ----------

function Menu({ onChoose }: { onChoose: (mode: Mode) => void }) {
  return (
    <div className="menu">
      <h1>Duelo das Cores</h1>
      <p className="subtitle">Escolha como quer jogar</p>
      <div className="menu-buttons">
        <button type="button" className="btn btn-primary" onClick={() => onChoose('cpu')}>
          Jogador contra computador
        </button>
        <button type="button" className="btn" onClick={() => onChoose('local')}>
          Teste local (as duas mãos abertas)
        </button>
        <button type="button" className="btn" disabled>
          Jogador contra jogador online (em breve)
        </button>
      </div>
    </div>
  )
}

// ---------- Tela principal ----------

function App() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [game, setGame] = useState<GameState>(() => createGame())
  const [fx, setFx] = useState<Fx | null>(null)
  const [showResult, setShowResult] = useState(false)

  // Quando alguém vence, espera um instante (para ver o golpe final) e abre o resultado.
  useEffect(() => {
    if (!game.winner) return
    const timer = window.setTimeout(() => setShowResult(true), 1600)
    return () => window.clearTimeout(timer)
  }, [game.winner])

  // Vez do computador: espera um pouco, escolhe uma carta e joga.
  useEffect(() => {
    if (mode !== 'cpu' || game.winner || game.current !== CPU) return
    const timer = window.setTimeout(() => {
      const cardId = chooseCard(game, CPU)
      if (!cardId) return
      const next = playCard(game, cardId)
      setFx(buildFx(game, next))
      setGame(next)
    }, CPU_THINKING_MS)
    return () => window.clearTimeout(timer)
  }, [game, mode])

  const handlePlay = (cardId: string) => {
    const next = playCard(game, cardId)
    if (next === game) return
    setFx(buildFx(game, next))
    setGame(next)
  }

  const startGame = (chosen: Mode) => {
    setMode(chosen)
    setGame(createGame())
    setFx(null)
    setShowResult(false)
  }

  if (mode === null) return <Menu onChoose={startGame} />

  const vsCpu = mode === 'cpu'
  const last = game.log[game.log.length - 1]
  const badge = last ? describeEffect(last) : null

  let status: string
  if (game.winner) {
    status = vsCpu
      ? game.winner === HUMAN
        ? 'Você venceu a partida!'
        : 'O computador venceu a partida!'
      : `${TEAM_NAME[game.winner]} venceram a partida!`
  } else if (vsCpu) {
    status = `Turno ${game.turn} · ${game.current === HUMAN ? 'sua vez' : 'vez do computador'}`
  } else {
    status = `Turno ${game.turn} · vez das ${TEAM_NAME[game.current]}`
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Duelo das Cores</h1>
          <p className="subtitle">
            {vsCpu
              ? 'Você joga de Pretas contra o computador.'
              : 'Teste local: as duas mãos aparecem abertas para conferirmos as regras.'}
          </p>
        </div>
        <div className="top-buttons">
          <button type="button" className="btn" onClick={() => setMode(null)}>
            Menu
          </button>
          <button type="button" className="btn" onClick={() => startGame(mode)}>
            Nova partida
          </button>
        </div>
      </header>

      <main className="board">
        <PlayerArea
          team="red"
          label={vsCpu ? 'Vermelhas (computador)' : 'Vermelhas'}
          game={game}
          fx={fx}
          interactive={!vsCpu}
          hidden={vsCpu}
          onPlay={handlePlay}
        />

        <section className="table">
          <p className={`status${game.winner ? ' winner' : ''}`}>{status}</p>
          {last && badge ? (
            <div key={last.turn} className="last-play">
              <div className={`play-card from-${last.team}`}>
                <CardView card={last.card} />
              </div>
              <div className={`badge badge-${badge.kind}`}>{badge.text}</div>
            </div>
          ) : (
            <p className="play-text">Escolha uma carta para começar.</p>
          )}
          {last && <p className="play-text">{last.text}</p>}
          {game.winner && !showResult && (
            <button type="button" className="btn btn-primary" onClick={() => setShowResult(true)}>
              Ver resultado
            </button>
          )}
        </section>

        <PlayerArea
          team="black"
          label={vsCpu ? 'Pretas (você)' : 'Pretas'}
          game={game}
          fx={fx}
          interactive
          hidden={false}
          onPlay={handlePlay}
        />
      </main>

      <HistoryPanel log={game.log} />

      {game.winner && showResult && (
        <ResultScreen
          game={game}
          humanTeam={vsCpu ? HUMAN : undefined}
          onNewGame={() => startGame(mode)}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  )
}

export default App
