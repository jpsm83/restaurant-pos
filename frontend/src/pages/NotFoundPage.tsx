import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Fallback for unknown routes (add a catch-all route in App when ready). */
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-100">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <Info className="h-16 w-16 text-neutral-500" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Page not found</CardTitle>
            <CardDescription className="mt-2 text-base">
              The page you are looking for does not exist or was moved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(-1)} className="w-full">
              Go back
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
