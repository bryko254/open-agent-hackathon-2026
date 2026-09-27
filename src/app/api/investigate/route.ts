import { NextResponse } from "next/server";
import { z } from "zod";
import { runInvestigation } from "@/lib/agent/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  goal: z.string().min(3).max(2000),
  maxSteps: z.number().int().min(3).max(12).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await runInvestigation(
      parsed.data.goal.trim(),
      parsed.data.maxSteps ?? 8
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("investigate failed", err);
    return NextResponse.json(
      {
        error: "Investigation failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
