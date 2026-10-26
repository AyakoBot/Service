const charsPerLine = 50;
const linesBesideThumbnail = 5;

const tokenPattern = /(<a?:\w+:\d+>|<@[!&]?\d+>|<#\d+>|<t:\d+(?::\w)?>|\[[^\]]*\]\([^)]*\))/;
const linkPattern = /\[[^\]]*\]\([^)]*\)/g;
const fencePattern = /```[\s\S]*?```/g;
const markers = ['**', '__', '~~', '||', '`'];

const tokenWidth = (token: string) => {
 if (token.startsWith('[')) return token.indexOf('](') - 1;
 if (/^<a?:/.test(token)) return 2;
 if (token.startsWith('<t:')) return 20;
 return 12;
};

const widthOf = (line: string) =>
 line
  .split(tokenPattern)
  .reduce((sum, part, index) => sum + (index % 2 ? tokenWidth(part) : part.length), 0);

const linesOf = (text: string) =>
 text
  .split('\n')
  .reduce((sum, line) => sum + Math.max(1, Math.ceil(widthOf(line) / charsPerLine)), 0);

const rawIndexAt = (line: string, room: number) => {
 let shown = 0;
 let raw = 0;

 for (const [index, part] of line.split(tokenPattern).entries()) {
  const width = index % 2 ? tokenWidth(part) : part.length;
  if (shown + width > room) return index % 2 ? raw : raw + room - shown;

  shown += width;
  raw += part.length;
 }

 return raw;
};

const cutInLine = (line: string, room: number) => {
 const hard = rawIndexAt(line, room);
 const space = line.lastIndexOf(' ', hard);
 const cut = space > 0 ? space : hard;
 const link = [...line.matchAll(linkPattern)].find(
  (match) => match.index < cut && cut < match.index + match[0].length,
 );

 return link ? link.index : cut;
};

const finish = (content: string, cut: number, quoted: boolean): [string, string] => {
 const fenced = (content.slice(0, cut).match(/```/g)?.length ?? 0) % 2 === 1;
 const at = fenced ? content.lastIndexOf('```', cut) : cut;
 const head = content.slice(0, at).trimEnd();
 const tail = content.slice(at).trimStart();
 if (!head) return ['', content];
 if (!tail) return [head, ''];

 const plain = head.replace(fencePattern, '');
 const open = markers
  .filter((marker) => (plain.split(marker).length - 1) % 2 === 1)
  .sort((a, b) => plain.lastIndexOf(a) - plain.lastIndexOf(b));
 const quote = quoted && !fenced ? '> ' : '';

 return [`${head}${[...open].reverse().join('')}`, `${quote}${open.join('')}${tail}`];
};

export const splitBesideThumbnail = (author: string, content: string): [string, string] => {
 let budget = linesBesideThumbnail - linesOf(author);
 let offset = 0;

 for (const line of content.split('\n')) {
  const needed = linesOf(line);
  if (needed > budget) {
   const within = budget > 0 ? cutInLine(line, budget * charsPerLine) : 0;
   return finish(content, offset + within, within > 0 && line.startsWith('> '));
  }

  budget -= needed;
  offset += line.length + 1;
 }

 return [content, ''];
};
