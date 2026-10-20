import { NOTEBOOK_SOURCES } from "./sources.mjs"

const SOURCE_BY_ID = Object.fromEntries(NOTEBOOK_SOURCES.map((s) => [s.id, s]))

const DOMAIN_SOURCE = {
  essential: "getting-started",
  infra: "agent-host",
  network: "agent-host",
  collection: "metrics",
  troubleshoot: "agent-host",
  viz: "query-graph",
}

export function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&rarr;/g, "→")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function resolveDocSource(card) {
  if (card.sourceUrl) {
    return { url: card.sourceUrl, title: card.sourceTitle || "Documentación Datadog" }
  }
  const id =
    card.sourceTag && card.sourceTag !== "emberize"
      ? card.sourceTag
      : DOMAIN_SOURCE[card.domain] || "getting-started"
  const s = SOURCE_BY_ID[id]
  return s
    ? { url: s.url, title: s.title }
    : { url: "https://docs.datadoghq.com/es/getting_started/", title: "Guía de inicio" }
}

export function buildWhyCorrect(card, correctOptionText) {
  const { url, title } = resolveDocSource(card)
  const detail = stripMarkdown(card.back)
  const shortCorrect = stripMarkdown(correctOptionText).slice(0, 220)

  if (card.docHeading) {
    const intro = `En la documentación «${title}» (sección «${card.docHeading}»), la opción correcta resume lo que indica Datadog oficialmente.`
    const body = detail.length > 60 ? ` ${detail.slice(0, 650)}${detail.length > 650 ? "…" : ""}` : ""
    return { whyCorrect: intro + body, sourceUrl: url, sourceTitle: title }
  }

  if (detail.length > 80) {
    return {
      whyCorrect: `Según ${title}, la respuesta correcta («${shortCorrect}») encaja con la documentación porque: ${detail.slice(0, 700)}${detail.length > 700 ? "…" : ""}`,
      sourceUrl: url,
      sourceTitle: title,
    }
  }

  return {
    whyCorrect: `Según la documentación de Datadog (${title}), «${shortCorrect}» es la opción alineada con la guía Fundamentals y los conceptos oficiales del producto.`,
    sourceUrl: url,
    sourceTitle: title,
  }
}
