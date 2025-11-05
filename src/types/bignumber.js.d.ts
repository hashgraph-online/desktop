declare module 'bignumber.js' {
  class BigNumber {
    constructor(n: number | string | BigNumber, base?: number);
    static another(n: number | string | BigNumber, base?: number): BigNumber;
  }
  export = BigNumber;
}
