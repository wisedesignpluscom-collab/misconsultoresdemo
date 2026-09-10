// Detección de "asignación automática" en el chat del portal — módulo puro
// (sin Prisma ni Next, mismo espíritu que lib/casos.ts). Un mensaje del
// CLIENTE dispara una tarea automática solo si combina:
//   1. Una frase de intención ("nueva asignación", "asignación adicional"…)
//   2. Una palabra clave de tema que algún User tenga en su especialidad
//      (impuestos, nómina, RIF…) — la lista de palabras vive en la BD
//      (PalabraClaveChat), configurable desde /configuracion.
// Un simple "hola, buenos días" nunca dispara nada: no trae frase de intención.

// Lista fija por ahora (estructural al feature); las palabras clave de TEMA
// sí son configurables desde el sistema (ver PalabraClaveChat).
export const FRASES_INTENCION = [
  "nueva asignacion",
  "asignacion adicional",
  "asignacion nueva",
  "nueva tarea",
  "quiero nueva asignacion",
] as const;

// Minúsculas + sin acentos, para comparar tolerante a tildes/mayúsculas
// (mismo criterio que lib/multivalor.ts hasValue).
const DIACRITICOS = new RegExp("[̀-ͯ]", "g");

export function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(DIACRITICOS, "").trim();
}

export function tieneIntencionDeAsignacion(mensaje: string): boolean {
  const t = normalizarTexto(mensaje);
  return FRASES_INTENCION.some((f) => t.includes(f));
}

export type ReglaPalabraClave = { palabra: string; especialidad: string };

// Primera regla activa cuyo texto aparece en el mensaje. Si varias palabras
// distintas calzan, gana la primera de la lista (orden = prioridad).
export function especialidadDetectada(mensaje: string, reglas: ReglaPalabraClave[]): string | null {
  const t = normalizarTexto(mensaje);
  const regla = reglas.find((r) => t.includes(normalizarTexto(r.palabra)));
  return regla?.especialidad ?? null;
}
