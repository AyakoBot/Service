export enum NodeKind {
 Text = 'text',
 Container = 'container',
 Section = 'section',
 Separator = 'separator',
 Gallery = 'gallery',
 Row = 'row',
 Button = 'button',
 StringSelect = 'stringSelect',
 UserSelect = 'userSelect',
 RoleSelect = 'roleSelect',
 ChannelSelect = 'channelSelect',
 MentionableSelect = 'mentionableSelect',
 Thumbnail = 'thumbnail',
}

export enum NodeAction {
 Edit = 'edit',
 EditOptions = 'options',
 MoveUp = 'up',
 MoveDown = 'down',
 Remove = 'remove',

 ToggleDivider = 'divider',
 ToggleSpacing = 'spacing',
 ToggleSpoiler = 'spoiler',
 ToggleDisabled = 'disabled',

 StylePrimary = 'stylePrimary',
 StyleSecondary = 'styleSecondary',
 StyleSuccess = 'styleSuccess',
 StyleDanger = 'styleDanger',
 StyleLink = 'styleLink',

 AccessoryButton = 'accessoryButton',
 AccessoryThumbnail = 'accessoryThumbnail',

 AddText = 'addText',
 AddContainer = 'addContainer',
 AddSectionButton = 'addSectionButton',
 AddSectionThumbnail = 'addSectionThumbnail',
 AddSeparator = 'addSeparator',
 AddGallery = 'addGallery',
 AddButton = 'addButton',
 AddStringSelect = 'addStringSelect',
 AddUserSelect = 'addUserSelect',
 AddRoleSelect = 'addRoleSelect',
 AddChannelSelect = 'addChannelSelect',
 AddMentionableSelect = 'addMentionableSelect',
 AddTextChild = 'addTextChild',
}

export enum MediaAddKind {
 Gallery = 'gallery',
 SectionThumbnail = 'sectionThumbnail',
 AccessoryThumbnail = 'accessoryThumbnail',
}

export const wipComponentLimit = 24;
export const rowButtonLimit = 5;
export const sectionTextLimit = 3;
export const galleryItemLimit = 10;
export const selectOptionLimit = 25;
export const customIdLimit = 100;
