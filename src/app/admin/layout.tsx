import type { Metadata } from "next";
import { AdminNav } from "@/app/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s · Admin · Emprego Agora" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8 lg:py-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">Administração</p>
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
