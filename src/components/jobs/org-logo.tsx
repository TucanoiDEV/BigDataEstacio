import Image from "next/image";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";

const PALETTE = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-900", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function OrgLogo({ name, fileId, size = 44, className }: { name: string; fileId?: string | null; size?: number; className?: string }) {
  if (fileId) {
    return (
      <Image
        src={`/api/arquivos/${fileId}`}
        alt={`Logo de ${name}`}
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 rounded-lg border bg-white object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-lg font-heading text-sm font-bold", colorFor(name), className)}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}
