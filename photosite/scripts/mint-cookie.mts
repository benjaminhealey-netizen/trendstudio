import { signSession } from "../src/lib/auth/session";
console.log(
  await signSession(
    process.env.ADMIN_EMAIL ?? "admin@localhost",
    process.env.SESSION_SECRET ?? "insecure-dev-secret-change-me"
  )
);
