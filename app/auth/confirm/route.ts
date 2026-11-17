import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the password-reset email link. Works from any browser (token_hash, not a PKCE code).
// The destination is hardcoded so the link can't be used as an open redirect.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return redirectTo("/reset-password");
  }
  const message = encodeURIComponent("Reset link is invalid or expired. Request a new one.");
  return redirectTo(`/forgot-password?error=${message}`);
}

// Relative Location on purpose: on Netlify request.url can be the per-deploy host, and the session
// cookie we just set belongs to the host the user actually visited. The browser resolves it correctly.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
