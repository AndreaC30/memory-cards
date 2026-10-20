/**
 * Extrae flashcards de datadog.emberize.es → preguntas de 4 opciones.
 * Uso: node scripts/build-quiz.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWhyCorrect } from "./rationale.mjs";

const CHUNK_URL =
  "https://datadog.emberize.es/_next/static/immutable/chunks/2l1togtwf6jnt.js";

const DOMAIN_LABELS = {
  essential: "Conceptos esenciales",
  infra: "Infraestructura y Agent",
  network: "Red y configuración",
  collection: "Recolección de datos",
  troubleshoot: "Troubleshooting",
  viz: "Visualización y uso",
};

function readJsString(js, startQuote) {
  let i = startQuote + 1;
  let out = "";
  while (i < js.length) {
    const ch = js[i];
    if (ch === "\\") {
      const next = js[i + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else out += next ?? "";
      i += 2;
      continue;
    }
    if (ch === '"') return { value: out, end: i + 1 };
    out += ch;
    i++;
  }
  throw new Error("Cadena sin cerrar en chunk");
}

function extractCards(js) {
  const start = js.indexOf(",K=[{");
  if (start < 0) throw new Error("No se encontró el array K en el chunk");
  const slice = js.slice(start);
  const end = slice.indexOf("}],H=");
  const block = end > 0 ? slice.slice(0, end + 1) : slice;
  const cards = [];
  const idRe = /\{id:"([^"]+)",domain:"([^"]+)",front:"/g;
  let m;
  while ((m = idRe.exec(block)) !== null) {
    const frontQuote = m.index + m[0].length - 1;
    const front = readJsString(block, frontQuote);
    const backKey = block.indexOf('back:"', front.end);
    const back = readJsString(block, backKey + 5);
    cards.push({
      id: m[1],
      domain: m[2],
      front: front.value,
      back: back.value,
    });
    idRe.lastIndex = back.end;
  }
  if (!cards.length) throw new Error("No se extrajeron cartas");
  return cards;
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function answerSummary(back) {
  const plain = stripMarkdown(back);
  const firstBlock = plain.split(/\n\n+/)[0] || plain;
  const oneLine = firstBlock.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 220) return oneLine;
  const cut = oneLine.slice(0, 217);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 120 ? cut.slice(0, lastSpace) : cut) + "…";
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDistractors(card, pool, count, rnd) {
  const same = pool.filter((c) => c.id !== card.id && c.domain === card.domain);
  const other = pool.filter((c) => c.id !== card.id && c.domain !== card.domain);
  const candidates = [...same, ...other];
  const picked = [];
  const used = new Set();
  const correct = answerSummary(card.back);
  used.add(correct.toLowerCase());

  while (picked.length < count && candidates.length) {
    const idx = Math.floor(rnd() * candidates.length);
    const c = candidates.splice(idx, 1)[0];
    const summary = answerSummary(c.back);
    const key = summary.toLowerCase();
    if (used.has(key) || summary.length < 8) continue;
    used.add(key);
    picked.push(summary);
  }
  return picked;
}

function buildQuestion(card, pool) {
  const rnd = mulberry32(hashSeed(card.id));
  const correctText = answerSummary(card.back);
  const distractors = pickDistractors(card, pool, 3, rnd);
  while (distractors.length < 3) {
    distractors.push(`Opción incorrecta (${distractors.length + 1})`);
  }
  const options = [correctText, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const rationale = buildWhyCorrect(
    { ...card, sourceTag: "emberize" },
    correctText,
  );
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
    sourceTag: "emberize",
    answerType: "single",
  };
}

async function main() {
  const res = await fetch(CHUNK_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar chunk`);
  const js = await res.text();
  const cards = extractCards(js);
  const questions = cards.map((c) => buildQuestion(c, cards));

  const out = {
    title: "Datadog Fundamentals",
    generatedAt: new Date().toISOString(),
    source: "https://datadog.emberize.es/study",
    count: questions.length,
    domains: DOMAIN_LABELS,
    questions,
  };

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  writeFileSync(join(root, "public", "datadog-quiz.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: ${questions.length} preguntas → public/datadog-quiz.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
