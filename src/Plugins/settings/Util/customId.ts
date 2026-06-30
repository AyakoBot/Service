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
 Guide = 'guide',
 GuideStep = 'gstep',
}

export interface SettingsId {
 action: SettingsAction;
 settingName: string;
 rowId?: string;
 groupId?: string;
 column?: string;
 hideUnavail?: boolean;
 guideFlags?: number;
 guideSection?: string;
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
  id.guideFlags === undefined ? '' : String(id.guideFlags),
  id.guideSection ?? '',
 ].join(':');

export const parseSettingsId = (customId: string): SettingsId | null => {
 if (!customId.startsWith('settings:')) return null;
 const [, action, settingName, rowId, groupId, column, hideUnavail, guideFlags, guideSection] =
  customId.split(':');
 if (!action || !settingName) return null;
 const flags = guideFlags === '' || guideFlags === undefined ? undefined : Number(guideFlags);
 return {
  action: action as SettingsAction,
  settingName,
  rowId: rowId || undefined,
  groupId: groupId || undefined,
  column: column || undefined,
  hideUnavail: hideUnavail === '1',
  guideFlags: flags !== undefined && Number.isNaN(flags) ? undefined : flags,
  guideSection: guideSection || undefined,
 };
};
