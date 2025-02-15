export type Pt = [number, number, number];

export type FrequencyMap = { [frequency: number]: number };

export type Source = {
  position: Pt;
  volume?: FrequencyMap;
  degreeRangeHorizontal?: [number, number];
  degreeRangeVertical?: [number, number];
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
