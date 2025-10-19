import type * as Discord from 'discord.js';
import fs from 'fs';
import sources from '../../../../BaseClient/Other/blockListSources.js';
import client from '../../../../BaseClient/Client.js';

export default async () => {
 const responses = (await client.util.fileURL2Buffer(sources.antivirus))
  .filter((res): res is Discord.AttachmentPayload => !!res)
  .map((e) => e.attachment.toString().replace(/\r+/, '\n').split(/\n+/))
  .flat(1)
  .filter((line) => !line.startsWith('#') && !line.includes('*'));

 fs.writeFile(
  './dist/BaseClient/Other/Blocklist.json',
  JSON.stringify(responses),
  'utf8',
  () => null,
 );
};
