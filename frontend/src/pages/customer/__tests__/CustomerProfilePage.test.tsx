import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerProfilePage from "../CustomerProfilePage";

const mockGetUserProfile = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockDispatch = vi.fn();
const mockResend = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: { status: "authenticated", user: mockUser(), error: null },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth/api", () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock("@/hooks/useResendEmailConfirmation", () => ({
  useResendEmailConfirmation: () => ({ resend: mockResend, pending: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

let unverified = false;

function mockUser() {
  return {
    id: "u1",
    email: "u@test.local",
    type: "user" as const,
    role: "Customer",
    emailVerified: unverified ? false : true,
    languagePreference: "en" as const,
  };
}

const profile = {
  _id: "u1",
  personalDetails: {
    email: "u@test.local",
    username: "pat",
    firstName: "Pat",
    lastName: "Lee",
    phoneNumber: "5551234",
    birthDate: "1990-01-01T00:00:00.000Z",
    gender: "Woman",
    nationality: "USA",
    address: {
      country: "USA",
      state: "CA",
      city: "Los Angeles",
      street: "Main St",
      buildingNumber: "123",
      postCode: "90001",
    },
  },
  languagePreference: "en" as const,
};

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={["/u1/customer/profile"]}>
      <Routes>
        <Route path="/:userId/customer/profile" element={<CustomerProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CustomerProfilePage", () => {
  beforeEach(() => {
    unverified = false;
    mockGetUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    mockDispatch.mockReset();
    mockResend.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    mockGetUserProfile.mockResolvedValue({ ok: true, data: profile });
  });

  it("loads the self profile with a read-only sign-in email and editable fields", async () => {
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Profile" }),
    ).toBeInTheDocument();
    const email = await screen.findByLabelText("Sign-in email");
    expect(email).toHaveValue("u@test.local");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByLabelText("First name")).toHaveValue("Pat");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lee");
    expect(screen.getByLabelText("Phone number")).toHaveValue("5551234");
    expect(screen.getByLabelText("Birth date")).toHaveValue("1990-01-01");
    expect(screen.getByLabelText("Country")).toHaveValue("USA");
    expect(mockGetUserProfile).toHaveBeenCalledWith("u1");
  });

  it("saves edited profile fields and language as multipart", async () => {
    const user = userEvent.setup();
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, firstName: "Updated" },
          languagePreference: "es",
        },
      },
    });

    await renderPage();
    const firstName = await screen.findByLabelText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Updated");

    await user.click(screen.getByLabelText("Language"));
    await user.click(await screen.findByRole("option", { name: "Español" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [, languageData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(languageData.get("languagePreference")).toBe("es");
    expect(languageData.get("firstName")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(2);
    });
    const [userId, formData] = mockUpdateUserProfile.mock.calls[1] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect(formData.get("firstName")).toBe("Updated");
    expect(formData.get("languagePreference")).toBe("es");
    expect(JSON.parse(String(formData.get("address")))).toMatchObject({
      country: "USA",
      postCode: "90001",
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Your profile has been saved.");
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "AUTH_SUCCESS",
      payload: expect.objectContaining({ languagePreference: "es" }),
    });
  });

  it("resends email confirmation for an unverified signed-in user", async () => {
    unverified = true;
    const user = userEvent.setup();
    mockResend.mockResolvedValue(undefined);

    await renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Resend confirmation email",
      }),
    );

    expect(mockResend).toHaveBeenCalledTimes(1);
  });
});
