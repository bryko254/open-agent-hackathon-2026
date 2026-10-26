const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "into",
  "about",
  "over",
  "after",
  "before",
  "than",
  "then",
  "also",
  "just",
  "only",
  "not",
  "your",
  "you",
  "we",
  "our",
  "their",
  "they",
  "them",
  "i",
  "do",
  "does",
  "did",
  "doing",
  "can",
  "could",
  "should",
  "would",
  "will",
  "shall",
  "may",
  "might",
  "please",
  "using",
  "use",
  "used",
  "explain",
  "find",
  "show",
  "tell",
  "give",
  "compare",
  "note",
  "notes",
  "summary",
  "summarize",
  "based",
  "according",
  "have",
  "has",
  "had",
  "any",
  "all",
  "each",
  "via",
  "per",
  "app",
  "apps",
  "say",
  "says",
  "cite",
  "cites",
  "cited",
  "line",
  "lines",
  "public",
  "reference",
  "references",
  "source",
  "sources",
  "confident",
  "confidence",
  "relevant",
  "match",
  "matches",
  "top",
  "both",
  "up",
  "out",
  "my",
  "me",
]);

const QUERY_META = new Set([
  "github",
  "repository",
  "repositories",
  "repo",
  "repos",
  "search",
  "documentation",
  "docs",
  "doc",
  "http",
  "https",
  "www",
  "official",
  "recommend",
  "recommends",
  "recommendation",
  "guidance",
  "guide",
  "page",
  "website",
  "site",
  "email",
  "emails",
  "inbox",
  "gmail",
  "mail",
  "message",
  "messages",
  "thread",
  "threads",
]);

export function goalTerms(goal: string): string[] {
  const raw = goal
    .replace(/https?:\/\/\S+/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
  return preferLongerInflection([...new Set(raw)]).slice(0, 12);
}

function preferLongerInflection(terms: string[]): string[] {
  return terms.filter((term, index) => {
    return !terms.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      return (
        other.startsWith(term) &&
        other.length > term.length &&
        other.length - term.length <= 3
      );
    });
  });
}

/** Short query for Wikipedia, DuckDuckGo, and GitHub search. */
export function searchQuery(goal: string): string {
  const terms = goalTerms(goal).filter((term) => !QUERY_META.has(term));
  const chosen = (terms.length ? terms : goalTerms(goal)).slice(0, 5);
  return chosen.join(" ") || goal.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function cleanExcerpt(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\s*/m, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function overlapOf(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term));
}

export function clipSentence(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

export function pickSupport(
  text: string,
  terms: string[]
): { sentence: string; overlap: string[] } {
  const cleaned = cleanExcerpt(text);
  const sentences = cleaned
    .split(/[.!?]+\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 50 && sentence.length <= 420);
  const pool = sentences.length
    ? sentences
    : [cleaned.slice(0, 320)].filter(Boolean);
  if (!pool.length) return { sentence: "", overlap: [] };

  let best = pool[0];
  let bestOverlap = overlapOf(best, terms);
  for (const sentence of pool.slice(1)) {
    const overlap = overlapOf(sentence, terms);
    const better =
      overlap.length > bestOverlap.length ||
      (overlap.length === bestOverlap.length &&
        overlap.length > 0 &&
        sentence.length < best.length);
    if (better) {
      best = sentence;
      bestOverlap = overlap;
    }
  }

  return { sentence: clipSentence(best, 360), overlap: bestOverlap };
}

export function hostOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
