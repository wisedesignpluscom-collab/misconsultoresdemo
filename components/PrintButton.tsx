"use client";

// Botón mínimo para imprimir/descargar como PDF una vista imprimible: usa el
// diálogo nativo del navegador (Guardar como PDF) en vez de generar el PDF en
// el servidor — cero dependencias nuevas, consistente con el resto del
// proyecto. Se oculta a sí mismo al imprimir (print:hidden).

export default function PrintButton({ label = "Descargar / imprimir PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
    >
      {label}
    </button>
  );
}
