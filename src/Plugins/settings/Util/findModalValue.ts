
export const findModalValue = (components: unknown, customId: string): string | undefined => {
 if (!Array.isArray(components)) return undefined;

 for (const c of components) {
  if (!c || typeof c !== 'object') continue;
  const comp = c as Record<string, unknown>;

  if (comp.custom_id === customId && typeof comp.value === 'string') return comp.value;

  const nested =
   findModalValue(comp.components, customId) ??
   findModalValue(comp.component ? [comp.component] : undefined, customId);
  if (nested !== undefined) return nested;
 }

 return undefined;
};
