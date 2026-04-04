import type { Prisma } from '@ayako/database';
import type PrismaTables from '@ayako/database';

export interface DataBaseTables {
 afkState: PrismaTables.AfkState;
 // antispam: PrismaTables.antispam;
 // antivirus: PrismaTables.antivirus;
 // appealquestions: PrismaTables.appealquestions;
 // appealsettings: PrismaTables.appealsettings;
 // appeals: PrismaTables.appeals;
 // art: PrismaTables.art;
 // autopunish: PrismaTables.autopunish;
 // autoroles: PrismaTables.autoroles;
 // balance: PrismaTables.balance;
 // censor: PrismaTables.censor;
 // customroles: PrismaTables.customroles;
 // newlines: PrismaTables.newlines;
 // invites: PrismaTables.invites;
 // buttonroles: PrismaTables.buttonroles;
 // buttonrolesettings: PrismaTables.buttonrolesettings;
 // contributers: PrismaTables.contributers;
 // cooldowns: PrismaTables.cooldowns;
 // customembeds: PrismaTables.customembeds;
 // disboard: PrismaTables.disboard;
 // expiry: PrismaTables.expiry;
 filteredWord: PrismaTables.FilteredWord;
 // giveawaycollections: PrismaTables.giveawaycollection;
 // giveaways: PrismaTables.giveaways;
 // guilds: PrismaTables.guilds;
 guildSetting: PrismaTables.GuildSetting;
 // level: PrismaTables.level;
 // leveling: PrismaTables.leveling;
 // levelingmultichannels: PrismaTables.levelingmultichannels;
 // levelingmultiroles: PrismaTables.levelingmultiroles;
 // levelingroles: PrismaTables.levelingroles;
 // levelingruleschannels: PrismaTables.levelingruleschannels;
 // logchannels: PrismaTables.logchannels;
 // nitroroles: PrismaTables.nitroroles;
 // nitrosettings: PrismaTables.nitrosettings;
 // nitrousers: PrismaTables.nitrousers;
 // punishments: PrismaTables.punishments;
 // reactionroles: PrismaTables.reactionroles;
 // reactionrolesettings: PrismaTables.reactionrolesettings;
 // reminder: PrismaTables.Reminder;
 // reviews: PrismaTables.reviews;
 // rolerewards: PrismaTables.rolerewards;
 // roleseparator: PrismaTables.roleseparator;
 // roleseparatorsettings: PrismaTables.roleseparatorsettings;
 // selfroles: PrismaTables.selfroles;
 // stats: PrismaTables.stats;
 // sticky: PrismaTables.sticky;
 // stickymessages: PrismaTables.stickymessages;
 // stickypermmembers: PrismaTables.stickypermmembers;
 // stickyrolemembers: PrismaTables.stickyrolemembers;
 // suggestionsettings: PrismaTables.suggestionsettings;
 // suggestionvotes: PrismaTables.suggestionvotes;
 // users: PrismaTables.users;
 // blockedusers: PrismaTables.blockedusers;
 // verification: PrismaTables.verification;
 // voterewards: PrismaTables.voterewards;
 // votesappliedrewards: PrismaTables.votesappliedrewards;
 // votes: PrismaTables.votes;
 // votesettings: PrismaTables.votesettings;
 // welcome: PrismaTables.welcome;
 // deletethreads: PrismaTables.deletethreads;
 // shop: PrismaTables.shop;
 // shopitems: PrismaTables.shopitems;
 // shopusers: PrismaTables.shopusers;
 // voicehubs: PrismaTables.voicehubs;
 // voicechannels: PrismaTables.voicechannels;
 // antiraid: PrismaTables.antiraid;
 customClient: PrismaTables.CustomClient;
 afkSetting: PrismaTables.AfkSetting;
 // linkedRolesDeco: PrismaTables.linkedRolesDeco;
 // pingReport: PrismaTables.pingReport;
 // votePunish: PrismaTables.votePunish;
 ticketSetting: PrismaTables.TicketSetting;
 ticket: PrismaTables.Ticket;
}

export type PrismaModelName = keyof Prisma.TypeMap['model'];
export type TableName = keyof DataBaseTables;

export type Capitalize<S extends string> = S extends `${infer F}${infer R}`
 ? `${Uppercase<F>}${R}`
 : S;
export type ToPrismaModel<T extends TableName> =
 Capitalize<T> extends PrismaModelName ? Capitalize<T> : T extends PrismaModelName ? T : never;

export type Operations<T extends PrismaModelName> = Prisma.TypeMap['model'][T]['operations'];
export type Args<T extends PrismaModelName, K extends keyof Operations<T>> = Operations<T>[K];

export type WhereUnique<T extends TableName> = Args<
 ToPrismaModel<T>,
 'findUnique'
>['args']['where'];
export type UpdateData<T extends TableName> = Args<ToPrismaModel<T>, 'update'>['args']['data'];
export type FindManyArgs<T extends TableName> = Args<ToPrismaModel<T>, 'findMany'>['args'];
export type CreateData<T extends TableName> = Args<ToPrismaModel<T>, 'create'>['args']['data'];