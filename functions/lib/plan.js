export const FREE_SUBSCRIPTION_LIMIT = 5;

export const normalizePlan = (value) => (value === "pro" ? "pro" : "free");

export const planFeatures = (plan) => {
  const normalized = normalizePlan(plan);
  return {
    plan: normalized,
    subscriptionLimit: normalized === "pro" ? null : FREE_SUBSCRIPTION_LIMIT,
    csv: normalized === "pro",
    sync: normalized === "pro",
    subscriptionReview: normalized === "pro",
  };
};
