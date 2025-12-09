import { scheduleJob, type Job, type JobCallback } from 'node-schedule';

import Logger from './Logger.js';

export default class JobCache {
 private cache: Job[] = [];

 constructor() {
  Logger.debug('[JobCache] Initialized');
 }

 createJob = (path: string, time: string, callback: JobCallback) => {
  Logger.silly('[JobCache] Creating job:', path, 'in', time, 'ms');
  const job = scheduleJob(path, new Date(Date.now() + Number(time)), callback);

  this.cache.push(job);
  Logger.silly('[JobCache] Job created, total jobs:', this.cache.length);
  return job;
 };
}
