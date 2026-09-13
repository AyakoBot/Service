import assert from 'node:assert';
import { test } from 'node:test';

import type Client from '../../../Classes/Client.js';
import type { TransformContext } from '../../settings/SettingsSchema.js';
import type CustomRolesPlugin from '../Plugin.js';

import RolePerks from './RolePerks.js';
import schema from './settingsSchema.js';

const markerKey = 'scheduled:customroles:reconcile:G1';
const cursorKey = 'scheduled-data:customroles:reconcile:G1';

const stub = () => {
 const writes = new Map<string, string>();
 const client = {
  cache: {
   scheduleDb: {
    set: async (key: string, value: string) => {
     writes.set(key, value);
     return 'OK';
    },
   },
  },
 } as unknown as Client;

 return { writes, client, plugin: { client } as CustomRolesPlugin };
};

const fireChange = async (rowId: string): Promise<Map<string, string>> => {
 const { writes, client, plugin } = stub();
 plugin.rewards = new RolePerks(plugin);

 await schema.onChange?.({ client, plugin, guildId: 'G1', rowId } as TransformContext);

 return writes;
};

test('a settings row change arms the guild reconcile key from the head', async () => {
 const writes = await fireChange('r1');

 assert.strictEqual(writes.get(markerKey), 'true');
 assert.strictEqual(writes.get(cursorKey), '');
});

test('the reconcile hook ignores rowId, so a deleted row still reconciles the whole guild', async () => {
 assert.deepStrictEqual([...(await fireChange('already-deleted'))], [
  [markerKey, 'true'],
  [cursorKey, ''],
 ]);
});
