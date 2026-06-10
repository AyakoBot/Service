export enum SettingsAction {
 Nav = 'nav',
 GroupNav = 'gnav',
 SetField = 'set',
 ToggleField = 'tog',
 FieldModal = 'fmod',
 FieldSave = 'fsav',
 ToggleUnavail = 'unav',
 Create = 'create',
 Delete = 'delete',
 DeleteConfirm = 'delc',
}

export interface SettingsId {
 action: SettingsAction;
 settingName: string;
 rowId?: string;
 groupId?: string;
 column?: string;
 hideUnavail?: boolean;
}

export const encodeSettingsId = (id: SettingsId): string =>
 [
  'settings',
  id.action,
  id.settingName,
  id.rowId ?? '',
  id.groupId ?? '',
  id.column ?? '',
  id.hideUnavail ? '1' : '',
 ].join(':');

export const parseSettingsId = (customId: string): SettingsId | null => {
 if (!customId.startsWith('settings:')) return null;
 const [, action, settingName, rowId, groupId, column, hideUnavail] = customId.split(':');
 if (!action || !settingName) return null;
 return {
  action: action as SettingsAction,
  settingName,
  rowId: rowId || undefined,
  groupId: groupId || undefined,
  column: column || undefined,
  hideUnavail: hideUnavail === '1',
 };
};
