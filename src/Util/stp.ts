interface R {
 [key: string]: unknown | R;
}

export default (expression: string, obj: R) => {
 const replace = (substring: string, value: string): string => {
  const newValue = value.split('.');
  let decided: R | string = '';
  const result = obj[newValue[0]];
  if (result === undefined || result === null) return substring;
  if (newValue.length < 2) return result as string;

  newValue.forEach((element: string, i) => {
   if (i === 1) decided = (result as R)[element] as string;
   if (i > 1) decided = (decided as R)[element] as string;
  });

  return decided as string;
 };

 expression = expression.replace(/{{\s?([^{}\s]*)\s?}}/g, replace);

 Object.entries(process.env)
  .filter((e) => e[0].toLowerCase().includes('token'))
  .forEach((s) => {
   expression = s[1]
    ? expression.replace(new RegExp(s[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '*')
    : expression;
  });

 return expression;
};
