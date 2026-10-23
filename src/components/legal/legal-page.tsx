import { Scale } from "lucide-react";

/** Valor configurado ou marcador visível de preenchimento pendente (nunca inventamos dados). */
export function fill(value: string | undefined, placeholder: string): React.ReactNode {
  return value && value.trim() ? value : <mark className="rounded bg-amber-100 px-1 text-amber-950">[PREENCHER: {placeholder}]</mark>;
}

export const controller = {
  name: process.env.NEXT_PUBLIC_CONTROLLER_NAME,
  cnpj: process.env.NEXT_PUBLIC_CONTROLLER_CNPJ,
  address: process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS,
  dpoName: process.env.NEXT_PUBLIC_DPO_NAME,
  dpoEmail: process.env.NEXT_PUBLIC_DPO_EMAIL,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
};

export function LegalPage(props: { title: string; version: string; intro?: React.ReactNode; toc: { id: string; label: string }[]; children: React.ReactNode }) {
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-8 py-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <nav aria-label="Nesta página" className="rounded-xl border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold text-petroleum">Nesta página</p>
          <ol className="space-y-1.5">
            {props.toc.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="text-muted-foreground hover:text-primary hover:underline">{t.label}</a></li>
            ))}
          </ol>
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-petroleum">{props.title}</h1>
          <p className="text-sm text-muted-foreground">Versão {props.version}</p>
          <div role="note" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <Scale className="size-5 shrink-0" aria-hidden />
            <p>
              <strong>Minuta — requer revisão jurídica antes da publicação.</strong> Este texto foi preparado como ponto de partida e descreve o
              funcionamento real da plataforma, mas não substitui a análise de um(a) advogado(a). Campos marcados com [PREENCHER] dependem de
              informações do controlador que não podem ser presumidas.
            </p>
          </div>
          {props.intro}
        </header>
        <div className="legal-prose space-y-8">{props.children}</div>
      </article>
    </div>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-3 leading-relaxed text-foreground/90">
      <h2 id={`${id}-h`} className="text-xl font-bold text-petroleum">{title}</h2>
      {children}
    </section>
  );
}

export function LegalTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>{headers.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y align-top">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
