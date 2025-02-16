export type Pt = [number, number, number];

export type FrequencyMap = { [frequency: number]: number };

export type Source = {
  position: Pt;
  volume?: FrequencyMap;
  spreadAngle?: number;
  direction?: Pt;
};

export type Wall = {
  vertices: Pt[];
  soundReflexionFac?: FrequencyMap;
  soundTransmissionFac?: FrequencyMap;
};

export type Room = {
  sources: Source[];
  walls: Wall[];
};

export type Settings = {
  sourceResolution?: number;
};

export type Config = {
  settings?: Settings;
  room: Room;
};
