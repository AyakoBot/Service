import { InteractionType } from '@discordjs/core';
import { Registry, Counter, Gauge } from 'prom-client';

import logger from './Logger.js';

enum MetricsKey {
 dbQuery = 'ayako_db_query_execute',
 cmdExecuted = 'ayako_command_executed',
 dbLatency = 'ayako_db_query_latency',
}

type InteractionTypeExtended = InteractionType | ExtendedTypes;

enum ExtendedTypes {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 StringCommand = 0,
}

enum MetricsLabel {
 modelName = 'modelName',
 action = 'action',
 command = 'command',
 type = 'type',
 context = 'context',
}

enum ContextType {
 user = 'User',
 guild = 'Guild',
}

class Metrics {
 readonly registry = new Registry();

 constructor() {
  logger.debug('[Metrics] Initializing Metrics...');
  this.install();
  logger.log('[Metrics] Metrics initialization complete');
 }

 private install = () => {
  logger.silly('[Metrics] Registering metrics...');
  this.installDbQuery();
  this.installCmdExecuted();
  this.installDbLatency();
  logger.silly('[Metrics] All metrics registered');
 };

 private installDbLatency = () => {
  logger.silly('[Metrics] Registering metric:', MetricsKey.dbLatency);
  this.registry.registerMetric(
   new Gauge({
    name: MetricsKey.dbLatency,
    help: 'Latency of each DB query',
    labelNames: [MetricsLabel.modelName, MetricsLabel.action],
   }),
  );
 };

 private installCmdExecuted = () => {
  logger.silly('[Metrics] Registering metric:', MetricsKey.cmdExecuted);
  this.registry.registerMetric(
   new Counter({
    name: MetricsKey.cmdExecuted,
    help: 'Individual commands executed',
    labelNames: [MetricsLabel.command, MetricsLabel.type, MetricsLabel.context],
   }),
  );
 };

 private installDbQuery = () => {
  logger.silly('[Metrics] Registering metric:', MetricsKey.dbQuery);
  this.registry.registerMetric(
   new Counter({
    name: MetricsKey.dbQuery,
    help: 'Individual DB queries executed',
    labelNames: [MetricsLabel.modelName, MetricsLabel.action],
   }),
  );
 };

 dbQuery = (modelName: string, action: string) =>
  (this.registry.getSingleMetric(MetricsKey.dbQuery) as Counter<string>)
   .labels(modelName, action)
   .inc();

 cmdExecuted = (command: string, type: InteractionTypeExtended, context: ContextType) =>
  (this.registry.getSingleMetric(MetricsKey.cmdExecuted) as Counter<string>)
   .labels(
    command,
    this.getInteractionType(type),
    context === ContextType.guild ? ContextType.guild : ContextType.user,
   )
   .inc();

 dbLatency = (modelName: string, action: string, latency: number) =>
  (this.registry.getSingleMetric(MetricsKey.dbLatency) as Gauge<string>)
   .labels(modelName, action)
   .set(latency);

 private getInteractionType = (type: InteractionTypeExtended) => {
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
}

const metrics = new Metrics();
export default metrics;
