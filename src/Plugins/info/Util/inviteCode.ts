const invitePattern = /(?:discord(?:app)?\.com\/invite\/|discord\.gg\/)?([\w-]+)$/;

export default (input: string): string | undefined => input.trim().match(invitePattern)?.[1];
