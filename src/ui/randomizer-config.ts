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
  reflectOpacity: RandomizerParameterConfig;
  reflectSharpness: RandomizerParameterConfig;
}

export const randomizerConfig: RandomizerConfig = {
  strength: {
    min: -400,
    max: 400,
    probability: 1,
  },
  scale: {
    min: 2,
    max: 150,
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
  reflectOpacity: {
    min: 10,
    max: 60,
    probability: 0.4,
  },
  reflectSharpness: {
    min: 40,
    max: 80,
    probability: 0.4,
  },
}; 