"use client";

import { Briefcase, Building2, LayoutDashboard, PlusCircle, Users } from "lucide-react";
import { SideNav } from "@/components/layout/side-nav";

export function OrgNav({ orgId, canManageMembers }: { orgId: string; canManageMembers: boolean }) {
  const base = `/empresa/${orgId}`;
  return (
    <SideNav
      label="Navegação da empresa"
      items={[
        { href: base, label: "Visão geral", icon: LayoutDashboard, exact: true },
        { href: `${base}/vagas`, label: "Vagas e candidaturas", icon: Briefcase },
        { href: `${base}/vagas/nova`, label: "Publicar vaga", icon: PlusCircle, exact: true },
        ...(canManageMembers ? [{ href: `${base}/membros`, label: "Membros", icon: Users }] : []),
        { href: `${base}/perfil`, label: "Perfil da empresa", icon: Building2 },
      ]}
    />
  );
}
