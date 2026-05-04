export type AccountCategory =
  | "checking" | "savings" | "credit_card" | "retirement_401k" | "brokerage" | "ira"
  | "car_loan" | "mortgage" | "student_loan" | "personal_loan" | "other_asset" | "other_liability";

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  retirement_401k: "401(k)",
  brokerage: "Brokerage",
  ira: "IRA",
  car_loan: "Car Loan",
  mortgage: "Mortgage",
  student_loan: "Student Loan",
  personal_loan: "Personal Loan",
  other_asset: "Other Asset",
  other_liability: "Other Liability",
};

export const ASSET_CATEGORIES: AccountCategory[] = ["checking","savings","retirement_401k","brokerage","ira","other_asset"];
export const LIABILITY_CATEGORIES: AccountCategory[] = ["credit_card","car_loan","mortgage","student_loan","personal_loan","other_liability"];
export const CASH_CATEGORIES: AccountCategory[] = ["checking","savings"];
export const INVESTMENT_CATEGORIES: AccountCategory[] = ["brokerage"];
export const RETIREMENT_CATEGORIES: AccountCategory[] = ["retirement_401k","ira"];

export const isAsset = (c: AccountCategory) => ASSET_CATEGORIES.includes(c);
export const isLiability = (c: AccountCategory) => LIABILITY_CATEGORIES.includes(c);
export const accountType = (c: AccountCategory): "asset" | "liability" =>
  isAsset(c) ? "asset" : "liability";
/** Signed contribution to net worth: assets positive, liabilities negative. */
export const signedBalance = (c: AccountCategory, balance: number): number =>
  isLiability(c) ? -Math.abs(balance) : balance;

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
export const fmtMoneyExact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

/** Returns ISO date (YYYY-MM-DD) of the Sunday ending the week containing `d`. */
export function weekEnding(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay(); // 0..6, Sun..Sat
  const add = (7 - day) % 7;
  date.setUTCDate(date.getUTCDate() + add);
  return date.toISOString().slice(0, 10);
}

export function pctChange(curr: number, prev: number): number {
  if (!prev) return curr ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export const SPENDING_CATEGORIES = [
  { value: "food", label: "Food" },
  { value: "coffee_snacks", label: "Coffee/Snacks" },
  { value: "groceries", label: "Groceries" },
  { value: "gas_transportation", label: "Gas/Transport" },
  { value: "shopping", label: "Shopping" },
  { value: "entertainment", label: "Entertainment" },
  { value: "bills", label: "Bills" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
] as const;
