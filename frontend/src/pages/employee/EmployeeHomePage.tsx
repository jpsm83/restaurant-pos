import { useParams } from "react-router-dom";

/** `/:userId/employee` index — home view; chrome is `EmployeeLayout`. */
export default function EmployeeHomePage() {
  const { userId } = useParams();

  return (
    <main className="min-h-0 flex-1 p-6">
      <h1 className="text-xl font-semibold text-neutral-900">Employee home</h1>
      <p className="mt-2 text-sm text-neutral-600">
        User <span className="font-mono">{userId}</span> — POS navigation in later phases.
      </p>
    </main>
  );
}
