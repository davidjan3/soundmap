import { FrequencyMap, Pt } from "configscheme";
import * as three from "three";

export const PA_REF = 0.00002;

export default class Utils {
  static Pa2dB(n: number) {
    return 10 * Math.log10(n ** 2 + PA_REF ** 2);
  }

  static dB2Pa(n: number) {
    return PA_REF * Math.sqrt(10 ** (n / 10));
  }

  static mapFrequencyMap(fm: FrequencyMap, func: (freq: number, val: number) => number) {
    return Object.fromEntries(Object.entries(fm).map(([freq, val]) => [freq, func(Number(freq), val)])) as FrequencyMap;
  }

  static factorFrequencyMap(fm: FrequencyMap, fac: number) {
    return this.mapFrequencyMap(fm, (freq, val) => val * fac);
  }

  static factorFrequencyMapEntries(fm: FrequencyMap, fm2: FrequencyMap) {
    return this.mapFrequencyMap(fm, (freq, val) => val * (fm2[freq] ?? 1));
  }

  static Pt2Vector3(pt: Pt) {
    return new three.Vector3(...pt);
  }
}
