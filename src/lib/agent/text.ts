/** Goal terms, sentence picking, and short quotes shared by planning and synthesis. */

const STOP_WORDS = new Set(
  `a an the of to and or for in on with from by about into over after before at as is are was were be been being this that those these it its if then than what which when where who whom how why do does did can could should would your you we they them our their not no yes app apps use using used cite explain summarize summary find show tell describe note notes please thanks via per also more most such just like make made need help give given get got let may might must will onto upon within without across among whether while during again each other another same only very much many some any all both few own new old one two three way ways thing things because matter docs doc documentation page pages official guide recommend recommended recommendation supported support definition`.split(
    /\s+/
  )
);

export function keywordsFrom(goal: string, extraStop: string[] = []): string[] {
  const stop = new Set([...STOP_WORDS, ...extraStop.map((s) => s.toLowerCase())]);
  const raw = goal.replace(/https?:\/\/\S+/g, " ").replace(/["'`]/g, " ").toLowerCase();
  const tokens = raw.match(/[a-z0-9]+(?:\.[a-z0-9]+)*/g) || [];
  const out: string[] = [];
  for (const token of tokens) {
    if (token.length < 3 || stop.has(token) || out.includes(token)) continue;
    out.push(token);
  }
  if (/app router/i.test(goal) && !out.includes("app router")) out.unshift("app router");
  return out;
}

function forms(keyword: string): string[] {
  const found = new Set([keyword]);
  if (keyword.endsWith("ing") && keyword.length > 5) {
    found.add(keyword.slice(0, -3));
    found.add(keyword.slice(0, -3) + "e");
  }
  if (keyword.endsWith("ed") && keyword.length > 4) found.add(keyword.slice(0, -2));
  if (keyword.endsWith("es") && keyword.length > 5) found.add(keyword.slice(0, -2));
  if (keyword.endsWith("s") && !keyword.endsWith("ss") && keyword.length > 4) {
    found.add(keyword.slice(0, -1));
  }
  return [...found].filter((form) => form.length >= 4);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasForm(text: string, form: string): boolean {
  return new RegExp(`\\b${escapeRegExp(form)}\\b`, "i").test(text);
}

export function termHits(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => forms(keyword).some((form) => hasForm(text, form)));
}

export function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1);
  const cut = slice.lastIndexOf(" ");
  return `${(cut > max * 0.6 ? slice.slice(0, cut) : slice).trimEnd()}…`;
}

function normalizeProse(text: string): string {
  const withoutFrontmatter = text.replace(/^---[\s\S]*?\n---\s*/, "");
  const withoutCode = withoutFrontmatter
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`\n]+)`/g, "$1");
  let prose = withoutCode.replace(/\s+/g, " ").trim();
  const marker = prose.toLowerCase().indexOf("on this page");
  if (marker >= 0 && marker < 500) {
    prose = prose.slice(marker + "on this page".length).trim();
  }
  let stripped = prose;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = stripped
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    if (next === stripped) break;
    stripped = next;
  }
  return stripped
    .replace(/[#>*_]/g, " ")
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/:\s*\d+\s*\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

const BOILER =
  /skip to content|was this page helpful|cookie policy|sign in to|subscribe to|table of contents|before getting started|comfortable with|foundations course|skip this step|edit this page|click generate domain|click the button|screen reader|voiceover|highly recommend/i;

export function sentencesOf(text: string): string[] {
  const prose = normalizeProse(text);
  if (!prose) return [];
  return prose
    .split(/(?<=[.!?])\s+|\s+(?=Note:)/)
    .map((sentence) => sentence.replace(/^Note:\s*/i, "").trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 420 && !BOILER.test(sentence));
}

export interface ScoredSentence {
  sentence: string;
  hits: string[];
  score: number;
}

function weight(hit: string): number {
  if (hit.length >= 8) return 3;
  if (hit.length >= 6) return 2;
  return 1;
}

export function bestSentences(text: string, keywords: string[], limit = 2): ScoredSentence[] {
  const ranked = sentencesOf(text)
    .map((sentence) => {
      const hits = termHits(sentence, keywords);
      let score = hits.reduce((sum, hit) => sum + weight(hit), 0);
      if (score > 0 && /^\s*the\s+\S.{0,80}\bis\b/i.test(sentence)) score += 1;
      return { sentence, hits, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.hits.length - a.hits.length);

  const picked: ScoredSentence[] = [];
  for (const item of ranked) {
    if (picked.some((existing) => existing.sentence.slice(0, 70) === item.sentence.slice(0, 70))) {
      continue;
    }
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function excerptAround(text: string, keywords: string[], max = 320): string | null {
  const prose = normalizeProse(text);
  let index = -1;
  for (const keyword of keywords) {
    for (const form of forms(keyword)) {
      const found = prose.search(new RegExp(`\\b${escapeRegExp(form)}\\b`, "i"));
      if (found >= 0 && (index < 0 || found < index)) index = found;
    }
  }
  if (index < 0) return null;
  const start = Math.max(0, index - 80);
  let slice = prose.slice(start, start + max).trim();
  if (start > 0) slice = `…${slice}`;
  if (start + max < prose.length) slice = `${slice}…`;
  return slice;
}

export function openingExcerpt(text: string, max = 420): string {
  const prose = normalizeProse(text);
  const first = prose.split(/(?<=[.!?])\s+/).find((part) => part.trim().length >= 40);
  return clip(first || prose, max);
}
