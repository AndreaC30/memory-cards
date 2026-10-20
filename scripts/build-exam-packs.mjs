/**
 * Genera tests de 20 preguntas y simulacros de 90 (certificación) a partir del
 * banco de estudio: todos los JSON de data/notebooklm/ (formato NotebookLM en español).
 *
 * node scripts/build-exam-packs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { NOTEBOOK_SOURCES, DOMAIN_LABELS } from "./sources.mjs"
import { notebookLmQuestionToApp } from "../src/notebooklm-format.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const STUDY_DIR = join(root, "data", "notebooklm")
const TEST_SIZE = 20
const SIM_SIZE = 90
const SIM_PRETEST = 15

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffleWithSeed(arr, seed) {
  const rnd = mulberry32(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Baraja las opciones de forma determinista y recalcula los índices correctos. */
function shuffleOptions(q) {
  const order = shuffleWithSeed(
    q.options.map((_, i) => i),
    hashSeed(q.id),
  )
  const newIndex = (old) => order.indexOf(old)
  const out = { ...q, options: order.map((i) => q.options[i]), correctIndex: newIndex(q.correctIndex) }
  if (q.correctIndices) out.correctIndices = q.correctIndices.map(newIndex).sort((a, b) => a - b)
  return out
}

function loadStudyBank() {
  const files = readdirSync(STUDY_DIR).filter((f) => f.endsWith(".json")).sort()
  const seen = new Set()
  const bank = []
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(STUDY_DIR, file), "utf8"))
    const prefix = file === "preguntas_datadog.json" ? "nb" : "doc"
    for (const [i, raw] of (data.preguntas || []).entries()) {
      const q = notebookLmQuestionToApp(raw, i, { idPrefix: prefix })
      const key = q.question.toLowerCase().trim()
      if (seen.has(key) || seen.has(q.id)) continue
      seen.add(key)
      seen.add(q.id)
      bank.push(shuffleOptions(q))
    }
    console.log(`  ${file}: ${data.preguntas?.length || 0} preguntas`)
  }
  return bank
}

/** Orden barajado que reparte cada dominio de forma proporcional a lo largo de todo el orden. */
function balancedOrder(pool, seed) {
  const byDomain = new Map()
  for (const q of shuffleWithSeed(pool, seed)) {
    if (!byDomain.has(q.domain)) byDomain.set(q.domain, [])
    byDomain.get(q.domain).push(q)
  }
  const rnd = mulberry32(seed + 1)
  const placed = [...byDomain.values()].flatMap((list) => {
    const offset = rnd()
    return list.map((q, k) => ({ q, pos: (k + offset) / list.length }))
  })
  return placed.sort((a, b) => a.pos - b.pos).map((p) => p.q)
}

/** Toma `size` preguntas empezando en `start`, dando la vuelta al final del orden. */
function takeWrapped(order, start, size) {
  return Array.from({ length: Math.min(size, order.length) }, (_, i) => order[(start + i) % order.length])
}

function markPretestQuestions(questions, seed, pretestCount) {
  const indices = shuffleWithSeed(
    questions.map((_, i) => i),
    seed,
  ).slice(0, pretestCount)
  const pretestSet = new Set(indices)
  return {
    questions: questions.map((q, i) => ({ ...q, isPretest: pretestSet.has(i) })),
    pretestItemIds: indices.map((i) => questions[i].id),
  }
}

function writePack(dir, name, meta, questions, scoring = null) {
  const body = { ...meta, count: questions.length, domains: DOMAIN_LABELS, questions }
  if (scoring) body.scoring = scoring
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(body, null, 2), "utf8")
  return `${name}.json`
}

function main() {
  console.log("Cargando banco de estudio (data/notebooklm/*.json)…")
  const pool = loadStudyBank()
  console.log(`Banco total: ${pool.length} preguntas únicas (${pool.filter((q) => q.correctIndices).length} de respuesta múltiple)`)

  const outDir = join(root, "public", "exams")
  mkdirSync(outDir, { recursive: true })
  for (const f of readdirSync(outDir)) {
    if (/^(test-\d+|simulacro-[a-z]|notebooklm-datadog-20)\.json$/.test(f)) rmSync(join(outDir, f))
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    poolSize: pool.length,
    notebookSources: NOTEBOOK_SOURCES.map((s) => s.url),
    tests20: [],
    simulacros90: [],
  }

  const testOrder = balancedOrder(pool, 1017)
  const testCount = Math.ceil(pool.length / TEST_SIZE)
  for (let i = 0; i < testCount; i++) {
    const id = `test-${String(i + 1).padStart(2, "0")}`
    const file = writePack(
      outDir,
      id,
      {
        id,
        title: `Test ${i + 1} — 20 preguntas`,
        type: "test20",
        description: "Preguntas basadas en la documentación oficial de Datadog. Aprobado práctica: ≥70%.",
        passPercent: 70,
      },
      takeWrapped(testOrder, i * TEST_SIZE, TEST_SIZE),
    )
    manifest.tests20.push({ id, file, title: `Test ${i + 1} (20)` })
  }

  const simOrder = balancedOrder(pool, 9001)
  for (const [i, letter] of ["a", "b", "c"].entries()) {
    const id = `simulacro-${letter}`
    const title = `Simulacro ${letter.toUpperCase()} — 90 preguntas`
    const raw = shuffleWithSeed(takeWrapped(simOrder, i * SIM_SIZE, SIM_SIZE), 9100 + i)
    const { questions, pretestItemIds } = markPretestQuestions(raw, 9200 + i, SIM_PRETEST)
    const file = writePack(
      outDir,
      id,
      {
        id,
        title,
        type: "simulacro90",
        description: "90 preguntas, resultado X/75. Mínimo referencia 48/75; apunta a 55–60+ para ir tranquilo.",
        passPercent: 64,
        examLike: { durationMinutes: 120, scoredItems: 75, pretestItems: SIM_PRETEST, passPercent: 64, passMinScored: 48 },
      },
      questions,
      { totalItems: SIM_SIZE, scoredItems: 75, pretestItems: SIM_PRETEST, pretestItemIds },
    )
    manifest.simulacros90.push({ id, file, title })
  }

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  writeFileSync(
    join(root, "public", "datadog-quiz.json"),
    JSON.stringify(
      {
        title: "Datadog Fundamentals — banco completo",
        generatedAt: new Date().toISOString(),
        count: pool.length,
        domains: DOMAIN_LABELS,
        questions: pool,
      },
      null,
      2,
    ),
    "utf8",
  )
  console.log(`OK: ${testCount} tests de 20 + 3 simulacros de 90 en public/exams/`)
}

if (!existsSync(STUDY_DIR)) throw new Error(`Falta ${STUDY_DIR}`)
main()
