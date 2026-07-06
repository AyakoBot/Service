import stp from './stp.js';

type ExtractPlaceholders<S extends string> = S extends `${string}{{${infer Key}}}${infer Rest}`
 ? Key | ExtractPlaceholders<Rest>
 : never;

type PathToObject<P extends string> = P extends `${infer First}.${infer Rest}`
 ? { [K in First]: PathToObject<Rest> }
 : P extends `${infer Key}`
   ? { [K in Key]: unknown }
   : never;

type MergeObjects<T> = T extends object
 ? {
    [K in keyof T]: T[K] extends object ? MergeObjects<T[K]> : T[K];
   }
 : T;

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
 k: infer I,
) => void
 ? I
 : never;

type ExtractVars<S extends string> = MergeObjects<
 UnionToIntersection<PathToObject<ExtractPlaceholders<S>>>
>;

type IsEmpty<T> = keyof T extends never ? true : false;

type TranslationFn<S extends string> =
 IsEmpty<ExtractVars<S>> extends true
  ? (vars?: Record<string, unknown>) => string
  : (vars: ExtractVars<S>) => string;

export type TranslatorType<T> = {
 [K in keyof T]: T[K] extends string
  ? TranslationFn<T[K]>
  : T[K] extends object
    ? TranslatorType<T[K]>
    : T[K];
};

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
