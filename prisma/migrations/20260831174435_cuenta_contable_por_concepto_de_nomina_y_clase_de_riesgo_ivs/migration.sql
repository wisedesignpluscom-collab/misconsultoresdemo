-- cuenta contable por concepto de nomina y clase de riesgo ivss
-- Generada con: npm run db:migracion
-- Nota: el ALTER de AporteLegal.cuentaContable se quitó de aquí al fusionar
-- con la rama de apertura de empresa — la migración
-- 20260821152744_aporte_por_pagar_y_apertura_de_empresa ya agrega esa misma
-- columna (más "ente") y corre antes por orden de fecha; repetirla aquí
-- rompería `migrate deploy` con "column already exists".

-- AlterTable
ALTER TABLE "ConfiguracionNomina" ADD COLUMN     "claseRiesgoIvss" TEXT;

