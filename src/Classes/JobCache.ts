import { logger } from '@ayako/utility';
import { scheduleJob, type Job, type JobCallback } from 'node-schedule';

export default class JobCache {
 private cache: Job[] = [];

 constructor() {
  logger.debug('[JobCache] Initialized');
 }

 createJob = (path: string, time: Date, callback: JobCallback) => {
  logger.silly('[JobCache] Creating job:', path, 'in', time, 'ms');
  const job = scheduleJob(path, time, callback);

  this.cache.push(job);
  logger.silly('[JobCache] Job created, total jobs:', this.cache.length);
  return job;
 };
}
