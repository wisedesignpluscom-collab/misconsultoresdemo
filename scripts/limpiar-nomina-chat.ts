// Limpieza previa para poder resembrar la demo del CRM: seed-demo-contable.ts
// borra Company y sus relaciones "clásicas" (deals, contactos, casos,
// facturación…) pero nunca conoció las tablas de nómina/chat/portal que se
// agregaron después. CorridaLinea -> ConceptoNomina es onDelete:Restrict a
// propósito (no se puede borrar un concepto con historial de nómina), así que
// bloquea cualquier intento de borrar la Company en cascada mientras exista
// una corrida calculada. Se borra aquí, de abajo hacia arriba, antes de tocar
// Company. Uso puntual — no es parte del flujo normal de seeding.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.corridaLinea.deleteMany();
  await prisma.corridaDetalle.deleteMany();
  await prisma.corridaNomina.deleteMany();
  await prisma.trabajadorDocumento.deleteMany();
  await prisma.asistenciaDia.deleteMany();
  await prisma.declaracionNomina.deleteMany();
  await prisma.registroVacaciones.deleteMany();
  await prisma.registroUtilidades.deleteMany();
  await prisma.liquidacion.deleteMany();
  await prisma.trabajador.deleteMany();
  await prisma.conceptoNomina.deleteMany();
  await prisma.aporteLegal.deleteMany();
  await prisma.jornada.deleteMany();
  await prisma.configuracionNomina.deleteMany();
  await prisma.geocerca.deleteMany();
  await prisma.casoFaseProgreso.deleteMany();
  await prisma.mensajeChat.deleteMany();
  await prisma.portalUser.deleteMany();
  console.log("Nómina/chat/portal limpios — Company ya se puede borrar en cascada.");
}
main().finally(() => prisma.$disconnect());
