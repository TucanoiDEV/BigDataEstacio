import { NextResponse } from "next/server";
import { db } from "@/server/db";

// Verificação de saúde para orquestradores/monitoramento. Não expõe detalhes internos.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
