import type {
 RESTPostAPIChatInputApplicationCommandsJSONBody,
 RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { appIdOf } from '../../../Util/appIdTokens.js';
import buildCommandBody from '../../../Util/buildCommandBody.js';

export type LocalCommandBody =
 | RESTPostAPIChatInputApplicationCommandsJSONBody
 | RESTPostAPIContextMenuApplicationCommandsJSONBody;

export interface LocalSurface {
 commands: LocalCommandBody[];
}

const ownerOf = function (this: Client, appId: string): Client['plugins'][number] | null {
 return (
  this.plugins.find((plugin) => {
   const token = plugin.getPluginBotToken?.();

   return Boolean(token) && appIdOf(token!) === appId;
  }) ?? null
 );
};

export default function (this: Client, appId: string): LocalSurface {
 const owner = ownerOf.call(this, appId);

 return {
  commands: buildCommandBody.call(this, owner ?? undefined) as LocalCommandBody[],
 };
}
