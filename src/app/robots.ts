import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/minha-conta", "/empresa/", "/admin", "/api/", "/convite/", "/entrar/verificacao", "/redefinir-senha", "/verificar-email", "/vagas/*/candidatar"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
