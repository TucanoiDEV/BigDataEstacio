"use client";

import { Building2, Database, FileLock2, Flag, Gauge, ScrollText, ShieldAlert, Users, Briefcase } from "lucide-react";
import { SideNav } from "@/components/layout/side-nav";

export function AdminNav() {
  return (
    <SideNav
      label="Administração"
      items={[
        { href: "/admin", label: "Visão geral", icon: Gauge, exact: true },
        { href: "/admin/empresas", label: "Empresas", icon: Building2 },
        { href: "/admin/vagas", label: "Vagas", icon: Briefcase },
        { href: "/admin/denuncias", label: "Denúncias", icon: Flag },
        { href: "/admin/usuarios", label: "Usuários", icon: Users },
        { href: "/admin/privacidade", label: "Solicitações LGPD", icon: FileLock2 },
        { href: "/admin/incidentes", label: "Incidentes", icon: ShieldAlert },
        { href: "/admin/dados", label: "Dados oficiais", icon: Database },
        { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
      ]}
    />
  );
}
