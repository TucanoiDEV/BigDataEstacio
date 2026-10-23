"use client";

import { useOptimistic, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSavedJobAction } from "@/app/actions/candidate";

export function SaveJobButton({ jobId, initialSaved, compact }: { jobId: string; initialSaved: boolean; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useOptimistic(initialSaved);

  const onClick = () =>
    start(async () => {
      setSaved(!saved);
      const res = await toggleSavedJobAction({ jobId });
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data?.saved ? "Vaga salva." : "Vaga removida das salvas.");
    });

  const Icon = saved ? BookmarkCheck : Bookmark;
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClick}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remover das vagas salvas" : "Salvar vaga"}
        className={saved ? "text-primary" : "text-muted-foreground"}
      >
        <Icon className="size-4" />
      </Button>
    );
  }
  return (
    <Button variant="outline" size="lg" className="h-10 px-4" onClick={onClick} disabled={pending} aria-pressed={saved}>
      <Icon className={saved ? "text-primary" : undefined} /> {saved ? "Salva" : "Salvar vaga"}
    </Button>
  );
}
