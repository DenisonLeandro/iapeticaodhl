// =============================================================================
// caseChatStore — fonte de verdade visual do chat, viva no escopo de módulo.
// Sobrevive a remount/HMR do CaseChatPanel para que a pergunta otimista e a
// resposta da IA nunca "sumam" entre re-renderizações.
// =============================================================================

import type { CaseChatMessage } from "@/services/caseChat";

type Listener = () => void;

const storeByCase = new Map<string, CaseChatMessage[]>();
const listenersByCase = new Map<string, Set<Listener>>();
// Tuplas estáveis por caseId — useSyncExternalStore exige referência idêntica
// entre chamadas para o mesmo snapshot lógico, senão entra em loop infinito.
const snapshotByCase = new Map<string, CaseChatMessage[]>();
const EMPTY: CaseChatMessage[] = Object.freeze([]) as unknown as CaseChatMessage[];

function emit(caseId: string) {
  const set = listenersByCase.get(caseId);
  if (!set) return;
  for (const l of set) {
    try { l(); } catch { /* ignora listener com erro */ }
  }
}

export function subscribeCaseChat(caseId: string, listener: Listener): () => void {
  let set = listenersByCase.get(caseId);
  if (!set) {
    set = new Set();
    listenersByCase.set(caseId, set);
  }
  set.add(listener);
  return () => {
    const s = listenersByCase.get(caseId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listenersByCase.delete(caseId);
  };
}

export function getCaseChatSnapshot(caseId: string | undefined): CaseChatMessage[] {
  if (!caseId) return EMPTY;
  const snap = snapshotByCase.get(caseId);
  if (snap) return snap;
  const initial = storeByCase.get(caseId) ?? EMPTY;
  snapshotByCase.set(caseId, initial);
  return initial;
}

export function setCaseChatMessages(
  caseId: string,
  updater: (prev: CaseChatMessage[]) => CaseChatMessage[],
) {
  const prev = storeByCase.get(caseId) ?? [];
  const next = updater(prev);
  if (next === prev) return;
  storeByCase.set(caseId, next);
  snapshotByCase.set(caseId, next);
  emit(caseId);
}

export function clearCaseChat(caseId: string) {
  storeByCase.delete(caseId);
  snapshotByCase.delete(caseId);
  emit(caseId);
}
