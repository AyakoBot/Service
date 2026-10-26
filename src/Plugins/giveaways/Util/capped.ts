import { maxListed } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export default (t: Translator, parts: string[]) => {
 const shown = parts.slice(0, maxListed).join(', ');
 const hidden = parts.length - maxListed;

 return hidden > 0 ? `${shown} ${t.giveaway.andMore({ count: String(hidden) })}` : shown;
};
