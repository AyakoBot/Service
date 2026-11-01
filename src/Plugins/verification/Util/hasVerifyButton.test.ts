/* eslint-disable @typescript-eslint/naming-convention */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
 ButtonStyle,
 ComponentType,
 type APIButtonComponentWithCustomId,
 type APIMessageTopLevelComponent,
 type APITextDisplayComponent,
} from 'discord-api-types/v10';

import { VerificationRoute } from '../Classes/Routes.js';

import hasVerifyButton from './hasVerifyButton.js';

const button = (customId: string): APIButtonComponentWithCustomId => ({
 type: ComponentType.Button,
 style: ButtonStyle.Primary,
 custom_id: customId,
 label: 'Verify',
});

const text: APITextDisplayComponent = { type: ComponentType.TextDisplay, content: 'Welcome' };

const row = (customId: string): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [button(customId)],
});

describe('hasVerifyButton', () => {
 it('finds the button in a top-level row', () => {
  assert.equal(hasVerifyButton([text, row(VerificationRoute.Verify)]), true);
 });

 it('finds the button in a row inside a container', () => {
  assert.equal(
   hasVerifyButton([
    {
     type: ComponentType.Container,
     components: [
      text,
      { type: ComponentType.ActionRow, components: [button(VerificationRoute.Verify)] },
     ],
    },
   ]),
   true,
  );
 });

 it('finds the button as a section accessory', () => {
  assert.equal(
   hasVerifyButton([
    {
     type: ComponentType.Container,
     components: [
      {
       type: ComponentType.Section,
       components: [text],
       accessory: button(VerificationRoute.Verify),
      },
     ],
    },
   ]),
   true,
  );
 });

 it('ignores other buttons and routes with arguments', () => {
  assert.equal(hasVerifyButton([row(`${VerificationRoute.Verify}_1`), row('other')]), false);
 });

 it('returns false for a design without buttons', () => {
  assert.equal(hasVerifyButton([text]), false);
 });
});
