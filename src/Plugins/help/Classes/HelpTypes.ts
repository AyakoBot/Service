import type { HelpSurface } from '../Util/normalize.js';
import { fullNameOf } from '../Util/path.js';

export type {
 HelpCommandView,
 HelpOptionView,
 HelpSource,
 HelpSurface,
} from '../Util/normalize.js';
export { HelpOptionKind, HelpScope, normalizeCommands } from '../Util/normalize.js';

export interface HelpSettingsEntry {
 category: string;
 name: string;
 description: string;
 fullName: string;
}

export interface HelpPanelData {
 surface: HelpSurface;
 settings: HelpSettingsEntry[];
 botId: string;
 botName: string;
 degraded: boolean;
}

export const settingsFullName = (category: string, name: string): string =>
 fullNameOf(['settings', category, name]);
