export type Money = {
  readonly cents: bigint;
};

type ParsedDecimal = {
  readonly units: bigint;
  readonly scale: bigint;
};

const DECIMAL_PATTERN = /^(?<whole>\d+)(?:(?<separator>[.,])(?<fraction>\d+))?$/u;

export function moneyFromCents(cents: bigint | number): Money {
  const normalized = toSafeBigInt(cents, "cents");

  if (normalized < 0n) {
    throw new Error("Money cents must be non-negative");
  }

  return { cents: normalized };
}

export function parseMoney(input: string): Money {
  const parsed = parseDecimal(input, "money amount");

  if (parsed.scale > 100n) {
    throw new Error("Money amount must have at most two decimal places");
  }

  return moneyFromCents(parsed.units * (100n / parsed.scale));
}

export function multiplyMoneyByDecimal(money: Money, factor: string): Money {
  const cents = toSafeBigInt(money.cents, "money.cents");
  if (cents < 0n) {
    throw new Error("Money cents must be non-negative");
  }

  const parsedFactor = parseDecimal(factor, "decimal factor");
  const unroundedCents = cents * parsedFactor.units;
  const quotient = unroundedCents / parsedFactor.scale;
  const remainder = unroundedCents % parsedFactor.scale;
  const rounded = remainder * 2n >= parsedFactor.scale ? quotient + 1n : quotient;

  return moneyFromCents(rounded);
}

export function formatMoney(money: Money): string {
  const cents = toSafeBigInt(money.cents, "money.cents");
  if (cents < 0n) {
    throw new Error("Money cents must be non-negative");
  }

  const euros = cents / 100n;
  const remainder = cents % 100n;

  return `${euros.toString()}.${remainder.toString().padStart(2, "0")}`;
}

function parseDecimal(input: string, label: string): ParsedDecimal {
  const trimmed = input.trim();
  const match = DECIMAL_PATTERN.exec(trimmed);

  if (!match?.groups) {
    throw new Error(`Invalid ${label}: expected a non-negative decimal string`);
  }

  const whole = match.groups.whole;
  const fraction = match.groups.fraction ?? "";

  // Leading zeroes are accepted to keep parser behavior boring and deterministic.
  const units = BigInt(`${whole}${fraction}`);
  const scale = 10n ** BigInt(fraction.length);

  return { units, scale };
}

function toSafeBigInt(value: bigint | number, label: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer number or bigint`);
  }

  return BigInt(value);
}
