"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestReverificationAction } from "@/app/actions/company";

export function ReverifyButton({ orgId }: { orgId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await requestReverificationAction({ orgId });
      if (r.ok) toast.success(r.message ?? "Enviado.");
      else toast.error(r.error);
    })}>
      <RotateCcw /> Solicitar nova análise
    </Button>
  );
}
