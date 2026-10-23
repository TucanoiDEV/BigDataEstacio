"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Script from "next/script";
import { Cookie } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { saveConsentAction } from "@/app/actions/consent";
import { CONSENT_COOKIE, decodeConsent, type ConsentChoice, type StoredConsent } from "@/lib/consent";

type ConsentState = { status: "loading" } | { status: "unset" } | { status: "set"; consent: StoredConsent };

const ConsentContext = createContext<{ state: ConsentState; openPreferences: () => void } | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent fora de ConsentProvider");
  return ctx;
}

function readCookie(): StoredConsent | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return decodeConsent(raw, Date.now());
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConsentState>({ status: "loading" });
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const c = readCookie();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do cookie após hidratação
    setState(c ? { status: "set", consent: c } : { status: "unset" });
  }, []);

  const save = useCallback((choice: ConsentChoice) => {
    startTransition(async () => {
      const res = await saveConsentAction(choice);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const c = readCookie();
      if (c) setState({ status: "set", consent: c });
      setPrefsOpen(false);
      toast.success("Preferências de cookies salvas.");
      // Revogação: scripts já carregados só deixam de executar após recarregar.
      if (choice.action === "REVOKE" || (!choice.analytics && state.status === "set" && state.consent.a)) {
        window.location.reload();
      }
    });
  }, [state]);

  const value = useMemo(() => ({ state, openPreferences: () => setPrefsOpen(true) }), [state]);

  return (
    <ConsentContext value={value}>
      {children}
      {state.status === "unset" && !prefsOpen && (
        <CookieBanner
          pending={pending}
          onAccept={() => save({ analytics: true, marketing: true, action: "GRANT_ALL" })}
          onReject={() => save({ analytics: false, marketing: false, action: "REJECT_OPTIONAL" })}
          onCustomize={() => setPrefsOpen(true)}
        />
      )}
      <PreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        initial={state.status === "set" ? { analytics: state.consent.a, marketing: state.consent.m } : { analytics: false, marketing: false }}
        hasPrevious={state.status === "set"}
        pending={pending}
        onSave={(c) => save({ ...c, action: "CUSTOM" })}
        onRevoke={() => save({ analytics: false, marketing: false, action: "REVOKE" })}
      />
      <OptionalScripts state={state} />
    </ConsentContext>
  );
}

function CookieBanner(props: { pending: boolean; onAccept: () => void; onReject: () => void; onCustomize: () => void }) {
  return (
    <section
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/98 shadow-[0_-8px_30px_rgba(11,59,70,0.12)] backdrop-blur animate-in slide-in-from-bottom-4"
    >
      <div className="container-page flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">
            Usamos cookies <strong>necessários</strong> para o funcionamento e a segurança do site. Com sua permissão,
            também usaríamos cookies <strong>opcionais</strong> de análise e marketing. Você pode aceitar, rejeitar ou
            escolher — e mudar de ideia a qualquer momento em “Preferências de cookies”, no rodapé.{" "}
            <Link href="/cookies" className="font-medium text-primary underline underline-offset-2">
              Política de Cookies
            </Link>
          </p>
        </div>
        {/* Três opções com o mesmo destaque visual (sem padrões manipulativos). */}
        <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" size="lg" className="h-10 px-4" disabled={props.pending} onClick={props.onReject}>
            Rejeitar opcionais
          </Button>
          <Button variant="outline" size="lg" className="h-10 px-4" disabled={props.pending} onClick={props.onCustomize}>
            Personalizar
          </Button>
          <Button variant="outline" size="lg" className="h-10 px-4" disabled={props.pending} onClick={props.onAccept}>
            Aceitar opcionais
          </Button>
        </div>
      </div>
    </section>
  );
}

function PreferencesDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { analytics: boolean; marketing: boolean };
  hasPrevious: boolean;
  pending: boolean;
  onSave: (c: { analytics: boolean; marketing: boolean }) => void;
  onRevoke: () => void;
}) {
  const [analytics, setAnalytics] = useState(props.initial.analytics);
  const [marketing, setMarketing] = useState(props.initial.marketing);
  const { open, initial } = props;

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o formulário ao abrir
      setAnalytics(initial.analytics);
      setMarketing(initial.marketing);
    }
  }, [open, initial.analytics, initial.marketing]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preferências de cookies</DialogTitle>
          <DialogDescription>
            Escolha quais categorias opcionais permitir. Nenhuma vem marcada por padrão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CategoryRow
            id="cookie-necessary"
            title="Necessários"
            description="Sessão, segurança e registro das suas escolhas. Não podem ser desativados porque o site não funciona sem eles."
            checked
            disabled
          />
          <CategoryRow
            id="cookie-analytics"
            title="Análise"
            description="Estatísticas agregadas de uso para melhorar a plataforma."
            checked={analytics}
            onChange={setAnalytics}
          />
          <CategoryRow
            id="cookie-marketing"
            title="Marketing"
            description="Personalização de comunicações e campanhas. Atualmente não utilizamos cookies desta categoria."
            checked={marketing}
            onChange={setMarketing}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {props.hasPrevious ? (
            <Button variant="ghost" disabled={props.pending} onClick={props.onRevoke}>
              Revogar consentimento
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={props.pending} onClick={() => props.onSave({ analytics, marketing })}>
            Salvar escolhas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow(props: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <label htmlFor={props.id} className="text-sm font-semibold">
          {props.title}
          {props.disabled && <span className="ml-2 text-xs font-normal text-muted-foreground">(sempre ativos)</span>}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      </div>
      <Switch id={props.id} checked={props.checked} disabled={props.disabled} onCheckedChange={props.onChange} />
    </div>
  );
}

/** Carrega scripts opcionais SOMENTE após consentimento válido da categoria correspondente. */
function OptionalScripts({ state }: { state: ConsentState }) {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (!src || state.status !== "set" || !state.consent.a) return null;
  return <Script src={src} data-domain={domain || undefined} strategy="afterInteractive" />;
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className={className}>
      Preferências de cookies
    </button>
  );
}
