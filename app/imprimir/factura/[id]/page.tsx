import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import { canAccessCompany } from "@/lib/ownership";
import { tipoFacturaLabels, estadoPagoLabels, formatMonto } from "@/lib/facturacion";
import { etiquetaPeriodo } from "@/lib/fiscal/vencimientos";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const fechaCorta = (d: Date) =>
  d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });

// Proforma imprimible/descargable de un cobro: el analista la genera desde
// /facturacion y la envía manualmente al cliente (no hay envío automático).
export default async function ImprimirFacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const factura = await prisma.facturacion.findUnique({
    where: { id },
    include: { company: { select: { id: true, name: true, rif: true } } },
  });
  if (!factura || !(await canAccessCompany(session, factura.companyId))) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8 print:p-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <h1 className="text-xl font-bold text-slate-900">Proforma</h1>
        <PrintButton />
      </div>

      <div className="space-y-6 rounded-xl border border-slate-200 p-8 print:rounded-none print:border-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-lg font-bold text-slate-900">Mis Consultores</p>
            <p className="text-xs text-slate-500">Outsourcing contable</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">Proforma de cobro</p>
            <p className="text-xs text-slate-500">Emitida el {fechaCorta(factura.fechaEmision)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
          <p className="text-sm font-semibold text-slate-800">{factura.company.name}</p>
          {factura.company.rif && <p className="text-xs text-slate-500">{factura.company.rif}</p>}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Concepto</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Período</th>
              <th className="py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-3">{factura.concepto}</td>
              <td className="py-3 text-slate-500">{tipoFacturaLabels[factura.tipo] ?? factura.tipo}</td>
              <td className="py-3 text-slate-500">{etiquetaPeriodo(factura.periodo)}</td>
              <td className="py-3 text-right font-semibold">{formatMonto(factura.monto, factura.moneda)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span>{formatMonto(factura.monto, factura.moneda)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Estado</span>
              <span>{estadoPagoLabels[factura.estadoPago] ?? factura.estadoPago}</span>
            </div>
          </div>
        </div>

        {factura.notas && (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Nota: {factura.notas}</p>
        )}
      </div>
    </div>
  );
}
