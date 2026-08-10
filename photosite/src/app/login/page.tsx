import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { SESSION_COOKIE, safeEqual, sessionCookieOptions, signSession } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/") || "/";

    const ok =
      safeEqual(email.toLowerCase(), config.adminEmail.toLowerCase()) &&
      safeEqual(password, config.adminPassword);

    if (!ok) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);

    const token = await signSession(email, config.sessionSecret);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    // Only ever bounce to a path on this app, never to an absolute URL.
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={login} className="card w-full max-w-sm">
        <h1 className="mb-1 text-lg font-medium">PhotoSite Manager</h1>
        <p className="mb-6 text-sm text-[var(--color-mist)]">Operator sign in.</p>

        {params.error ? (
          <p className="mb-4 rounded-md border border-[#5c2626] bg-[#2a1414] px-3 py-2 text-sm text-[#f19393]">
            Those details did not match.
          </p>
        ) : null}

        <input type="hidden" name="next" value={params.next ?? "/"} />
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="username" className="field mb-4" />
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field mb-6"
        />
        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
      </form>
    </main>
  );
}
