import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Diretivas que só fazem sentido sob HTTPS (definidas pelo APP_URL do build).
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Origem do script de análise opcional (só é carregado após consentimento).
const analyticsOrigin = originOf(process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL);

/**
 * Content Security Policy.
 * Observação: o App Router injeta scripts inline de hidratação; sem nonces
 * (que exigiriam renderização 100% dinâmica e anulariam o pré-render parcial),
 * 'unsafe-inline' em script-src é necessário. As demais diretivas são restritivas
 * (sem eval em produção, sem objetos, sem iframes de terceiros, form-action/base-uri
 * limitados à própria origem). Veja docs/SEGURANCA.md.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${analyticsOrigin ? ` ${analyticsOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    serverActions: {
      // Uploads de currículo usam Server Actions; o limite real é validado no servidor.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Áreas autenticadas nunca devem ser armazenadas em caches compartilhados.
        source: "/(minha-conta|empresa|admin|api)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
