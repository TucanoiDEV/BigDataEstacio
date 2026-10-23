import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, Mail, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/states";
import { PrivacyRequestForm } from "@/components/privacy/privacy-request-form";
import { controller, fill } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Central de Privacidade", description: "Exerça seus direitos de titular de dados (LGPD) no Emprego Agora." };

const SELF_SERVICE = [
  { icon: Eye, title: "Acessar e baixar seus dados", text: "Exportação completa em JSON.", href: "/minha-conta/privacidade" },
  { icon: Pencil, title: "Corrigir dados", text: "Edite perfil, experiências e formação.", href: "/minha-conta/perfil" },
  { icon: Mail, title: "Comunicações e visibilidade", text: "Escolha quem vê seu perfil e que e-mails recebe.", href: "/minha-conta/privacidade" },
  { icon: Trash2, title: "Excluir conta", text: "Eliminação do perfil, currículos e dados associados.", href: "/minha-conta/privacidade#excluir" },
];

export default function PrivacyCenterPage() {
  return (
    <div className="container-page max-w-4xl space-y-8 py-10">
      <PageHeader
        eyebrow="LGPD"
        title="Central de Privacidade"
        description="Seus direitos como titular de dados, em um só lugar. A maioria das ações é imediata na sua conta; as demais viram uma solicitação com protocolo e prazo."
      />
      <section aria-labelledby="autoatendimento">
        <h2 id="autoatendimento" className="mb-3 text-lg font-semibold text-petroleum">Autoatendimento (requer login)</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SELF_SERVICE.map((s) => (
            <li key={s.title}>
              <Link href={s.href} className="flex h-full gap-3 rounded-xl border bg-card p-4 hover:border-primary/40">
                <s.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span><span className="block font-medium">{s.title}</span><span className="text-sm text-muted-foreground">{s.text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="solicitar" className="rounded-2xl border bg-card p-6">
        <h2 id="solicitar" className="flex items-center gap-2 text-lg font-semibold text-petroleum"><Download className="size-5" aria-hidden /> Abrir solicitação</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Também para quem não tem conta (por exemplo, para saber se tratamos seus dados). Prazo de referência: 15 dias. Para proteger você,
          podemos confirmar sua identidade antes de entregar ou excluir dados.
        </p>
        <PrivacyRequestForm />
      </section>
      <section aria-labelledby="encarregado" className="rounded-2xl border border-dashed p-6 text-sm">
        <h2 id="encarregado" className="font-semibold text-petroleum">Encarregado(a) de dados (DPO)</h2>
        <p className="mt-2">{fill(controller.dpoName, "nome do encarregado")} — {fill(controller.dpoEmail, "e-mail do encarregado")}</p>
        <p className="mt-2 text-muted-foreground">
          Se considerar que seus direitos não foram atendidos, você pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </section>
    </div>
  );
}
