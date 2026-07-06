export const cleanPreview = (text: string): string =>
 text
  .replace(/<a?:(\w+):\d+>/g, ':$1:')
  .replace(/<\/([\w -]+):\d+>/g, '/$1')
  .replace(/<@&\d+>/g, '@role')
  .replace(/<@!?\d+>/g, '@user')
  .replace(/<#\d+>/g, '#channel');
