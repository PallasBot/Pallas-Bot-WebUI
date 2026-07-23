/** React 侧替代 Vue catalogSync：无 vue.ref，仅保留通知钩子。 */

let epoch = 0;
const listeners = new Set<() => void>();

export function getInstancesCatalogEpoch(): number {
  return epoch;
}

export function subscribeInstancesCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyInstancesCatalogUpdated(): void {
  epoch += 1;
  for (const fn of listeners) fn();
}
