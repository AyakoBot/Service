export interface AccessLists {
 denyChannels: string[];
 denyRoles: string[];
 denyUsers: string[];
 allowChannels: string[];
 allowRoles: string[];
 allowUsers: string[];
}

export const isBlocked = (
 s: AccessLists,
 ctx: { channelId: string; userId: string; roleIds: string[] },
): boolean => {
 const isUserAllowed = s.allowUsers.includes(ctx.userId);
 const isUserDenied = s.denyUsers.includes(ctx.userId);
 const isRoleAllowed = s.allowRoles.length
  ? ctx.roleIds.some((r) => s.allowRoles.includes(r))
  : false;
 const isRoleDenied = s.denyRoles.length ? ctx.roleIds.some((r) => s.denyRoles.includes(r)) : false;
 const isChannelAllowed = s.allowChannels.length ? s.allowChannels.includes(ctx.channelId) : false;
 const isChannelDenied =
  (s.allowChannels.length > 0 && !isChannelAllowed) || s.denyChannels.includes(ctx.channelId);

 if (isUserDenied) return true;
 if (isRoleDenied && !isUserAllowed) return true;
 if (isChannelDenied && !isUserAllowed && !isRoleAllowed) return true;

 return false;
};
