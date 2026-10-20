import {
  DEFAULT_PASS_PERCENT,
  SIMULACRO_PASS_PERCENT,
  evaluatePass,
  evaluateSimulacroScore,
} from './quiz.js'

const KEY = 'memory-cards:quiz-history:v1'

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveHistory(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

export function historyStats(history) {
  const total = history.length
  if (!total) {
    return { total: 0, passed: 0, failed: 0, passedPct: 0, failedPct: 0 }
  }
  const passed = history.filter((h) => h.passed).length
  const failed = total - passed
  return {
    total,
    passed,
    failed,
    passedPct: Math.round((passed / total) * 100),
    failedPct: Math.round((failed / total) * 100),
  }
}

/** Mejor nota y si alguna vez aprobó, por packId. */
export function historyByPack(history) {
  const map = new Map()
  for (const row of history) {
    const cur = map.get(row.packId) || {
      packId: row.packId,
      title: row.title,
      packFile: row.packFile,
      attempts: 0,
      bestPercent: 0,
      everPassed: false,
      lastPercent: 0,
      lastPassed: false,
    }
    cur.attempts += 1
    cur.bestPercent = Math.max(cur.bestPercent, row.scorePercent)
    if (row.passed) cur.everPassed = true
    cur.lastPercent = row.scorePercent
    cur.lastPassed = row.passed
    cur.title = row.title
    cur.packFile = row.packFile
    map.set(row.packId, cur)
  }
  return [...map.values()]
}

export function buildAttemptFromQuiz(quiz) {
  if (!quiz.finished || !quiz.queue?.length) return null

  const passBar =
    quiz.examType === 'simulacro90'
      ? quiz.passPercent ?? SIMULACRO_PASS_PERCENT
      : quiz.passPercent ?? DEFAULT_PASS_PERCENT

  let scorePercent = 0
  let passed = false
  let detail = {}

  if (quiz.examType === 'simulacro90' && quiz.scoring) {
    const r = evaluateSimulacroScore(quiz.answersLog, quiz.scoring, passBar)
    scorePercent = r.pctOnScored
    passed = scorePercent >= passBar
    detail = {
      scoredCorrect: r.scoredCorrect,
      scoredItems: r.scoredItems,
      totalCorrect: r.totalCorrect,
      totalItems: r.totalItems,
    }
  } else {
    const total = quiz.queue.length
    const ev = evaluatePass(quiz.correct, total, passBar)
    scorePercent = ev.pct
    passed = ev.passed
    detail = { correct: quiz.correct, total }
  }

  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    packId: quiz.packId || quiz.packFile || 'unknown',
    packFile: quiz.packFile || '',
    title: quiz.title || 'Test',
    examType: quiz.examType || 'test',
    scorePercent,
    passed,
    passBarPercent: passBar,
    detail,
  }
}

export function addAttempt(quiz) {
  const row = buildAttemptFromQuiz(quiz)
  if (!row) return null
  const list = loadHistory()
  list.unshift(row)
  saveHistory(list.slice(0, 200))
  return row
}

export function renderHistory(history, escapeHtml) {
  const stats = historyStats(history)
  const byPack = historyByPack(history)

  if (!history.length) {
    return `
      <section class="empty history-empty">
        <h2>Historial de tests</h2>
        <p>Aún no has terminado ningún examen. Cuando completes uno, aquí verás tu <strong>nota sobre 100%</strong> y si aprobaste.</p>
      </section>
    `
  }

  const packRows = byPack
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => {
      const status = p.everPassed
        ? '<span class="hist-ok">Aprobado alguna vez</span>'
        : '<span class="hist-bad">Sin aprobar aún</span>'
      return `
        <li class="history-pack-row">
          <div>
            <strong>${escapeHtml(p.title)}</strong>
            <span class="help">${p.attempts} intento${p.attempts === 1 ? '' : 's'} · mejor ${p.bestPercent}% · último ${p.lastPercent}%</span>
            ${status}
          </div>
          <button type="button" class="${p.everPassed ? 'ghost' : 'primary'}" data-history-retry="${escapeHtml(p.packFile)}" data-history-pack-id="${escapeHtml(p.packId)}">${p.everPassed ? 'Repetir' : 'Repetir hasta aprobar'}</button>
        </li>`
    })
    .join('')

  const attemptRows = history
    .map((h) => {
      const date = new Date(h.at)
      const when = date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      const badge = h.passed
        ? '<span class="hist-badge hist-badge-ok">Aprobado</span>'
        : '<span class="hist-badge hist-badge-bad">Suspenso</span>'
      const ref =
        h.examType === 'simulacro90' && h.detail?.scoredCorrect != null
          ? ` <span class="help">(${h.detail.scoredCorrect}/${h.detail.scoredItems} referencia examen)</span>`
          : ''
      return `
        <li class="history-attempt-row ${h.passed ? 'is-pass' : 'is-fail'}">
          <div>
            ${badge}
            <strong class="hist-score">${h.scorePercent}%</strong>
            <span class="help">${escapeHtml(h.title)} · ${when}${ref}</span>
          </div>
          <button type="button" class="ghost" data-history-retry="${escapeHtml(h.packFile)}" data-history-pack-id="${escapeHtml(h.packId)}">Repetir</button>
        </li>`
    })
    .join('')

  return `
    <section class="history">
      <h2>Historial</h2>
      <p class="help">Todas las notas son <strong>sobre 100%</strong> (en simulacros: % de aciertos en las 75 que puntúan). Aprobar referencia: ≥${SIMULACRO_PASS_PERCENT}% simulacro, ≥${DEFAULT_PASS_PERCENT}% tests de 20.</p>
      <div class="history-stats">
        <div class="history-stat">
          <strong>${stats.passedPct}%</strong>
          <span>Aprobados (${stats.passed}/${stats.total})</span>
        </div>
        <div class="history-stat">
          <strong>${stats.failedPct}%</strong>
          <span>Suspendidos (${stats.failed}/${stats.total})</span>
        </div>
      </div>
      <h3 class="history-sub">Por examen</h3>
      <ul class="history-pack-list">${packRows}</ul>
      <h3 class="history-sub">Todos los intentos</h3>
      <ul class="history-attempt-list">${attemptRows}</ul>
      <button type="button" class="danger history-clear" data-history="clear">Borrar historial</button>
    </section>
  `
}
