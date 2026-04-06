import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessRegisterPage from "./BusinessRegisterPage";

const mockDispatch = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: { user: null, status: "unauthenticated", error: null },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/services/business/businessService", () => ({
  useCreateBusinessMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

async function fillValidBusinessRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^trade name$/i), "Café Demo");
  await user.type(screen.getByLabelText(/^legal name$/i), "Café Demo LLC");
  await user.type(screen.getByLabelText(/^email$/i), "owner@demo.test");
  await user.type(screen.getByLabelText(/^phone number$/i), "+1000000000");
  await user.type(screen.getByLabelText(/^tax number$/i), "TAX-001");
  await user.type(screen.getByLabelText(/^password$/i), "Secret1!a");
  await user.type(screen.getByLabelText(/^confirm password$/i), "Secret1!a");
  await user.type(screen.getByLabelText(/^country$/i), "CH");
  await user.type(screen.getByLabelText(/state \/ region/i), "VD");
  await user.type(screen.getByLabelText(/^city$/i), "Lausanne");
  await user.type(screen.getByLabelText(/^street$/i), "Rue Test");
  await user.type(screen.getByLabelText(/building number/i), "1");
  await user.type(screen.getByLabelText(/post code/i), "1000");
}

describe("BusinessRegisterPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockMutateAsync.mockReset();
    localStorage.clear();
  });

  it("shows field validation when submitting an empty form", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter>
        <BusinessRegisterPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /create business/i }));

    const requiredMsgs = screen.getAllByText(
      /trade name, legal name, email, password, phone, tax number, subscription, currency/i,
    );
    expect(requiredMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it("submits and navigates to business dashboard on success", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        email: "owner@demo.test",
        type: "business",
        emailVerified: false,
        role: "Tenant",
      },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/register"]}>
        <Routes>
          <Route path="/business/register" element={<BusinessRegisterPage />} />
          <Route
            path="/business/:businessId/dashboard"
            element={<div>Business tenant dashboard</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await fillValidBusinessRegistration(user);
    await user.click(screen.getByRole("button", { name: /create business/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText("Business tenant dashboard")).toBeInTheDocument();
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "AUTH_SUCCESS",
      payload: {
        id: "507f1f77bcf86cd799439011",
        email: "owner@demo.test",
        type: "business",
        emailVerified: false,
        role: "Tenant",
      },
    });
  });

  it(
    "shows mutation error in an alert",
    async () => {
      const user = userEvent.setup({ delay: null });
      mockMutateAsync.mockImplementation(() =>
        Promise.reject(new Error("Network down")),
      );

      await renderWithI18n(
        <MemoryRouter initialEntries={["/business/register"]}>
          <Routes>
            <Route path="/business/register" element={<BusinessRegisterPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await fillValidBusinessRegistration(user);
      await user.click(screen.getByRole("button", { name: /create business/i }));

      expect(await screen.findByText("Network down")).toBeInTheDocument();
    },
    15_000,
  );
});
