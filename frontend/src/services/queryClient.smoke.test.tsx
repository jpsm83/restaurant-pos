import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

function QueryProbe() {
  const { data, isPending } = useQuery({
    queryKey: ["smoke", "probe"],
    queryFn: async () => "ok",
  });
  if (isPending) return <div>loading</div>;
  return <div>{data}</div>;
}

describe("QueryClientProvider (Phase 0.4 smoke)", () => {
  it("runs a query under a fresh QueryClient", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <QueryProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("ok")).toBeInTheDocument();
    });
  });
});
