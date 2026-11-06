import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerProfilePage from "../CustomerProfilePage";

const mockGetUserProfile = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockDeleteUserPhoto = vi.fn();
const mockDispatch = vi.fn();
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
  deleteUserPhoto: (...args: unknown[]) => mockDeleteUserPhoto(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

let unverified = false;
let googleLinked = false;
let passwordPresent = true;

function mockUser() {
  return {
    id: "u1",
    email: "u@test.local",
    type: "user" as const,
    role: "Customer",
    emailVerified: unverified ? false : true,
    languagePreference: "en" as const,
    hasGoogleIdentity: googleLinked,
    hasPassword: passwordPresent,
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
    <MemoryRouter initialEntries={["/account/profile"]}>
      <Routes>
        <Route path="/account/profile" element={<CustomerProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CustomerProfilePage", () => {
  beforeEach(() => {
    unverified = false;
    googleLinked = false;
    passwordPresent = true;
    mockGetUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    mockDeleteUserPhoto.mockReset();
    mockDispatch.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    mockGetUserProfile.mockResolvedValue({ ok: true, data: profile });
  });

  it("loads the self profile's editable personal details", async () => {
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Profile" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Pat");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lee");
    expect(screen.getByLabelText("Phone number")).toHaveValue("5551234");
    expect(screen.getByLabelText("Birth date")).toHaveValue("1990-01-01");
    expect(screen.queryByLabelText("Country")).not.toBeInTheDocument();
    expect(mockGetUserProfile).toHaveBeenCalledWith("u1");
  });

  it("does not duplicate the sign-in email or verification controls", async () => {
    unverified = true;
    await renderPage();

    await screen.findByLabelText("First name");
    expect(screen.queryByLabelText("Sign-in email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change sign-in email" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm your email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resend confirmation email" }),
    ).not.toBeInTheDocument();
  });

  it("does not render a language control", async () => {
    await renderPage();

    await screen.findByLabelText("First name");
    expect(screen.queryByLabelText("Language")).not.toBeInTheDocument();
  });

  it("renders the stored profile photo", async () => {
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        personalDetails: {
          ...profile.personalDetails,
          imageUrl: "https://lh3.googleusercontent.com/a/avatar.png",
        },
      },
    });

    await renderPage();

    expect(
      await screen.findByRole("img", { name: "Your profile photo" }),
    ).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/avatar.png",
    );
  });

  it("shows initials when the profile has no stored photo", async () => {
    await renderPage();

    expect(
      await screen.findByRole("img", { name: "Your profile photo" }),
    ).toHaveTextContent("PL");
  });

  it("updates the session avatar when a profile save returns a new photo", async () => {
    const user = userEvent.setup();
    const imageUrl = "https://cdn.example.com/new-avatar.png";
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, imageUrl },
        },
      },
    });

    await renderPage();
    await screen.findByLabelText("First name");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "AUTH_SUCCESS",
        payload: expect.objectContaining({ imageUrl }),
      });
    });
  });

  it("saves edited profile fields as multipart without a language field", async () => {
    const user = userEvent.setup();
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, firstName: "Updated" },
        },
      },
    });

    await renderPage();
    const firstName = await screen.findByLabelText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Updated");

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [userId, formData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect(formData.get("firstName")).toBe("Updated");
    expect(formData.get("languagePreference")).toBeNull();
    expect(formData.get("address")).toBeNull();
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Your profile has been saved.");
    });
  });

  it("removes the stored photo, clears the session avatar, and shows initials", async () => {
    const user = userEvent.setup();
    const imageUrl = "https://res.cloudinary.com/demo/image/upload/avatar.jpg";
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        personalDetails: { ...profile.personalDetails, imageUrl },
      },
    });
    mockDeleteUserPhoto.mockResolvedValue({
      ok: true,
      data: {
        message: "Profile photo removed successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, imageUrl: undefined },
        },
      },
    });

    await renderPage();
    await screen.findByRole("img", { name: "Your profile photo" });
    await user.click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() => {
      expect(mockDeleteUserPhoto).toHaveBeenCalledWith("u1");
    });
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "AUTH_SUCCESS",
        payload: expect.objectContaining({ imageUrl: undefined }),
      });
    });
    expect(
      screen.queryByRole("button", { name: "Remove photo" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: "Your profile photo" }),
    ).toHaveTextContent("PL");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Your profile photo has been removed.",
    );
  });

  it("keeps the stored photo and shows a localized error when removal fails", async () => {
    const user = userEvent.setup();
    const imageUrl = "https://res.cloudinary.com/demo/image/upload/avatar.jpg";
    mockGetUserProfile.mockResolvedValue({
      ok: true,
      data: {
        ...profile,
        personalDetails: { ...profile.personalDetails, imageUrl },
      },
    });
    mockDeleteUserPhoto.mockResolvedValue({
      ok: false,
      error: { code: "profilePhotoDelete.badRequest", status: 400 },
    });

    await renderPage();
    await screen.findByRole("img", { name: "Your profile photo" });
    await user.click(screen.getByRole("button", { name: "Remove photo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't remove your profile photo. Try again.",
    );
    expect(
      await screen.findByRole("img", { name: "Your profile photo" }),
    ).toHaveAttribute("src", imageUrl);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
