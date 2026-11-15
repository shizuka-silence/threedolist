import { Button } from "@/components/ui/button";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">ThreeDoList</h1>
      <form className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          minLength={6}
          required
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        <Button type="submit" formAction={signIn} size="lg">Sign in</Button>
        <Button type="submit" formAction={signUp} size="lg" variant="outline">Sign up</Button>
      </form>
    </main>
  );
}
