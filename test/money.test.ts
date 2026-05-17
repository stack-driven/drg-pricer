import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatMoney,
  moneyFromCents,
  multiplyMoneyByDecimal,
  parseMoney,
} from "../src/money.js";

describe("moneyFromCents", () => {
  it("accepts non-negative integer cents", () => {
    assert.deepEqual(moneyFromCents(123), { cents: 123n });
    assert.deepEqual(moneyFromCents(123n), { cents: 123n });
  });

  it("rejects unsafe or negative cents", () => {
    assert.throws(() => moneyFromCents(-1), /non-negative/);
    assert.throws(() => moneyFromCents(0.1), /safe integer/);
    assert.throws(() => moneyFromCents(Number.MAX_SAFE_INTEGER + 1), /safe integer/);
  });
});

describe("parseMoney", () => {
  it("parses deterministic decimal money strings into cents", () => {
    assert.deepEqual(parseMoney("0"), { cents: 0n });
    assert.deepEqual(parseMoney("0.00"), { cents: 0n });
    assert.deepEqual(parseMoney("1"), { cents: 100n });
    assert.deepEqual(parseMoney("1.2"), { cents: 120n });
    assert.deepEqual(parseMoney("1.23"), { cents: 123n });
    assert.deepEqual(parseMoney("001.23"), { cents: 123n });
    assert.deepEqual(parseMoney("123456789.99"), { cents: 12345678999n });
  });

  it("accepts a decimal comma without accepting thousands separators", () => {
    assert.deepEqual(parseMoney("1,23"), { cents: 123n });
    assert.throws(() => parseMoney("1,234"), /at most two decimal places/);
    assert.throws(() => parseMoney("1,234.56"), /Invalid money amount/);
  });

  it("rejects invalid money strings", () => {
    assert.throws(() => parseMoney(""), /Invalid money amount/);
    assert.throws(() => parseMoney("abc"), /Invalid money amount/);
    assert.throws(() => parseMoney("1.234"), /at most two decimal places/);
    assert.throws(() => parseMoney("-1.00"), /Invalid money amount/);
    assert.throws(() => parseMoney("1e3"), /Invalid money amount/);
  });
});

describe("formatMoney", () => {
  it("formats cents as a stable machine-readable decimal string", () => {
    assert.equal(formatMoney({ cents: 0n }), "0.00");
    assert.equal(formatMoney({ cents: 1n }), "0.01");
    assert.equal(formatMoney({ cents: 120n }), "1.20");
    assert.equal(formatMoney({ cents: 12345n }), "123.45");
  });

  it("rejects negative cents", () => {
    assert.throws(() => formatMoney({ cents: -1n }), /non-negative/);
  });
});

describe("multiplyMoneyByDecimal", () => {
  it("multiplies money by non-negative decimal factors without floating point math", () => {
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("4000.00"), "1"), {
      cents: 400000n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("4000.00"), "1.234"), {
      cents: 493600n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("4000.00"), "1,234"), {
      cents: 493600n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("123456789.99"), "1.2345"), {
      cents: 15240740724n,
    });
  });

  it("rounds half up to cents", () => {
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("100.00"), "0.3333"), {
      cents: 3333n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("100.00"), "0.33335"), {
      cents: 3334n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("0.01"), "0.5"), {
      cents: 1n,
    });
    assert.deepEqual(multiplyMoneyByDecimal(parseMoney("0.01"), "0.49"), {
      cents: 0n,
    });
  });

  it("rejects invalid decimal factors", () => {
    assert.throws(() => multiplyMoneyByDecimal(parseMoney("1.00"), ""), /Invalid decimal factor/);
    assert.throws(() => multiplyMoneyByDecimal(parseMoney("1.00"), "abc"), /Invalid decimal factor/);
    assert.throws(() => multiplyMoneyByDecimal(parseMoney("1.00"), "-1"), /Invalid decimal factor/);
    assert.throws(() => multiplyMoneyByDecimal(parseMoney("1.00"), "1e-3"), /Invalid decimal factor/);
    assert.throws(() => multiplyMoneyByDecimal(parseMoney("1.00"), "1,234.56"), /Invalid decimal factor/);
  });
});
