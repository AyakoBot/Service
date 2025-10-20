import * as CT from '../../../../Typings/Typings.js';
import create from './embedbuilder/create.js';
import inherit from './embedbuilder/inherit.js';

export default (t: CT.Language) => ({
 ...t.JSON.slashCommands.embedbuilder,
 inherit: inherit(t),
 create: create(t),
});
