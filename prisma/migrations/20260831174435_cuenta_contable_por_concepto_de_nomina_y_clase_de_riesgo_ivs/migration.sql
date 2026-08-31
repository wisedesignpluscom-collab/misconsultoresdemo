-- cuenta contable por concepto de nomina y clase de riesgo ivss
-- Generada con: npm run db:migracion

-- AlterTable
ALTER TABLE "ConfiguracionNomina" ADD COLUMN     "claseRiesgoIvss" TEXT;

-- AlterTable
ALTER TABLE "AporteLegal" ADD COLUMN     "cuentaContable" TEXT;

