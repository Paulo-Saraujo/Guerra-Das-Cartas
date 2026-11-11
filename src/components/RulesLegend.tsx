import { useState } from 'react'

// Legenda fixa ao lado da mesa: o resumo do que cada carta faz.
const ITEMS = [
  { chip: '2–10', title: 'Ataque', text: 'dano igual ao número da carta.' },
  { chip: 'A', title: 'Ás', text: '1 de dano e você joga de novo.' },
  { chip: '♞ J', title: 'Valete', text: 'o adversário perde a carta mais forte da mão.' },
  { chip: '♛ Q', title: 'Dama', text: 'recupera 10 de vida (máximo 50).' },
  { chip: '♚ K', title: 'Rei', text: 'devolve o último dano que você recebeu.' },
]

export default function RulesLegend() {
  const [open, setOpen] = useState(true)

  return (
    <aside className="legend" aria-label="Legenda das cartas">
      <button
        type="button"
        className="legend-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>Legenda das cartas</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul>
          {ITEMS.map((item) => (
            <li key={item.title}>
              <span className="chip chip-black legend-chip">{item.chip}</span>
              <span>
                <b>{item.title}:</b> {item.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
