export const CHIP_TYPES = ['ay'] as const;
export type ChipType = (typeof CHIP_TYPES)[number];
