import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader(props: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", props.className)}>
      <div className="space-y-1.5">
        {props.eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{props.eyebrow}</p>}
        <h1 className="text-2xl font-bold text-petroleum sm:text-3xl">{props.title}</h1>
        {props.description && <div className="max-w-2xl text-sm text-muted-foreground sm:text-base">{props.description}</div>}
      </div>
      {props.actions && <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div>}
    </div>
  );
}

export function EmptyState(props: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  const Icon = props.icon ?? Inbox;
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center", props.className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">{props.title}</h2>
      {props.description && <div className="mt-1 max-w-md text-sm text-muted-foreground">{props.description}</div>}
      {props.action && (
        <Link
          href={props.action.href}
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {props.action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState(props: { title?: string; description?: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-8 text-destructive" aria-hidden />
      <h2 className="font-semibold">{props.title ?? "Algo deu errado"}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {props.description ?? "Não foi possível carregar esta seção. Tente novamente em instantes."}
      </p>
      {props.children}
    </div>
  );
}

export function CardListSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: "green" | "blue" | "amber" | "red" | "gray" | "violet"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    gray: "bg-slate-100 text-slate-700 ring-slate-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}
