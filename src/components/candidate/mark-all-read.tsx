"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/app/actions/candidate";

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction({}); })}>
      <CheckCheck /> Marcar todas como lidas
    </Button>
  );
}
