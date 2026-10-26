/** URL extraction and connector triggers. Source choice lives in plan.ts. */

const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

export function extractUrls(goal: string): string[] {
  const found = goal.match(URL_RE) || [];
  const cleaned = found.map((url) => url.replace(/[.,;:!?]+$/, ""));
  return [...new Set(cleaned)];
}

export function wantsEmail(goal: string): boolean {
  return /\b(e-?mail|gmail|inbox|mailbox)\b/i.test(goal);
}

export function wantsGithub(goal: string): boolean {
  return /\b(github|repositories|repos?|pull requests?|prs?|issues?|commits?)\b/i.test(goal);
}
