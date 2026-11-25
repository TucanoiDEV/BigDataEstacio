"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/components/consent/consent-provider";
import { AssistantChat, AssistantConsent } from "@/components/candidate/assistant-chat";
import { cn } from "@/lib/utils";
import type { AssistantStatus } from "@/lib/assistant";

// Áreas onde o botão não aparece: painéis de empresa e administração, e a página própria do assistente.
const HIDDEN_PREFIXES = ["/admin", "/empresa", "/minha-conta/assistente"];

/** usePathname é dinâmico: o botão entra depois do shell estático. */
export function AssistantWidget() {
  return (
    <Suspense fallback={null}>
      <AssistantWidgetInner />
    </Suspense>
  );
}

/**
 * Botão flutuante do assistente, presente em todo o site. O painel abre ao lado do conteúdo
 * (não bloqueia a página) e continua montado ao navegar, para a conversa não se perder.
 */
function AssistantWidgetInner() {
  const pathname = usePathname();
  const { state: cookies } = useConsent();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [status, setStatus] = useState<AssistantStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/assistente", { cache: "no-store" });
      const data = (await res.json()) as { state?: AssistantStatus };
      setStatus(data.state ?? "unavailable");
    } catch {
      setStatus("unavailable");
    }
  }, []);

  const toggle = () => {
    if (!open) {
      setOpened(true);
      void refresh(); // a pessoa pode ter entrado, saído ou aceitado o aviso em outra aba
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Enquanto o aviso de cookies ocupa o rodapé, o botão espera para não cobrir as opções.
  if (hidden || cookies.status !== "set") return null;

  // No celular o painel ocupa quase a tela: fecha ao abrir uma vaga.
  const closeOnSmallScreens = () => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  };

  return (
    <>
      {opened && (
        <section
          id="assistente-painel"
          aria-label="Assistente"
          className={cn(
            "fixed inset-x-3 bottom-20 z-40 flex h-[min(36rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-[0_12px_40px_rgba(11,59,70,0.22)] sm:inset-x-auto sm:right-5 sm:w-[25rem]",
            !open && "hidden",
          )}
        >
          <header className="flex items-start justify-between gap-2 border-b bg-petroleum px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">Assistente</h2>
              <p className="text-xs text-white/75">Vagas para você, candidaturas e dúvidas sobre o site</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 text-white hover:bg-white/15 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar assistente">
              <X />
            </Button>
          </header>
          <PanelBody status={status} onStatus={setStatus} onNavigate={closeOnSmallScreens} open={open} />
        </section>
      )}
      <Button
        onClick={toggle}
        aria-expanded={open}
        aria-controls="assistente-painel"
        className="fixed right-5 bottom-5 z-40 h-12 rounded-full px-4 shadow-[0_8px_24px_rgba(11,59,70,0.3)] sm:px-5"
      >
        {open ? <X className="size-5" /> : <MessageCircleQuestion className="size-5" />}
        <span className={cn(open && "sr-only sm:not-sr-only")}>{open ? "Fechar" : "Pergunte à IA"}</span>
      </Button>
    </>
  );
}

function PanelBody({ status, onStatus, onNavigate, open }: { status: AssistantStatus | null; onStatus: (s: AssistantStatus) => void; onNavigate: () => void; open: boolean }) {
  if (status === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (status === "ready") return <AssistantChat variant="panel" onRevoked={() => onStatus("consent")} onNavigate={onNavigate} autoFocus={open} />;
  if (status === "consent") return <AssistantConsent variant="panel" onAccepted={() => onStatus("ready")} />;

  const message = {
    unavailable: { text: "O assistente ainda não foi ativado neste site. Enquanto isso, use a busca de vagas.", href: "/vagas", label: "Buscar vagas" },
    anonymous: { text: "Entre na sua conta para o assistente sugerir vagas para o seu perfil e acompanhar suas candidaturas.", href: "/entrar", label: "Entrar" },
    unverified: { text: "Confirme seu e-mail para usar o assistente.", href: "/verificar-email", label: "Confirmar e-mail" },
  }[status];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <MessageCircleQuestion className="size-10 text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{message.text}</p>
      <Button asChild>
        <Link href={status === "anonymous" ? `/entrar?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}` : message.href} onClick={onNavigate}>
          {message.label}
        </Link>
      </Button>
    </div>
  );
}
