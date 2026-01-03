import stp from './stp.js';

/**
 * Extracts placeholder keys from a template string.
 * E.g., "Hello {{user.name}}" -> ["user.name"]
 */
type ExtractPlaceholders<S extends string> = S extends `${string}{{${infer Key}}}${infer Rest}`
 ? Key | ExtractPlaceholders<Rest>
 : never;

/**
 * Converts a dot-path like "user.name" into a nested object type { user: { name: unknown } }
 */
type PathToObject<P extends string> = P extends `${infer First}.${infer Rest}`
 ? { [K in First]: PathToObject<Rest> }
 : P extends `${infer Key}`
   ? { [K in Key]: unknown }
   : never;

/**
 * Merges multiple objects into one, combining nested structures.
 */
type MergeObjects<T> = T extends object
 ? {
    [K in keyof T]: T[K] extends object ? MergeObjects<T[K]> : T[K];
   }
 : T;

/**
 * Union to intersection helper.
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
 k: infer I,
) => void
 ? I
 : never;

/**
 * Extracts the variables required for a template string.
 * E.g., "{{user.username}} is AFK" -> { user: { username: unknown } }
 */
type ExtractVars<S extends string> = MergeObjects<
 UnionToIntersection<PathToObject<ExtractPlaceholders<S>>>
>;

/**
 * Checks if a type has any keys (is not empty).
 */
type IsEmpty<T> = keyof T extends never ? true : false;

/**
 * Converts a string template into a translation function type.
 * If the template has placeholders, requires vars parameter.
 * If no placeholders, vars is optional.
 */
type TranslationFn<S extends string> =
 IsEmpty<ExtractVars<S>> extends true
  ? (vars?: Record<string, unknown>) => string
  : (vars: ExtractVars<S>) => string;

/**
 * Recursively converts a language object into typed translation functions.
 * Strings become callable functions, objects are recursively processed.
 */
export type TranslatorType<T> = {
 [K in keyof T]: T[K] extends string
  ? TranslationFn<T[K]>
  : T[K] extends object
    ? TranslatorType<T[K]>
    : T[K];
};

/**
 * Creates a proxy-based translator that converts string templates into callable functions.
 * Nested objects are also wrapped in proxies for deep access.
 *
 * @example
 * const lang = { t: { hello: "Hello {{name}}!" } };
 * const t = createTranslator(lang);
 * t.t.hello({ name: "World" }); // "Hello World!"
 *
 * @param obj - The language object containing string templates
 * @returns A proxy that converts strings to translation functions
 */
const createTranslator = <T extends object>(obj: T): TranslatorType<T> =>
 new Proxy(obj, {
  get(target, prop: string) {
   const value = target[prop as keyof T];

   if (typeof value === 'string') {
    return (vars: Record<string, unknown> = {}) => stp(value, vars);
   }

   if (value !== null && typeof value === 'object') {
    return createTranslator(value as object);
   }

   return value;
  },
 }) as TranslatorType<T>;

export default createTranslator;
