"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/components/forms/use-action-form";
import { FormRootError, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { changeMemberRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction } from "@/app/actions/company";
import { ORG_ROLE_LABEL } from "@/lib/constants";
import type { OrgRole } from "@/generated/prisma/browser";

const inviteSchema = z.object({
  orgId: z.string(),
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  role: z.enum(["OWNER", "ADMIN", "RECRUITER", "VIEWER"], { error: "Escolha o papel." }),
});

export function InviteForm({ orgId, roles }: { orgId: string; roles: { value: string; label: string }[] }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: inviteSchema,
    action: inviteMemberAction,
    defaultValues: { orgId, email: "", role: "RECRUITER" },
    onSuccess: () => form.reset({ orgId, email: "", role: "RECRUITER" }),
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <div className="sm:col-span-3"><FormRootError form={form} /></div>
      <TextField form={form} name="email" label="E-mail" type="email" required />
      <SelectField form={form} name="role" label="Papel" options={roles} required />
      <SubmitButton pending={pending} className="h-9">Enviar convite</SubmitButton>
    </form>
  );
}

export function MemberActions(props: { orgId: string; membershipId: string; role: OrgRole; isSelf: boolean; editable: boolean; roles: { value: string; label: string }[] }) {
  const [pending, start] = useTransition();
  if (props.isSelf) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{ORG_ROLE_LABEL[props.role]}</span>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
          if (!confirm("Sair desta empresa? Você perderá o acesso imediatamente.")) return;
          const r = await removeMemberAction({ orgId: props.orgId, membershipId: props.membershipId });
          if (r && !r.ok) toast.error(r.error);
        })}>Sair da empresa</Button>
      </div>
    );
  }
  if (!props.editable) return <span className="text-sm text-muted-foreground">{ORG_ROLE_LABEL[props.role]}</span>;
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`role-${props.membershipId}`}>Papel</label>
      <select
        id={`role-${props.membershipId}`}
        defaultValue={props.role}
        disabled={pending}
        className="h-8 rounded-lg border bg-background px-2 text-sm"
        onChange={(e) => {
          const role = e.target.value as OrgRole;
          start(async () => {
            const r = await changeMemberRoleAction({ orgId: props.orgId, membershipId: props.membershipId, role });
            if (r.ok) toast.success(r.message ?? "Atualizado.");
            else toast.error(r.error);
          });
        }}
      >
        {props.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => start(async () => {
        if (!confirm("Remover este membro?")) return;
        const r = await removeMemberAction({ orgId: props.orgId, membershipId: props.membershipId });
        if (r.ok) toast.success(r.message ?? "Removido.");
        else toast.error(r.error);
      })}>Remover</Button>
    </div>
  );
}

export function RevokeInviteButton({ orgId, invitationId }: { orgId: string; invitationId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await revokeInvitationAction({ orgId, invitationId });
      if (!r.ok) toast.error(r.error);
    })}>Revogar</Button>
  );
}
