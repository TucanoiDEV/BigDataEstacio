import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CookiePreferencesButton } from "@/components/consent/consent-provider";

const GROUPS = [
  {
    title: "Candidatos",
    links: [
      { href: "/vagas", label: "Explorar vagas" },
      { href: "/criar-conta", label: "Criar conta" },
      { href: "/minha-conta/alertas", label: "Alertas de vagas" },
    ],
  },
  {
    title: "Empresas",
    links: [
      { href: "/empresa/nova", label: "Cadastrar empresa" },
      { href: "/empresas", label: "Empresas verificadas" },
      { href: "/seguranca", label: "Como combatemos golpes" },
    ],
  },
  {
    title: "Dados",
    links: [
      { href: "/mercado-de-trabalho", label: "Observatório do trabalho" },
      { href: "/mercado-de-trabalho/metodologia", label: "Fontes e metodologia" },
    ],
  },
  {
    title: "Privacidade e termos",
    links: [
      { href: "/privacidade", label: "Política de Privacidade" },
      { href: "/cookies", label: "Política de Cookies" },
      { href: "/termos", label: "Termos de Uso" },
      { href: "/seguranca", label: "Segurança da Informação" },
      { href: "/central-de-privacidade", label: "Central de Privacidade" },
      { href: "/contato", label: "Contato" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-petroleum text-petroleum-foreground">
      <div className="container-page grid grid-cols-1 gap-10 py-12 md:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <Logo inverted />
          <p className="max-w-xs text-sm text-petroleum-foreground/80">
            Vagas, dados oficiais do mercado de trabalho e tendências profissionais em um só lugar.
          </p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="mb-3 text-sm font-semibold text-white">{g.title}</h2>
            <ul className="space-y-2 text-sm">
              {g.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-petroleum-foreground/80 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-petroleum-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>Emprego Agora. Dados estatísticos de fontes públicas oficiais (Novo CAGED, RAIS, IBGE), citadas em cada indicador.</p>
          <CookiePreferencesButton className="text-left underline underline-offset-2 hover:text-white" />
        </div>
      </div>
    </footer>
  );
}
