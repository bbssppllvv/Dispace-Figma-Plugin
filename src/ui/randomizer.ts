import {
  randomizerConfig,
  RandomizerConfig,
  RandomizerParameterConfig,
} from "./randomizer-config";

export type RandomizerResult = Record<keyof RandomizerConfig, number>;

function getRandomValue(config: RandomizerParameterConfig): number {
  if (config.probability !== undefined && Math.random() > config.probability) {
    return 0;
  }
  return Math.random() * (config.max - config.min) + config.min;
}

export function generateRandomizedValues(): RandomizerResult {
  const result: Partial<RandomizerResult> = {};
  for (const key in randomizerConfig) {
    if (Object.prototype.hasOwnProperty.call(randomizerConfig, key)) {
      const paramKey = key as keyof RandomizerConfig;
      const paramConfig = randomizerConfig[paramKey];
      result[paramKey] = getRandomValue(paramConfig);
    }
  }
  return result as RandomizerResult;
} 