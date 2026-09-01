import type { WelcomeSetting } from '@ayako/database';

import { GreetingKind } from '../Classes/Enums.js';

export interface GreetingConfig {
 active: boolean;
 channel: string | null;
 embed: string | null;
 components: string | null;
 pingJoin: boolean;
 pingRoles: string[];
 pingUsers: string[];
}

export const getGreetingConfig = (row: WelcomeSetting, kind: GreetingKind): GreetingConfig =>
 (kind === GreetingKind.Welcome
  ? {
     active: row.welcomeActive,
     channel: row.welcomeChannel,
     embed: row.welcomeEmbed,
     components: row.welcomeComponents,
     pingJoin: row.welcomePingJoin,
     pingRoles: row.welcomePingRoles,
     pingUsers: row.welcomePingUsers,
    }
  : {
     active: row.goodbyeActive,
     channel: row.goodbyeChannel,
     embed: row.goodbyeEmbed,
     components: row.goodbyeComponents,
     pingJoin: false,
     pingRoles: row.goodbyePingRoles,
     pingUsers: row.goodbyePingUsers,
    });
