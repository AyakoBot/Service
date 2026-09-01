import type Client from '../../../Classes/Client.js';
import type { MessagePlaceholder } from '../../../Util/messagePlaceholders.js';

export const placeholdersByPlugin = (client: Client) =>
 client.plugins
  .filter((plugin) => plugin.placeholders?.length)
  .map((plugin) => ({
   name: plugin.name,
   placeholders: plugin.placeholders as MessagePlaceholder[],
  }));
