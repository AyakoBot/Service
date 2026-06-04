export enum SettingsAction {
 Nav = 'nav',
 Group = 'group',
 Save = 'save',
 Create = 'create',
 Pause = 'pause',
 Delete = 'delete',
 SysSelect = 'sysselect',
}

export interface SettingsId {
 action: SettingsAction;
 settingName: string;
 rowId?: string;
 groupId?: string;
}

export const encodeSettingsId = (id: SettingsId): string =>
 ['settings', id.action, id.settingName, id.rowId, id.groupId]
  .filter((p) => p !== undefined && p !== '')
  .join(':');

export const parseSettingsId = (customId: string): SettingsId | null => {
 if (!customId.startsWith('settings:')) return null;
 const [, action, settingName, rowId, groupId] = customId.split(':');
 if (!action || !settingName) return null;
 return { action: action as SettingsAction, settingName, rowId, groupId };
};
