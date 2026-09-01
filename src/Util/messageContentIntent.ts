const gatewayMessageContent = 1 << 18;
const gatewayMessageContentLimited = 1 << 19;

export const flagsHaveMessageContent = (flags: number | null | undefined): boolean =>
 Boolean(flags && (flags & gatewayMessageContent || flags & gatewayMessageContentLimited));

export const hasMessageContentIntent = async (token: string): Promise<boolean> => {
 const response = await fetch('https://discord.com/api/v10/applications/@me', {
  headers: { authorization: `Bot ${token.replace('Bot ', '')}` },
 }).catch(() => null);

 if (!response?.ok) return false;

 const application = (await response.json().catch(() => null)) as { flags?: number } | null;
 return flagsHaveMessageContent(application?.flags);
};
