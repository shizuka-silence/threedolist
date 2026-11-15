import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and sends logged-out visitors to /login.
// Self-contained on purpose: proxy shouldn't depend on shared modules.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!user && !isLoginPage) return NextResponse.redirect(new URL("/login", request.url));
  if (user && isLoginPage) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  // Skip static assets and the triage webhook (it uses its own Bearer token, not a session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/webhooks|api/triage|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
