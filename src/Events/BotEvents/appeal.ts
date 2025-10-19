import client from '../../src/BaseClient/Client.js';
import { appeal } from '../../src/Commands/ButtonCommands/appeals/submit.js';
import * as CT from '../../src/Typings/Typings.js';

export default async ({ data }: CT.Message<CT.MessageType.Appeal>) =>
 appeal(client, Number(data.punishmentId));
