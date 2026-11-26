import { dayInTimeZone } from "../../billing-calendar.js";
import { usd } from "../../money.js";

const parseDate = (value, timeZone) => {
  if (!value) return null;
  const date = new Date(Number.isFinite(Number(value)) ? Number(value) * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : dayInTimeZone(date, timeZone);
};

export const stripeTransactions = async (secretKey, timeZone) => {
  const transactions = [];
  let url = "https://api.stripe.com/v1/balance_transactions?limit=100&type=charge";
  while (url) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Stripe-Version": "2024-06-20",
        },
      });
    } catch (error) {
      throw new Error(`stripe_network_error: ${error?.message || "fetch_failed"}`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let error = {};
      try { error = JSON.parse(body); } catch {}
      throw new Error(error.error?.message || `stripe_request_failed_${response.status}`);
    }
    const data = await response.json();
    for (const item of data.data || []) {
      transactions.push({
        date: parseDate(item.created, timeZone),
        source: "stripe",
        amount: usd(item.amount || 0),
        platformFee: usd(item.fee || 0),
        client: item.description || "",
        externalRef: item.id,
      });
    }
    url = data.has_more ? `${url}&starting_after=${data.data[data.data.length - 1].id}` : null;
  }
  return transactions;
};
