export const commandName = 'giveaway';

export enum GiveawaysRoute {
 Participate = 'giveaways/participate',
 Claim = 'giveaways/claim',
 Reroll = 'giveaways/reroll',
 RerollCount = 'giveaways/rerollcount',
 List = 'giveaways/list',
 Prizes = 'giveaways/prizes',
 PanelEdit = 'giveaways/paneledit',
 PanelSave = 'giveaways/panelsave',
 PanelStart = 'giveaways/panelstart',
 Due = 'giveaways/due',
}

export enum GiveawaySub {
 Quick = 'quick',
 End = 'end',
 Edit = 'edit',
 Reroll = 'reroll',
 Cancel = 'cancel',
 List = 'list',
 Prizes = 'prizes',
}

export enum GiveawayGroup {
 Start = 'start',
}

export enum GiveawayStartSub {
 Default = 'default',
 FromTemplate = 'from-template',
}

export enum GiveawayOption {
 Description = 'prize-description',
 Time = 'time',
 Winners = 'winners',
 Channel = 'channel',
 Role = 'role',
 Host = 'host',
 Prize = 'prize',
 ClaimTimeout = 'claiming-timeout',
 FailReroll = 'claim-fail-reroll',
 MessageId = 'message-id',
 Template = 'template',
}

export enum GiveawaySettingName {
 Templates = 'giveaway-templates',
}

export enum PanelOrigin {
 Command = 'c',
 Due = 'd',
}
