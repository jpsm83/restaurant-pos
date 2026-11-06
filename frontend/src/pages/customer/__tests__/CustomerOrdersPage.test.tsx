import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerOrdersPage from "../CustomerOrdersPage";

function renderOrdersPage(language?: "en" | "es") {
  return renderWithI18n(
    <MemoryRouter initialEntries={["/account/orders"]}>
      <Routes>
        <Route path="/account/orders" element={<CustomerOrdersPage />} />
      </Routes>
    </MemoryRouter>,
    { language },
  );
}

describe("CustomerOrdersPage", () => {
  it("renders the Orders heading and the not-built-yet state", async () => {
    await renderOrdersPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This page is not built yet."),
    ).toBeInTheDocument();
  });

  it("localizes the Orders heading and not-built-yet state", async () => {
    await renderOrdersPage("es");

    expect(
      screen.getByRole("heading", { level: 1, name: "Pedidos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Esta página aún no está disponible."),
    ).toBeInTheDocument();
  });
});
