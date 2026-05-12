import { redirect } from "next/navigation";

/**
 * OAuth callback landing page.
 * In production the backend handles /api/auth/callback/github and sets
 * the session cookie, then redirects here. We immediately redirect to
 * /admin so the middleware can validate the freshly-set cookie.
 */
export default function LoginCallback() {
  // Backend handles /api/auth/callback/github and sets the session cookie,
  // then redirects here. We immediately bounce to admin — middleware gates access.
  redirect("/admin");
}
