const stringify = (json: unknown) => (json === undefined ? '' : JSON.stringify(json));

export const hasGifPlaceholder = (json: unknown) => /{{\s?gif\s?}}/.test(stringify(json));

export const gifInUrlSlot = (json: unknown) =>
 /"url"\s*:\s*"[^"]*{{\s?gif\s?}}[^"]*"/.test(stringify(json));

export const usesMemberCount = (json: unknown) => /{{\s?membercount\s?}}/.test(stringify(json));
