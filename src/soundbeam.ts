import { FrequencyMap, Pt } from "configscheme";
import * as three from "three";

export const MAX_LEN = 50;

export default class SoundBeam {
  sourceIndex: number;
  soundPressure: FrequencyMap;
  from: three.Vector3;
  to: three.Vector3;
}
