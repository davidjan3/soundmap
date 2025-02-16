import { FrequencyMap, Pt } from "configscheme";
import * as three from "three";

export class SoundBeam {
  sourceIndex: number;
  soundPressure: FrequencyMap;
  from: three.Vector3;
  to: three.Vector3;
}
