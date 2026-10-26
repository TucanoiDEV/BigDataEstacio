import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Plus_Jakarta_Sans({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Emprego Agora: vagas e dados do mercado de trabalho",
    template: "%s · Emprego Agora",
  },
  description:
    "Encontre vagas de empresas verificadas, acompanhe suas candidaturas e entenda o mercado de trabalho brasileiro com dados oficiais do Novo CAGED, RAIS e IBGE.",
  applicationName: "Emprego Agora",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Emprego Agora" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b3b46",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable}`} data-scroll-behavior="smooth">
      <body className="flex min-h-dvh flex-col">
        <TooltipProvider delayDuration={200}>
          <ConsentProvider>
            <SiteHeader />
            <main id="conteudo" className="flex flex-1 flex-col">
              {children}
            </main>
            <SiteFooter />
            <Toaster position="top-center" closeButton />
          </ConsentProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
