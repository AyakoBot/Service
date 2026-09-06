const maxLength = 300;

export const dbErrorText = (error: Error) => {
 const detail = error.message
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length)
  .at(-1);

 if (!detail) return null;

 return detail.length > maxLength ? `${detail.slice(0, maxLength)}…` : detail;
};
