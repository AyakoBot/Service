import { API } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { cache as redisRedis } from './Redis.js';

export const rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(
 ((process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? '').replace(
  'Bot ',
  '',
 ),
);

export const api = new API(rest);
export const user = await api.users.getCurrent();
export const cache = redisRedis;
