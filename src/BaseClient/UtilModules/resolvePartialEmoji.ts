import parseEmoji from './parseEmoji.js';

export default (emoji: string) => {
 if (!emoji) return null;
 if (typeof emoji === 'string') {
  return /^\d{17,19}$/.test(emoji)
   ? { id: emoji, animated: undefined, name: undefined }
   : parseEmoji(emoji);
 }

 const { id, name, animated } = emoji;

 if (!id && !name) return null;

 return { id, name, animated: Boolean(animated) };
};
