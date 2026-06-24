CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauthClient" (
  "id" text PRIMARY KEY NOT NULL,
  "clientId" text NOT NULL UNIQUE,
  "clientSecret" text,
  "disabled" boolean,
  "skipConsent" boolean,
  "enableEndSession" boolean,
  "subjectType" text,
  "scopes" text[],
  "userId" text REFERENCES "user"("id") ON DELETE cascade,
  "referenceId" text,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone DEFAULT now(),
  "name" text,
  "uri" text,
  "icon" text,
  "contacts" text[],
  "tos" text,
  "policy" text,
  "softwareId" text,
  "softwareVersion" text,
  "softwareStatement" text,
  "redirectUris" text[] NOT NULL,
  "postLogoutRedirectUris" text[],
  "tokenEndpointAuthMethod" text,
  "grantTypes" text[],
  "responseTypes" text[],
  "public" boolean,
  "type" text,
  "requirePKCE" boolean,
  "metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE cascade,
  "sessionId" text REFERENCES "session"("id") ON DELETE set null,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "referenceId" text,
  "scopes" text[] NOT NULL,
  "revoked" timestamp with time zone,
  "authTime" timestamp with time zone,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauthAccessToken" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL UNIQUE,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE cascade,
  "sessionId" text REFERENCES "session"("id") ON DELETE set null,
  "refreshId" text REFERENCES "oauthRefreshToken"("id") ON DELETE cascade,
  "userId" text REFERENCES "user"("id") ON DELETE cascade,
  "referenceId" text,
  "scopes" text[] NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "expiresAt" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauthConsent" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE cascade,
  "referenceId" text,
  "scopes" text[] NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_consent_user_client_reference_idx"
ON "oauthConsent" ("userId", "clientId", "referenceId");
