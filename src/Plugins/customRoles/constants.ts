export const origin = 'CustomRoles';

export enum CustomRolesKey {
 Reconcile = 'customroles:reconcile',
}

export enum CustomRolesReason {
 Grant = 'Custom-Role',
 Manage = 'Custom Roles',
 OwnerLeft = 'Custom-Role Owner left the Server',
 PrivilegeLost = 'Custom-Role Owner lost privilege to own this Role',
}

export const reconcileChunkSize = 100;
export const reconcileChunkDelaySeconds = 2;
