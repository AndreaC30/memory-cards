/** Filtros para no meter en tests preguntas ilegibles o “trozo de documentación”. */

const BANNED_QUESTION = [
  /consulta al gráfico/i,
  /¿qué describe la documentación/i,
  /¿qué describe la doc/i,
  /encontrar las series temporales/i,
]

const URL_HEAVY = /https?:\/\/\S{20,}/

export function isReadableOption(text, maxLen = 220) {
  const s = String(text || "").trim()
  if (s.length < 4 || s.length > maxLen) return false
  if (URL_HEAVY.test(s)) return false
  if ((s.match(/https?:\/\//g) || []).length >= 2) return false
  return true
}

export function isUsableMcqQuestion(q) {
  if (!q?.question || !Array.isArray(q.options) || q.options.length < 2) return false
  const stem = String(q.question).trim()
  if (stem.length < 12 || stem.length > 320) return false
  if (BANNED_QUESTION.some((re) => re.test(stem))) return false
  if (!q.options.every((o) => isReadableOption(o))) return false
  if (q.sourceTag === "study-pack" || q.sourceTag === "notebooklm") return true
  const correct = q.correctIndex ?? 0
  if (!q.options[correct]) return false
  return true
}

export function filterUsableQuestions(list) {
  return list.filter(isUsableMcqQuestion)
}
