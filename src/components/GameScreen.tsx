import { useEffect, useRef, useState } from 'react'
import { createGame } from '../game/engine'
import { chooseCard } from '../game/ai'
import { MAX_LIFE, TEAM_NAME, cardLabel, otherTeam } from '../game/deck'
import { describeEffect } from '../game/format'
import type { GameState, Team } from '../game/types'
import { maskState, tryPlay } from '../online/protocol'
import type { OnlineSession } from '../online/room'
import CardView from './CardView'
import Hearts from './Hearts'
import HistoryPanel from './HistoryPanel'
import ResultScreen from './ResultScreen'

// cpu = contra o computador | local = teste com as duas mãos abertas | online = contra um amigo
export type Mode = 'cpu' | 'local' | 'online'

const HOST_TEAM: Team = 'black' // no online, o anfitrião joga de Pretas
const GUEST_TEAM: Team = 'red' // e o convidado, de Vermelhas
const CPU_TEAM: Team = 'red'
const CPU_THINKING_MS = 1200

// ---------- Efeitos visuais (números flutuantes, brilhos) ----------

type PopupKind = 'damage' | 'heal' | 'discard'

interface Popup {
  team: Team
  text: string
  kind: PopupKind
}

interface Fx {
  id: number
  popups: Popup[]
}

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
  label: string
  badge: string // texto do selo "de quem é a vez"
  game: GameState
  fx: Fx | null
  interactive: boolean // o usuário pode clicar nas cartas desta mão?
  hidden: boolean // cartas viradas
  onPlay: (cardId: string) => void
}

function PlayerArea({ team, label, badge, game, fx, interactive, hidden, onPlay }: PlayerAreaProps) {
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
        {active && <span className="turn-badge">{badge}</span>}
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

// ---------- A tela do jogo ----------

interface GameScreenProps {
  mode: Mode
  online?: OnlineSession
  onExit: () => void
}

export default function GameScreen({ mode, online, onExit }: GameScreenProps) {
  const role = online?.role
  const myTeam: Team = role === 'guest' ? GUEST_TEAM : HOST_TEAM // sempre fica embaixo da tela
  const foeTeam = otherTeam(myTeam)
  const solo = mode !== 'local' // existe um "você" (contra o computador ou online)
  const foeWord = mode === 'cpu' ? 'computador' : 'oponente'

  const [game, setGame] = useState<GameState>(() => online?.initialState ?? createGame())
  const [fx, setFx] = useState<Fx | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [disconnected, setDisconnected] = useState('')
  const gameRef = useRef<GameState>(game) // sempre o jogo mais recente, mesmo dentro de timers e mensagens

  // Aceita um novo estado de jogo (de uma jogada, de uma partida nova ou vindo do anfitrião).
  const commit = (next: GameState, nextFx: Fx | null) => {
    gameRef.current = next
    setGame(next)
    setFx(nextFx)
  }

  // Joga uma carta em nome de "team" (valida vez e carta antes).
  const applyPlay = (team: Team, cardId: string) => {
    const prev = gameRef.current
    const next = tryPlay(prev, team, cardId)
    if (next) commit(next, buildFx(prev, next))
  }

  // Convidado: chegou o jogo atualizado pelo anfitrião.
  const receiveState = (next: GameState) => {
    const prev = gameRef.current
    if (JSON.stringify(prev) === JSON.stringify(next)) return
    if (next.log.length <= prev.log.length) setShowResult(false)
    const isNewPlay = next.log.length === prev.log.length + 1
    commit(next, isNewPlay ? buildFx(prev, next) : null)
  }

  // Clique do usuário numa carta.
  const handleClick = (cardId: string) => {
    if (role === 'guest') {
      const current = gameRef.current
      if (current.current === myTeam && !current.winner) {
        online?.room.send({ type: 'play', cardId }) // o anfitrião decide e devolve o jogo atualizado
      }
      return
    }
    applyPlay(mode === 'local' ? gameRef.current.current : myTeam, cardId)
  }

  const handleNewGame = () => {
    if (role === 'guest') return
    commit(createGame(), null)
    setShowResult(false)
  }

  const leave = () => {
    online?.room.close()
    onExit()
  }

  const handleMenu = () => {
    const playing = online && !game.winner && !disconnected
    if (playing && !window.confirm('Sair da partida online? Ela será encerrada para os dois.')) return
    leave()
  }

  // Quando alguém vence, espera um instante (para ver o golpe final) e abre o resultado.
  useEffect(() => {
    if (!game.winner) return
    const timer = window.setTimeout(() => setShowResult(true), 1600)
    return () => window.clearTimeout(timer)
  }, [game.winner])

  // Contra o computador: na vez dele, espera um pouco, escolhe uma carta e joga.
  useEffect(() => {
    if (mode !== 'cpu' || game.winner || game.current !== CPU_TEAM) return
    const timer = window.setTimeout(() => {
      const cardId = chooseCard(gameRef.current, CPU_TEAM)
      if (cardId) applyPlay(CPU_TEAM, cardId)
    }, CPU_THINKING_MS)
    return () => window.clearTimeout(timer)
  }, [game, mode])

  // Online: configura o que fazer com as mensagens do outro jogador.
  useEffect(() => {
    if (!online) return
    online.room.setHandlers({
      onMessage: (message) => {
        if (online.role === 'host') {
          if (message.type === 'play') applyPlay(GUEST_TEAM, message.cardId)
          if (message.type === 'sync') {
            online.room.send({ type: 'state', state: maskState(gameRef.current, GUEST_TEAM) })
          }
        } else if (message.type === 'state') {
          receiveState(message.state)
        }
      },
      onClosed: (reason) => setDisconnected(reason),
    })
  }, [online])

  // Anfitrião: a cada mudança no jogo, manda ao convidado a versão que ele pode ver.
  useEffect(() => {
    if (online?.role !== 'host') return
    online.room.send({ type: 'state', state: maskState(game, GUEST_TEAM) })
  }, [game, online])

  const last = game.log[game.log.length - 1]
  const badge = last ? describeEffect(last) : null

  let status: string
  if (game.winner) {
    status = solo
      ? game.winner === myTeam
        ? 'Você venceu a partida!'
        : `O ${foeWord} venceu a partida!`
      : `${TEAM_NAME[game.winner]} venceram a partida!`
  } else if (solo) {
    status = `Turno ${game.turn} · ${game.current === myTeam ? 'sua vez' : `vez do ${foeWord}`}`
  } else {
    status = `Turno ${game.turn} · vez das ${TEAM_NAME[game.current]}`
  }

  let subtitle: string
  if (mode === 'cpu') subtitle = 'Você joga de Pretas contra o computador.'
  else if (mode === 'online') subtitle = `Partida online · Sala ${online?.room.code ?? ''} · você joga de ${TEAM_NAME[myTeam]}`
  else subtitle = 'Teste local: as duas mãos aparecem abertas para conferirmos as regras.'

  const foeBadge = mode === 'cpu' ? 'Pensando…' : mode === 'online' ? 'Vez do oponente' : 'Jogando agora'

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Duelo das Cores</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="top-buttons">
          <button type="button" className="btn" onClick={handleMenu}>
            Menu
          </button>
          {role !== 'guest' && (
            <button type="button" className="btn" onClick={handleNewGame}>
              Nova partida
            </button>
          )}
        </div>
      </header>

      <main className="board">
        <PlayerArea
          team={foeTeam}
          label={solo ? `${TEAM_NAME[foeTeam]} (${foeWord})` : TEAM_NAME[foeTeam]}
          badge={foeBadge}
          game={game}
          fx={fx}
          interactive={!solo}
          hidden={solo}
          onPlay={handleClick}
        />

        <section className="table">
          <p className={`status${game.winner ? ' winner' : ''}`}>{status}</p>
          {last && badge ? (
            <div key={last.turn} className="last-play">
              <div className={`play-card from-${last.team === myTeam ? 'bottom' : 'top'}`}>
                <CardView card={last.card} />
              </div>
              <div className={`badge badge-${badge.kind}`}>{badge.text}</div>
            </div>
          ) : (
            <p className="play-text">
              {role === 'guest' && game.current !== myTeam
                ? 'Aguardando a jogada do anfitrião…'
                : 'Escolha uma carta para começar.'}
            </p>
          )}
          {last && <p className="play-text">{last.text}</p>}
          {game.winner && !showResult && (
            <button type="button" className="btn btn-primary" onClick={() => setShowResult(true)}>
              Ver resultado
            </button>
          )}
        </section>

        <PlayerArea
          team={myTeam}
          label={solo ? `${TEAM_NAME[myTeam]} (você)` : TEAM_NAME[myTeam]}
          badge={solo ? 'Sua vez' : 'Jogando agora'}
          game={game}
          fx={fx}
          interactive
          hidden={false}
          onPlay={handleClick}
        />
      </main>

      <HistoryPanel log={game.log} />

      {game.winner && showResult && !disconnected && (
        <ResultScreen
          game={game}
          humanTeam={solo ? myTeam : undefined}
          opponentName={mode === 'cpu' ? 'O computador' : 'Seu oponente'}
          onNewGame={role === 'guest' ? undefined : handleNewGame}
          onClose={() => setShowResult(false)}
        />
      )}

      {disconnected && (
        <div className="overlay" role="alertdialog" aria-label="Conexão encerrada">
          <div className="result">
            <h2 className="result-title">Conexão encerrada</h2>
            <p className="play-text">{disconnected}</p>
            <div className="result-actions">
              <button type="button" className="btn btn-primary" onClick={leave}>
                Voltar ao menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
