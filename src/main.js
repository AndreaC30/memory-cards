import './style.css'
import {
  defaultQuizSession,
  loadManifest,
  loadPack,
  loadFullBank,
  rebuildQueue,
  renderQuiz,
  handleQuizAction,
  quizKeydown,
  parseImportedPack,
  scheduleAutoAdvance,
  clearAutoAdvance,
  loadFlowStyle,
} from './quiz.js'
import {
  loadState,
  saveState,
  sessionWeight,
  setSessionWeight,
  resetSession,
  parseDeckJson,
  exportDeck,
  pickCardId,
  markSeen,
  remainingCount,
  uid,
} from './store.js'
import { loadHistory, addAttempt, renderHistory, clearHistory } from './history.js'

const SCHEMA_HINT = `{
  "title": "Nombre del mazo",
  "cards": [
    { "front": "Anverso", "back": "Reverso", "weight": 1 }
  ]
}`

const state = loadState()
const quiz = defaultQuizSession()
let tab = 'quiz'
let editingId = null
let notice = ''
let adminFilter = ''
let historyList = loadHistory()

const app = document.querySelector('#app')

function saveQuizAttemptIfNeeded() {
  if (tab !== 'quiz' || !quiz.finished || quiz.attemptSaved) return
  addAttempt(quiz)
  quiz.attemptSaved = true
  historyList = loadHistory()
}

function persist() {
  saveState(state)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function currentCard() {
  return state.cards.find((c) => c.id === state.session.currentId) || null
}

function ensureCard() {
  if (!state.cards.length) {
    state.session.currentId = null
    state.session.flipped = false
    return
  }
  if (!currentCard()) {
    state.session.currentId = pickCardId(state)
    state.session.flipped = false
  }
}

function goNext() {
  const prev = state.session.currentId
  markSeen(state, prev)
  state.session.currentId = pickCardId(state, prev ? [prev] : [])
  state.session.flipped = false
  persist()
  render()
}

function toggleFlip() {
  const cardEl = app.querySelector('.card')
  if (!cardEl) return
  state.session.flipped = !state.session.flipped
  cardEl.classList.toggle('is-flipped', state.session.flipped)
  persist()
}

function bumpWeight(delta) {
  const card = currentCard()
  if (!card) return
  setSessionWeight(state, card.id, sessionWeight(state, card.id) + delta)
  persist()
  const label = app.querySelector('.weight strong')
  if (label) label.textContent = String(sessionWeight(state, card.id))
}

function finishQuizInteraction(action, result) {
  if (result?.importJson) {
    document.getElementById('quiz-import-file')?.click()
    return
  }
  if (result?.async) {
    loadQuizBank()
    return
  }
  render()
  if (result?.scheduleAdvance) {
    scheduleAutoAdvance(quiz, () => {
      clearAutoAdvance(quiz)
      handleQuizAction(quiz, 'next')
      render()
    })
  } else if (action === 'next' || action === 'prev' || action === 'next-skip' || action === 'shuffle') {
    clearAutoAdvance(quiz)
  }
  if (
    quiz.checked &&
    (action === 'check' || action === 'next' || action === 'pick' || result?.scheduleAdvance)
  ) {
    focusQuizContinueButton()
  }
}

function focusQuizContinueButton() {
  requestAnimationFrame(() => {
    const btn = app.querySelector('button[data-quiz="next"]')
    if (!btn) return
    btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    btn.focus({ preventScroll: true })
  })
}

function render() {
  ensureCard()
  saveQuizAttemptIfNeeded()
  const body =
    tab === 'study'
      ? renderStudy()
      : tab === 'quiz'
        ? renderQuiz(quiz, escapeHtml)
        : tab === 'history'
          ? renderHistory(historyList, escapeHtml)
          : renderAdmin()
  const isDeckTab = tab === 'study' || tab === 'admin'
  app.innerHTML = `
    <div class="shell">
      <header class="top">
        <div>
          <p class="kicker">${isDeckTab ? 'Tarjetas de memoria' : 'Práctica de certificación'}</p>
          <h1>${escapeHtml(isDeckTab ? state.deckTitle || 'Memory cards' : 'Datadog Fundamentals')}</h1>
        </div>
        <nav class="tabs" role="tablist">
          <button type="button" class="${tab === 'quiz' ? 'is-on' : ''}" data-tab="quiz">Tests</button>
          <button type="button" class="${tab === 'history' ? 'is-on' : ''}" data-tab="history">Mis resultados</button>
          <button type="button" class="${tab === 'study' ? 'is-on' : ''}" data-tab="study">Tarjetas</button>
          <button type="button" class="${tab === 'admin' ? 'is-on' : ''}" data-tab="admin">Administrar</button>
        </nav>
      </header>
      ${notice ? `<p class="notice" role="status">${escapeHtml(notice)}</p>` : ''}
      ${body}
    </div>
  `
}

function renderStudy() {
  const card = currentCard()
  const left = remainingCount(state)
  const seen = state.session.seen.length + (state.session.unique && card ? 1 : 0)
  const total = state.cards.length

  if (!state.cards.length) {
    return `
      <section class="empty">
        <h2>No hay tarjetas</h2>
        <p>Pasa a Administrar para crearlas o importar un JSON.</p>
      </section>
    `
  }

  if (!card) {
    return `
      <section class="empty">
        <h2>Sesión terminada</h2>
        <p>No quedan tarjetas ${state.session.unique ? 'sin repetir' : 'con peso > 0'}.</p>
        <button type="button" class="primary" data-action="reset">Reiniciar sesión</button>
      </section>
    `
  }

  const weight = sessionWeight(state, card.id)
  return `
    <section class="study">
      <div class="toolbar">
        <label class="check">
          <input type="checkbox" data-action="unique" ${state.session.unique ? 'checked' : ''} />
          No repetir en esta sesión
        </label>
        <p class="meta">${state.session.unique ? `${Math.min(seen, total)} / ${total} vistas · ${left} restantes` : `${total} en el mazo`}</p>
        <button type="button" class="ghost" data-action="reset">Reiniciar sesión</button>
      </div>

      <button type="button" class="card ${state.session.flipped ? 'is-flipped' : ''}" data-action="flip" aria-label="Girar tarjeta">
        <span class="card-inner">
          <span class="face front">
            <span class="side">Anverso</span>
            <span class="prompt">${escapeHtml(card.front)}</span>
          </span>
          <span class="face back">
            <span class="side">Reverso</span>
            <span class="prompt">${escapeHtml(card.back)}</span>
          </span>
        </span>
      </button>

      <div class="controls">
        <div class="weight">
          <button type="button" class="icon" data-action="weight-down" aria-label="Bajar peso">−</button>
          <span>Peso <strong>${weight}</strong></span>
          <button type="button" class="icon" data-action="weight-up" aria-label="Subir peso">+</button>
        </div>
        <button type="button" class="primary" data-action="next">Siguiente</button>
      </div>
      <p class="hints">Espacio gira · N / → siguiente · + / − peso</p>
    </section>
  `
}

function renderAdmin() {
  const filtered = state.cards.filter((c) => {
    if (!adminFilter) return true
    const q = adminFilter.toLowerCase()
    return c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
  })
  const editing = editingId ? state.cards.find((c) => c.id === editingId) : null

  return `
    <section class="admin">
      <div class="panel">
        <h2>${editing ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
        <form data-form="card">
          <label>Anverso
            <textarea name="front" rows="2" required>${editing ? escapeHtml(editing.front) : ''}</textarea>
          </label>
          <label>Reverso
            <textarea name="back" rows="2" required>${editing ? escapeHtml(editing.back) : ''}</textarea>
          </label>
          <label>Peso base
            <input name="weight" type="number" min="0" max="99" value="${editing ? editing.baseWeight : 1}" />
          </label>
          <div class="row">
            <button type="submit" class="primary">${editing ? 'Guardar' : 'Añadir'}</button>
            ${editing ? '<button type="button" class="ghost" data-action="cancel-edit">Cancelar</button>' : ''}
          </div>
        </form>
      </div>

      <div class="panel">
        <h2>Importar / exportar</h2>
        <p class="help">El JSON admite un objeto con <code>title</code> y <code>cards</code>, o un array de tarjetas. Cada tarjeta necesita <code>front</code> y <code>back</code>; <code>weight</code> e <code>id</code> son opcionales.</p>
        <pre class="schema">${escapeHtml(SCHEMA_HINT)}</pre>
        <div class="row wrap">
          <button type="button" class="primary" data-action="import">Añadir desde JSON</button>
          <button type="button" class="ghost" data-action="replace">Reemplazar mazo</button>
          <a class="ghost linkish" href="${import.meta.env.BASE_URL}ejemplo.json" download>Descargar ejemplo</a>
          <button type="button" class="ghost" data-action="export">Exportar mazo</button>
          <button type="button" class="danger" data-action="clear">Vaciar mazo</button>
        </div>
        <input id="json-file" type="file" accept="application/json,.json" hidden />
        <label class="title-field">Nombre del mazo
          <input data-field="title" value="${escapeHtml(state.deckTitle)}" />
        </label>
      </div>

      <div class="panel wide">
        <div class="list-head">
          <h2>Tarjetas (${state.cards.length})</h2>
          <input data-field="filter" placeholder="Filtrar…" value="${escapeHtml(adminFilter)}" />
        </div>
        ${
          filtered.length
            ? `<ul class="cards-list">${filtered
                .map(
                  (c) => `
              <li>
                <div>
                  <strong>${escapeHtml(c.front)}</strong>
                  <span>${escapeHtml(c.back)}</span>
                </div>
                <em>peso ${c.baseWeight}</em>
                <div class="row">
                  <button type="button" class="ghost" data-edit="${c.id}">Editar</button>
                  <button type="button" class="danger" data-delete="${c.id}">Eliminar</button>
                </div>
              </li>`,
                )
                .join('')}</ul>`
            : '<p class="help">Ninguna tarjeta coincide.</p>'
        }
      </div>
    </section>
  `
}

function importJson(replace) {
  const input = document.querySelector('#json-file')
  if (!input) return
  input.onchange = async () => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const parsed = parseDeckJson(await file.text())
      if (replace) {
        state.cards = parsed.cards
        resetSession(state)
      } else {
        const ids = new Set(state.cards.map((c) => c.id))
        for (const card of parsed.cards) {
          if (ids.has(card.id)) card.id = uid()
          state.cards.push(card)
        }
      }
      if (parsed.title) state.deckTitle = parsed.title
      notice = replace
        ? `Mazo reemplazado: ${parsed.cards.length} tarjetas.`
        : `Añadidas ${parsed.cards.length} tarjetas.`
      persist()
      render()
    } catch (err) {
      notice = err instanceof Error ? err.message : 'JSON no válido.'
      render()
    }
  }
  input.click()
}

async function ensureQuizManifest() {
  if (quiz.manifest) return
  try {
    quiz.manifest = await loadManifest(import.meta.env.BASE_URL)
    quiz.packId = quiz.manifest.tests20?.[0]?.id || 'test-01'
    quiz.packFile = quiz.manifest.tests20?.[0]?.file || 'test-01.json'
  } catch (err) {
    quiz.loadError = err instanceof Error ? err.message : 'Error al cargar índice'
  }
}

async function loadQuizBank() {
  try {
    if (!quiz.manifest) await ensureQuizManifest()
    const base = import.meta.env.BASE_URL
    const file = quiz.packFile || 'test-01.json'
    const data =
      file === '__full__' ? await loadFullBank(base) : await loadPack(base, file)
    quiz.bank = data.bank
    quiz.domains = data.domains
    quiz.title = data.title
    quiz.packDescription = data.description || ''
    quiz.fixedPack = data.fixedPack
    quiz.passPercent =
      data.type === 'simulacro90' ? (data.passPercent ?? 64) : (data.passPercent ?? 70)
    quiz.examType = data.examType ?? data.type ?? null
    quiz.scoring = data.scoring ?? null
    quiz.answersLog = []
    quiz.attemptSaved = false
    quiz.loaded = true
    quiz.loadError = ''
    quiz.importedPack = false
    quiz.flow = loadFlowStyle()
    rebuildQueue(quiz)
    notice = ''
  } catch (err) {
    quiz.loadError = err instanceof Error ? err.message : 'Error al cargar'
    quiz.loaded = false
    notice = quiz.loadError
  }
  render()
}

app.addEventListener('click', (event) => {
  const historyClear = event.target.closest('[data-history="clear"]')
  if (historyClear) {
    if (!confirm('¿Borrar todo el historial de tests?')) return
    clearHistory()
    historyList = []
    render()
    return
  }

  const historyRetry = event.target.closest('[data-history-retry]')
  if (historyRetry) {
    quiz.packFile = historyRetry.dataset.historyRetry
    quiz.packId = historyRetry.dataset.historyPackId || quiz.packId
    tab = 'quiz'
    notice = ''
    loadQuizBank()
    return
  }

  const quizBtn = event.target.closest('[data-quiz]')
  if (quizBtn) {
    const action = quizBtn.dataset.quiz
    if (
      (action === 'shuffle' || action === 'pick-another') &&
      quiz.loaded &&
      !quiz.finished &&
      quiz.answered > 0
    ) {
      if (!confirm('¿Abandonar este intento? Volverás al inicio del examen.')) return
    }
    let detail
    if (action === 'pick') detail = Number(quizBtn.dataset.index)
    const result = handleQuizAction(quiz, action, detail)
    finishQuizInteraction(action, result)
    return
  }

  const tabBtn = event.target.closest('[data-tab]')
  if (tabBtn) {
    tab = tabBtn.dataset.tab
    notice = ''
    if (tab === 'quiz') {
      ensureQuizManifest().then(() => render())
      return
    }
    if (tab === 'history') {
      historyList = loadHistory()
    }
    render()
    return
  }

  const editBtn = event.target.closest('[data-edit]')
  if (editBtn) {
    editingId = editBtn.dataset.edit
    render()
    return
  }

  const delBtn = event.target.closest('[data-delete]')
  if (delBtn) {
    const id = delBtn.dataset.delete
    state.cards = state.cards.filter((c) => c.id !== id)
    if (state.session.currentId === id) state.session.currentId = null
    state.session.seen = state.session.seen.filter((x) => x !== id)
    delete state.session.weights[id]
    persist()
    render()
    return
  }

  const action = event.target.closest('[data-action]')?.dataset.action
  if (!action) return

  if (action === 'flip') {
    toggleFlip()
    return
  }
  if (action === 'next') {
    goNext()
    return
  }
  if (action === 'weight-up') {
    bumpWeight(1)
    return
  }
  if (action === 'weight-down') {
    bumpWeight(-1)
    return
  }
  if (action === 'reset') {
    resetSession(state)
    persist()
    render()
    return
  }
  if (action === 'cancel-edit') {
    editingId = null
    render()
    return
  }
  if (action === 'import') {
    importJson(false)
    return
  }
  if (action === 'replace') {
    if (!confirm('Esto borra el mazo actual y reinicia la sesión. ¿Continuar?')) return
    importJson(true)
    return
  }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify(exportDeck(state), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mazo.json'
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  if (action === 'clear') {
    if (!confirm('¿Vaciar todas las tarjetas?')) return
    state.cards = []
    resetSession(state)
    persist()
    render()
  }
})

app.addEventListener('change', (event) => {
  if (event.target.dataset.quiz === 'pack-select') {
    const opt = event.target.selectedOptions[0]
    handleQuizAction(quiz, 'pack-select', {
      packId: opt.dataset.packId,
      file: opt.value,
    })
    quiz.packFile = opt.value
    render()
    return
  }
  if (event.target.dataset.quiz === 'domain') {
    handleQuizAction(quiz, 'domain', event.target.value)
    render()
    return
  }
  if (event.target.dataset.quiz === 'mode') {
    handleQuizAction(quiz, 'mode', event.target.value)
    render()
    return
  }
  if (event.target.name === 'quiz-flow') {
    handleQuizAction(quiz, 'flow', event.target.value)
    return
  }
  if (event.target.id === 'quiz-import-file') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    file
      .text()
      .then((text) => {
        const data = parseImportedPack(JSON.parse(text))
        quiz.bank = data.bank
        quiz.domains = data.domains
        quiz.title = data.title
        quiz.packDescription = data.description
        quiz.fixedPack = true
        quiz.passPercent = data.passPercent
        quiz.examType = data.examType
        quiz.scoring = data.scoring
        quiz.importedPack = true
        quiz.packId = 'import'
        quiz.flow = 'instant'
        quiz.answersLog = []
        quiz.attemptSaved = false
        quiz.loaded = true
        quiz.loadError = ''
        rebuildQueue(quiz)
        notice = `${data.title}: ${data.bank.length} preguntas importadas.`
        render()
      })
      .catch((err) => {
        notice = err instanceof Error ? err.message : 'JSON no válido.'
        render()
      })
    return
  }
  if (event.target.dataset.action === 'unique') {
    state.session.unique = event.target.checked
    persist()
    render()
  }
})

app.addEventListener('input', (event) => {
  if (event.target.dataset.field === 'title') {
    state.deckTitle = event.target.value
    persist()
    const heading = app.querySelector('h1')
    if (heading) heading.textContent = state.deckTitle || 'Memory cards'
  }
  if (event.target.dataset.field === 'filter') {
    adminFilter = event.target.value
    render()
    const field = app.querySelector('[data-field="filter"]')
    if (field) {
      field.focus()
      const end = adminFilter.length
      field.setSelectionRange(end, end)
    }
  }
})

app.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form="card"]')
  if (!form) return
  event.preventDefault()
  const data = new FormData(form)
  const front = String(data.get('front') || '').trim()
  const back = String(data.get('back') || '').trim()
  const weight = Number(data.get('weight'))
  const baseWeight = Number.isFinite(weight) ? Math.max(0, Math.min(99, Math.round(weight))) : 1
  if (!front || !back) return

  if (editingId) {
    const card = state.cards.find((c) => c.id === editingId)
    if (card) {
      card.front = front
      card.back = back
      card.baseWeight = baseWeight
    }
    editingId = null
  } else {
    state.cards.push({ id: uid(), front, back, baseWeight })
  }
  persist()
  render()
})

window.addEventListener('keydown', (event) => {
  if (tab === 'quiz') {
    const tag = event.target.tagName
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      const wasChecked = quiz.checked
      if (quizKeydown(quiz, event)) {
        const schedule =
          quiz.flow === 'instant' && !wasChecked && quiz.checked && quiz.answersLog.at(-1)?.ok
            ? { scheduleAdvance: true }
            : {}
        finishQuizInteraction('keydown', schedule)
      }
    }
    return
  }
  if (tab !== 'study') return
  const tag = event.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    toggleFlip()
  } else if (event.key === 'n' || event.key === 'N' || event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    bumpWeight(1)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    bumpWeight(-1)
  }
})

render()
ensureQuizManifest().then(() => render())
