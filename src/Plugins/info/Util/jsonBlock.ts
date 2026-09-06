import { containerCharBudget } from '../../../Util/fmt.js';

const zeroWidth = String.fromCharCode(0x200b);
const ellipsis = '…';

const escapeCodeBlock = (content: string): string =>
 content.replace(/`(?=``)/g, `\`${zeroWidth}`);

const fence = (body: string): string => `\`\`\`json\n${body}\n\`\`\``;

const dropLoneSurrogate = (content: string): string =>
 (/[\uD800-\uDBFF]$/.test(content) ? content.slice(0, -1) : content);

export const fitJsonBlock = (
 json: string,
 budget: number = containerCharBudget,
): { content: string; truncated: boolean } => {
 const escaped = escapeCodeBlock(json);
 const full = fence(escaped);

 if (full.length <= budget) return { content: full, truncated: false };

 const room = Math.max(budget - fence(ellipsis).length, 0);

 return {
  content: fence(`${dropLoneSurrogate(escaped.slice(0, room))}${ellipsis}`),
  truncated: true,
 };
};
