const declineShift = 16;

export const hasFlag = (bits: number, flag: number): boolean => (bits & flag) === flag;
export const addFlag = (bits: number, flag: number): number => bits | flag;
export const removeFlag = (bits: number, flag: number): number => bits & ~flag;

export const declineFlag = (flag: number): number => flag << declineShift;
export const hasDeclined = (bits: number, flag: number): boolean =>
 hasFlag(bits, declineFlag(flag));
export const addDecline = (bits: number, flag: number): number => addFlag(bits, declineFlag(flag));
