import type { Settings } from '../src/types/index.ts';

export const defaultSettings: Settings = {
  mandates: {
    simple: { rate: 4, floor: 5000 },
    exclusif: { rate: 3, floor: 4000 },
  },
  notaryRate: 8.5, // ancien
  notaryRateNew: 3, // neuf
  notaryBase: 'net',
};

let current: Settings = JSON.parse(JSON.stringify(defaultSettings));
export const getSettings = () => current;
export const setSettings = (s: Partial<Settings>) => {
  current = { ...current, ...s };
  return current;
};
