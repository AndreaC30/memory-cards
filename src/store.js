const KEY = 'memory-cards:v1'

export function uid() {
  return crypto.randomUUID()
}

export function defaultState() {
  return {
    deckTitle: 'Mi mazo',
    cards: [],
    session: {
      weights: {},
      seen: [],
      unique: true,
      currentId: null,
      flipped: false,
    },
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return withSample(defaultState())
    const parsed = JSON.parse(raw)
    const base = defaultState()
    return {
      ...base,
      ...parsed,
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      session: { ...base.session, ...(parsed.session || {}) },
    }
  } catch {
    return withSample(defaultState())
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function withSample(state) {
  state.deckTitle = 'Ejemplo: atajos'
  state.cards = [
    { id: uid(), front: 'Espacio o clic', back: 'Gira la tarjeta', baseWeight: 2 },
    { id: uid(), front: 'N o →', back: 'Siguiente tarjeta', baseWeight: 2 },
    { id: uid(), front: '+ y −', back: 'Suben o bajan el peso de esta sesión', baseWeight: 3 },
    { id: uid(), front: 'Peso alto', back: 'Sale más a menudo en el sorteo', baseWeight: 4 },
    { id: uid(), front: 'Sin repetir', back: 'La casilla oculta las ya vistas hasta reiniciar', baseWeight: 1 },
  ]
  return state
}

export function sessionWeight(state, id) {
  const stored = state.session.weights[id]
  if (Number.isFinite(stored)) return Math.max(0, stored)
  const card = state.cards.find((c) => c.id === id)
  return Math.max(0, Number(card?.baseWeight) || 1)
}

export function setSessionWeight(state, id, value) {
  state.session.weights[id] = Math.max(0, Math.min(99, Math.round(value)))
}

export function resetSession(state) {
  state.session.weights = {}
  state.session.seen = []
  state.session.currentId = null
  state.session.flipped = false
}

export function parseDeckJson(text) {
  const data = JSON.parse(text)
  let title = null
  let list = null
  if (Array.isArray(data)) {
    list = data
  } else if (data && Array.isArray(data.cards)) {
    list = data.cards
    if (typeof data.title === 'string' && data.title.trim()) title = data.title.trim()
    else if (typeof data.deck === 'string' && data.deck.trim()) title = data.deck.trim()
  } else {
    throw new Error('El JSON debe ser un array de tarjetas o un objeto { title, cards }.')
  }

  const cards = list.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`La tarjeta ${i + 1} no es un objeto.`)
    }
    const front = String(item.front ?? item.anverso ?? '').trim()
    const back = String(item.back ?? item.reverso ?? '').trim()
    if (!front || !back) {
      throw new Error(`La tarjeta ${i + 1} necesita "front" y "back".`)
    }
    const weight = Number(item.weight ?? item.peso ?? item.baseWeight ?? 1)
    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : uid(),
      front,
      back,
      baseWeight: Number.isFinite(weight) ? Math.max(0, Math.min(99, Math.round(weight))) : 1,
    }
  })

  return { title, cards }
}

export function exportDeck(state) {
  return {
    title: state.deckTitle,
    cards: state.cards.map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      weight: c.baseWeight,
    })),
  }
}

function eligible(state, exclude) {
  return state.cards.filter((c) => {
    if (exclude.has(c.id)) return false
    return sessionWeight(state, c.id) > 0
  })
}

export function pickCardId(state, extraExclude = []) {
  const exclude = new Set(extraExclude)
  if (state.session.unique) {
    for (const id of state.session.seen) exclude.add(id)
  }
  let pool = eligible(state, exclude)
  if (!pool.length && extraExclude.length) {
    pool = eligible(state, new Set(state.session.unique ? state.session.seen : []))
  }
  if (!pool.length) return null

  const total = pool.reduce((sum, c) => sum + sessionWeight(state, c.id), 0)
  let r = Math.random() * total
  for (const card of pool) {
    r -= sessionWeight(state, card.id)
    if (r <= 0) return card.id
  }
  return pool[pool.length - 1].id
}

export function markSeen(state, id) {
  if (!id || !state.session.unique) return
  if (!state.session.seen.includes(id)) state.session.seen.push(id)
}

export function remainingCount(state) {
  const seen = new Set(state.session.unique ? state.session.seen : [])
  if (state.session.unique && state.session.currentId) seen.add(state.session.currentId)
  return eligible(state, seen).length
}
