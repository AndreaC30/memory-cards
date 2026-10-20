/**
 * Genera tests de 20 preguntas y simulacros de 90 (certificación).
 * Combina banco emberize + hechos extraídos de las 13 URLs del notebook.
 *
 * node scripts/build-quiz.mjs      (emberize → public/datadog-quiz.json)
 * node scripts/build-exam-packs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { NOTEBOOK_SOURCES, DOMAIN_LABELS } from "./sources.mjs"
import { buildWhyCorrect, stripMarkdown } from "./rationale.mjs"
import { buildMultiQuestions } from "./multi-questions.mjs"
import { summarizeOptionText } from "./option-text.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

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

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractDocFacts(html, source) {
  const facts = []
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi
  let m
  while ((m = re.exec(clean)) !== null) {
    const heading = stripHtml(m[1]).slice(0, 120)
    const body = stripHtml(m[2]).slice(0, 500)
    if (heading.length < 8 || body.length < 40) continue
    if (/cookie|consent|navigation/i.test(heading)) continue
    facts.push({ heading, body, source })
  }
  if (!facts.length) {
    const text = stripHtml(clean).slice(0, 4000)
    if (text.length > 120) facts.push({ heading: source.title, body: text, source })
  }
  return facts
}

function answerSummary(text) {
  return summarizeOptionText(stripMarkdown(text))
}

function pickDistractors(card, pool, rnd) {
  const picked = []
  const used = new Set([answerSummary(card.back).toLowerCase()])
  const candidates = pool.filter((c) => c.id !== card.id)
  const same = candidates.filter((c) => c.domain === card.domain)
  const ordered = [...same, ...candidates.filter((c) => c.domain !== card.domain)]
  while (picked.length < 3 && ordered.length) {
    const idx = Math.floor(rnd() * ordered.length)
    const c = ordered.splice(idx, 1)[0]
    const s = answerSummary(c.back)
    const key = s.toLowerCase()
    if (used.has(key) || s.length < 10) continue
    used.add(key)
    picked.push(s)
  }
  while (picked.length < 3) picked.push(`Opción incorrecta (${picked.length + 1})`)
  return picked
}

function toMcq(card, pool) {
  const rnd = mulberry32(hashSeed(card.id))
  const correctText = answerSummary(card.back)
  const options = [correctText, ...pickDistractors(card, pool, rnd)]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  const rationale = buildWhyCorrect(card, correctText)
  return {
    id: card.id,
    domain: card.domain,
    domainLabel: DOMAIN_LABELS[card.domain] || card.domain,
    question: card.front,
    options,
    correctIndex: options.indexOf(correctText),
    explanation: stripMarkdown(card.back),
    whyCorrect: rationale.whyCorrect,
    sourceUrl: rationale.sourceUrl,
    sourceTitle: rationale.sourceTitle,
    sourceTag: card.sourceTag || "emberize",
    answerType: "single",
  }
}

async function fetchFacts() {
  const cards = []
  for (const source of NOTEBOOK_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "memory-cards-study-bot/1.0" },
      })
      if (!res.ok) {
        console.warn(`SKIP ${source.id}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      const facts = extractDocFacts(html, source)
      facts.slice(0, 12).forEach((f, i) => {
        cards.push({
          id: `doc-${source.id}-${i}`,
          domain: source.domain,
          front: `(${source.title}) ¿Qué describe la documentación sobre «${stripMarkdown(f.heading)}»?`,
          back: stripMarkdown(f.body),
          docHeading: stripMarkdown(f.heading),
          sourceTag: source.id,
          sourceUrl: source.url,
          sourceTitle: source.title,
        })
      })
      console.log(`  ${source.id}: ${Math.min(facts.length, 12)} preguntas`)
    } catch (err) {
      console.warn(`SKIP ${source.id}:`, err.message)
    }
  }
  return cards
}

function loadEmberizeCards() {
  const path = join(root, "public", "datadog-quiz.json")
  const data = JSON.parse(readFileSync(path, "utf8"))
  return (data.questions || []).map((q) => ({
    id: q.id,
    domain: q.domain,
    front: q.question,
    back: q.explanation,
    sourceTag: "emberize",
  }))
}

function dedupeCards(cards) {
  const seen = new Set()
  return cards.filter((c) => {
    const key = c.front.toLowerCase().slice(0, 100)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildPool(rawCards) {
  const deduped = dedupeCards(rawCards)
  const singles = deduped.map((c) => toMcq(c, deduped))
  const multis = buildMultiQuestions(deduped, deduped)
  return [...singles, ...multis]
}

function isMulti(q) {
  return q.answerType === "multiple"
}

function composePack(pool, total, multiCount, seed, allowRepeat = false) {
  const multis = pool.filter(isMulti)
  const singles = pool.filter((q) => !isMulti(q))
  const multiPick = pickN(multis, Math.min(multiCount, multis.length), seed, false)
  const singleNeed = total - multiPick.length
  const singlePick = pickN(singles, singleNeed, seed + 11, allowRepeat)
  return shuffleWithSeed([...multiPick, ...singlePick], seed + 23).slice(0, total)
}

function pickN(pool, n, seed, allowRepeat = false) {
  const rnd = mulberry32(seed)
  const out = []
  const used = new Set()
  const shuffled = shuffleWithSeed(pool, seed)
  for (const q of shuffled) {
    if (out.length >= n) break
    if (!allowRepeat && used.has(q.id)) continue
    used.add(q.id)
    out.push(q)
  }
  while (out.length < n) {
    const q = pool[Math.floor(rnd() * pool.length)]
    out.push({ ...q, id: `${q.id}-r${out.length}` })
  }
  return out
}

function markPretestQuestions(questions, seed, pretestCount = 15) {
  const indices = shuffleWithSeed(
    questions.map((_, i) => i),
    seed,
  ).slice(0, pretestCount)
  const pretestSet = new Set(indices)
  const pretestItemIds = indices.map((i) => questions[i].id)
  const marked = questions.map((q, i) => ({
    ...q,
    isPretest: pretestSet.has(i),
  }))
  return { questions: marked, pretestItemIds }
}

function writePack(dir, name, meta, questions, scoring = null) {
  const file = join(dir, `${name}.json`)
  const body = {
    ...meta,
    count: questions.length,
    domains: DOMAIN_LABELS,
    questions,
  }
  if (scoring) body.scoring = scoring
  writeFileSync(file, JSON.stringify(body, null, 2), "utf8")
  return `${name}.json`
}

async function main() {
  console.log("Cargando emberize…")
  const emberize = loadEmberizeCards()
  console.log("Descargando docs (13 URLs)…")
  const fromDocs = await fetchFacts()
  const raw = [...emberize, ...fromDocs]
  const pool = buildPool(raw)
  const multiN = pool.filter(isMulti).length
  console.log(`Banco total: ${pool.length} preguntas (${multiN} de respuesta múltiple)`)

  const outDir = join(root, "public", "exams")
  mkdirSync(outDir, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    poolSize: pool.length,
    notebookSources: NOTEBOOK_SOURCES.map((s) => s.url),
    tests20: [],
    simulacros90: [],
  }

  for (let i = 1; i <= 6; i++) {
    const questions = composePack(pool, 20, 2, 1000 + i * 17, false)
    const file = writePack(outDir, `test-${String(i).padStart(2, "0")}`, {
      id: `test-${String(i).padStart(2, "0")}`,
      title: `Test ${i} — 20 preguntas`,
      type: "test20",
      description: "Incluye ~2 preguntas de respuesta múltiple. Aprobado de referencia: ≥70%.",
      passPercent: 70,
    }, questions)
    manifest.tests20.push({ id: `test-${String(i).padStart(2, "0")}`, file, title: `Test ${i} (20)` })
  }

  const simNames = [
    { id: "simulacro-a", title: "Simulacro A — 90 preguntas", seed: 9001 },
    { id: "simulacro-b", title: "Simulacro B — 90 preguntas", seed: 9002 },
    { id: "simulacro-c", title: "Simulacro C — 90 preguntas", seed: 9003 },
  ]
  for (const sim of simNames) {
    const raw = composePack(pool, 90, 6, sim.seed, true)
    const { questions, pretestItemIds } = markPretestQuestions(raw, sim.seed + 99, 15)
    const file = writePack(
      outDir,
      sim.id,
      {
        id: sim.id,
        title: sim.title,
        type: "simulacro90",
        description:
          "90 preguntas, resultado X/75. Mínimo referencia 48/75; apunta a 55–60+ para ir tranquilo.",
        passPercent: 64,
        examLike: {
          durationMinutes: 120,
          scoredItems: 75,
          pretestItems: 15,
          passPercent: 64,
          passMinScored: 48,
        },
      },
      questions,
      {
        totalItems: 90,
        scoredItems: 75,
        pretestItems: 15,
        pretestItemIds,
      },
    )
    manifest.simulacros90.push({ id: sim.id, file, title: sim.title })
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
  console.log(`OK: manifest + 6 tests de 20 + 3 simulacros de 90 en public/exams/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
