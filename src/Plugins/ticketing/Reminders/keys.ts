export enum RemindKind {
 Unclaimed = 'remind-unclaimed',
 Stale = 'remind-stale',
 InactivityWarn = 'inactivity-warn',
 InactivityClose = 'inactivity-close',
}

export const remindKinds: RemindKind[] = [
 RemindKind.Unclaimed,
 RemindKind.Stale,
 RemindKind.InactivityWarn,
 RemindKind.InactivityClose,
];

export const ticketKey = 'tickets:';

export const positiveSeconds = (value: unknown): number => {
 const n = Number(value);
 return Number.isFinite(n) && n > 0 ? n : 0;
};

export const remindKey = (kind: RemindKind, id: string) => `${ticketKey}${kind}:${id}`;

export interface RemindJob {
 guildId: string;
 ticketId: string;
 kind: RemindKind;
}

export const encodeJob = (job: RemindJob) => JSON.stringify(job);

export const parseTicketKey = (key: string): { kind: RemindKind; id: string } | null => {
 if (!key.startsWith(ticketKey)) return null;

 const rest = key.slice(ticketKey.length);
 const split = rest.lastIndexOf(':');
 if (split <= 0) return null;

 const candidate = rest.slice(0, split);
 const id = rest.slice(split + 1);
 if (!id || !(remindKinds as string[]).includes(candidate)) return null;

 return { kind: candidate as RemindKind, id };
};
