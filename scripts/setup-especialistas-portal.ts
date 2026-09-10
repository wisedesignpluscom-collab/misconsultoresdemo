// Crea/ajusta un usuario por especialidad, las palabras clave del chat, y un
// acceso de portal por cada uno de los 9 clientes que quedaron en la demo.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const CLAVE = "prueba123";
const CLAVE_PORTAL = "PortalDemo123";

async function main() {
  const hash = await bcrypt.hash(CLAVE, 10);

  // ── Usuarios especialistas ────────────────────────────────────────────────
  await prisma.user.update({ where: { email: "admin@skynetcrm.com" }, data: { especialidad: null } });
  await prisma.user.update({ where: { email: "supervisor@test.com" }, data: { especialidad: "Facturación" } });
  await prisma.user.update({ where: { email: "vendedor@test.com" }, data: { especialidad: "Tributario" } });

  const nuevos = [
    { name: "Especialista Laboral", email: "laboral@skynetcrm.com", especialidad: "Laboral" },
    { name: "Especialista Legal", email: "legal@skynetcrm.com", especialidad: "Legal" },
    { name: "Especialista en Auditoría", email: "auditoria@skynetcrm.com", especialidad: "Auditoría" },
  ];
  for (const u of nuevos) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, especialidad: u.especialidad, active: true },
      create: { name: u.name, email: u.email, passwordHash: hash, role: "vendedor", especialidad: u.especialidad },
    });
  }
  console.log("Usuarios especialistas listos: Tributario, Laboral, Legal, Facturación, Auditoría.");

  // ── Palabras clave del chat ───────────────────────────────────────────────
  await prisma.palabraClaveChat.deleteMany();
  const palabras: { palabra: string; especialidad: string }[] = [
    { palabra: "impuestos", especialidad: "Tributario" },
    { palabra: "iva", especialidad: "Tributario" },
    { palabra: "islr", especialidad: "Tributario" },
    { palabra: "rif", especialidad: "Tributario" },
    { palabra: "seniat", especialidad: "Tributario" },
    { palabra: "nomina", especialidad: "Laboral" },
    { palabra: "trabajador", especialidad: "Laboral" },
    { palabra: "empleado", especialidad: "Laboral" },
    { palabra: "contrato", especialidad: "Legal" },
    { palabra: "legal", especialidad: "Legal" },
    { palabra: "factura", especialidad: "Facturación" },
    { palabra: "cobro", especialidad: "Facturación" },
    { palabra: "pago", especialidad: "Facturación" },
    { palabra: "auditoria", especialidad: "Auditoría" },
    { palabra: "revision", especialidad: "Auditoría" },
  ];
  for (const p of palabras) await prisma.palabraClaveChat.create({ data: p });
  console.log(`${palabras.length} palabras clave sembradas.`);

  // ── Portal de clientes para los 9 ────────────────────────────────────────
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const passwordHashPortal = await bcrypt.hash(CLAVE_PORTAL, 10);
  const gerente = await prisma.user.findUnique({ where: { email: "admin@skynetcrm.com" } });
  const resumen: { empresa: string; email: string }[] = [];
  for (const c of companies) {
    const slug = c.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\bc\.?a\.?$/, "")
      .replace(/[^a-z0-9\s]+/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(".");
    const email = `cliente@${slug}.demo`;
    await prisma.portalUser.upsert({
      where: { email },
      update: { active: true, mustChangePassword: false, companyId: c.id },
      create: {
        companyId: c.id,
        name: `Contacto ${c.name}`,
        email,
        passwordHash: passwordHashPortal,
        mustChangePassword: false,
        createdById: gerente?.id,
      },
    });
    resumen.push({ empresa: c.name, email });
  }
  console.log("\nAccesos de portal (clave para todos: " + CLAVE_PORTAL + "):");
  for (const r of resumen) console.log(`  ${r.empresa.padEnd(42)} ${r.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
