export const tagCommandName = 'tag';
export const tagInputOption = 'input';
export const tagCommandsField = 'commands';
export const forceOpenCommandName = 'Open Ticket';
export const ticketCommandName = 'ticket';
export const openingTextField = 'text';

export enum TicketSubcommand {
 Open = 'open',
 Claim = 'claim',
 Unclaim = 'unclaim',
 Take = 'take',
 Escalate = 'escalate',
 Close = 'close',
 Delete = 'delete',
 Add = 'add',
 Remove = 'remove',
 Priority = 'priority',
 Info = 'info',
 List = 'list',
}

export enum TicketCommandOption {
 User = 'user',
 Tier = 'tier',
 Level = 'level',
}

export enum TicketRoute {
 Create = 'tickets/create',
 CreateModal = 'tickets/createModal',
 Claim = 'tickets/claim',
 Unclaim = 'tickets/unclaim',
 Take = 'tickets/take',
 Escalate = 'tickets/escalate',
 EscalateTo = 'tickets/escalateTo',
 Close = 'tickets/close',
 CloseReason = 'tickets/closeReason',
 Leave = 'tickets/leave',
 Delete = 'tickets/delete',
 KeepOpen = 'tickets/keepopen',

 TagSend = 'tickets/tagSend',
 TagPage = 'tickets/tagPage',
 TagSearch = 'tickets/tagSearch',
 TagSearchModal = 'tickets/tagSearchModal',
 TagAdd = 'tickets/tagAdd',
 TagAddModal = 'tickets/tagAddModal',
 TagEdit = 'tickets/tagEdit',
 TagEditModal = 'tickets/tagEditModal',
 TagAdvanced = 'tickets/tagAdvanced',
 TagAdvancedModal = 'tickets/tagAdvancedModal',
 TagAdvancedHelp = 'tickets/tagAdvancedHelp',
 TagDelete = 'tickets/tagDelete',
 TagManage = 'tickets/tagManage',
 TagBrowse = 'tickets/tagBrowse',

 RoleMap = 'tickets/rolemap',
 RoleMapAdd = 'tickets/rolemap/add',
 RoleMapEdit = 'tickets/rolemap/edit',
 RoleMapRemove = 'tickets/rolemap/remove',
 RoleMapUp = 'tickets/rolemap/up',
 RoleMapDown = 'tickets/rolemap/down',
 RoleMapPage = 'tickets/rolemap/page',
 RoleMapSave = 'tickets/rolemap/save',

 TierManage = 'tickets/tierManage',
 TierAdd = 'tickets/tierAdd',
 TierEdit = 'tickets/tierEdit',
 TierDel = 'tickets/tierDel',
 TierUp = 'tickets/tierUp',
 TierDown = 'tickets/tierDown',
 TierPage = 'tickets/tierPage',
 TierSave = 'tickets/tierSave',

 Panel = 'tickets/panel',
 PanelAdd = 'tickets/panel/add',
 PanelEdit = 'tickets/panel/edit',
 PanelPost = 'tickets/panel/post',
 PanelRemove = 'tickets/panel/remove',
 PanelPage = 'tickets/panel/page',
 PanelSave = 'tickets/panel/save',
 PanelLabel = 'tickets/panel/label',
 PanelLabelSave = 'tickets/panel/labelsave',
 PanelPick = 'tickets/panelPick',

 ClearBotToken = 'tickets/clearBotToken',
 ClearBotTokenConfirm = 'tickets/clearBotTokenConfirm',
 ClearBotTokenCancel = 'tickets/clearBotTokenCancel',
 InviteBot = 'tickets/inviteBot',

 IntakeOpen = 'tickets/intakeOpen',
 IntakeExisting = 'tickets/intakeExisting',
 IntakeUnreachable = 'tickets/intakeUnreachable',
 ForceOpenKind = 'tickets/forceOpenKind',
 ContactPick = 'tickets/contactPick',
 ForceBlock = 'tickets/forceBlock',
 ForceBlockConfirm = 'tickets/forceBlockConfirm',
 ForceBlockCancel = 'tickets/forceBlockCancel',
 IntakeServer = 'tickets/intakeServer',
 IntakeKind = 'tickets/intakeKind',
}
