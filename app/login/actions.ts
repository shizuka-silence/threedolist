"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/auth-rules";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData) {
  return { email: String(formData.get("email")), password: String(formData.get("password")) };
}

function backToLogin(key: "error" | "message", text: string, path = "/login"): never {
  redirect(`${path}?${key}=${encodeURIComponent(text)}`);
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(readCredentials(formData));
  if (error) backToLogin("error", error.message);
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(readCredentials(formData));
  if (error) backToLogin("error", error.message);
  // No session means Supabase is waiting for the user to confirm their email.
  if (!data.session) backToLogin("message", "Check your email to confirm your account, then sign in.");
  redirect("/");
}

// Same reply whether or not the email has an account, so this can't be used to probe for accounts.
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(String(formData.get("email")));
  if (error) console.error("Password reset request failed", error.message);
  backToLogin("message", "If that email has an account, a reset link is on its way.", "/forgot-password");
}

// The recovery link (app/auth/confirm/route.ts) signs the user in; this sets the new password on that session.
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password"));
  const problem = validateNewPassword(password, String(formData.get("confirm")));
  if (problem) backToLogin("error", problem, "/reset-password");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) backToLogin("error", "Reset link expired. Request a new one.", "/forgot-password");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) backToLogin("error", error.message, "/reset-password");
  redirect("/");
}

// Google sends the user back to /auth/confirm?code=..., which finishes the sign-in.
export async function signInWithGoogle() {
  const origin = (await headers()).get("origin"); // server actions are POSTs, so the browser always sends Origin
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/confirm` },
  });
  if (error || !data.url) backToLogin("error", error?.message ?? "Google sign-in failed. Try again.");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
