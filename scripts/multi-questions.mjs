import { DOMAIN_LABELS } from "./sources.mjs"
import { buildWhyCorrect, stripMarkdown } from "./rationale.mjs"
import { summarizeOptionText } from "./option-text.mjs"

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

export function extractListItems(text) {
  const plain = stripMarkdown(text).replace(/\r\n/g, "\n")
  const items = []
  const push = (raw) => {
    const item = raw.replace(/\s+/g, " ").trim()
    if (item.length >= 14 && item.length <= 720) items.push(item)
  }
  for (const line of plain.split("\n")) {
    const t = line.trim()
    const m = t.match(/^[-*•]\s+(.+)/) || t.match(/^\d+[.)]\s+(.+)/)
    if (m) {
      push(m[1])
      continue
    }
    if (t.includes(" - ")) {
      const parts = t.split(/\s+-\s+/)
      for (let i = 1; i < parts.length; i++) push(parts[i])
    }
  }
  return [...new Set(items)]
}

function summarizeItem(item) {
  return summarizeOptionText(item)
}

function wrongItemsFromPool(card, pool, count, rnd, avoid) {
  const avoidSet = new Set(avoid.map((x) => x.toLowerCase()))
  const bag = []
  for (const c of pool) {
    if (c.id === card.id) continue
    for (const it of extractListItems(c.back)) {
      const key = it.toLowerCase()
      if (!avoidSet.has(key) && it.length >= 14) bag.push(summarizeItem(it))
    }
  }
  const picked = []
  const used = new Set()
  while (picked.length < count && bag.length) {
    const idx = Math.floor(rnd() * bag.length)
    const it = bag.splice(idx, 1)[0]
    const key = it.toLowerCase()
    if (used.has(key)) continue
    used.add(key)
    picked.push(it)
  }
  while (picked.length < count) {
    picked.push(`Afirmación incorrecta (${picked.length + 1})`)
  }
  return picked
}

export function buildMultiQuestions(rawCards, rawPool) {
  const multis = []
  for (const card of rawCards) {
    if (card.sourceTag === "emberize" && card.id?.includes("-multi")) continue
    const items = extractListItems(card.back)
    if (items.length < 4) continue

    const rnd = mulberry32(hashSeed(`${card.id}-multi`))
    const shuffled = shuffleWithSeed(items, hashSeed(card.id))
    const correctCount = items.length >= 5 ? 3 : 2
    const correctRaw = shuffled.slice(0, correctCount).map(summarizeItem)
    const wrong = wrongItemsFromPool(card, rawPool, 5 - correctCount, rnd, correctRaw)
    const options = shuffleWithSeed([...correctRaw, ...wrong], hashSeed(`${card.id}-opts`))
    const correctSet = new Set(correctRaw.map((s) => s.toLowerCase()))
    const correctIndices = options
      .map((opt, i) => (correctSet.has(opt.toLowerCase()) ? i : -1))
      .filter((i) => i >= 0)

    if (correctIndices.length < 2) continue

    const topic = stripMarkdown(card.front).replace(/\?$/, "").trim()
    const question = `Marca todas las opciones correctas: ${topic}`

    const rationale = buildWhyCorrect(card, correctRaw.join(" · "))
    const whyCorrect = `Son varias respuestas válidas. ${rationale.whyCorrect}`

    multis.push({
      id: `${card.id}-multi`,
      answerType: "multiple",
      domain: card.domain,
      domainLabel: DOMAIN_LABELS[card.domain] || card.domain,
      question,
      options,
      correctIndices,
      correctIndex: correctIndices[0],
      explanation: stripMarkdown(card.back),
      whyCorrect,
      sourceUrl: rationale.sourceUrl,
      sourceTitle: rationale.sourceTitle,
      sourceTag: card.sourceTag || "emberize",
    })
  }
  return multis
}
