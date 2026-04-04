import type { REmoji, RUser } from '@ayako/utility';

class Constants {
 standard = {
  prefix: 'h!',
  botName: 'Ayako',
  botAddUrl: (id: string) => `https://discord.com/oauth2/authorize?client_id=${id}`,
 };

 formatters = {
  user: (u: RUser | { discriminator: string; username: string }) =>
   `${u.discriminator === '0' ? u.username : `${u.username}#${u.discriminator}`}`,
  getEmote: (
   emoji:
    | REmoji
    | { name: string | undefined; id?: string | null | undefined; animated?: boolean | null }
    | null
    | undefined,
  ) => {
   if (!emoji) return undefined;

   return (
    (emoji.id && `<${emoji.animated ? 'a:' : ':'}${emoji.name}:${emoji.id}>`) ||
    `${(emoji.name ?? '').match(/\w/g)?.length ? `:${emoji.name}:` : emoji.name}`
   );
  },
  getTime: (time: number) =>
   `<t:${String(time).slice(0, -3)}:f> (<t:${String(time).slice(0, -3)}:R>)`,
  msgURL: (g: string | undefined | null, c: string, m: string) =>
   `https://discord.com/channels/${g ?? '@me'}/${c}/${m}`,
 };
}

const constants = new Constants();
export default constants;
