import type { APIMessageTopLevelComponent } from 'discord-api-types/v10';

import { VerificationRoute } from '../Classes/Routes.js';

export default (components: APIMessageTopLevelComponent[]): boolean =>
 JSON.stringify(components).includes(`"custom_id":"${VerificationRoute.Verify}"`);
