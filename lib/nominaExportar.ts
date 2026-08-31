// Generadores de archivo para BANAVIH (FAOV) y SENIAT (retención de ISLR).
//
// ADVERTENCIA: no se contó con el layout oficial exacto de ninguno de los dos
// formatos al construir esto (ver decisión del 2026-08-31). Son un borrador
// razonable con los campos típicos de este tipo de reporte — un contador debe
// validarlos contra el formato vigente del ente antes de usarlos para
// presentar de verdad. Módulo puro, sin Prisma ni Next, para poder probarlo.

export type TrabajadorAporte = {
  cedula: string;
  nombre: string;
  baseDevengada: number;
};

// ── FAOV — BANAVIH (.txt) ───────────────────────────────────────────────────
// Campos típicos de la relación de aportantes del FAOV: cédula, nombre,
// salario base, % trabajador, % patronal, monto trabajador, monto patronal.
// Delimitado por "|" (texto plano legible) en vez de ancho fijo, a falta del
// layout oficial de columnas de BANAVIH.
export function generarFaovTxt(
  trabajadores: TrabajadorAporte[],
  pctTrabajador: number,
  pctPatronal: number
): string {
  const lineas = [
    "CEDULA|NOMBRE|SALARIO_BASE|PCT_TRABAJADOR|MONTO_TRABAJADOR|PCT_PATRONAL|MONTO_PATRONAL",
    ...trabajadores.map((t) => {
      const montoTrabajador = (t.baseDevengada * pctTrabajador) / 100;
      const montoPatronal = (t.baseDevengada * pctPatronal) / 100;
      return [
        t.cedula,
        t.nombre,
        t.baseDevengada.toFixed(2),
        pctTrabajador.toFixed(2),
        montoTrabajador.toFixed(2),
        pctPatronal.toFixed(2),
        montoPatronal.toFixed(2),
      ].join("|");
    }),
  ];
  return lineas.join("\n");
}

// ── Retención de ISLR — SENIAT (XML) ────────────────────────────────────────
function escaparXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generarIslrXml(
  trabajadores: TrabajadorAporte[],
  pctRetencion: number,
  periodo: string
): string {
  const filas = trabajadores
    .map((t) => {
      const monto = (t.baseDevengada * pctRetencion) / 100;
      return [
        "  <Retencion>",
        `    <Cedula>${escaparXml(t.cedula)}</Cedula>`,
        `    <Nombre>${escaparXml(t.nombre)}</Nombre>`,
        `    <BaseImponible>${t.baseDevengada.toFixed(2)}</BaseImponible>`,
        `    <PorcentajeRetencion>${pctRetencion.toFixed(2)}</PorcentajeRetencion>`,
        `    <MontoRetenido>${monto.toFixed(2)}</MontoRetenido>`,
        "  </Retencion>",
      ].join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<RetencionesISLR periodo="${escaparXml(periodo)}">`,
    filas,
    "</RetencionesISLR>",
  ].join("\n");
}
