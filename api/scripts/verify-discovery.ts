import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// curl supplies the public response body on stdin after checking the HTTP status.
const issuer = "https://auth.szarans.ca/api/auth";
const discovery = JSON.parse(readFileSync(0, "utf8"));
assert.equal(discovery.issuer, issuer, "Unexpected OIDC issuer");
for (const [field, path] of Object.entries({
  authorization_endpoint: "/oauth2/authorize",
  token_endpoint: "/oauth2/token",
  userinfo_endpoint: "/oauth2/userinfo",
  jwks_uri: "/jwks",
})) {
  assert.equal(discovery[field], `${issuer}${path}`, `Unexpected ${field}`);
}
for (const [field, required] of Object.entries({
  response_types_supported: "code",
  subject_types_supported: "public",
  id_token_signing_alg_values_supported: "EdDSA",
  scopes_supported: "openid",
  code_challenge_methods_supported: "S256",
})) {
  assert.ok(Array.isArray(discovery[field]) && discovery[field].includes(required), `Invalid ${field}`);
}
console.log(`Valid OIDC discovery JSON; issuer: ${discovery.issuer}`);
