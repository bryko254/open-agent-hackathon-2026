import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "evidence-agent",
    track: "Open Agent Hackathon 2026 — Track 02 Autonomous Agent",
    timestamp: new Date().toISOString(),
    llmConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}
