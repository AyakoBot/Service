import {
 ComponentType,
 InteractionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { EmbedBuilderCommand } from '../../Classes/Commands.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import type EmbedBuilderPlugin from '../../Plugin.js';

import autocomplete from './autocomplete.js';
import {
 backToBuilder,
 closeThread,
 emptyBuilder,
 fieldPick,
 propertyPick,
} from './builderActions.js';
import { editorSave } from './editorModal.js';
import { exportJson, importOpen, importSave } from './ioFlow.js';
import { saveOpen, saveSubmit } from './saveFlow.js';
import {
 editOpen,
 editSave,
 sendOpen,
 sendTo,
 webhookOpen,
 webhookSendTo,
 webhookSubmit,
} from './sendFlow.js';
import { deleteSaved, loadOpen, loadPick, openFromAction, startFresh } from './start.js';
import command from './viewCommands.js';

export default async function (
 this: EmbedBuilderPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand: {
   const interaction = cmd as APIApplicationCommandInteraction;
   if (interaction.data.name === EmbedBuilderCommand.EmbedBuilder) {
    command.call(this, interaction);
   }
   break;
  }
  case InteractionType.MessageComponent: {
   const interaction = cmd as APIMessageComponentInteraction;
   switch (interaction.data.component_type) {
    case ComponentType.Button:
     button.call(this, interaction);
     break;
    case ComponentType.StringSelect:
     select.call(this, interaction);
     break;
    case ComponentType.ChannelSelect:
     channelSelect.call(this, interaction);
     break;
    default:
     break;
   }
   break;
  }
  case InteractionType.ModalSubmit:
   modal.call(this, cmd as APIModalSubmitInteraction);
   break;
  case InteractionType.ApplicationCommandAutocomplete:
   autocomplete.call(this, cmd as APIApplicationCommandAutocompleteInteraction);
   break;
  default:
   break;
 }
}

const button = async function (this: EmbedBuilderPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case EmbedBuilderRoute.Start: {
   startFresh.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.ImportJson: {
   importOpen.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.LoadOpen: {
   loadOpen.call(this, cmd, args);
   break;
  }
  case EmbedBuilderRoute.DeleteSaved: {
   deleteSaved.call(this, cmd, args);
   break;
  }
  case EmbedBuilderRoute.OpenBuilder: {
   openFromAction.call(this, cmd, args);
   break;
  }
  case EmbedBuilderRoute.Empty: {
   emptyBuilder.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.ExportJson: {
   exportJson.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.Save: {
   saveOpen.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.Send: {
   sendOpen.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.WebhookModal: {
   webhookOpen.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.EditMessage: {
   editOpen.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.Back: {
   backToBuilder.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.CloseThread: {
   closeThread.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const select = async function (this: EmbedBuilderPlugin, cmd: APIMessageComponentInteraction) {
 const [fileCall] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case EmbedBuilderRoute.LoadPick: {
   loadPick.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.Property: {
   propertyPick.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.Field: {
   fieldPick.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const channelSelect = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const [fileCall] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case EmbedBuilderRoute.SendTo: {
   sendTo.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.WebhookSendTo: {
   webhookSendTo.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const modal = async function (this: EmbedBuilderPlugin, cmd: APIModalSubmitInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case EmbedBuilderRoute.Editor: {
   editorSave.call(this, cmd, args);
   break;
  }
  case EmbedBuilderRoute.ImportSave: {
   importSave.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.SaveSubmit: {
   saveSubmit.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.WebhookSubmit: {
   webhookSubmit.call(this, cmd);
   break;
  }
  case EmbedBuilderRoute.EditMessageSubmit: {
   editSave.call(this, cmd);
   break;
  }
  default:
   break;
 }
};
