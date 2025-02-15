export default class Utils {
  static readonly PA_REF = 0.00002;

  static Pa2dB(n: number) {
    return 10 * Math.log10(n ** 2 + this.PA_REF ** 2);
  }

  static dB2Pa(n: number) {
    return this.PA_REF * Math.sqrt(10 ** (n / 10));
  }
}
