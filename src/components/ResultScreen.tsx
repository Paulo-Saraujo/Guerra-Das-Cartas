import type { GameState, Team } from '../game/types'
import { MAX_LIFE, TEAM_NAME } from '../game/deck'
import Hearts from './Hearts'
import CardChip from './CardChip'

interface ResultScreenProps {
  game: GameState
  onNewGame?: () => void // sem isto (convidado online), aparece um aviso no lugar do botão
  onClose: () => void
  humanTeam?: Team // quando há um "você": qual equipe é a sua
  opponentName?: string // ex.: "O computador" ou "Seu oponente"
}

// Estatísticas de uma equipe, calculadas a partir do histórico.
function teamStats(game: GameState, team: Team) {
  const plays = game.log.filter((entry) => entry.team === team)
  const damage = plays
    .filter((entry) => entry.effect === 'damage' || entry.effect === 'reflect')
    .reduce((sum, entry) => sum + entry.amount, 0)
  return { cards: plays.length, damage }
}

const TEAMS: Team[] = ['black', 'red']

export default function ResultScreen({
  game,
  onNewGame,
  onClose,
  humanTeam,
  opponentName,
}: ResultScreenProps) {
  const winner = game.winner
  if (!winner) return null

  const title = humanTeam
    ? winner === humanTeam
      ? '♛ Você venceu!'
      : `${opponentName ?? 'O computador'} venceu!`
    : `♛ ${TEAM_NAME[winner]} venceram!`

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Resultado da partida">
      <div className="result">
        <p className="result-kicker">Fim da partida</p>
        <h2 className="result-title">{title}</h2>

        <div className="result-teams">
          {TEAMS.map((team) => {
            const stats = teamStats(game, team)
            const life = game.players[team].life
            return (
              <div
                key={team}
                className={`result-team${team === winner ? ' is-winner' : ''}`}
              >
                <h3>{TEAM_NAME[team]}</h3>
                <Hearts team={team} life={life} />
                <p className="result-life">
                  {life}/{MAX_LIFE} de vida
                </p>
                <p>{stats.cards} cartas jogadas</p>
                <p>{stats.damage} de dano causado</p>
              </div>
            )
          })}
        </div>

        <p className="result-turns">
          A partida durou <b>{game.turn}</b> turnos
        </p>

        <div className="result-history">
          {TEAMS.map((team) => (
            <div key={team}>
              <h4>Cartas das {TEAM_NAME[team]}, em ordem</h4>
              <div className="chips">
                {game.log
                  .filter((entry) => entry.team === team)
                  .map((entry) => (
                    <CardChip key={entry.turn} card={entry.card} />
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="result-actions">
          {onNewGame ? (
            <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
              Nova partida
            </button>
          ) : (
            <p className="play-text">Aguardando o anfitrião começar uma nova partida…</p>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Ver a mesa
          </button>
        </div>
      </div>
    </div>
  )
}
