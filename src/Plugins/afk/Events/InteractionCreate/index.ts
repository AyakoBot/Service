import { ApplicationCommandType, InteractionType, type GatewayDispatchEvents } from '@discordjs/core';
import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import Afk from '../../Classes/Afk.js';
import { AfkCommand } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';

export default async function (
 this: AFKPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (cmd.type !== InteractionType.ApplicationCommand) return;
 if (cmd.data.name !== AfkCommand.Afk) return;
 if (!cmd.guild_id || !cmd.channel?.id) return;

 const user = cmd.user || cmd.member?.user;
 if (!user?.id) return;
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 await new Afk(this, user.id, cmd.guild_id).set(cmd as APIChatInputApplicationCommandInteraction);
}
