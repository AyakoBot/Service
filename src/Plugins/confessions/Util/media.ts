const imagePath = /\.(png|jpe?g|gif|webp)$/i;

export const isImageLink = (value: string): boolean => {
 try {
  const url = new URL(value);

  return url.protocol === 'https:' && imagePath.test(url.pathname);
 } catch {
  return false;
 }
};
