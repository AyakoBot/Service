import { FilterType } from '@ayako/database';
import { AutoModerationRuleTriggerType, type GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import FilteredWord from '../../FilteredWord.js';
import type FilterScraperPlugin from '../../Plugin.js';

export default async function (
 this: FilterScraperPlugin,
 data: ExtractPayload<GatewayDispatchEvents.AutoModerationActionExecution>,
) {
 if (data.rule_trigger_type !== AutoModerationRuleTriggerType.KeywordPreset) return;

 const rule = await this.client.cache.automods.get(data.rule_id);
 if (!rule) return;

 if (!rule.trigger_metadata.presets) return;
 const presetLength = Number(rule.trigger_metadata.presets.length || 0);

 if (!presetLength) return;
 if (presetLength !== 1) return;
 if (!data.matched_keyword) return;

 const filterType = ['Unknown', ...Object.keys(FilterType)][
  rule.trigger_metadata.presets[0]
 ] as FilterType;

 new FilteredWord(this.client, data.matched_keyword, filterType).upsert(
  { keyword: data.matched_keyword, filterType },
  {},
 );
}
