// lib/salary/engine.ts

export interface AnnualSalaryResult {
  minAnnual: number | null;
  maxAnnual: number | null;
  currency: string | null;
}

const currencySymbols: Record<string, string[]> = {
  USD: ['$', 'US$', 'USD'],
  EUR: ['€', 'EUR'],
  GBP: ['£', 'GBP'],
  CAD: ['C$', 'CAD'],
  AUD: ['A$', 'AUD'],
  NZD: ['NZ$', 'NZD'],
  CHF: ['CHF'],
  SEK: ['SEK', 'kr'],
  NOK: ['NOK', 'kr'],
  DKK: ['DKK', 'kr'],
  JPY: ['¥', 'JPY'],
  SGD: ['S$', 'SGD'],
  INR: ['₹', 'INR'],
};

const intervalKeywords: Record<string, 'YEAR' | 'MONTH' | 'HOUR'> = {
  year: 'YEAR',
  yearly: 'YEAR',
  annually: 'YEAR',
  annum: 'YEAR',
  month: 'MONTH',
  monthly: 'MONTH',
  hour: 'HOUR',
  hourly: 'HOUR',
};

export function parseSalaryStringsToAnnual(
  salaryStrings: string[],
  currencyHint?: string
): AnnualSalaryResult {
  if (!salaryStrings.length && !currencyHint) {
    return { minAnnual: null, maxAnnual: null, currency: null };
  }

  const combined = salaryStrings.join(' • ').toLowerCase();

  const currency = detectCurrency(combined, currencyHint || null);
  const numbers = extractNumbers(combined);
  if (!numbers.length) {
    return { minAnnual: null, maxAnnual: null, currency };
  }

  const min = numbers[0];
  const max = numbers.length > 1 ? numbers[1] : numbers[0];

  const interval = detectInterval(combined) ?? 'YEAR';

  const [minAnnual, maxAnnual] = [min, max].map((n) =>
    annualize(n, interval)
  );

  return {
    minAnnual,
    maxAnnual,
    currency,
  };
}

function detectCurrency(text: string, hint: string | null): string | null {
  if (hint) return hint.toUpperCase();

  for (const [code, symbols] of Object.entries(currencySymbols)) {
    if (symbols.some((s) => text.includes(s.toLowerCase()))) {
      return code;
    }
  }
  return null;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\b[\d,]+k?\b/g) || [];
  const nums: number[] = [];

  for (const m of matches) {
    let nStr = m.replace(/,/g, '');
    let multiplier = 1;
    if (nStr.toLowerCase().endsWith('k')) {
      multiplier = 1000;
      nStr = nStr.slice(0, -1);
    }
    const n = parseFloat(nStr) * multiplier;
    if (!Number.isNaN(n) && n > 0) {
      nums.push(n);
    }
  }

  return nums.sort((a, b) => a - b);
}

function detectInterval(text: string): 'YEAR' | 'MONTH' | 'HOUR' | null {
  for (const [keyword, val] of Object.entries(intervalKeywords)) {
    if (text.includes(keyword)) return val;
  }
  if (/per\s+year|p\.a\.|per\s+annum/.test(text)) return 'YEAR';
  if (/per\s+month/.test(text)) return 'MONTH';
  if (/per\s+hour/.test(text)) return 'HOUR';
  return null;
}

function annualize(
  amount: number,
  interval: 'YEAR' | 'MONTH' | 'HOUR'
): number {
  switch (interval) {
    case 'YEAR':
      return amount;
    case 'MONTH':
      return amount * 12;
    case 'HOUR':
      return amount * 2080; // 40h*52 weeks
  }
}
