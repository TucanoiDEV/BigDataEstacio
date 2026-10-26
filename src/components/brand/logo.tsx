import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="#047857" />
      {/* Degraus ascendentes + seta: trajetória profissional */}
      <path d="M8 22h5v-4h5v-4h4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 10.5H24V15" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 rounded-md", className)} aria-label="Emprego Agora, página inicial">
      <LogoMark />
      <span className={cn("font-heading text-lg font-bold tracking-tight", inverted ? "text-white" : "text-petroleum")}>
        Emprego<span className={inverted ? "text-emerald-300" : "text-primary"}>Agora</span>
      </span>
    </Link>
  );
}
