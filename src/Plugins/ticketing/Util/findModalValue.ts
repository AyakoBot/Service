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

export const findModalValues = (components: unknown, customId: string): string[] => {
 if (!Array.isArray(components)) return [];

 for (const c of components) {
  if (!c || typeof c !== 'object') continue;
  const comp = c as Record<string, unknown>;

  if (comp.custom_id === customId && Array.isArray(comp.values)) {
   return comp.values.map((v) => String(v));
  }

  const nested = comp.components
   ? findModalValues(comp.components, customId)
   : comp.component
     ? findModalValues([comp.component], customId)
     : [];
  if (nested.length) return nested;
 }

 return [];
};
