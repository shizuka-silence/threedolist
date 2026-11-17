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
    if (!error) return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  const message = encodeURIComponent("Reset link is invalid or expired. Request a new one.");
  return NextResponse.redirect(new URL(`/forgot-password?error=${message}`, request.url));
}
