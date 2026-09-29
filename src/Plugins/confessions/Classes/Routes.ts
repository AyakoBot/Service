export const commandName = 'confess';
export const bansCommandName = 'confession-bans';

export const contentField = 'content';
export const mediaField = 'media';
export const reasonField = 'reason';
export const durationField = 'duration';
export const actionField = 'action';

export enum ConfessionsRoute {
 Submit = 'confessions/submit',
 SubmitModal = 'confessions/submitmodal',
 Reply = 'confessions/reply',
 ReplyModal = 'confessions/replymodal',
 Approve = 'confessions/approve',
 Deny = 'confessions/deny',
 DenyModal = 'confessions/denymodal',
 Ban = 'confessions/ban',
 BanModal = 'confessions/banmodal',
 Unban = 'confessions/unban',
 Reveal = 'confessions/reveal',
 Menu = 'confessions/menu',
 MenuAction = 'confessions/menuaction',
 ReportModal = 'confessions/reportmodal',
 DeleteModal = 'confessions/deletemodal',
 BansPage = 'confessions/banspage',
 BansUnban = 'confessions/bansunban',
}

export enum MenuAction {
 Ban = 'ban',
 Report = 'report',
}
