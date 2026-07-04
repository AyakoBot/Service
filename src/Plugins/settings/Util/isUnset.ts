export const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);
