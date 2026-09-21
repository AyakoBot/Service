import type { HelpScope } from './HelpTypes.js';

export interface SessionEntry {
 scope: HelpScope;
 path: string | null;
 page: number;
 paged: boolean;
 hide: boolean;
}

const sessionCap = 500;

export default class HelpSession {
 private sessions: Map<string, SessionEntry> = new Map();
 private counter: number = 0;

 create = (entry: SessionEntry): string => {
  this.counter += 1;

  const id = this.counter.toString(36);
  this.sessions.set(id, entry);

  if (this.sessions.size > sessionCap) {
   const leastRecentlyUsed = this.sessions.keys().next();

   if (!leastRecentlyUsed.done) this.sessions.delete(leastRecentlyUsed.value);
  }

  return id;
 };

 get = (id: string): SessionEntry | undefined => {
  const entry = this.sessions.get(id);

  if (!entry) return undefined;

  this.sessions.delete(id);
  this.sessions.set(id, entry);

  return entry;
 };

 update = (id: string, entry: SessionEntry): void => {
  if (this.sessions.delete(id)) this.sessions.set(id, entry);
 };
}
