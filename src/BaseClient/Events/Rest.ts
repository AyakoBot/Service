import baseEventHandler from '../../Events/BotEvents/baseEventHandler.js';
import { rest } from '../Client.js';
import events from '../UtilModules/getEvents.js';

events.RestEvents.forEach((path) => {
 const eventName = path.replace('.js', '').split(/\/+/).pop() as Parameters<typeof rest.on>[0];
 if (!eventName) return;

 rest.on(eventName, (...args) => baseEventHandler(String(eventName), args));
});
