import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { exportUserData } from "@/server/services/privacy";
import { rateLimit } from "@/server/security/rate-limit";

// Exportação dos dados do titular (LGPD art. 18, II e V).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });
  const limit = await rateLimit(`export:user:${user.id}`, 5, 3600);
  if (!limit.allowed) {
    return new NextResponse("Muitas exportações seguidas. Tente novamente mais tarde.", { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const data = await exportUserData(user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="emprego-agora-meus-dados-${date}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
