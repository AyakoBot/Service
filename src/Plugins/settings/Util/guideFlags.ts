export const hasFlag = (bits: number, flag: number): boolean => (bits & flag) === flag;
export const addFlag = (bits: number, flag: number): number => bits | flag;
export const removeFlag = (bits: number, flag: number): number => bits & ~flag;
