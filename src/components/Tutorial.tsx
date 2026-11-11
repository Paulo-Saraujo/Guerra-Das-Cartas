import { useState } from 'react'
import type { ReactNode } from 'react'
import CardView from './CardView'
import type { Card, Rank, Suit } from '../game/types'

function card(rank: Rank, suit: Suit): Card {
  return { id: `${rank}${suit}`, rank, suit }
}

interface Slide {
  title: string
  body: ReactNode
}

// Cada "slide" do tutorial. Para mudar um texto, é só editar aqui.
const SLIDES: Slide[] = [
  {
    title: 'O objetivo',
    body: (
      <>
        <p>
          Deixe a vida do adversário em <b>zero</b>. Cada jogador começa com <b>50 de vida</b> (são 10
          corações, e cada um vale 5).
        </p>
        <p>
          As <b>Pretas</b> (♠ ♣) enfrentam as <b>Vermelhas</b> (♥ ♦). Cada lado compra do seu próprio
          baralho.
        </p>
      </>
    ),
  },
  {
    title: 'Como jogar',
    body: (
      <>
        <ol className="tutorial-steps">
          <li>
            Na sua vez, <b>clique em uma carta</b> da sua mão.
          </li>
          <li>O efeito acontece na hora e a carta vai para o centro da mesa.</li>
          <li>
            Você <b>compra até ter 5 cartas</b> e a vez passa para o adversário.
          </li>
        </ol>
        <p className="tutorial-tip">Quem está na vez aparece com o selo dourado.</p>
      </>
    ),
  },
  {
    title: 'Cartas de ataque',
    body: (
      <>
        <div className="tutorial-cards">
          <CardView card={card('A', '♠')} />
          <CardView card={card('7', '♠')} />
          <CardView card={card('10', '♥')} />
        </div>
        <p>
          <b>2 a 10</b> causam dano igual ao número da carta.
        </p>
        <p>
          O <b>Ás</b> causa só 1 de dano, mas você <b>joga de novo</b>!
        </p>
      </>
    ),
  },
  {
    title: 'Cartas especiais',
    body: (
      <>
        <div className="tutorial-cards">
          <CardView card={card('J', '♥')} />
          <CardView card={card('Q', '♠')} />
          <CardView card={card('K', '♦')} />
        </div>
        <ul className="tutorial-list">
          <li>
            <b>Valete:</b> o adversário perde a carta mais forte da mão dele (ordem: K, Q, J, 10 … 2, A).
          </li>
          <li>
            <b>Dama:</b> você recupera 10 de vida (máximo 50).
          </li>
          <li>
            <b>Rei:</b> devolve o último dano que você recebeu: você se cura e o adversário leva o
            mesmo dano.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Dicas rápidas',
    body: (
      <ul className="tutorial-list">
        <li>
          Guarde o <b>Rei</b> para depois de levar um golpe grande: quanto maior o dano, melhor o
          reflexo.
        </li>
        <li>
          Use a <b>Dama</b> quando a vida estiver baixa. Com a vida cheia, ela não ajuda.
        </li>
        <li>
          O <b>Ás</b> é uma jogada de graça: jogue cedo e depois escolha outra carta.
        </li>
        <li>
          O <b>Valete</b> derruba a melhor carta do adversário, às vezes um Rei!
        </li>
        <li>
          Para rever tudo, use o botão <b>Como jogar</b>. A legenda das cartas fica ao lado da mesa.
        </li>
      </ul>
    ),
  },
]

export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step] as Slide
  const isLast = step === SLIDES.length - 1

  return (
    <div className="overlay tutorial-overlay" role="dialog" aria-modal="true" aria-label="Como jogar">
      <div className="result tutorial">
        <p className="result-kicker">
          Como jogar · {step + 1} de {SLIDES.length}
        </p>
        <h2 className="result-title tutorial-title">{slide.title}</h2>
        <div className="tutorial-body">{slide.body}</div>

        <div className="tutorial-dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span key={i} className={`dot${i === step ? ' on' : ''}`} />
          ))}
        </div>

        <div className="result-actions">
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          {isLast ? (
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
              Jogar!
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)} autoFocus>
                Próximo
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Pular
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
