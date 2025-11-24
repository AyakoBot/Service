import * as CT from '../../../../Typings/Typings.js';

/**
 * Parser for command type settings.
 * @param val - The command ID or name to parse.
 * @param language - The language object containing translations.
 * @returns A string representation of the command.
 */
export default async (val: string | null, language: CT.Language) => {
 if (!val) return language.t.None;

 const { cache } = await import('../../../Client.js');

 const isId = val?.replace(/\D+/g, '').length === val?.length;
 const cmd = isId ? await cache.commands.get(val) : undefined;
 if (cmd) return `</${cmd.name}:${cmd.id}>`;
 return `\`${val}\``;
};
