import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="h-dvh flex flex-col items-center gap-6 text-4xl p-4">
      <h1>Restaurante POS</h1>
      <Button asChild>
        Sign In
      </Button>
    </main>
  );
}
