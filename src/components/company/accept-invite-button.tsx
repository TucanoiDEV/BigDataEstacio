"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/app/actions/company";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <Button className="h-10 w-full" disabled={pending} onClick={() => start(async () => {
      const r = await acceptInvitationAction({ token });
      if (r && !r.ok) toast.error(r.error);
    })}>
      {pending && <Loader2 className="animate-spin" />} Aceitar convite
    </Button>
  );
}
