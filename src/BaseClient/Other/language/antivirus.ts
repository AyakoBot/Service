import * as CT from '../../../Typings/Typings.js';

export default (t: CT.Language) => ({
 ...t.JSON.antivirus,
 malicious: (cross: string) => t.stp(t.JSON.antivirus.malicious, { cross }),
 clean: (check: string) => t.stp(t.JSON.antivirus.clean, { check }),
 log: {
  ...t.JSON.antivirus.log,
  vtStats: (m: string, s: string, h: string, u: string) =>
   t.stp(t.JSON.antivirus.log.vtStats, { m, s, h, u }),
  detectedAs: (c: string) => t.stp(t.JSON.antivirus.log.detectedAs, { c }),
  value: async (msg: RMessage) =>
   t.stp(t.JSON.antivirus.log.value, {
    msg,
    name: (await t.cache.channels.get(msg.channel_id)) || t.JSON.t.Unknown,
   }),
 },
});
