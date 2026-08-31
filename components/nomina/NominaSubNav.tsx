"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-navegación horizontal presente en toda la sección de nómina de un
// cliente. El autoservicio del trabajador ("Vista empleado" / "Mi panel" /
// "Marcar asistencia" / "Mis recibos") se retiró de aquí: está fuera del
// alcance del analista y no tenía ruta real todavía.
export default function NominaSubNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const home = `/nomina/${companyId}`;
  const active = pathname === home;

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      <Link
        href={home}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          active ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Nóminas
      </Link>
    </nav>
  );
}
