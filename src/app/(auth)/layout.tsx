import { BarChart3, ListChecks, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="container-page grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center lg:py-16">
      <aside className="hero-pattern relative hidden overflow-hidden rounded-3xl p-10 text-white lg:block">
        <h2 className="max-w-md text-3xl font-bold leading-tight">Uma conta para buscar vagas e acompanhar candidaturas.</h2>
        <p className="mt-3 max-w-md text-petroleum-foreground/85">
          Vagas de empresas verificadas, acompanhamento transparente das candidaturas e dados oficiais do mercado de trabalho.
        </p>
        <ul className="mt-10 space-y-5">
          {[
            { icon: ShieldCheck, title: "Empresas verificadas", text: "Moderação ativa contra golpes e vagas falsas." },
            { icon: ListChecks, title: "Recomendações explicáveis", text: "Você sabe por que cada vaga foi sugerida." },
            { icon: BarChart3, title: "Observatório do trabalho", text: "Novo CAGED, RAIS e IBGE com fonte e metodologia." },
          ].map((f) => (
            <li key={f.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <f.icon className="size-5 text-emerald-300" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{f.title}</span>
                <span className="text-sm text-petroleum-foreground/80">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="w-full">{children}</div>
    </div>
  );
}
