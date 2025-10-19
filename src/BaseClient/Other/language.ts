import type { RGuild, RUser } from '@ayako/gateway/src/Typings/Redis.js';
import type { AuditLogEvent } from '@discordjs/core';
import merge from 'lodash.merge';

import { cache, user } from '../Client.js';
const { default: util } = await import('../Util.js');

import antivirus from './language/antivirus.js';
import auditLogAction from './language/auditLogAction.js';
import autotypes from './language/autotypes.js';
import censor from './language/censor.js';
import channelRules from './language/channelRules.js';
import channelTypes from './language/channelTypes.js';
import defaultAutoArchiveDuration from './language/defaultAutoArchiveDuration.js';
import defaultForumLayout from './language/defaultForumLayout.js';
import defaultSortOrder from './language/defaultSortOrder.js';
import events from './language/events/events.js';
import expire from './language/expire.js';
import languageFunction from './language/languageFunction.js';
import leveling from './language/leveling.js';
import mod from './language/mod.js';
import nitro from './language/nitro.js';
import slashCommands from './language/slashCommands.js';
import ticketing from './language/ticketing.js';
import time from './language/time.js';
import verification from './language/verification.js';

import deJSON from '../../Languages/de-DE.json' with { type: 'json' };
import enJSON from '../../Languages/en-GB.json' with { type: 'json' };

export const languages = {
 'en-GB': enJSON,
 'en-US': enJSON,
 'de-DE': deJSON,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeLang = <T extends Record<string, any>>(lang: T) =>
 merge({}, languages['en-GB'], lang) as T & (typeof languages)['en-GB'];

const t = (lan: ReturnType<typeof mergeLang>) => ({
 ...lan.t,
 welcome: (user: RUser, guild: RGuild) => util.stp(lan.t.welcome, { user, guild }),
 defaultValuesLog: (oldValue: string, newValue: string) =>
  util.stp(lan.t.welcome, { oldValue, newValue }),
 pageBetween: (x: number, y: number) => util.stp(lan.t.pageBetween, { x, y }),
});

export default class Language {
 botName = user.username;
 botId = user.id;
 CURRENT_LANGUAGE: keyof typeof languages = 'en-GB';
 JSON: (typeof languages)['en-GB'] = mergeLang(languages['en-GB']);
 stp = util.stp;
 util = util;
 cache = cache;

 t: ReturnType<typeof t>;

 permissions: typeof this.JSON.permissions;
 ticketing: ReturnType<typeof ticketing>;
 userFlags: typeof this.JSON.userFlags;
 punishmentAction: typeof this.JSON.punishmentAction;
 punishmentDeleteMessageSeconds: typeof this.JSON.punishmentDeleteMessageSeconds;
 contextCommands: typeof this.JSON.contextCommands;
 linkedid: typeof this.JSON.linkedid;
 multiplier: typeof this.JSON.multiplier;
 holdhands: typeof this.JSON.holdhands;
 punishments: typeof this.JSON.punishments;
 punishmentDuration: typeof this.JSON.punishmentDuration;
 shoptypes: typeof this.JSON.shoptypes;
 formulatypes: typeof this.JSON.formulatypes;
 ticketingtype: typeof this.JSON.ticketingtype;
 answertypes: typeof this.JSON.answertypes;
 commandTypes: typeof this.JSON.commandTypes;
 languages: typeof this.JSON.languages;
 features: typeof this.JSON.features;
 deleteReasons: typeof this.JSON.deleteReasons;
 regions: typeof this.JSON.regions;
 rolemodes: typeof this.JSON.rolemodes;
 scopes: typeof this.JSON.scopes;
 errors: typeof this.JSON.errors;
 lvlupmodes: typeof this.JSON.lvlupmodes;
 weekendstype: typeof this.JSON.weekendstype;
 threadAutoArchiveDurations: typeof this.JSON.threadAutoArchiveDurations;

 leveling: ReturnType<typeof leveling>;
 time: ReturnType<typeof time>;
 languageFunction: ReturnType<typeof languageFunction>;
 events: ReturnType<typeof events>;
 channelTypes: ReturnType<typeof channelTypes>;
 verification: ReturnType<typeof verification>;
 expire: ReturnType<typeof expire>;
 slashCommands: ReturnType<typeof slashCommands>;
 nitro: ReturnType<typeof nitro>;
 mod: ReturnType<typeof mod>;
 censor: ReturnType<typeof censor>;
 antivirus: ReturnType<typeof antivirus>;
 autotypes: ReturnType<typeof autotypes>;
 channelRules: ReturnType<typeof channelRules>;
 defaultAutoArchiveDuration: ReturnType<typeof defaultAutoArchiveDuration>;
 defaultForumLayout: ReturnType<typeof defaultForumLayout>;
 defaultSortOrder: ReturnType<typeof defaultSortOrder>;
 auditLogAction: { [key in AuditLogEvent]: string };

 constructor(type: keyof typeof languages) {
  this.CURRENT_LANGUAGE = type;

  this.JSON = mergeLang(languages[this.CURRENT_LANGUAGE]);
  if (!this.JSON) this.JSON = mergeLang(languages['en-GB']);

  this.t = t(this.JSON);

  this.permissions = this.JSON.permissions;
  this.ticketing = ticketing(this);
  this.userFlags = this.JSON.userFlags;
  this.punishmentAction = this.JSON.punishmentAction;
  this.punishmentDeleteMessageSeconds = this.JSON.punishmentDeleteMessageSeconds;
  this.contextCommands = this.JSON.contextCommands;
  this.linkedid = this.JSON.linkedid;
  this.multiplier = this.JSON.multiplier;
  this.holdhands = this.JSON.holdhands;
  this.punishments = this.JSON.punishments;
  this.punishmentDuration = this.JSON.punishmentDuration;
  this.shoptypes = this.JSON.shoptypes;
  this.formulatypes = this.JSON.formulatypes;
  this.ticketingtype = this.JSON.ticketingtype;
  this.answertypes = this.JSON.answertypes;
  this.commandTypes = this.JSON.commandTypes;
  this.languages = this.JSON.languages;
  this.features = this.JSON.features;
  this.deleteReasons = this.JSON.deleteReasons;
  this.regions = this.JSON.regions;
  this.rolemodes = this.JSON.rolemodes;
  this.scopes = this.JSON.scopes;
  this.errors = this.JSON.errors;
  this.lvlupmodes = this.JSON.lvlupmodes;
  this.weekendstype = this.JSON.weekendstype;
  this.threadAutoArchiveDurations = this.JSON.threadAutoArchiveDurations;

  this.leveling = leveling(this);
  this.time = time(this);
  this.languageFunction = languageFunction(this);
  this.events = events(this);
  this.channelTypes = channelTypes(this);
  this.verification = verification(this);
  this.expire = expire(this);
  this.slashCommands = slashCommands(this);
  this.nitro = nitro(this);
  this.mod = mod(this);
  this.censor = censor(this);
  this.antivirus = antivirus(this);
  this.autotypes = autotypes(this);
  this.channelRules = channelRules(this);
  this.defaultAutoArchiveDuration = defaultAutoArchiveDuration(this);
  this.defaultForumLayout = defaultForumLayout(this);
  this.defaultSortOrder = defaultSortOrder(this);
  this.auditLogAction = auditLogAction(this);
 }
}
