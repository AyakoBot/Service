import * as CT from '../../../../Typings/Typings.js';
import banAdd from './execution/banAdd.js';
import banRemove from './execution/banRemove.js';
import channelBanAdd from './execution/channelBanAdd.js';
import channelBanRemove from './execution/channelBanRemove.js';
import kickAdd from './execution/kickAdd.js';
import muteRemove from './execution/muteRemove.js';
import roleAdd from './execution/roleAdd.js';
import roleRemove from './execution/roleRemove.js';
import softBanAdd from './execution/softBanAdd.js';
import softWarnAdd from './execution/softWarnAdd.js';
import strikeAdd from './execution/strikeAdd.js';
import tempBanAdd from './execution/tempBanAdd.js';
import tempChannelBanAdd from './execution/tempChannelBanAdd.js';
import tempMuteAdd from './execution/tempMuteAdd.js';
import unafk from './execution/unAfk.js';
import warnAdd from './execution/warnAdd.js';
import vcMuteAdd from './execution/vcMuteAdd.js';
import vcTempMuteAdd from './execution/vcTempMuteAdd.js';
import vcMuteRemove from './execution/vcMuteRemove.js';
import vcDeafenAdd from './execution/vcDeafenAdd.js';
import vcTempDeafenAdd from './execution/vcTempDeafenAdd.js';
import vcDeafenRemove from './execution/vcDeafenRemove.js';

export default (t: CT.Language) => ({
 ...t.JSON.mod.execution,
 banRemove: banRemove(t),
 banAdd: banAdd(t),
 channelBanAdd: channelBanAdd(t),
 channelBanRemove: channelBanRemove(t),
 kickAdd: kickAdd(t),
 muteRemove: muteRemove(t),
 roleAdd: roleAdd(t),
 roleRemove: roleRemove(t),
 softBanAdd: softBanAdd(t),
 softWarnAdd: softWarnAdd(t),
 strikeAdd: strikeAdd(t),
 tempBanAdd: tempBanAdd(t),
 tempChannelBanAdd: tempChannelBanAdd(t),
 tempMuteAdd: tempMuteAdd(t),
 warnAdd: warnAdd(t),
 unAfk: unafk(t),
 vcMuteAdd: vcMuteAdd(t),
 vcTempMuteAdd: vcTempMuteAdd(t),
 vcMuteRemove: vcMuteRemove(t),
 vcDeafenAdd: vcDeafenAdd(t),
 vcTempDeafenAdd: vcTempDeafenAdd(t),
 vcDeafenRemove: vcDeafenRemove(t),
});
