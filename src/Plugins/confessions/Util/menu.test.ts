import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MenuPath, menuPath } from './menu.js';

describe('confession menu decision', () => {
 it('sends the author straight to deletion, even when they are a reviewer', () => {
  assert.equal(menuPath(true, false), MenuPath.Delete);
  assert.equal(menuPath(true, true), MenuPath.Delete);
 });

 it('offers a reviewer who is not the author the moderator choice', () => {
  assert.equal(menuPath(false, true), MenuPath.Moderate);
 });

 it('sends everyone else straight to the report form', () => {
  assert.equal(menuPath(false, false), MenuPath.Report);
 });
});
