import type { LogEntry } from '../game/types'
import { TEAM_NAME } from '../game/deck'
import { describeEffect } from '../game/format'
import CardChip from './CardChip'

// Lista de todas as jogadas da partida, da mais recente para a mais antiga.
export default function HistoryPanel({ log }: { log: LogEntry[] }) {
  return (
    <aside className="history">
      <h2>
        Histórico <span className="count">{log.length} jogadas</span>
      </h2>
      {log.length === 0 ? (
        <p className="empty">Nenhuma jogada ainda.</p>
      ) : (
        <ol>
          {[...log].reverse().map((entry) => {
            const effect = describeEffect(entry)
            return (
              <li key={entry.turn} className={`log-${entry.team}`} title={entry.text}>
                <span className="log-turn">T{entry.turn}</span>
                <CardChip card={entry.card} />
                <span className="log-team">{TEAM_NAME[entry.team]}</span>
                <span className={`log-effect effect-${effect.kind}`}>{effect.text}</span>
                {effect.extra && <span className="log-extra">+1 jogada</span>}
                {entry.discarded && <CardChip card={entry.discarded} />}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
