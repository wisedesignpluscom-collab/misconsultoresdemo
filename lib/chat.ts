// Chat interno cliente ↔ gestor (Fase 2 del portal). Módulo server-only (usa
// Prisma) pero sin cookies()/redirect(): las Server Actions de cada lado
// (app/(crm)/empresas/chat-actions.ts y app/portal/(app)/chat/actions.ts) son
// wrappers finos sobre estas funciones — mismo principio que lib/portal.ts,
// para poder probarlas sin el runtime de Next.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "./prisma";
import { hasValue } from "./multivalor";
import { tieneIntencionDeAsignacion, especialidadDetectada } from "./chatAsignacion";

export const MAX_MENSAJE_LENGTH = 4000;

export type AutorTipo = "staff" | "cliente";

// Adjuntos del chat — mismos límites que WhatsApp: 16 MB para fotos/imágenes,
// 100 MB para documentos. Se guardan en disco (no en la BD): SQLite/Postgres
// no están pensados para blobs de decenas de MB, y el servidor Windows del
// cliente tiene disco de sobra.
export const MAX_TAMANO_IMAGEN = 16 * 1024 * 1024;
export const MAX_TAMANO_DOCUMENTO = 100 * 1024 * 1024;

const MIME_IMAGEN = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Documentos típicos de una firma contable. Deliberadamente NO incluye
// ejecutables, scripts ni HTML: el portal recibe archivos de internet.
const MIME_DOCUMENTO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/rtf",
]);

const UPLOADS_ROOT = join(process.cwd(), "uploads", "chat");

export type ArchivoMensaje = {
  archivoNombre: string;
  archivoRuta: string;
  archivoMime: string;
  archivoTamano: number;
};

function nombreSeguro(nombre: string) {
  return nombre.replace(/[^\w.\-() ]+/g, "_").slice(-150) || "archivo";
}

// Valida tipo y tamaño ANTES de tocar disco. Mensaje en español listo para
// mostrarle al usuario (patrón de las Validation Rules del engine).
export function errorArchivoChat(file: File): string | null {
  const mime = file.type || "application/octet-stream";
  const esImagen = MIME_IMAGEN.has(mime);
  const esDocumento = MIME_DOCUMENTO.has(mime);
  if (!esImagen && !esDocumento) {
    return "Ese tipo de archivo no está permitido. Se aceptan imágenes y documentos comunes (PDF, Word, Excel…).";
  }
  const limite = esImagen ? MAX_TAMANO_IMAGEN : MAX_TAMANO_DOCUMENTO;
  if (file.size > limite) {
    return esImagen
      ? "La imagen supera el límite de 16 MB."
      : "El archivo supera el límite de 100 MB.";
  }
  return null;
}

// Guarda el archivo en uploads/chat/<companyId>/ con un nombre único. Asume
// que errorArchivoChat() ya se llamó y no encontró problemas.
export async function guardarArchivoChat(file: File, companyId: string): Promise<ArchivoMensaje> {
  const mime = file.type || "application/octet-stream";
  const dir = join(UPLOADS_ROOT, companyId);
  await mkdir(dir, { recursive: true });
  const nombreArchivo = `${randomUUID()}-${nombreSeguro(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, nombreArchivo), buffer);

  return {
    archivoNombre: file.name || nombreArchivo,
    archivoRuta: `${companyId}/${nombreArchivo}`,
    archivoMime: mime,
    archivoTamano: file.size,
  };
}

// Lee el archivo para servirlo — usado por app/api/chat/archivo/[id]/route.ts,
// que hace el control de acceso (empresa del mensaje == empresa de quien pide).
export async function leerArchivoChat(rutaRelativa: string): Promise<Buffer> {
  return readFile(join(UPLOADS_ROOT, rutaRelativa));
}

export type NuevoMensaje = {
  companyId: string;
  contenido: string;
  autorTipo: AutorTipo;
  userId?: string | null;
  portalUserId?: string | null;
  archivo?: ArchivoMensaje | null;
};

// Cada mensaje nace leído por quien lo escribe y sin leer por el otro lado —
// así el contador de "no leídos" siempre mira hacia el lado contrario.
export async function crearMensaje(datos: NuevoMensaje) {
  const contenido = datos.contenido.trim().slice(0, MAX_MENSAJE_LENGTH);
  if (!contenido && !datos.archivo) return null;

  const ahora = new Date();
  const mensaje = await prisma.mensajeChat.create({
    data: {
      companyId: datos.companyId,
      contenido,
      autorTipo: datos.autorTipo,
      userId: datos.autorTipo === "staff" ? (datos.userId ?? null) : null,
      portalUserId: datos.autorTipo === "cliente" ? (datos.portalUserId ?? null) : null,
      readByStaffAt: datos.autorTipo === "staff" ? ahora : null,
      readByClientAt: datos.autorTipo === "cliente" ? ahora : null,
      ...(datos.archivo ?? {}),
    },
  });

  // Todo lo de abajo es SOLO para mensajes del CLIENTE — nunca se dispara si
  // escribe el staff. Nunca debe tumbar el envío del mensaje: el chat sigue
  // vivo aunque esto falle.
  if (datos.autorTipo === "cliente" && contenido) {
    await procesarMensajeCliente(datos.companyId, contenido, !!datos.archivo).catch(() => {});
  }

  return mensaje;
}

const PREFIJO_TAREA_CHAT = "Nueva asignación (chat)";

function fechaHoraCorta(d: Date): string {
  return d.toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

// Avisa "en grande" (Notification.urgente=true, dirigida a un usuario puntual)
// además de la campanita normal — la UI (AlertaGrande) la muestra encima de
// cualquier módulo en el que esté esa persona.
async function avisarUrgente(userId: string, title: string, body: string, url: string) {
  await prisma.notification.create({ data: { userId, title, body, url, urgente: true } });
}

// Punto de entrada por cada mensaje del cliente. Dos caminos, no excluyentes:
//   1. Si hay una tarea de asignación abierta para esta empresa (de cualquier
//      mensaje anterior), el mensaje se ACUMULA ahí en vez de crear otra —
//      así los "5 nombres + fotos de cédula" que van llegando en mensajes
//      separados terminan en UNA sola tarea. Una tarea nueva por especialidad
//      solo se abre si trae una frase de intención con una especialidad que
//      todavía no tiene tarea abierta.
//   2. Sin importar lo anterior, el analista principal de la cuenta recibe
//      SIEMPRE un aviso urgente por cualquier mensaje del cliente (lo pidió
//      el cliente explícitamente: "que le llegue también sin palabra clave").
async function procesarMensajeCliente(companyId: string, mensaje: string, traeArchivo: boolean) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) return;

  const sufijoArchivo = traeArchivo ? " 📎 (el cliente adjuntó un archivo — revísalo en el chat)" : "";
  const conIntencion = tieneIntencionDeAsignacion(mensaje);
  const reglas = conIntencion ? await prisma.palabraClaveChat.findMany({ where: { activa: true } }) : [];
  const especialidad = conIntencion ? especialidadDetectada(mensaje, reglas) : null;

  // Marcador oculto para encontrar la tarea abierta de ESTA empresa/especialidad
  // sin depender de que haya un contacto (Task no tiene companyId propio).
  const marcador = (esp: string | null) => `[[chat-auto:${companyId}:${esp ?? "general"}]]`;

  const abierta = conIntencion
    ? await prisma.task.findFirst({
        where: { done: false, title: { startsWith: PREFIJO_TAREA_CHAT }, description: { contains: marcador(especialidad) } },
      })
    : await prisma.task.findFirst({
        where: { done: false, title: { startsWith: PREFIJO_TAREA_CHAT }, description: { contains: `[[chat-auto:${companyId}:` } },
        orderBy: { createdAt: "desc" },
      });

  if (abierta) {
    await prisma.task.update({
      where: { id: abierta.id },
      data: { description: `${abierta.description ?? ""}\n\n[${fechaHoraCorta(new Date())}] ${mensaje}${sufijoArchivo}` },
    });
  } else if (conIntencion) {
    await crearTareaPorAsignacionAutomatica(company, especialidad, mensaje + sufijoArchivo, marcador(especialidad));
  }

  // El aviso urgente por CUALQUIER mensaje del cliente (con o sin palabra
  // clave) no necesita una Notification aparte: /api/alertas ya lista los
  // mensajes sin leer del cliente (scope de companyScope, que ahora también
  // cubre al especialista con tarea abierta) y los marca urgente=true — crear
  // una Notification adicional aquí duplicaría el aviso para la misma cosa.
}

// Crea la tarea automática y la asigna al User cuya especialidad coincida con
// la palabra clave detectada. Si no hay palabra clave o nadie tiene esa
// especialidad, la tarea queda sin asignar y se avisa a supervisor/gerente
// (nunca cae en silencio al analista principal de la cuenta — pedido explícito).
async function crearTareaPorAsignacionAutomatica(
  company: { id: string; name: string },
  especialidad: string | null,
  descripcion: string,
  marcador: string
) {
  const [contacto, usuariosConEspecialidad] = await Promise.all([
    prisma.contact.findFirst({ where: { companyId: company.id }, select: { id: true } }),
    prisma.user.findMany({
      where: { active: true, especialidad: { not: null } },
      select: { id: true, name: true, especialidad: true },
    }),
  ]);

  let asignadoA: { id: string; name: string } | null = null;
  if (especialidad) {
    const match = usuariosConEspecialidad.find((u) => hasValue(u.especialidad, especialidad));
    if (match) asignadoA = { id: match.id, name: match.name };
  }

  const titulo = especialidad
    ? `${PREFIJO_TAREA_CHAT} — ${especialidad}: ${company.name}`
    : `${PREFIJO_TAREA_CHAT}: ${company.name}`;

  await prisma.task.create({
    data: {
      title: titulo,
      description: `${descripcion}\n\n${marcador}`,
      type: "seguimiento",
      ownerId: asignadoA?.id ?? null,
      contactId: contacto?.id ?? null,
    },
  });

  if (asignadoA) {
    await avisarUrgente(
      asignadoA.id,
      `📋 Nueva asignación: ${company.name}`,
      especialidad ? `Tema: ${especialidad}. Entra al chat para ver el detalle.` : "Entra al chat para ver el detalle.",
      `/empresas/${company.id}#chat`
    );
  } else {
    await prisma.notification.create({
      data: {
        title: "Tarea de chat sin especialista",
        body: especialidad
          ? `${company.name} pidió algo de "${especialidad}" pero nadie tiene esa especialidad configurada.`
          : `${company.name} pidió una nueva asignación por chat, pero el mensaje no menciona un tema conocido.`,
        url: `/empresas/${company.id}#chat`,
        urgente: true,
      },
    });
  }

  // La firma le avisa a quien tenga la especialidad "facturación": una tarea
  // nueva implica trabajo adicional que probablemente haya que cobrar. Se
  // avisa solo al ABRIR la tarea, no en cada mensaje que se le acumula.
  const facturacion = usuariosConEspecialidad.filter(
    (u) => hasValue(u.especialidad, "facturación") || hasValue(u.especialidad, "facturacion")
  );
  for (const u of facturacion) {
    if (u.id === asignadoA?.id) continue; // ya recibió el aviso de asignación
    await avisarUrgente(
      u.id,
      `🧾 Nueva asignación con posible cobro adicional`,
      `${company.name}: ${titulo}`,
      `/empresas/${company.id}#chat`
    );
  }
}

// El gestor abrió el chat de esta empresa: los mensajes del cliente quedan leídos.
export async function marcarLeidoPorStaff(companyId: string) {
  await prisma.mensajeChat.updateMany({
    where: { companyId, autorTipo: "cliente", readByStaffAt: null },
    data: { readByStaffAt: new Date() },
  });
}

// El cliente abrió su chat: los mensajes del gestor quedan leídos.
export async function marcarLeidoPorCliente(companyId: string) {
  await prisma.mensajeChat.updateMany({
    where: { companyId, autorTipo: "staff", readByClientAt: null },
    data: { readByClientAt: new Date() },
  });
}

// Mensajes del cliente sin leer por el gestor, dentro del alcance de su
// cartera (fragmento `where` de companyScope) — para la campanita.
export function noLeidosPorStaffWhere(scopeEmpresa: object) {
  return { autorTipo: "cliente", readByStaffAt: null, company: scopeEmpresa };
}

// Mensajes del gestor sin leer por el cliente de UNA empresa — para el
// contador del portal (nav "Chat").
export async function contarNoLeidosPorCliente(companyId: string): Promise<number> {
  return prisma.mensajeChat.count({
    where: { companyId, autorTipo: "staff", readByClientAt: null },
  });
}
