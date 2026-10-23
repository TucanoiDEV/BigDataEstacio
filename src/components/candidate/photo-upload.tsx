"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removePhotoAction, uploadPhotoAction } from "@/app/actions/candidate";
import { initials } from "@/lib/text";

export function PhotoUpload({ name, photoFileId }: { name: string; photoFileId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Limite: 2 MB.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadPhotoAction(fd);
      if (r.ok) toast.success(r.message ?? "Foto atualizada.");
      else toast.error(r.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="foto-title">
      {photoFileId ? (
        <Image src={`/api/arquivos/${photoFileId}`} alt="Sua foto de perfil" width={80} height={80} unoptimized className="size-20 rounded-full border object-cover" />
      ) : (
        <span className="grid size-20 place-items-center rounded-full bg-secondary font-heading text-2xl font-bold text-secondary-foreground" aria-hidden>
          {initials(name)}
        </span>
      )}
      <div className="flex-1">
        <h2 id="foto-title" className="font-semibold text-petroleum">Foto de perfil (opcional)</h2>
        <p className="text-sm text-muted-foreground">
          JPG, PNG ou WebP até 2 MB. A foto fica visível apenas para você e <strong>não</strong> é enviada às empresas
          nas candidaturas, para reduzir vieses na seleção.
        </p>
      </div>
      <div className="flex gap-2">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo-input" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2 className="animate-spin" /> : <Camera />} {photoFileId ? "Trocar" : "Enviar foto"}
        </Button>
        {photoFileId && (
          <Button
            variant="ghost"
            disabled={pending}
            aria-label="Remover foto"
            onClick={() =>
              start(async () => {
                const r = await removePhotoAction({});
                if (!r.ok) toast.error(r.error);
              })
            }
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </section>
  );
}
