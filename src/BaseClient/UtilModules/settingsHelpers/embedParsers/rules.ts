import * as CT from '../../../../Typings/Typings.js';

/**
 * Parser for rules type settings.
 * @param val - The array of rule IDs to parse.
 * @param language - The language object containing translations.
 * @param guild - The Discord guild object.
 * @returns A string representation of the rules.
 */
export default async (val: string[] | null, language: CT.Language) => {
 const { cache } = await import('../../../Client.js');
 const automods = (await Promise.all(val?.map((v) => cache.automods.get(v)) || [])) ?? [];

 return val && val.length
  ? val.map((v) => `\`${automods.find((a) => a?.id === v)?.name ?? v}\``).join(', ')
  : language.t.None;
};
