import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { env } from "./env.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.use(
  "/api/auth/*",
  cors({
    origin: [env.webOrigin, env.betterAuthUrl],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.all("/api/auth/oauth2/authorize", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.searchParams.get("prompt") !== "login" || url.searchParams.get("fresh_login") === "1") {
    return next();
  }

  url.searchParams.delete("prompt");
  url.searchParams.set("fresh_login", "1");

  const response = c.redirect(url.toString(), 302);
  const signOutResponse = await auth.api.signOut({ headers: c.req.raw.headers }).catch(() => null);
  const setCookie = signOutResponse instanceof Response ? signOutResponse.headers.get("set-cookie") : null;
  if (setCookie) response.headers.append("set-cookie", setCookie);

  for (const cookieName of ["better-auth.session_token", "__Secure-better-auth.session_token"]) {
    response.headers.append(
      "set-cookie",
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${env.betterAuthUrl.startsWith("https://") ? "; Secure" : ""}`,
    );
  }

  return response;
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.on(["GET", "POST"], "/api/auth/.well-known/*", (c) => auth.handler(c.req.raw));
app.on(["GET", "POST"], "/.well-known/*", (c) => auth.handler(c.req.raw));

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`auth api listening on http://127.0.0.1:${info.port}`);
  },
);
