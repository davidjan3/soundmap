export type Pt = [number, number, number];

export type FrequencyMap = { [frequency: number]: number };

export type Source = {
  position: Pt;
  volume?: FrequencyMap;
  spreadAngle?: number;
  direction?: Pt;
  radius?: number;
};

type SoundObstruction = {
  soundReflexionFac?: FrequencyMap;
  soundTransmissionFac?: FrequencyMap;
};

export type Wall = SoundObstruction & {
  vertices: Pt[];
};

export type Object = SoundObstruction & {
  path: string;
  position: Pt;
  rotation?: Pt;
  scale?: Pt;
};

export type Room = {
  sources: Source[];
  walls: Wall[];
  objects?: Object[];
};

export type Settings = {
  sourceResolution?: number;
  maxBounces?: number;
  heatMapStep?: number;
};

export type Config = {
  settings?: Settings;
  room: Room;
};

export const materials = {
  concrete: {
    soundReflexionFac: { 125: 0.99, 250: 0.99, 500: 0.99, 1000: 0.98, 2000: 0.98, 4000: 0.98 },
  },
  wallpaper: {
    soundReflexionFac: { 125: 0.98, 250: 0.97, 500: 0.96, 1000: 0.4, 2000: 0.4, 4000: 0.4 },
  },
  glass: {
    soundReflexionFac: { 125: 0.9, 250: 0.94, 500: 0.96, 1000: 0.97, 2000: 0.98, 4000: 0.98 },
  },
  parquet: {
    soundReflexionFac: { 125: 0.9, 250: 0.93, 500: 0.95, 1000: 0.94, 2000: 0.94, 4000: 0.94 },
  },
  furniture_textile: {
    soundReflexionFac: { 125: 0.92, 250: 0.85, 500: 0.75, 1000: 0.71, 2000: 0.57, 4000: 0.61 },
  },
};

export const noises: { [index: string]: FrequencyMap } = {
  music_techno: { 125: 95, 250: 90, 500: 85, 1000: 80, 2000: 75, 4000: 70 },
  music_classical: { 125: 75, 250: 80, 500: 85, 1000: 85, 2000: 80, 4000: 75 },
  music_rock: { 125: 90, 250: 88, 500: 85, 1000: 87, 2000: 85, 4000: 83 },
  music_hiphop: { 125: 95, 250: 90, 500: 85, 1000: 83, 2000: 80, 4000: 75 },
  movie: { 125: 70, 250: 75, 500: 80, 1000: 80, 2000: 75, 4000: 70 },
  talking: { 125: 45, 250: 55, 500: 60, 1000: 60, 2000: 55, 4000: 45 },
};
