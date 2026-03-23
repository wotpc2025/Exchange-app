const PAGE_POLICIES = [
  { pattern: /^\/admin(?:\/|$)/, role: "admin" },
  { pattern: /^\/profile(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/my-items(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/add-item(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/requests(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/support(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/chat(?:\/|$)/, role: "authenticated" },
  { pattern: /^\/notifications(?:\/|$)/, role: "authenticated" },
];

const API_POLICIES = [
  { pattern: /^\/api\/auth(?:\/|$)/, methods: ["*"], role: "public" },
  { pattern: /^\/api\/admin(?:\/|$)/, methods: ["*"], role: "admin" },

  { pattern: /^\/api\/notifications(?:\/|$)/, methods: ["*"], role: "authenticated" },
  { pattern: /^\/api\/user(?:\/|$)/, methods: ["*"], role: "authenticated" },
  { pattern: /^\/api\/support(?:\/|$)/, methods: ["*"], role: "authenticated" },
  { pattern: /^\/api\/chat(?:\/|$)/, methods: ["*"], role: "authenticated" },
  { pattern: /^\/api\/users(?:\/|$)/, methods: ["*"], role: "authenticated" },
  { pattern: /^\/api\/requests(?:\/|$)/, methods: ["*"], role: "authenticated" },

  { pattern: /^\/api\/items(?:\/|$)/, methods: ["POST", "PUT", "PATCH", "DELETE"], role: "authenticated" },
  { pattern: /^\/api\/items(?:\/|$)/, methods: ["GET"], role: "public" },
];

function methodMatches(policyMethods, method) {
  if (!Array.isArray(policyMethods) || !policyMethods.length) return true;
  if (policyMethods.includes("*")) return true;
  return policyMethods.includes(String(method || "GET").toUpperCase());
}

function findMatchingPolicy(policies, pathname, method) {
  for (const policy of policies) {
    if (!policy?.pattern?.test(pathname)) continue;
    if (!methodMatches(policy.methods, method)) continue;
    return policy;
  }
  return null;
}

export function resolveAccessPolicy(pathname, method) {
  if (!pathname || typeof pathname !== "string") return null;

  if (pathname.startsWith("/api/")) {
    const apiPolicy = findMatchingPolicy(API_POLICIES, pathname, method);
    return apiPolicy || null;
  }

  const pagePolicy = findMatchingPolicy(PAGE_POLICIES, pathname, method);
  return pagePolicy || null;
}

export const ACCESS_ROLE = {
  PUBLIC: "public",
  AUTHENTICATED: "authenticated",
  ADMIN: "admin",
};
