export type Preset = {
  primary: string;
  border: string;
  text: string;
  line: string;
  accent: string;
  surface: string;
};

export const presets: Record<string, Preset> = {
  light: { primary: '#d8eceb', border: '#50727c', text: '#20303a', line: '#50727c', accent: '#69e6f7', surface: '#f4f1e8' },
  dark: { primary: '#304c63', border: '#69e6f7', text: '#f4f1e8', line: '#69e6f7', accent: '#ff6b57', surface: '#151c24' },
  terminal: { primary: '#183d2e', border: '#8ef0b4', text: '#d9ffe5', line: '#8ef0b4', accent: '#f2d479', surface: '#07120f' },
  paper: { primary: '#f1d7bb', border: '#a76b47', text: '#3f3028', line: '#a76b47', accent: '#ff6b57', surface: '#f4f1e8' },
  architecture: { primary: '#cad9df', border: '#356575', text: '#19313c', line: '#356575', accent: '#69e6f7', surface: '#e6edf0' },
};

export const presetIds = Object.keys(presets);

export const getPreset = (presetId: string): Preset | undefined => presets[presetId];
