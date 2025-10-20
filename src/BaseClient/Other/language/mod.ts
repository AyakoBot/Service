import * as CT from '../../../Typings/Typings.js';
import execution from './mod/execution.js';
import logs from './mod/logs.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod,
 logs: logs(t),
 execution: execution(t),
});
