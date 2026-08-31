import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { canAccessCompany } from "@/lib/ownership";
import { fechaLocal } from "@/lib/fiscal/vencimientos";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const fechaCorta = (d: Date) => d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

function fechaDeInput(raw: string | undefined, fallback: Date): Date {
  const texto = raw?.trim();
  if (!texto) return fallback;
  const [a, m, d] = texto.split("-").map(Number);
  return a && m && d ? fechaLocal(a, m, d) : fallback;
}

// Vista imprimible de los recibos de pago (uno por trabajador por corrida) en
// el rango de fechas filtrado en /nomina/[companyId]/reportes — cada recibo
// en su propia "página" para imprimir o guardar como PDF por separado.
export default async function ImprimirRecibosPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; desde?: string; hasta?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId, desde: desdeParam, hasta: hastaParam } = await searchParams;
  if (!companyId || !(await canAccessCompany(session, companyId))) notFound();

  const hoy = new Date();
  const desde = fechaDeInput(desdeParam, new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const hasta = fechaDeInput(hastaParam, hoy);

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, rif: true } });
  if (!company) notFound();

  const corridas = await prisma.corridaNomina.findMany({
    where: { companyId, fechaInicio: { lte: hasta }, fechaFin: { gte: desde } },
    orderBy: { fechaInicio: "asc" },
    include: {
      detalles: {
        include: { trabajador: { select: { nombre: true, cedula: true, cargo: true } } },
        orderBy: { trabajador: { nombre: "asc" } },
      },
    },
  });

  const recibos = corridas.flatMap((c) => c.detalles.map((d) => ({ corrida: c, detalle: d })));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8 print:p-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recibos de pago — {company.name}</h1>
          <p className="text-sm text-slate-500">
            {fechaCorta(desde)} – {fechaCorta(hasta)} · {recibos.length} recibo(s)
          </p>
        </div>
        <PrintButton />
      </div>

      {recibos.length === 0 && <p className="text-sm text-slate-500">No hay corridas calculadas en este rango.</p>}

      {recibos.map(({ corrida, detalle }, i) => (
        <div
          key={detalle.id}
          className={`space-y-4 rounded-xl border border-slate-200 p-6 print:break-after-page print:rounded-none print:border-0 ${
            i > 0 ? "print:mt-0" : ""
          }`}
        >
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{company.name}</p>
              <p className="text-xs text-slate-500">{company.rif ?? ""}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">Recibo de pago</p>
              <p className="text-xs text-slate-500">
                {corrida.periodo} · {fechaCorta(corrida.fechaInicio)} – {fechaCorta(corrida.fechaFin)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="text-slate-400">Trabajador: </span>
              {detalle.trabajador.nombre}
            </p>
            <p>
              <span className="text-slate-400">Cédula: </span>
              {detalle.trabajador.cedula}
            </p>
            <p>
              <span className="text-slate-400">Cargo: </span>
              {detalle.trabajador.cargo ?? "—"}
            </p>
            <p>
              <span className="text-slate-400">Horas trabajadas: </span>
              {detalle.horasTrabajadas}h
            </p>
          </div>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="py-1.5 text-slate-500">Base devengada</td>
                <td className="py-1.5 text-right font-medium">{money(detalle.baseDevengada)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="py-1.5 text-slate-500">Conceptos adicionales</td>
                <td className="py-1.5 text-right font-medium">{money(detalle.totalConceptos)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="py-1.5 text-slate-500">Deducciones</td>
                <td className="py-1.5 text-right font-medium text-red-600">-{money(detalle.totalDeducciones)}</td>
              </tr>
              <tr className="border-t-2 border-slate-800">
                <td className="py-2 font-semibold text-slate-900">Neto a pagar</td>
                <td className="py-2 text-right text-base font-bold text-slate-900">
                  {money(detalle.neto)} {corrida.moneda}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
