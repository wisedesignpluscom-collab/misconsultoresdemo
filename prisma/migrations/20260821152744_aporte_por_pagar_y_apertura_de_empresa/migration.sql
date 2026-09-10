-- aporte_por_pagar_y_apertura_de_empresa
-- Generada con: npm run db:migracion

-- AlterTable
ALTER TABLE "AporteLegal" ADD COLUMN     "cuentaContable" TEXT,
ADD COLUMN     "ente" TEXT;

-- CreateTable
CREATE TABLE "AportePorPagar" (
    "id" TEXT NOT NULL,
    "corridaId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ente" TEXT NOT NULL,
    "montoTrabajador" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoPatronal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "cuentaContable" TEXT,
    "estadoPago" TEXT NOT NULL DEFAULT 'pendiente',
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPago" TIMESTAMP(3),
    "notas" TEXT,

    CONSTRAINT "AportePorPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AportePorPagar_companyId_idx" ON "AportePorPagar"("companyId");

-- CreateIndex
CREATE INDEX "AportePorPagar_estadoPago_idx" ON "AportePorPagar"("estadoPago");

-- CreateIndex
CREATE UNIQUE INDEX "AportePorPagar_corridaId_ente_key" ON "AportePorPagar"("corridaId", "ente");

-- AddForeignKey
ALTER TABLE "AportePorPagar" ADD CONSTRAINT "AportePorPagar_corridaId_fkey" FOREIGN KEY ("corridaId") REFERENCES "CorridaNomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AportePorPagar" ADD CONSTRAINT "AportePorPagar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

