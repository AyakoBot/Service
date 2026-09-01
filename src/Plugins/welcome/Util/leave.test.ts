import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuditLogEvent } from 'discord-api-types/v10';

import { involuntaryActions } from './leave.js';

test('involuntary actions cover kick, prune and ban but not voluntary leaves', () => {
 assert.equal(involuntaryActions.includes(AuditLogEvent.MemberKick), true);
 assert.equal(involuntaryActions.includes(AuditLogEvent.MemberPrune), true);
 assert.equal(involuntaryActions.includes(AuditLogEvent.MemberBanAdd), true);

 assert.equal(involuntaryActions.includes(AuditLogEvent.MemberBanRemove), false);
 assert.equal(involuntaryActions.includes(AuditLogEvent.MemberRoleUpdate), false);
});
