import { NextResponse } from "next/server";
import { githubToken } from "@/lib/tools/github";

export const dynamic = "force-dynamic";

export async function GET() {
  const llmConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    service: "evidence-agent",
    track: "Open Agent Hackathon 2026 — Track 02 Autonomous Agent",
    timestamp: new Date().toISOString(),
    llmConfigured,
    githubTokenConfigured: Boolean(githubToken()),
    synthesis: llmConfigured ? "llm" : "heuristic",
  });
}
