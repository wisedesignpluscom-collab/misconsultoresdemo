import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { recurringCaseScope } from "@/lib/permissions";
import { etiquetaPeriodo } from "@/lib/fiscal/vencimientos";
import { estadoCasoLabels } from "@/lib/casos";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Vista imprimible del reporte de "Casos del período" — misma combinación de
// filtros que la bandeja (/casos), sin el chrome del CRM. Se abre en pestaña
// nueva desde el botón "Descargar reporte" de /casos, pasando el querystring
// tal cual.
export default async function ImprimirCasosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; estado?: string; analista?: string; ente?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const filtros = await searchParams;

  const scope = recurringCaseScope(session);
  const where = {
    ...scope,
    ...(filtros.periodo ? { periodoFiscal: { startsWith: filtros.periodo } } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.analista ? { analistaId: filtros.analista } : {}),
    ...(filtros.ente ? { obligacion: { enteReceptor: filtros.ente } } : {}),
  };

  const casos = await prisma.casoRecurrente.findMany({
    where,
    include: {
      company: { select: { name: true, rif: true } },
      obligacion: { select: { nombre: true, enteReceptor: true } },
      analista: { select: { name: true } },
    },
    orderBy: [{ fechaLimite: "asc" }, { createdAt: "desc" }],
    take: 1000,
  });

  const fechaCorta = (d: Date | null) =>
    d ? d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const filtrosTexto = [
    filtros.periodo && `Período: ${etiquetaPeriodo(filtros.periodo)}`,
    filtros.estado && `Estado: ${estadoCasoLabels[filtros.estado] ?? filtros.estado}`,
    filtros.ente && `Ente: ${filtros.ente}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8 print:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reporte de casos del período</h1>
          <p className="text-sm text-slate-500">
            Generado el {new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}
            {filtrosTexto && ` · ${filtrosTexto}`}
          </p>
          <p className="text-xs text-slate-400">{casos.length} caso(s)</p>
        </div>
        <PrintButton />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">Cliente</th>
            <th className="py-2 pr-3">RIF</th>
            <th className="py-2 pr-3">Obligación</th>
            <th className="py-2 pr-3">Ente</th>
            <th className="py-2 pr-3">Período</th>
            <th className="py-2 pr-3">Fecha límite</th>
            <th className="py-2 pr-3">Estado</th>
            <th className="py-2 pr-3">Analista</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c) => (
            <tr key={c.id} className="border-b border-slate-200">
              <td className="py-1.5 pr-3">{c.company.name}</td>
              <td className="py-1.5 pr-3 text-slate-500">{c.company.rif ?? "—"}</td>
              <td className="py-1.5 pr-3">{c.obligacion.nombre}</td>
              <td className="py-1.5 pr-3 text-slate-500">{c.obligacion.enteReceptor}</td>
              <td className="py-1.5 pr-3 text-slate-500">{etiquetaPeriodo(c.periodoFiscal)}</td>
              <td className="py-1.5 pr-3">{fechaCorta(c.fechaLimite)}</td>
              <td className="py-1.5 pr-3">{estadoCasoLabels[c.estado] ?? c.estado}</td>
              <td className="py-1.5 pr-3 text-slate-500">{c.analista?.name ?? "Sin asignar"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {casos.length === 0 && <p className="text-sm text-slate-500">No hay casos con estos filtros.</p>}
    </div>
  );
}
