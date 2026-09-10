import {
  crearPalabraClaveChat,
  actualizarPalabraClaveChat,
  eliminarPalabraClaveChat,
} from "@/app/(crm)/configuracion/chat-asignacion-actions";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export type ReglaChatRow = {
  id: string;
  palabra: string;
  especialidad: string;
  activa: boolean;
};

export default function PalabrasClaveChatPanel({
  reglas,
  especialidadesEnUso,
}: {
  reglas: ReglaChatRow[];
  especialidadesEnUso: string[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Asignación automática por chat</h2>
      <p className="mb-4 text-xs text-slate-400">
        Cuando un cliente escribe en el chat del portal una frase como &quot;nueva asignación&quot; o
        &quot;asignación adicional&quot; junto con una de estas palabras clave, el sistema crea la tarea
        y la asigna al usuario que tenga esa especialidad — no al analista principal de la cuenta.
        Si nadie tiene esa especialidad, la tarea queda sin asignar y se avisa por la campanita.
      </p>

      {especialidadesEnUso.length > 0 && (
        <p className="mb-3 text-xs text-slate-400">
          Especialidades ya usadas por algún usuario: {especialidadesEnUso.join(", ")}
        </p>
      )}

      {reglas.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Todavía no hay palabras clave configuradas.</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100">
          {reglas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-sm">
                <span className={`font-medium ${r.activa ? "text-slate-800" : "text-slate-400 line-through"}`}>
                  {r.palabra}
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
                  {r.especialidad}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <form action={actualizarPalabraClaveChat}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="activa" value={r.activa ? "" : "on"} />
                  <button type="submit" className="text-xs font-medium text-slate-500 hover:text-teal-700 hover:underline">
                    {r.activa ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <form action={eliminarPalabraClaveChat}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-xs font-medium text-slate-400 hover:text-red-600 hover:underline">
                    Eliminar
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={crearPalabraClaveChat} className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Palabra clave
          <input
            name="palabra"
            placeholder="ej. impuestos"
            required
            className={`${inputClass} mt-1 block w-40`}
          />
        </label>
        <label className="text-xs text-slate-500">
          Especialidad que la atiende
          <input
            name="especialidad"
            placeholder="ej. impuestos"
            required
            className={`${inputClass} mt-1 block w-48`}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Agregar
        </button>
      </form>
    </section>
  );
}
