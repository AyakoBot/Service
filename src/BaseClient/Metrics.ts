import { scheduleJob } from 'node-schedule';
import { Counter, Gauge, Registry } from 'prom-client';
import cacheDB from './Redis.js';
import { InteractionType } from '@discordjs/core';

const registry = new Registry();

const dbQuery = new Counter({
 name: 'ayako_db_query_execute',
 help: 'Individual DB queries executed',
 labelNames: ['modelName', 'action'],
});

const cmdExecuted = new Counter({
 name: 'ayako_command_executed',
 help: 'Individual commands executed',
 labelNames: ['command', 'type', 'context'],
});

const dbLatency = new Gauge({
 name: 'ayako_db_query_latency',
 help: 'Latency of each DB query',
 labelNames: ['modelName', 'action'],
});

registry.registerMetric(dbQuery);
registry.registerMetric(cmdExecuted);
registry.registerMetric(dbLatency);
registry.registerMetric(dbLatency);

export default {
 dbQuery: (modelName: string, action: string) => dbQuery.labels(modelName, action).inc(),

 cmdExecuted: (command: string, type: InteractionTypeExtended, context: 0 | 1) =>
  cmdExecuted.labels(command, getInteractionType(type), context === 0 ? 'Guild' : 'User').inc(),

 dbLatency: (modelName: string, action: string, latency: number) =>
  dbLatency.labels(modelName, action).set(latency),
};

type InteractionTypeExtended = InteractionType | ExtendedTypes;
enum ExtendedTypes {
 StringCommand = 0,
}

const getInteractionType = (type: InteractionTypeExtended) => {
 switch (type) {
  case ExtendedTypes.StringCommand:
   return 'String-Command';
  case InteractionType.ApplicationCommand:
   return 'Slash-Command';
  case InteractionType.ApplicationCommandAutocomplete:
   return 'Auto-Complete';
  case InteractionType.MessageComponent:
   return 'Message-Component';
  case InteractionType.ModalSubmit:
   return 'Modal-Submit';
  case InteractionType.Ping:
   return 'Ping';
  default:
   return '-';
 }
};

scheduleJob('metrics', '*/5 * * * * *', async () => {
 cacheDB.set(`metrics:service`, await registry.metrics());
});
