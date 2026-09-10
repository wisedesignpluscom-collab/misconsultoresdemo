// Semilla de "Apertura de empresa (SAREN)" — trámite de UNA SOLA VEZ para
// constituir un cliente nuevo sin RIF todavía (Parte II-IV del manual de
// procedimientos). Crea la Obligacion (si falta) con periodicidad "unica" —
// nunca se ofrece como servicio recurrente (empresas/[id]/page.tsx la filtra)
// — y sus 13 fases, mismo patrón que seed-fases-obligacion.ts. Idempotente:
// no siembra fases si la obligación ya tiene alguna.
//   npx tsx prisma/seed-apertura-empresa.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOMBRE_OBLIGACION = "Apertura de empresa (SAREN)";

type CampoSeed = { id: string; label: string; tipo: "texto" | "numero" | "fecha" | "url"; requerido: boolean };
type FaseSeed = { nombre: string; descripcion?: string; campos?: CampoSeed[] };

const campo = (
  id: string,
  label: string,
  tipo: CampoSeed["tipo"],
  requerido = false
): CampoSeed => ({ id, label, tipo, requerido });

// Los 13 pasos son literalmente el checklist de la Parte IV del manual — es
// un trámite poco frecuente y de alto riesgo si se salta un paso, por eso
// lleva el mismo nivel de detalle que el manual. El modelo de fases de este
// repo no soporta campos tipo "select con opciones" ni validación de
// duplicados por campo — se simplifican a texto libre donde hacía falta.
const FASES: FaseSeed[] = [
  {
    nombre: "Definir figura jurídica y datos societarios",
    campos: [
      campo("tipoSocietario", "Figura jurídica (C.A. / S.R.L. / Firma Personal / Otra)", "texto", true),
      campo("objetoSocial", "Objeto social", "texto", true),
      campo("capitalSocial", "Capital social", "numero", true),
      campo("socios", "Socios/accionistas", "texto", true),
    ],
  },
  {
    nombre: "Reservar la denominación comercial (SAREN)",
    campos: [
      campo("nombreReservado", "Nombre reservado", "texto", true),
      campo("numeroConstancia", "N° de constancia de reserva", "texto", true),
      campo("fechaReserva", "Fecha de reserva", "fecha", true),
    ],
  },
  {
    nombre: "Elaborar el Acta Constitutiva y Estatutos Sociales",
    campos: [
      campo("abogadoResponsable", "Abogado colegiado responsable", "texto", true),
      campo("fechaElaboracion", "Fecha de elaboración", "fecha", false),
    ],
  },
  {
    nombre: "Presentar e inscribir ante el Registro Mercantil",
    campos: [
      campo("montoArancel", "Arancel registral pagado", "numero", true),
      campo("fechaProtocolizacion", "Fecha de protocolización", "fecha", true),
      campo("numeroExpediente", "N° de expediente/tomo", "texto", true),
    ],
  },
  {
    nombre: "Publicar el Acta Constitutiva (cuando aplique)",
    campos: [
      campo("diarioPublicacion", "Diario/periódico mercantil", "texto", false),
      campo("fechaPublicacion", "Fecha de publicación", "fecha", false),
    ],
  },
  {
    nombre: "Sellar los libros legales",
    descripcion: "Libro Diario, Mayor, Inventarios, Accionistas/Socios, Actas de Asamblea.",
    campos: [
      campo("fechaSellado", "Fecha de sellado", "fecha", true),
      campo("librosSellados", "Libros sellados", "texto", true),
    ],
  },
  {
    nombre: "Abrir la cuenta bancaria empresarial",
    campos: [
      campo("banco", "Banco", "texto", true),
      campo("numeroCuenta", "Número de cuenta", "texto", true),
      campo("fechaAperturaCuenta", "Fecha de apertura", "fecha", false),
    ],
  },
  {
    nombre: "Tramitar el RIF ante el SENIAT",
    descripcion: "Máx. 30 días desde la constitución.",
    campos: [
      campo("rif", "RIF asignado", "texto", true),
      campo("fechaEmisionRif", "Fecha de emisión", "fecha", false),
    ],
  },
  {
    nombre: "Registro patronal ante el IVSS (Sistema TIUNA)",
    campos: [campo("numeroPatronalIvss", "Número patronal IVSS", "texto", true)],
  },
  {
    nombre: "Registro ante BANAVIH (FAOV en línea)",
    campos: [campo("usuarioPatronalFaov", "Usuario patronal FAOV", "texto", true)],
  },
  {
    nombre: "Registro ante el INCES",
    campos: [campo("numeroAportanteInces", "Número de aportante INCES", "texto", true)],
  },
  {
    nombre: "Registro de la entidad de trabajo ante el MINTRA (RNET)",
    campos: [campo("constanciaRnet", "Constancia de inscripción RNET", "texto", true)],
  },
  {
    nombre: "Licencia de Actividades Económicas (municipal)",
    campos: [
      campo("municipioLicencia", "Municipio", "texto", true),
      campo("numeroLicencia", "N° de licencia", "texto", true),
      campo("vigenciaLicencia", "Vigencia", "fecha", false),
    ],
  },
];

async function main() {
  let obligacion = await prisma.obligacion.findFirst({ where: { nombre: NOMBRE_OBLIGACION } });
  if (!obligacion) {
    obligacion = await prisma.obligacion.create({
      data: {
        nombre: NOMBRE_OBLIGACION,
        jurisdiccion: "nacional",
        // "unica" = trámite de una sola vez, no un ciclo fiscal recurrente.
        periodicidad: "unica",
        enteReceptor: "SAREN",
        // Sin calendario fiscal que calcular: la fecha (si se quiere una
        // meta) la pone el analista.
        reglaTipo: "manual",
        reglaParam: null,
        notas: "Constitución de una empresa nueva: figura jurídica, SAREN, RIF y registros patronales (Parte II-IV del manual).",
        order: 5,
      },
    });
    console.log(`Creada la obligación «${NOMBRE_OBLIGACION}».`);
  }

  const existentes = await prisma.faseObligacion.count({ where: { obligacionId: obligacion.id } });
  if (existentes > 0) {
    console.log(`«${NOMBRE_OBLIGACION}» ya tenía fases — no se toca.`);
    await prisma.$disconnect();
    return;
  }

  for (const [i, fase] of FASES.entries()) {
    await prisma.faseObligacion.create({
      data: {
        obligacionId: obligacion.id,
        order: (i + 1) * 10,
        nombre: fase.nombre,
        descripcion: fase.descripcion ?? null,
        campos: JSON.stringify(fase.campos ?? []),
      },
    });
  }
  console.log(`Listo: ${FASES.length} fases sembradas para «${NOMBRE_OBLIGACION}».`);
  await prisma.$disconnect();
}

main();
