export default (text: string) => {
 const decodedText = text.includes('%') ? decodeURIComponent(text) : text;

 if (!decodedText.includes(':')) return { animated: false, name: decodedText, id: undefined };

 const match = /<?(?:(?<animated>a):)?(?<name>\w{2,32}):(?<id>\d{17,19})?>?/.exec(decodedText);

 return (
  match && {
   animated: Boolean(match.groups?.animated),
   name: match.groups?.name,
   id: match.groups?.id,
  }
 );
};
