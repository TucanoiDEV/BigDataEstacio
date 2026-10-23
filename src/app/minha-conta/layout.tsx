import type { Metadata } from "next";
import { CandidateNav } from "@/app/minha-conta/candidate-nav";

export const metadata: Metadata = {
  title: { default: "Minha conta", template: "%s · Minha conta · Emprego Agora" },
  robots: { index: false, follow: false },
};

export default function CandidateLayout({ children }: LayoutProps<"/minha-conta">) {
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">Minha conta</p>
        <CandidateNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
