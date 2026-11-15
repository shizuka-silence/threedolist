"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData) {
  return { email: String(formData.get("email")), password: String(formData.get("password")) };
}

function backToLogin(key: "error" | "message", text: string): never {
  redirect(`/login?${key}=${encodeURIComponent(text)}`);
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
