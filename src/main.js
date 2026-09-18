import './style.css'
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

const SCHEMA_HINT = `{
  "title": "Nombre del mazo",
  "cards": [
    { "front": "Anverso", "back": "Reverso", "weight": 1 }
  ]
}`

const state = loadState()
let tab = 'study'
let editingId = null
let notice = ''
let adminFilter = ''

const app = document.querySelector('#app')

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

function render() {
  ensureCard()
  app.innerHTML = `
    <div class="shell">
      <header class="top">
        <div>
          <p class="kicker">Aprendizaje rápido</p>
          <h1>${escapeHtml(state.deckTitle || 'Memory cards')}</h1>
        </div>
        <nav class="tabs" role="tablist">
          <button type="button" class="${tab === 'study' ? 'is-on' : ''}" data-tab="study">Estudiar</button>
          <button type="button" class="${tab === 'admin' ? 'is-on' : ''}" data-tab="admin">Administrar</button>
        </nav>
      </header>
      ${notice ? `<p class="notice" role="status">${escapeHtml(notice)}</p>` : ''}
      ${tab === 'study' ? renderStudy() : renderAdmin()}
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

app.addEventListener('click', (event) => {
  const tabBtn = event.target.closest('[data-tab]')
  if (tabBtn) {
    tab = tabBtn.dataset.tab
    notice = ''
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
