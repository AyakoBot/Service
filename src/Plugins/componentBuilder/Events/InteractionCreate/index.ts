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
import { ComponentBuilderCommand } from '../../Classes/Commands.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { parseMarker } from '../../Util/builderState.js';
import { customIdPrefix } from '../../Util/componentTree.js';

import autocomplete from './autocomplete.js';
import {
 ackCustomComponent,
 actionPick,
 backToBuilder,
 closeThread,
 emptyBuilder,
 nodePick,
} from './builderActions.js';
import { editorSave, mediaAddSave, optionsSave } from './editorModal.js';
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
 this: ComponentBuilderPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand: {
   const interaction = cmd as APIApplicationCommandInteraction;
   if (interaction.data.name === ComponentBuilderCommand.ComponentBuilder) {
    command.call(this, interaction);
   }
   break;
  }
  case InteractionType.MessageComponent: {
   const interaction = cmd as APIMessageComponentInteraction;
   if (
    interaction.data.custom_id.startsWith(customIdPrefix) &&
    interaction.message &&
    parseMarker(interaction.message)
   ) {
    ackCustomComponent.call(this, interaction);
    break;
   }

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

const button = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case ComponentBuilderRoute.Start: {
   startFresh.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.ImportJson: {
   importOpen.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.LoadOpen: {
   loadOpen.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.DeleteSaved: {
   deleteSaved.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.OpenBuilder: {
   openFromAction.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.Empty: {
   emptyBuilder.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.ExportJson: {
   exportJson.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.Save: {
   saveOpen.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.Send: {
   sendOpen.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.WebhookModal: {
   webhookOpen.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.EditMessage: {
   editOpen.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.Back: {
   backToBuilder.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.CloseThread: {
   closeThread.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const select = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const [fileCall] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case ComponentBuilderRoute.LoadPick: {
   loadPick.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.Node: {
   nodePick.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.Action: {
   actionPick.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const channelSelect = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const [fileCall] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case ComponentBuilderRoute.SendTo: {
   sendTo.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.WebhookSendTo: {
   webhookSendTo.call(this, cmd);
   break;
  }
  default:
   break;
 }
};

const modal = async function (this: ComponentBuilderPlugin, cmd: APIModalSubmitInteraction) {
 const [fileCall, ...args] = cmd.data.custom_id.split('_');

 switch (fileCall) {
  case ComponentBuilderRoute.EditorSave: {
   editorSave.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.OptionsSave: {
   optionsSave.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.MediaAddSave: {
   mediaAddSave.call(this, cmd, args);
   break;
  }
  case ComponentBuilderRoute.ImportSave: {
   importSave.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.SaveSubmit: {
   saveSubmit.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.WebhookSubmit: {
   webhookSubmit.call(this, cmd);
   break;
  }
  case ComponentBuilderRoute.EditMessageSubmit: {
   editSave.call(this, cmd);
   break;
  }
  default:
   break;
 }
};
