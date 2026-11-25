"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { setAssistantConsentAction } from "@/app/actions/candidate";
import {
  ASSISTANT_MAX_HISTORY,
  ASSISTANT_MAX_MESSAGE_CHARS,
  splitReply,
  type AssistantJobRef,
  type AssistantResponse,
} from "@/lib/assistant";

type Variant = "page" | "panel";

// ---------------------------------------------------------------------------
// Aviso e consentimento
// ---------------------------------------------------------------------------

function ConsentText() {
  return (
    <>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Suas mensagens e as informações necessárias para responder (vagas, motivos das sugestões e o status das suas
          candidaturas) são enviadas à <strong>Anthropic</strong>, empresa que fornece o modelo de IA, e processadas fora do Brasil.
        </li>
        <li>Seu nome, e-mail, telefone, documentos e currículos <strong>não</strong> são enviados.</li>
        <li>As conversas não ficam salvas na sua conta. Ao fechar ou recarregar a página, a conversa é apagada.</li>
        <li>A IA pode errar. Confira os detalhes na página de cada vaga antes de se candidatar.</li>
        <li>Não escreva CPF, endereço ou outros dados pessoais nas mensagens.</li>
      </ul>
      <p className="text-muted-foreground">Você pode desativar o assistente quando quiser.</p>
    </>
  );
}

/** Pede o aceite. Na página, recarrega os dados do servidor; no painel, avisa quem o abriu. */
export function AssistantConsent({ variant = "page", onAccepted }: { variant?: Variant; onAccepted?: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const accept = () =>
    start(async () => {
      const r = await setAssistantConsentAction({ grant: true });
      if (!r.ok) toast.error(r.error);
      else if (onAccepted) onAccepted();
      else router.refresh();
    });
  const button = (
    <Button disabled={pending} onClick={accept} className={variant === "panel" ? "w-full" : undefined}>
      {pending && <Loader2 className="animate-spin" />} Concordo, quero usar o assistente
    </Button>
  );

  if (variant === "panel") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          <p className="font-medium">Antes de começar, veja como seus dados são usados:</p>
          <ConsentText />
        </div>
        <div className="border-t p-3">{button}</div>
      </div>
    );
  }
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Antes de começar</CardTitle>
        <CardDescription>O assistente usa inteligência artificial. Leia como seus dados são usados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ConsentText />
      </CardContent>
      <CardFooter>{button}</CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------

type ChatMessage = { role: "user" | "assistant"; content: string; jobs?: AssistantJobRef[] };

const SUGGESTIONS = [
  "Quais vagas combinam com o meu perfil?",
  "Como estão as minhas candidaturas?",
  "O que posso melhorar no perfil para receber mais sugestões?",
  "Tem vaga remota de atendimento ao cliente?",
];

/** Últimas mensagens para enviar, começando sempre por uma do candidato. */
function historyForRequest(messages: ChatMessage[]) {
  let recent = messages.slice(-ASSISTANT_MAX_HISTORY);
  while (recent.length && recent[0].role !== "user") recent = recent.slice(1);
  return recent.map(({ role, content }) => ({ role, content }));
}

export function AssistantChat({
  variant = "page",
  onRevoked,
  onNavigate,
  autoFocus,
}: {
  variant?: Variant;
  /** Chamado após desativar o assistente (no painel). Na página, os dados são recarregados. */
  onRevoked?: () => void;
  /** Chamado ao clicar em um link de vaga da plataforma. */
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, startRevoke] = useTransition();
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panel = variant === "panel";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForRequest(next) }),
      });
      const data = (await res.json().catch(() => null)) as (AssistantResponse & { error?: string }) | null;
      if (!res.ok || !data || data.error) throw new Error(data?.error ?? "O assistente não conseguiu responder agora. Tente novamente.");
      setMessages([...next, { role: "assistant", content: data.reply, jobs: data.jobs }]);
    } catch (err) {
      // Devolve a pergunta para o campo, para a pessoa tentar de novo sem redigitar.
      setMessages(messages);
      setInput(content);
      setError(err instanceof Error ? err.message : "O assistente não conseguiu responder agora.");
    } finally {
      setSending(false);
    }
  }

  const revoke = () =>
    startRevoke(async () => {
      const r = await setAssistantConsentAction({ grant: false });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Assistente desativado.");
      if (onRevoked) onRevoked();
      else router.refresh();
    });

  const conversation = (
    <div
      className={cn("space-y-4 overflow-y-auto", panel ? "min-h-0 flex-1 p-4" : "max-h-[60vh] min-h-72 p-4 sm:p-6")}
      aria-live="polite"
      aria-busy={sending}
    >
      {messages.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {panel ? "Olá! Posso sugerir vagas, contar como estão suas candidaturas ou tirar dúvidas sobre o site." : "Comece com uma pergunta ou escolha uma sugestão:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
      {messages.map((m, i) =>
        m.role === "user" ? <UserBubble key={i} text={m.content} /> : <AssistantBubble key={i} text={m.content} jobs={m.jobs ?? []} compact={panel} onNavigate={onNavigate} />,
      )}
      {sending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Consultando…
        </p>
      )}
      <div ref={endRef} />
    </div>
  );

  const form = (
    <form
      className={cn("flex items-end gap-2 border-t", panel ? "p-3" : "p-3 sm:p-4")}
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
    >
      <label htmlFor={`assistant-input-${variant}`} className="sr-only">
        Sua mensagem
      </label>
      <Textarea
        id={`assistant-input-${variant}`}
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send(input);
          }
        }}
        maxLength={ASSISTANT_MAX_MESSAGE_CHARS}
        rows={panel ? 1 : 2}
        placeholder="Escreva sua pergunta…"
        className="min-h-10 resize-none"
        disabled={sending}
      />
      <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Enviar">
        <SendHorizontal />
      </Button>
    </form>
  );

  const footer = (
    <>
      {error && (
        <p role="alert" className={cn("text-sm text-destructive", panel && "px-3 pt-2")}>
          {error}
        </p>
      )}
      <div className={cn("flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground", panel && "px-3 pb-2")}>
        <p>A IA pode errar. Confira a vaga antes de se candidatar.</p>
        <div className="flex">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setMessages([])} disabled={sending}>
              Nova conversa
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={revoking || sending} onClick={revoke}>
            Desativar
          </Button>
        </div>
      </div>
    </>
  );

  if (panel) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {conversation}
        {form}
        {footer}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        {conversation}
        {form}
      </Card>
      {footer}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{text}</p>
    </div>
  );
}

function JobLink({ job, onNavigate }: { job: AssistantJobRef; onNavigate?: () => void }) {
  const className = "font-medium text-primary underline underline-offset-2";
  if (job.external) {
    return (
      <a href={job.href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {job.title} ({job.company})
        <ExternalLink className="ml-0.5 inline size-3 align-baseline" aria-label="abre outro site" />
      </a>
    );
  }
  return (
    <Link href={job.href} className={className} onClick={onNavigate}>
      {job.title} ({job.company})
    </Link>
  );
}

function AssistantBubble({ text, jobs, compact, onNavigate }: { text: string; jobs: AssistantJobRef[]; compact?: boolean; onNavigate?: () => void }) {
  const parts = splitReply(text, jobs);
  return (
    <div className={cn("space-y-3", compact ? "max-w-full" : "max-w-[92%]")}>
      <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm leading-relaxed">
        {parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : <JobLink key={i} job={p.job} onNavigate={onNavigate} />))}
      </div>
      {jobs.length > 0 && (
        <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
          {jobs.map((job) => (
            <li key={job.key} className="rounded-lg border bg-card p-3 text-sm">
              <JobLink job={job} onNavigate={onNavigate} />
              <p className="mt-1 text-xs text-muted-foreground">
                {job.location}
                {job.score != null && <> · {job.score}% compatível</>}
                {job.external && <> · outro site</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
