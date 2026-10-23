"use client";

import { useRef, useTransition } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/components/forms/use-action-form";
import { CheckboxField, FormRootError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { createOrgAction, updateOrgAction, uploadOrgLogoAction } from "@/app/actions/company";
import { createOrgSchema, updateOrgSchema, type UpdateOrgInput } from "@/lib/validation/org";
import { COMPANY_SIZES, SECTORS, UFS } from "@/lib/constants";
import { idSchema } from "@/lib/validation/common";

const sectorOpts = SECTORS.map((s) => ({ value: s, label: s }));
const sizeOpts = COMPANY_SIZES.map((s) => ({ value: s, label: `${s} pessoas` }));
const ufOpts = UFS.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }));

function ProfileFields({ form }: { form: Parameters<typeof TextField>[0]["form"] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField form={form} name="tradeName" label="Nome fantasia" required />
        <TextField form={form} name="contactEmail" label="E-mail de contato corporativo" type="email" required hint="Preferencialmente no domínio do site da empresa." />
        <TextField form={form} name="website" label="Site" type="url" placeholder="https://" />
        <SelectField form={form} name="sector" label="Setor" options={sectorOpts} allowEmpty />
        <SelectField form={form} name="sizeRange" label="Porte" options={sizeOpts} allowEmpty />
        <TextField form={form} name="city" label="Cidade (sede)" />
        <SelectField form={form} name="state" label="UF" options={ufOpts} allowEmpty />
      </div>
      <TextAreaField form={form} name="description" label="Sobre a empresa" rows={5} hint="Cultura, áreas de atuação e o que candidatos podem esperar." />
    </>
  );
}

export function CreateOrgForm({ contactEmail }: { contactEmail: string }) {
  const { form, onSubmit, pending } = useActionForm({
    schema: createOrgSchema,
    action: createOrgAction,
    defaultValues: { legalName: "", cnpj: "", tradeName: "", contactEmail, website: "", description: "", city: "", declaration: false as unknown as true },
    successToast: false,
  });
  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6" noValidate>
      <FormRootError form={form} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField form={form} name="legalName" label="Razão social" required />
        <TextField form={form} name="cnpj" label="CNPJ" inputMode="numeric" placeholder="00.000.000/0000-00" required hint="Dado da pessoa jurídica, usado apenas para verificação." />
      </div>
      <ProfileFields form={form as never} />
      <CheckboxField form={form} name="declaration" label="Declaro que represento esta empresa e tenho autorização para publicar vagas em nome dela." description="Informações falsas levam à suspensão da conta e podem ser comunicadas às autoridades." />
      <SubmitButton pending={pending}>Enviar para verificação</SubmitButton>
    </form>
  );
}

export function UpdateOrgForm({ orgId, defaults }: { orgId: string; defaults: UpdateOrgInput }) {
  const schema = updateOrgSchema.extend({ orgId: idSchema });
  const { form, onSubmit, pending } = useActionForm({ schema, action: updateOrgAction, defaultValues: { ...defaults, orgId } });
  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6" noValidate>
      <FormRootError form={form} />
      <ProfileFields form={form as never} />
      <SubmitButton pending={pending}>Salvar</SubmitButton>
    </form>
  );
}

export function OrgLogoUpload({ orgId }: { orgId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Arquivo do logo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const fd = new FormData();
          fd.set("orgId", orgId);
          fd.set("file", f);
          start(async () => {
            const r = await uploadOrgLogoAction(fd);
            if (r.ok) toast.success(r.message ?? "Logo atualizado.");
            else toast.error(r.error);
          });
        }}
      />
      <Button variant="outline" disabled={pending} onClick={() => ref.current?.click()}>
        {pending ? <Loader2 className="animate-spin" /> : <ImageUp />} Enviar logo
      </Button>
    </>
  );
}
