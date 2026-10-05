const nickLengthLimit = 32;
const suffixes = [' [AFK]', ' AFK'];

export const afkSuffixOf = (nick: string | null | undefined): string | undefined =>
 nick ? suffixes.find((suffix) => nick.endsWith(suffix)) : undefined;

export const taggedNick = (base: string): string | undefined => {
 const suffix = suffixes.find((candidate) => base.length + candidate.length <= nickLengthLimit);
 return suffix ? `${base}${suffix}` : undefined;
};

export const untaggedNick = (nick: string, displayName: string | null): string | null => {
 const suffix = afkSuffixOf(nick);
 const base = suffix ? nick.slice(0, -suffix.length) : nick;
 return base === displayName ? null : base;
};
