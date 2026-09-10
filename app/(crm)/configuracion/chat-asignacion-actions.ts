"use server";

// CRUD de PalabraClaveChat — qué palabra clave del chat del portal dispara una
// tarea automática para qué especialidad (ver lib/chat.ts → crearMensaje y
// lib/chatAsignacion.ts). Admin-only, mismo nivel que el resto de /configuracion.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { normalizarTexto } from "@/lib/chatAsignacion";
import { revalidatePath } from "next/cache";

async function sesionAdmin() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export async function crearPalabraClaveChat(formData: FormData) {
  if (!(await sesionAdmin())) return;
  const palabra = normalizarTexto((formData.get("palabra") as string) ?? "");
  const especialidad = ((formData.get("especialidad") as string) ?? "").trim();
  if (!palabra || !especialidad) return;

  await prisma.palabraClaveChat.upsert({
    where: { palabra_especialidad: { palabra, especialidad } },
    create: { palabra, especialidad },
    update: { activa: true },
  });
  revalidatePath("/configuracion");
}

export async function actualizarPalabraClaveChat(formData: FormData) {
  if (!(await sesionAdmin())) return;
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.palabraClaveChat.update({
    where: { id },
    data: { activa: formData.get("activa") === "on" },
  });
  revalidatePath("/configuracion");
}

export async function eliminarPalabraClaveChat(formData: FormData) {
  if (!(await sesionAdmin())) return;
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.palabraClaveChat.delete({ where: { id } }).catch(() => {});
  revalidatePath("/configuracion");
}
