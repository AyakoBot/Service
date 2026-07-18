import {
 ApplicationCommandType,
 ComponentType,
 InteractionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { MoveDirection } from '../../Classes/Enums.js';
import { tagCommandName, TicketRoute } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';

import autocomplete from './autocomplete.js';
import { clearBotToken, inviteBot } from './botIdentity.js';
import claim from './claim.js';
import close from './close.js';
import closeReason from './closeReason.js';
import create from './create.js';
import del from './delete.js';
import escalate from './escalate.js';
import escalateTo from './escalateTo.js';
import intake from './intake.js';
import intakeExisting from './intakeExisting.js';
import { intakeKind } from './intakeKind.js';
import { intakeServer } from './intakeServer.js';
import keepOpen from './keepOpen.js';
import leave from './leave.js';
import { panelEditorOpen, panelPage, panelPost, panelRemove } from './panelEditor.js';
import {
 panelAdd,
 panelEdit,
 panelLabelPick,
 panelLabelSave,
 panelSave,
} from './panelEditorModal.js';
import panelPick from './panelPick.js';
import { roleMapMove, roleMapOpen, roleMapPage, roleMapRemove } from './roleMap.js';
import { roleMapAdd, roleMapEdit, roleMapSave } from './roleMapModal.js';
import tag from './tag.js';
import { tagAdd, tagDelete, tagEdit, tagManage, tagPage, tagSearch, tagSend } from './tagButton.js';
import { tagAddModal, tagEditModal, tagSearchModal } from './tagModal.js';
import take from './take.js';
import { tierDel, tierManageOpen, tierMove, tierPage } from './tierManage.js';
import { tierAdd, tierEdit, tierSave } from './tierModal.js';
import unclaim from './unclaim.js';
import userInfo from './userInfo.js';

export default async function (
 this: TicketPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   command.call(this, cmd);
   break;
  case InteractionType.MessageComponent:
   if (cmd.data.component_type === ComponentType.Button) button.call(this, cmd);
   else if (cmd.data.component_type === ComponentType.StringSelect) select.call(this, cmd);
   break;
  case InteractionType.ModalSubmit:
   modal.call(this, cmd);
   break;
  case InteractionType.ApplicationCommandAutocomplete:
   autocomplete.call(this, cmd as APIApplicationCommandAutocompleteInteraction);
   break;
 }
}

const command = async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;

 switch (cmd.data.name) {
  case tagCommandName: {
   tag.call(this, cmd);
   break;
  }

  default:
   break;
 }
};

const button = async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case TicketRoute.Create: {
   create.call(this, cmd, args);
   break;
  }
  case TicketRoute.Claim: {
   claim.call(this, cmd, args);
   break;
  }
  case TicketRoute.Unclaim: {
   unclaim.call(this, cmd, args);
   break;
  }
  case TicketRoute.Take: {
   take.call(this, cmd, args);
   break;
  }
  case TicketRoute.UserInfo: {
   userInfo.call(this, cmd, args);
   break;
  }
  case TicketRoute.Escalate: {
   escalate.call(this, cmd, args);
   break;
  }
  case TicketRoute.EscalateTo: {
   escalateTo.call(this, cmd, args);
   break;
  }
  case TicketRoute.Close: {
   close.call(this, cmd, args);
   break;
  }
  case TicketRoute.Leave: {
   leave.call(this, cmd);
   break;
  }
  case TicketRoute.Delete: {
   del.call(this, cmd, args);
   break;
  }
  case TicketRoute.KeepOpen: {
   keepOpen.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagSend: {
   tagSend.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagPage: {
   tagPage.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagSearch: {
   tagSearch.call(this, cmd);
   break;
  }
  case TicketRoute.TagAdd: {
   tagAdd.call(this, cmd);
   break;
  }
  case TicketRoute.TagEdit: {
   tagEdit.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagDelete: {
   tagDelete.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagManage: {
   tagManage.call(this, cmd, true);
   break;
  }
  case TicketRoute.TagBrowse: {
   tagManage.call(this, cmd, false);
   break;
  }
  case TicketRoute.RoleMap: {
   roleMapOpen.call(this, cmd);
   break;
  }
  case TicketRoute.RoleMapAdd: {
   roleMapAdd.call(this, cmd);
   break;
  }
  case TicketRoute.RoleMapEdit: {
   roleMapEdit.call(this, cmd, args);
   break;
  }
  case TicketRoute.RoleMapRemove: {
   roleMapRemove.call(this, cmd, args);
   break;
  }
  case TicketRoute.RoleMapUp: {
   roleMapMove.call(this, cmd, args, MoveDirection.Up);
   break;
  }
  case TicketRoute.RoleMapDown: {
   roleMapMove.call(this, cmd, args, MoveDirection.Down);
   break;
  }
  case TicketRoute.RoleMapPage: {
   roleMapPage.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierManage: {
   tierManageOpen.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierAdd: {
   tierAdd.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierEdit: {
   tierEdit.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierDel: {
   tierDel.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierUp: {
   tierMove.call(this, cmd, args, MoveDirection.Up);
   break;
  }
  case TicketRoute.TierDown: {
   tierMove.call(this, cmd, args, MoveDirection.Down);
   break;
  }
  case TicketRoute.TierPage: {
   tierPage.call(this, cmd, args);
   break;
  }
  case TicketRoute.Panel: {
   panelEditorOpen.call(this, cmd);
   break;
  }
  case TicketRoute.PanelAdd: {
   panelAdd.call(this, cmd);
   break;
  }
  case TicketRoute.PanelEdit: {
   panelEdit.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelPost: {
   panelPost.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelRemove: {
   panelRemove.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelPage: {
   panelPage.call(this, cmd, args);
   break;
  }
  case TicketRoute.IntakeOpen: {
   intake.call(this, cmd);
   break;
  }
  case TicketRoute.IntakeExisting: {
   intakeExisting.call(this, cmd, args);
   break;
  }
  case TicketRoute.ClearBotToken: {
   clearBotToken.call(this, cmd, args);
   break;
  }
  case TicketRoute.InviteBot: {
   inviteBot.call(this, cmd, args);
   break;
  }

  default:
   break;
 }
};

const select = async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case TicketRoute.PanelPick: {
   panelPick.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelLabel: {
   panelLabelPick.call(this, cmd);
   break;
  }
  case TicketRoute.IntakeServer: {
   intakeServer.call(this, cmd, args);
   break;
  }
  case TicketRoute.IntakeKind: {
   intakeKind.call(this, cmd, args);
   break;
  }

  default:
   break;
 }
};

const modal = async function (this: TicketPlugin, cmd: APIModalSubmitInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case TicketRoute.CloseReason: {
   closeReason.call(this, cmd, args);
   break;
  }
  case TicketRoute.TagSearchModal: {
   tagSearchModal.call(this, cmd);
   break;
  }
  case TicketRoute.TagAddModal: {
   tagAddModal.call(this, cmd);
   break;
  }
  case TicketRoute.TagEditModal: {
   tagEditModal.call(this, cmd, args);
   break;
  }
  case TicketRoute.RoleMapSave: {
   roleMapSave.call(this, cmd, args);
   break;
  }
  case TicketRoute.TierSave: {
   tierSave.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelSave: {
   panelSave.call(this, cmd, args);
   break;
  }
  case TicketRoute.PanelLabelSave: {
   panelLabelSave.call(this, cmd, args);
   break;
  }

  default:
   break;
 }
};
