type PlaidAccount = {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current?: number | null; available?: number | null; iso_currency_code?: string | null };
};

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  merchant_name?: string | null;
  name?: string | null;
  category?: string[] | null;
  date: string;
  pending: boolean;
};

type PlaidHolding = {
  account_id: string;
  security_id: string;
  quantity: number;
  institution_price: number;
  institution_value: number;
};

type PlaidSecurity = { security_id: string; ticker_symbol?: string | null; name?: string | null };

export function isPlaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export async function createPlaidLinkToken(userId: string) {
  const products = (process.env.PLAID_PRODUCTS || "transactions,investments").split(",").map((item) => item.trim()).filter(Boolean);
  return plaidRequest<{ link_token: string; expiration: string }>("/link/token/create", {
    user: { client_user_id: userId },
    client_name: "Project You+",
    products,
    country_codes: ["US"],
    language: "en",
    ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
  });
}

export async function exchangePlaidPublicToken(publicToken: string) {
  return plaidRequest<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
}

export async function getPlaidAccounts(accessToken: string) {
  return plaidRequest<{ accounts: PlaidAccount[]; item: { institution_id?: string | null } }>("/accounts/get", { access_token: accessToken });
}

export async function syncPlaidTransactions(accessToken: string, initialCursor?: string | null) {
  let cursor = initialCursor || undefined;
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: Array<{ transaction_id: string }> = [];
  let hasMore = true;
  let pages = 0;
  while (hasMore && pages < 20) {
    const page = await plaidRequest<{ added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: Array<{ transaction_id: string }>; next_cursor: string; has_more: boolean }>("/transactions/sync", { access_token: accessToken, ...(cursor ? { cursor } : {}) });
    added.push(...(page.added ?? []));
    modified.push(...(page.modified ?? []));
    removed.push(...(page.removed ?? []));
    cursor = page.next_cursor;
    hasMore = page.has_more;
    pages += 1;
  }
  return { added, modified, removed, nextCursor: cursor ?? null };
}

export async function getPlaidHoldings(accessToken: string) {
  return plaidRequest<{ accounts: PlaidAccount[]; holdings: PlaidHolding[]; securities: PlaidSecurity[] }>("/investments/holdings/get", { access_token: accessToken });
}

async function plaidRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new Error("Plaid is not configured");
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
    cache: "no-store",
  });
  const data = await response.json() as T & { error_message?: string; error_code?: string };
  if (!response.ok || data.error_code) throw new Error(`Plaid ${data.error_code ?? response.status}: ${data.error_message ?? "request failed"}`);
  return data;
}

function plaidBaseUrl() {
  const env = process.env.PLAID_ENV || "sandbox";
  if (env === "production") return "https://production.plaid.com";
  if (env === "development") return "https://development.plaid.com";
  return "https://sandbox.plaid.com";
}

export type { PlaidAccount, PlaidTransaction, PlaidHolding, PlaidSecurity };
