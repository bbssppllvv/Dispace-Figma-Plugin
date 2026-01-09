/**
 * Randomizer utility for generating random effect parameter values
 */

export interface RandomizerParameterConfig {
  min: number;
  max: number;
  probability?: number;
}

export interface RandomizerConfig {
  strength: RandomizerParameterConfig;
  scale: RandomizerParameterConfig;
  soft: RandomizerParameterConfig;
  chromatic: RandomizerParameterConfig;
  blur: RandomizerParameterConfig;
  noise: RandomizerParameterConfig;
  grain: RandomizerParameterConfig;
  grainSize: RandomizerParameterConfig;
}

export const randomizerConfig: RandomizerConfig = {
  strength: {
    min: -600,
    max: 600,
    probability: 1,
  },
  scale: {
    min: 10,
    max: 200,
    probability: 1,
  },
  soft: {
    min: 0,
    max: 3,
    probability: 0.3,
  },
  chromatic: {
    min: 0,
    max: 50,
    probability: 0.4,
  },
  blur: {
    min: 0,
    max: 10,
    probability: 0.6,
  },
  noise: {
    min: 0,
    max: 50,
    probability: 0.4,
  },
  grain: {
    min: 0,
    max: 80,
    probability: 0.4,
  },
  grainSize: {
    min: 0,
    max: 40,
    probability: 0.1,
  },
};

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

