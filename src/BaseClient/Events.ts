/* eslint-disable no-console */

const spawnEvents = async () =>
 Promise.all(
  ['./Events/Process.js', './Events/Rest.js'].map((p) => import(p)),
 );

await spawnEvents();
