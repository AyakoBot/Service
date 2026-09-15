import type { API } from '@ayako/api';
import { RequestHandlerError } from '@ayako/api';

const names = new Map<string, string>();

export const botNameOf = async function (this: API): Promise<string> {
 const cached = names.get(this.botId);
 if (cached) return cached;

 const application = await this.applications.getCurrent({
  origin: 'Help',
  reason: 'Resolving the Bot name for the Help panel',
 });

 if (application instanceof RequestHandlerError) return 'Ayako';

 names.set(this.botId, application.name);

 return application.name;
};
