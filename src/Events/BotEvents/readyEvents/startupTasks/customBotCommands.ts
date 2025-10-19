import * as Discord from 'discord.js';
import client from '../../../../BaseClient/Client.js';

export default async () => {
 client.util.request.commands.getGlobalCommands(undefined, client as Discord.Client<true>);
};
