import { NextResponse, type NextRequest } from "next/server";

// Verificação OTIMISTA: apenas a presença do cookie de sessão. A validação
// real (sessão no banco, papel, vínculo com a empresa) acontece no servidor,
// na camada de acesso a dados, em cada página, Server Action e Route Handler.

const PROTECTED = ["/minha-conta", "/empresa", "/admin", "/convite"];

function hasSessionCookie(req: NextRequest) {
  return req.cookies.has("__Host-ea_session") || req.cookies.has("ea_session");
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Páginas de perfil privado, painéis e currículos nunca são indexados.
  if (isProtected) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: [
    // Ignora assets estáticos e prefetches.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|geo/).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
