import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/states";
import { ContactForm } from "@/components/privacy/contact-form";
import { controller, fill } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Contato", description: "Fale com a equipe do Emprego Agora." };

export default function ContactPage() {
  return (
    <div className="container-page grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <PageHeader title="Contato" description="Dúvidas, parcerias ou problemas com a plataforma. Para pedidos sobre dados pessoais, use a Central de Privacidade." />
        <div className="rounded-2xl border bg-card p-6"><ContactForm /></div>
      </div>
      <aside className="space-y-4 text-sm">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-petroleum">Canais</h2>
          <p className="mt-2">E-mail: {fill(controller.contactEmail, "e-mail de contato")}</p>
          <p className="mt-1">Privacidade/DPO: {fill(controller.dpoEmail, "e-mail do encarregado")}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold text-petroleum">Atalhos</h2>
          <ul className="mt-2 space-y-1">
            <li><Link href="/central-de-privacidade" className="text-primary underline">Central de Privacidade</Link></li>
            <li><Link href="/seguranca" className="text-primary underline">Reportar vulnerabilidade</Link></li>
            <li><Link href="/vagas" className="text-primary underline">Denunciar uma vaga (na página da vaga)</Link></li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
