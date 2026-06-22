import type { Settings } from '../src/types/index.ts';

export const defaultSettings: Settings = {
  mandates: {
    simple: { rate: 4, floor: 5000 },
    exclusif: { rate: 3, floor: 4000 },
  },
  notaryRate: 8,
  notaryRateNew: 3,
  notaryBase: 'net',
  negotiationRate: 20, // 20% du montant négocié (ligne informative)
};

let current: Settings = JSON.parse(JSON.stringify(defaultSettings));
export const getSettings = () => current;
export const setSettings = (s: Partial<Settings>) => {
  current = { ...current, ...s };
  return current;
};
