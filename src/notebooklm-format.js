/** JSON de cuestionario de estudio (exportado desde cuaderno / NotebookLM). Sin dependencias del DOM. */

export const NOTEBOOKLM_SCHEMA_HINT = {
  titulo: 'Título del cuestionario',
  descripcion: 'Descripción opcional',
  total_preguntas: 20,
  preguntas: [
    {
      id: 1,
      fuente_tema: 'Tema o fuente en el cuaderno',
      pregunta: 'Enunciado de la pregunta',
      opciones: ['A) …', 'B) …', 'C) …', 'D) …'],
      respuesta_correcta: 'B) …',
      explicacion: 'Por qué es correcta',
      pista: 'Opcional',
    },
  ],
}

const DOMAIN_LABELS = {
  essential: 'Conceptos esenciales',
  infra: 'Infraestructura y Agent',
  network: 'Red y configuración',
  collection: 'Recolección de datos',
  troubleshoot: 'Troubleshooting',
  viz: 'Visualización y uso',
}

export function stripOptionPrefix(text) {
  return String(text).replace(/^[A-F]\)\s*/i, '').trim()
}

export function resolveCorrectIndex(options, answer) {
  const raw = String(answer ?? '').trim()
  if (!raw) return -1
  const exact = options.findIndex((o) => String(o).trim() === raw)
  if (exact >= 0) return exact
  const want = stripOptionPrefix(raw)
  return options.findIndex((o) => stripOptionPrefix(o) === want)
}

export function inferDomainFromTema(tema) {
  const t = String(tema || '').toLowerCase()
  if (/docker|agent|fleet|host|servidor|infra|autodiscovery|integraci/.test(t)) return 'infra'
  if (/dogstatsd|métric|metric|api de métric|apm|ddtrace|span/.test(t)) return 'collection'
  if (/monitor|downtime|outlier|forecast|composite|alert/.test(t)) return 'troubleshoot'
  if (/consulta|gráfico|aggregat|dashboard/.test(t)) return 'viz'
  if (/clave|api|aplicación|application/.test(t)) return 'network'
  return 'essential'
}

export function notebookLmQuestionToApp(q, i, { idPrefix = 'nb' } = {}) {
  const rawOpts = q.opciones || q.options || []
  const options = rawOpts.map((o) => stripOptionPrefix(o))
  let correctIndex = resolveCorrectIndex(rawOpts, q.respuesta_correcta ?? q.respuesta)
  if (correctIndex < 0) correctIndex = resolveCorrectIndex(options, q.respuesta_correcta)
  const correctIndices = Array.isArray(q.respuestas_correctas)
    ? q.respuestas_correctas.map((a) => resolveCorrectIndex(rawOpts, a)).filter((n) => n >= 0)
    : []
  const multiple = correctIndices.length > 1
  const tema = q.fuente_tema || q.tema || ''
  const domain = q.domain || inferDomainFromTema(tema)
  return {
    id: `${idPrefix}-${q.id ?? i + 1}`,
    domain,
    domainLabel: q.domainLabel || DOMAIN_LABELS[domain] || tema,
    question: q.pregunta || q.question,
    options,
    correctIndex: multiple ? correctIndices[0] : correctIndex >= 0 ? correctIndex : 0,
    ...(multiple ? { correctIndices } : {}),
    explanation: q.explicacion || q.explanation || '',
    whyCorrect: q.explicacion || q.explanation || '',
    hint: q.pista || q.hint || '',
    sourceTitle: tema || 'Documentación Datadog',
    sourceUrl: q.url_fuente || q.sourceUrl || '',
    sourceTag: 'study-pack',
    answerType: multiple ? 'multiple' : 'single',
  }
}

/** Convierte el JSON raíz de NotebookLM (español) al formato interno questions[]. */
export function notebookLmEsToStandard(data, { defaultPassPercent = 70 } = {}) {
  const preguntas = data?.preguntas
  if (!Array.isArray(preguntas) || !preguntas.length) return data
  return {
    title: data.titulo || data.title || 'Cuestionario NotebookLM',
    description: data.descripcion || data.description || '',
    passPercent: data.passPercent ?? defaultPassPercent,
    questions: preguntas.map((q, i) => notebookLmQuestionToApp(q, i)),
  }
}
