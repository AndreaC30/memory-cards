export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']

export const DOMAIN_THEMES = {
  essential: { label: 'Conceptos esenciales', hue: '215' },
  infra: { label: 'Infraestructura y Agent', hue: '168' },
  network: { label: 'Red y configuración', hue: '265' },
  collection: { label: 'Recolección de datos', hue: '28' },
  troubleshoot: { label: 'Troubleshooting', hue: '8' },
  viz: { label: 'Visualización y uso', hue: '195' },
}

const FOCUS_KEY = 'memory-cards-quiz-focus'

/** Tests cortos: un poco más exigente. */
export const DEFAULT_PASS_PERCENT = 70

/** Simulacro: % sobre 100 (= aciertos en las 75 que puntúan). 64% ≈ 48/75 (referencia). */
export const SIMULACRO_PASS_PERCENT = 64

/** Metas sobre 100%, por encima del mínimo de referencia. */
export const SIMULACRO_TARGETS = [
  { minPercent: 70, label: 'Sólido', hint: 'Buen margen sobre el mínimo' },
  { minPercent: 75, label: 'Muy bien', hint: 'Vas con confianza al examen' },
  { minPercent: 80, label: 'Excelente', hint: 'Objetivo alto — muy bien preparado' },
]

export function simulacroTargetLevel(scorePercent) {
  if (scorePercent < SIMULACRO_PASS_PERCENT) {
    return {
      label: 'Suspenso',
      hint: `Por debajo del ${SIMULACRO_PASS_PERCENT}% de referencia (dato real ~48/75)`,
    }
  }
  let level = {
    label: 'Aprobado (referencia)',
    hint: `≥${SIMULACRO_PASS_PERCENT}% — sigue subiendo hacia 70%+`,
  }
  for (const t of SIMULACRO_TARGETS) {
    if (scorePercent >= t.minPercent) level = t
  }
  return level
}

export function formatScorePercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0%'
  const rounded = Math.round(n * 10) / 10
  return `${rounded % 1 === 0 ? Math.round(rounded) : rounded.toFixed(1)}%`
}

export function passThreshold(total, percent = DEFAULT_PASS_PERCENT) {
  if (!total) return 0
  return Math.ceil((percent / 100) * total)
}

export function evaluatePass(correct, total, percent = DEFAULT_PASS_PERCENT) {
  const pct = total ? Math.round((correct / total) * 100) : 0
  const needed = passThreshold(total, percent)
  const passed = correct >= needed
  return { pct, needed, passed, percent }
}

/** Resultado tipo examen: X aciertos sobre 75 preguntas que puntúan. */
export function evaluateSimulacroScore(answersLog, scoring, percent = DEFAULT_PASS_PERCENT) {
  const pretest = new Set(scoring?.pretestItemIds || [])
  const scoredItems = scoring?.scoredItems ?? 75
  let scoredCorrect = 0
  let scoredAnswered = 0
  let totalCorrect = 0
  for (const row of answersLog) {
    if (row.ok) totalCorrect += 1
    if (pretest.has(row.questionId)) continue
    scoredAnswered += 1
    if (row.ok) scoredCorrect += 1
  }
  const pctOnScored = scoredItems ? Math.round((scoredCorrect / scoredItems) * 1000) / 10 : 0
  const needed = passThreshold(scoredItems, percent)
  const passed = pctOnScored >= percent
  const pctOnAll = answersLog.length ? Math.round((totalCorrect / answersLog.length) * 100) : 0
  return {
    scoredCorrect,
    scoredItems,
    needed,
    passed,
    percent,
    totalCorrect,
    totalItems: answersLog.length,
    pctOnScored,
    pctOnAll,
    pretestCount: pretest.size,
  }
}

export function loadFocusMode() {
  try {
    return localStorage.getItem(FOCUS_KEY) === '1'
  } catch {
    return false
  }
}

export function saveFocusMode(on) {
  try {
    localStorage.setItem(FOCUS_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function isMultipleQuestion(q) {
  return (
    q?.answerType === 'multiple' ||
    (Array.isArray(q?.correctIndices) && q.correctIndices.length > 1)
  )
}

export function getCorrectIndices(q) {
  if (isMultipleQuestion(q)) return [...q.correctIndices].sort((a, b) => a - b)
  if (Number.isFinite(q?.correctIndex)) return [q.correctIndex]
  return []
}

export function selectedIndices(quiz) {
  if (Array.isArray(quiz.selected)) return [...quiz.selected]
  if (quiz.selected >= 0) return [quiz.selected]
  return []
}

export function isAnswerCorrect(q, selected) {
  const correct = getCorrectIndices(q)
  const sel = [...selected].sort((a, b) => a - b)
  if (correct.length !== sel.length) return false
  return correct.every((v, i) => v === sel[i])
}

function canCheckSelection(q, selected) {
  if (isMultipleQuestion(q)) return selected.length >= 2
  return selected.length === 1
}

export function defaultQuizSession() {
  return {
    bank: [],
    domains: {},
    title: 'Test',
    loaded: false,
    loadError: '',
    manifest: null,
    packId: 'test-01',
    fixedPack: false,
    packDescription: '',
    domainFilter: 'all',
    mode: 'practice',
    queue: [],
    index: 0,
    selected: [],
    checked: false,
    correct: 0,
    answered: 0,
    finished: false,
    focusMode: loadFocusMode(),
    passPercent: DEFAULT_PASS_PERCENT,
    examType: null,
    scoring: null,
    answersLog: [],
    attemptSaved: false,
  }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function rebuildQueue(quiz, { shuffleItems = false } = {}) {
  let list = [...quiz.bank]
  if (!quiz.fixedPack && quiz.domainFilter !== 'all') {
    list = list.filter((q) => q.domain === quiz.domainFilter)
  }
  if (shuffleItems || (!quiz.fixedPack && quiz.mode !== 'fixed')) {
    list = shuffle(list)
  }
  if (!quiz.fixedPack && quiz.mode === 'exam25') {
    list = list.slice(0, 25)
  }
  quiz.queue = list
  quiz.index = 0
  quiz.selected = []
  quiz.checked = false
  quiz.correct = 0
  quiz.answered = 0
  quiz.finished = false
  quiz.answersLog = []
  quiz.attemptSaved = false
}

export async function loadManifest(baseUrl) {
  const res = await fetch(`${baseUrl}exams/manifest.json`)
  if (!res.ok) throw new Error(`No se pudo cargar el índice de exámenes (${res.status})`)
  return res.json()
}

export async function loadPack(baseUrl, file) {
  const res = await fetch(`${baseUrl}exams/${file}`)
  if (!res.ok) throw new Error(`No se pudo cargar ${file} (${res.status})`)
  const data = await res.json()
  return {
    title: data.title || 'Test Datadog',
    description: data.description || '',
    domains: data.domains || {},
    bank: data.questions || [],
    fixedPack: true,
    type: data.type,
    examType: data.type,
    scoring: data.scoring || null,
    passPercent:
      data.type === 'simulacro90'
        ? data.passPercent ?? data.examLike?.passPercent ?? SIMULACRO_PASS_PERCENT
        : data.passPercent ?? data.examLike?.passPercent ?? DEFAULT_PASS_PERCENT,
  }
}

export async function loadFullBank(baseUrl) {
  const res = await fetch(`${baseUrl}datadog-quiz.json`)
  if (!res.ok) throw new Error(`No se pudo cargar el banco completo (${res.status})`)
  const data = await res.json()
  return {
    title: data.title || 'Banco completo',
    description: `${data.count || 0} preguntas mezclables por tema.`,
    domains: data.domains || {},
    bank: data.questions || [],
    fixedPack: false,
    passPercent: DEFAULT_PASS_PERCENT,
  }
}

function packOptions(manifest, selectedId) {
  if (!manifest) return ''
  const opts = []
  for (const t of manifest.tests20 || []) {
    opts.push(
      `<option value="${t.file}" data-pack-id="${t.id}" ${selectedId === t.id ? 'selected' : ''}>${t.title}</option>`,
    )
  }
  opts.push('<option disabled>──────────</option>')
  for (const s of manifest.simulacros90 || []) {
    opts.push(
      `<option value="${s.file}" data-pack-id="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.title}</option>`,
    )
  }
  opts.push(
    `<option value="__full__" data-pack-id="full" ${selectedId === 'full' ? 'selected' : ''}>Banco completo (${manifest.poolSize || '?'} preg.)</option>`,
  )
  return opts.join('')
}

const SIMULACRO_GOAL_MARKERS = [
  { value: SIMULACRO_PASS_PERCENT, short: '64', title: 'Referencia aprobación (~48/75)' },
  { value: 70, short: '70', title: 'Sólido' },
  { value: 75, short: '75', title: 'Muy bien' },
  { value: 80, short: '80', title: 'Excelente' },
]

function renderSimulacroGoalTrack(quiz, escapeHtml) {
  const r = evaluateSimulacroScore(quiz.answersLog, quiz.scoring, quiz.passPercent ?? SIMULACRO_PASS_PERCENT)
  const pct = Math.min(100, Math.max(0, r.pctOnScored))
  const level = simulacroTargetLevel(pct)
  const markers = SIMULACRO_GOAL_MARKERS
    .map(
      (m) => `
        <span class="quiz-goals-marker ${pct >= m.value ? 'is-reached' : ''}" style="left:${m.value}%" title="${escapeHtml(m.title)}">
          <span class="quiz-goals-marker-line" aria-hidden="true"></span>
          <span class="quiz-goals-marker-label">${m.short}%</span>
        </span>`,
    )
    .join('')
  return `
    <div class="quiz-goals quiz-goals-sim" aria-label="Nota sobre 100 y objetivos 64, 70, 75 y 80 por ciento">
      <div class="quiz-goals-head">
        <span class="quiz-goals-now">${formatScorePercent(pct)}</span>
        <span class="help">sobre 100 · ${r.scoredCorrect}/${r.scoredItems} que puntúan · <strong>${escapeHtml(level.label)}</strong></span>
      </div>
      <div class="quiz-goals-track">
        <div class="quiz-goals-fill" style="width:${pct}%"></div>
        ${markers}
      </div>
      <p class="help quiz-goals-legend">Marcas: referencia examen (64%) y metas de estudio (70–80%). Las 15 pretest no cuentan en el %.</p>
    </div>`
}

function renderTestGoalTrack(quiz, escapeHtml) {
  const total = quiz.queue.length || 1
  const { pct } = evaluatePass(quiz.correct, total, quiz.passPercent ?? DEFAULT_PASS_PERCENT)
  const bar = Math.min(100, Math.max(0, pct))
  const pass = quiz.passPercent ?? DEFAULT_PASS_PERCENT
  return `
    <div class="quiz-goals quiz-goals-test" aria-label="Nota sobre 100 y mínimo de práctica">
      <div class="quiz-goals-head">
        <span class="quiz-goals-now">${formatScorePercent(bar)}</span>
        <span class="help">sobre 100 · ${quiz.correct}/${total} aciertos</span>
      </div>
      <div class="quiz-goals-track">
        <div class="quiz-goals-fill" style="width:${bar}%"></div>
        <span class="quiz-goals-marker ${bar >= pass ? 'is-reached' : ''}" style="left:${pass}%" title="Mínimo práctica">
          <span class="quiz-goals-marker-line" aria-hidden="true"></span>
          <span class="quiz-goals-marker-label">${pass}%</span>
        </span>
      </div>
    </div>`
}

function optionClass(q, quiz, i) {
  const selected = selectedIndices(quiz)
  const correct = getCorrectIndices(q)
  const isSel = selected.includes(i)
  let cls = 'quiz-option'
  if (!quiz.checked) {
    if (isSel) cls += ' is-selected'
    return cls
  }
  const isCorrect = correct.includes(i)
  if (isCorrect) cls += ' is-correct'
  if (isSel && !isCorrect) cls += ' is-wrong'
  if (!isSel && isCorrect) cls += ' is-missed'
  return cls
}

export function renderQuiz(quiz, escapeHtml) {
  if (!quiz.manifest && !quiz.loaded && !quiz.loadError) {
    return `
      <section class="empty quiz-empty">
        <h2>Modo test</h2>
        <p>Cargando lista de exámenes…</p>
      </section>
    `
  }

  if (!quiz.loaded && !quiz.loadError) {
    return `
      <section class="empty quiz-empty">
        <h2>Modo test — Datadog Fundamentals</h2>
        <p>Tests de <strong>20</strong> preguntas y <strong>3 simulacros de 90</strong>. Incluye preguntas de <strong>una</strong> y de <strong>varias</strong> respuestas correctas.</p>
        <label class="quiz-pick-pack">Elige examen
          <select data-quiz="pack-select">${packOptions(quiz.manifest, quiz.packId)}</select>
        </label>
        <button type="button" class="primary" data-quiz="load">Empezar</button>
        <p class="help">Contenido: 13 URLs del notebook + material emberize. Regenerar: <code>node scripts/build-exam-packs.mjs</code></p>
      </section>
    `
  }

  if (quiz.loadError) {
    return `
      <section class="empty">
        <h2>No se pudo cargar el test</h2>
        <p class="notice">${escapeHtml(quiz.loadError)}</p>
        <button type="button" class="primary" data-quiz="load">Reintentar</button>
      </section>
    `
  }

  if (!quiz.bank.length) {
    return `
      <section class="empty">
        <h2>Sin preguntas</h2>
        <p>El banco está vacío.</p>
      </section>
    `
  }

  if (quiz.finished || !quiz.queue.length) {
    const percent = quiz.passPercent ?? DEFAULT_PASS_PERCENT
    const isSimulacro = quiz.examType === 'simulacro90' && quiz.scoring

    if (isSimulacro) {
      const r = evaluateSimulacroScore(quiz.answersLog, quiz.scoring, percent)
      const scorePct = r.pctOnScored
      const target = simulacroTargetLevel(scorePct)
      const nextTarget = SIMULACRO_TARGETS.find((t) => scorePct < t.minPercent)
      const resultLine = r.passed
        ? nextTarget
          ? `Referencia superada. Siguiente meta: ≥${nextTarget.minPercent}% («${nextTarget.label}»).`
          : `¡${target.label}! ${target.hint}`
        : `Te faltan ${Math.max(0, Math.round((percent - scorePct) * 10) / 10)} puntos para el ${percent}% de referencia.`
      const officialNote =
        `Nota sobre 100 = aciertos en las 75 que puntúan. Las 90 del examen incluyen 15 pretest (no cuentan en el %). El ${SIMULACRO_PASS_PERCENT}% es solo referencia (≈48/75); tu objetivo puede ser 70–80+.`
      const badgeClass = !r.passed
        ? 'is-fail'
        : scorePct >= (SIMULACRO_TARGETS[0]?.minPercent ?? 70)
          ? 'is-pass'
          : 'is-pass-min'
      return `
        <section class="quiz-summary ${badgeClass}" data-quiz-finished="1">
          <h2>Resultado del simulacro</h2>
          <p class="quiz-result-badge" aria-live="polite">${target.label}</p>
          <p class="quiz-score">${formatScorePercent(scorePct)}</p>
          <p class="quiz-score-sub">sobre 100 (75 preguntas que puntúan)</p>
          <p class="quiz-target-hint">${escapeHtml(target.hint)}</p>
          <p class="quiz-score-detail">Referencia examen: ${r.scoredCorrect}/${r.scoredItems} · ${r.totalCorrect}/${r.totalItems} en las 90 · aprobación ref. ≥${percent}%</p>
          <p class="quiz-result-message">${resultLine}</p>
          <p class="help quiz-pass-note">${officialNote}</p>
          <button type="button" class="primary" data-quiz="restart">Repetir este examen</button>
          <button type="button" class="ghost" data-quiz="pick-another">Elegir otro examen</button>
        </section>
      `
    }

    const total = quiz.queue.length
    const { pct, needed, passed } = evaluatePass(quiz.correct, total, percent)
    const margin = quiz.correct - needed
    const resultLine = passed
      ? `¡Aprobado! Superaste el mínimo de práctica (${percent}%).`
      : `No aprobado. Te faltaron ${Math.abs(margin)} acierto${Math.abs(margin) === 1 ? '' : 's'} para el ${percent}%.`
    const officialNote = `Mínimo de referencia: ${needed} de ${total} aciertos (${percent}%). En el examen oficial son 90 preguntas y el informe es X/75.`
    return `
      <section class="quiz-summary ${passed ? 'is-pass' : 'is-fail'}" data-quiz-finished="1">
        <h2>Resultado del test</h2>
        <p class="quiz-result-badge" aria-live="polite">${passed ? 'Aprobado' : 'Suspenso'}</p>
        <p class="quiz-score">${formatScorePercent(pct)}</p>
        <p class="quiz-score-sub">sobre 100</p>
        <p class="quiz-score-detail">${quiz.correct} aciertos de ${total} · hacían falta al menos <strong>${needed}</strong></p>
        <p class="quiz-result-message">${resultLine}</p>
        <p class="help quiz-pass-note">${officialNote}</p>
        <button type="button" class="primary" data-quiz="restart">Repetir este examen</button>
        <button type="button" class="ghost" data-quiz="pick-another">Elegir otro examen</button>
      </section>
    `
  }

  const q = quiz.queue[quiz.index]
  if (!q) {
    quiz.finished = true
    return renderQuiz(quiz, escapeHtml)
  }

  const multi = isMultipleQuestion(q)
  const domainKey = q.domain && DOMAIN_THEMES[q.domain] ? q.domain : 'essential'
  const progressPct = Math.round(((quiz.index + (quiz.checked ? 1 : 0)) / quiz.queue.length) * 100)
  const selected = selectedIndices(quiz)
  const correct = getCorrectIndices(q)

  const options = q.options
    .map((text, i) => {
      const key = OPTION_KEYS[i] || String(i + 1)
      const role = multi ? 'checkbox' : 'radio'
      return `
      <button type="button" class="${optionClass(q, quiz, i)}"
        data-quiz="pick" data-index="${i}" ${quiz.checked ? 'disabled' : ''} role="${role}" aria-checked="${selected.includes(i)}">
        <span class="quiz-key">${key}</span>
        <span>${escapeHtml(text)}</span>
      </button>`
    })
    .join('')

  let feedback = ''
  if (quiz.checked) {
    const ok = isAnswerCorrect(q, selected)
    const correctLabels = correct.map((i) => OPTION_KEYS[i]).join(', ')
    const correctTexts = correct.map((i) => q.options[i]).filter(Boolean).join(' · ')
    const why = q.whyCorrect || q.explanation || ''
    const sourceUrl = q.sourceUrl || ''
    const sourceTitle = q.sourceTitle || 'Documentación Datadog'
    const sourceLink = sourceUrl
      ? `<p class="quiz-source-ref"><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Consultar: ${escapeHtml(sourceTitle)}</a></p>`
      : ''
    feedback = `
      <div class="quiz-feedback ${ok ? 'is-ok' : 'is-bad'}">
        <p class="quiz-verdict"><strong>${ok ? 'Correcto' : 'Incorrecto'}</strong></p>
        <p class="quiz-correct-line">Respuesta correcta: <strong>${correctLabels}</strong>${multi ? ' (todas las que aplican)' : ''} — ${escapeHtml(correctTexts)}</p>
        <h3 class="quiz-why-heading">Por qué ${multi ? 'son correctas' : 'es correcta'}</h3>
        <p class="quiz-why-body">${escapeHtml(why)}</p>
        ${sourceLink}
        ${q.explanation && q.whyCorrect && q.explanation !== q.whyCorrect ? `<details class="quiz-more-detail"><summary>Más detalle</summary><p>${escapeHtml(q.explanation)}</p></details>` : ''}
      </div>
    `
  }

  const domainOpts = Object.entries(quiz.domains)
    .map(
      ([key, label]) =>
        `<option value="${escapeHtml(key)}" ${quiz.domainFilter === key ? 'selected' : ''}>${escapeHtml(label)}</option>`,
    )
    .join('')

  const extraTools = quiz.fixedPack
    ? `<p class="meta quiz-pack-desc">${escapeHtml(quiz.packDescription || '')}</p>`
    : `
        <label>Tema
          <select data-quiz="domain">
            <option value="all" ${quiz.domainFilter === 'all' ? 'selected' : ''}>Todos</option>
            ${domainOpts}
          </select>
        </label>
        <label>Modo
          <select data-quiz="mode">
            <option value="practice" ${quiz.mode === 'practice' ? 'selected' : ''}>Todas (barajadas)</option>
            <option value="exam25" ${quiz.mode === 'exam25' ? 'selected' : ''}>Muestra 25</option>
          </select>
        </label>`

  const checkDisabled = !canCheckSelection(q, selected)

  return `
    <section class="quiz quiz-panel domain-${domainKey} ${quiz.focusMode ? 'is-focus' : ''} ${multi ? 'is-multi' : ''}" data-domain="${domainKey}">
      <div class="quiz-toolbar">
        ${extraTools}
        <button type="button" class="ghost" data-quiz="shuffle">Barajar orden</button>
        <button type="button" class="ghost" data-quiz="pick-another">Cambiar examen</button>
        <button type="button" class="ghost quiz-focus-toggle ${quiz.focusMode ? 'is-on' : ''}" data-quiz="focus-toggle" aria-pressed="${quiz.focusMode}">
          ${quiz.focusMode ? 'Modo color' : 'Modo enfoque'}
        </button>
      </div>
      <div class="quiz-progress" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del test">
        <div class="quiz-progress-fill" style="width:${progressPct}%"></div>
      </div>
      ${
        quiz.examType === 'simulacro90' && quiz.scoring
          ? renderSimulacroGoalTrack(quiz, escapeHtml)
          : quiz.fixedPack && quiz.queue.length <= 25
            ? renderTestGoalTrack(quiz, escapeHtml)
            : ''
      }
      <p class="meta quiz-meta-line"><strong>${escapeHtml(quiz.title)}</strong> · Pregunta ${quiz.index + 1} de ${quiz.queue.length} · Aciertos ${quiz.correct} / ${quiz.answered}</p>
      <span class="quiz-domain-pill">${escapeHtml(q.domainLabel || DOMAIN_THEMES[domainKey]?.label || '')}</span>
      ${multi ? '<p class="quiz-multi-hint">Respuesta múltiple: marca <strong>todas</strong> las opciones correctas.</p>' : ''}
      <h2 class="quiz-question">${escapeHtml(q.question)}</h2>
      <div class="quiz-options" role="${multi ? 'group' : 'radiogroup'}" aria-label="Opciones de respuesta">${options}</div>
      <div class="row">
        ${quiz.checked ? `<button type="button" class="primary" data-quiz="next">${quiz.index >= quiz.queue.length - 1 ? 'Ver resultado' : 'Siguiente'}</button>` : `<button type="button" class="primary" data-quiz="check" ${checkDisabled ? 'disabled' : ''}>Comprobar</button>`}
      </div>
      ${feedback}
      <p class="hints">${multi ? 'Marca varias · Enter comprueba o avanza' : 'Teclas 1–4 eligen · Enter comprueba o avanza'}</p>
    </section>
  `
}

export function handleQuizAction(quiz, action, detail) {
  if (action === 'load' || action === 'pick-another') {
    if (action === 'pick-another') {
      quiz.loaded = false
      quiz.loadError = ''
      quiz.bank = []
    }
    return { async: true }
  }
  if (action === 'restart') {
    rebuildQueue(quiz, { shuffleItems: quiz.fixedPack })
    return {}
  }
  if (action === 'shuffle') {
    rebuildQueue(quiz, { shuffleItems: true })
    return {}
  }
  if (action === 'focus-toggle') {
    quiz.focusMode = !quiz.focusMode
    saveFocusMode(quiz.focusMode)
    return {}
  }
  if (action === 'pack-select') {
    quiz.packId = detail.packId
    quiz.packFile = detail.file
    return {}
  }
  if (action === 'domain') {
    quiz.domainFilter = detail
    rebuildQueue(quiz)
    return {}
  }
  if (action === 'mode') {
    quiz.mode = detail
    rebuildQueue(quiz)
    return {}
  }
  if (action === 'pick') {
    if (quiz.checked) return {}
    const q = quiz.queue[quiz.index]
    if (!q) return {}
    const idx = detail
    if (isMultipleQuestion(q)) {
      const set = new Set(selectedIndices(quiz))
      if (set.has(idx)) set.delete(idx)
      else set.add(idx)
      quiz.selected = [...set].sort((a, b) => a - b)
    } else {
      quiz.selected = [idx]
    }
    return {}
  }
  if (action === 'check') {
    const q = quiz.queue[quiz.index]
    const sel = selectedIndices(quiz)
    if (!q || quiz.checked || !canCheckSelection(q, sel)) return {}
    quiz.checked = true
    quiz.answered += 1
    const ok = isAnswerCorrect(q, sel)
    if (ok) quiz.correct += 1
    quiz.answersLog.push({ questionId: q.id, ok })
    return {}
  }
  if (action === 'next') {
    if (quiz.index >= quiz.queue.length - 1) {
      quiz.finished = true
      return { finished: true }
    } else {
      quiz.index += 1
      quiz.selected = []
      quiz.checked = false
    }
    return {}
  }
  return {}
}

export function quizKeydown(quiz, event) {
  if (quiz.finished || !quiz.queue.length) return false
  const q = quiz.queue[quiz.index]
  if (quiz.checked) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleQuizAction(quiz, 'next')
      return true
    }
    return false
  }
  const num = Number(event.key)
  const maxKey = q?.options?.length || 4
  if (num >= 1 && num <= maxKey) {
    handleQuizAction(quiz, 'pick', num - 1)
    return true
  }
  const sel = selectedIndices(quiz)
  if (event.key === 'Enter' && canCheckSelection(q, sel)) {
    event.preventDefault()
    handleQuizAction(quiz, 'check')
    return true
  }
  return false
}
