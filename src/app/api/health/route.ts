import { NextResponse } from "next/server";
import { hasLlm } from "@/lib/agent/llm";
import { githubToken } from "@/lib/tools/github";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "evidence-agent",
    track: "Open Agent Hackathon 2026 — Track 02 (The Agent That Can Explain Why)",
    timestamp: new Date().toISOString(),
    llmConfigured: hasLlm(),
    synthesis: hasLlm() ? "llm" : "heuristic",
    githubAuth: githubToken() ? "token" : "public",
  });
}
