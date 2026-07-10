// =============================================================================
// Inflight guard — deduplica chamadas idênticas de IA em curso
// =============================================================================
// Usa um Map em memória para retornar a MESMA Promise quando uma execução da
// mesma ação (mesma chave) já está em andamento. Evita cliques duplos por
// diferentes componentes/hooks disparando a mesma edge function.
//
// A chave deve ser estável: `${action}:${user_id ?? '-'}:${resource_id}`.

const inflight = new Map<string, Promise<unknown>>();

export class InflightBusyError extends Error {
  constructor(public readonly key: string) {
    super("Já existe uma execução em andamento para esta ação. Aguarde a conclusão.");
    this.name = "InflightBusyError";
  }
}

export function isInflight(key: string): boolean {
  return inflight.has(key);
}

/**
 * Se `mode="dedupe"` (padrão): retorna a Promise em curso.
 * Se `mode="reject"`: lança InflightBusyError.
 */
export async function withInflight<T>(
  key: string,
  fn: () => Promise<T>,
  mode: "dedupe" | "reject" = "dedupe",
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    if (mode === "reject") throw new InflightBusyError(key);
    return existing as Promise<T>;
  }
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
