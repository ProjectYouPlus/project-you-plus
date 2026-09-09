import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrationSecret, saveIntegrationSecret } from "@/lib/integrations/secrets";
import { getPlaidAccounts, getPlaidHoldings, syncPlaidTransactions } from "@/lib/integrations/plaid";

type PlaidSecret = { access_token: string; item_id: string; transaction_cursor?: string | null };

export async function syncPlaidForUser(userId: string) {
  const secret = await getIntegrationSecret<PlaidSecret>(userId, "plaid");
  if (!secret?.access_token) throw new Error("Plaid connection is missing its access token");
  const admin = createAdminClient();
  const accountResponse = await getPlaidAccounts(secret.access_token);
  const accountMap = new Map<string, string>();

  for (const account of accountResponse.accounts ?? []) {
    const accountType = mapAccountType(account.type, account.subtype);
    const rawBalance = Number(account.balances?.current ?? 0);
    const balance = accountType === "credit" ? -Math.abs(rawBalance) : rawBalance;
    const { data: existing } = await admin.from("finance_accounts").select("id").eq("user_id", userId).eq("connected_via", "plaid").eq("provider_account_id", account.account_id).maybeSingle();
    const payload = {
      user_id: userId,
      name: account.official_name || account.name,
      account_type: accountType,
      balance,
      institution: null,
      connected_via: "plaid",
      provider_account_id: account.account_id,
      mask: account.mask ?? null,
      last_synced_at: new Date().toISOString(),
    };
    if (existing?.id) {
      await admin.from("finance_accounts").update(payload).eq("id", existing.id);
      accountMap.set(account.account_id, existing.id);
    } else {
      const { data: inserted, error } = await admin.from("finance_accounts").insert(payload).select("id").single();
      if (error) throw error;
      accountMap.set(account.account_id, inserted.id);
    }
  }

  try {
    const transactionSync = await syncPlaidTransactions(secret.access_token, secret.transaction_cursor ?? null);
    for (const removed of transactionSync.removed) await admin.from("transactions").delete().eq("user_id", userId).eq("provider_transaction_id", removed.transaction_id);
    for (const transaction of [...transactionSync.added, ...transactionSync.modified]) {
      const amount = -Number(transaction.amount || 0);
      const { data: existing } = await admin.from("transactions").select("id").eq("user_id", userId).eq("provider_transaction_id", transaction.transaction_id).maybeSingle();
      const payload = {
        user_id: userId,
        account_id: accountMap.get(transaction.account_id) ?? null,
        amount,
        category: transaction.category?.[0] ?? null,
        merchant: transaction.merchant_name || transaction.name || null,
        occurred_at: new Date(`${transaction.date}T12:00:00`).toISOString(),
        provider_transaction_id: transaction.transaction_id,
        pending: Boolean(transaction.pending),
      };
      if (existing?.id) await admin.from("transactions").update(payload).eq("id", existing.id);
      else await admin.from("transactions").insert(payload);
    }
    secret.transaction_cursor = transactionSync.nextCursor;
  } catch (error) {
    console.warn("Plaid transaction sync not ready:", error);
  }

  try {
    const holdings = await getPlaidHoldings(secret.access_token);
    const securities = new Map((holdings.securities ?? []).map((security) => [security.security_id, security]));
    await admin.from("investment_holdings").delete().eq("user_id", userId).eq("provider", "plaid");
    const rows = (holdings.holdings ?? []).map((holding) => {
      const security = securities.get(holding.security_id);
      return {
        user_id: userId,
        account_id: accountMap.get(holding.account_id) ?? null,
        provider: "plaid",
        provider_security_id: holding.security_id,
        ticker: security?.ticker_symbol ?? null,
        name: security?.name || security?.ticker_symbol || "Investment",
        quantity: Number(holding.quantity || 0),
        price: Number(holding.institution_price || 0),
        value: Number(holding.institution_value || 0),
        as_of: new Date().toISOString(),
      };
    });
    if (rows.length) await admin.from("investment_holdings").insert(rows);
  } catch (error) {
    console.warn("Plaid investment holdings sync not available:", error);
  }

  await saveIntegrationSecret(userId, "plaid", secret);
  await admin.from("integrations").upsert({ user_id: userId, provider: "plaid", status: "connected", connected_at: new Date().toISOString(), metadata: { item_id: secret.item_id, last_synced_at: new Date().toISOString(), environment: process.env.PLAID_ENV || "sandbox" } }, { onConflict: "user_id,provider" });
  return { accounts: accountMap.size };
}

function mapAccountType(type: string, subtype?: string | null) {
  if (type === "investment" || type === "brokerage") return "investment";
  if (type === "credit") return "credit";
  if (subtype === "checking") return "checking";
  if (subtype === "savings" || subtype === "money market") return "savings";
  if (type === "depository") return "checking";
  return "other";
}
