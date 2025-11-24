import {
 ChannelType,
 ComponentType,
 SelectMenuDefaultValueType,
 type APIChannelSelectComponent,
 type APIMentionableSelectComponent,
 type APIRoleSelectComponent,
 type APIUserSelectComponent,
} from 'discord-api-types/v10.js';
import * as CT from '../../../../Typings/Typings.js';
import { getWithUTS } from '../buttonParsers/back.js';
import getChangeSelectType from '../getChangeSelectType.js';
import getPlaceholder from '../getPlaceholder.js';

export default <T extends keyof typeof CT.SettingsName2TableName>(
 language: CT.Language,
 type: CT.ChangeSelectType,
 fieldName: string,
 settingName: T,
 uniquetimestamp: number | undefined | string,
 values: {
  id: string;
  type: SelectMenuDefaultValueType;
 }[],
 channelType?: 'text' | 'voice' | 'category',
) => {
 const menu:
  | APIRoleSelectComponent
  | APIChannelSelectComponent
  | APIUserSelectComponent
  | APIMentionableSelectComponent = {
  min_values: 0,
  max_values: type.endsWith('s') ? 25 : 1,
  custom_id: getWithUTS(`settings/${type}_${fieldName}_${String(settingName)}`, uniquetimestamp),
  default_values: values as never,
  type: getChangeSelectType(type),
  placeholder: getPlaceholder(type, language),
 };

 if (menu.type === ComponentType.ChannelSelect) {
  switch (channelType) {
   case 'voice': {
    menu.channel_types = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];
    break;
   }
   case 'category': {
    menu.channel_types = [ChannelType.GuildCategory];
    break;
   }
   default: {
    menu.channel_types = [
     ChannelType.AnnouncementThread,
     ChannelType.GuildAnnouncement,
     ChannelType.GuildForum,
     ChannelType.GuildStageVoice,
     ChannelType.GuildText,
     ChannelType.GuildVoice,
     ChannelType.PrivateThread,
     ChannelType.PublicThread,
     ChannelType.GuildMedia,
    ];
    break;
   }
  }
 }

 return menu;
};
