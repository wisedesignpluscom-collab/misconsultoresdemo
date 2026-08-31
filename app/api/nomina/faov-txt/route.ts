import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessCompany } from "@/lib/ownership";
import { fechaLocal } from "@/lib/fiscal/vencimientos";
import { generarFaovTxt } from "@/lib/nominaExportar";

export const dynamic = "force-dynamic";

function fechaDeParam(raw: string | null): Date | null {
  if (!raw) return null;
  const [a, m, d] = raw.split("-").map(Number);
  return a && m && d ? fechaLocal(a, m, d) : null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId || !(await canAccessCompany(session, companyId))) {
    return NextResponse.json({ error: "sin acceso" }, { status: 403 });
  }
  const desde = fechaDeParam(req.nextUrl.searchParams.get("desde"));
  const hasta = fechaDeParam(req.nextUrl.searchParams.get("hasta"));
  if (!desde || !hasta) return NextResponse.json({ error: "rango inválido" }, { status: 400 });

  const [company, faov] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.aporteLegal.findMany({
      where: { companyId, activo: true, nombre: { contains: "FAOV" } },
    }),
  ]);
  if (!company) return NextResponse.json({ error: "cliente no encontrado" }, { status: 404 });

  const trabajador = faov.find((a) => a.tipo === "trabajador")?.porcentaje ?? 1;
  const patronal = faov.find((a) => a.tipo === "patronal")?.porcentaje ?? 2;

  const detalles = await prisma.corridaDetalle.findMany({
    where: { corrida: { companyId, fechaInicio: { lte: hasta }, fechaFin: { gte: desde } } },
    include: { trabajador: { select: { cedula: true, nombre: true } } },
  });

  const txt = generarFaovTxt(
    detalles.map((d) => ({ cedula: d.trabajador.cedula, nombre: d.trabajador.nombre, baseDevengada: d.baseDevengada })),
    trabajador,
    patronal
  );

  return new NextResponse(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="faov_${company.name.replace(/[^a-z0-9]+/gi, "_")}.txt"`,
    },
  });
}
