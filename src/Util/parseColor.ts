export const parseColor = (value: string): number | null => {
 const match = value.trim().replace(/^#/, '');
 if (!/^[0-9a-f]{6}$/i.test(match)) return null;
 return parseInt(match, 16);
};
