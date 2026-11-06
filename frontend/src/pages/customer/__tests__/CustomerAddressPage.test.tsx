import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerAddressPage from "../CustomerAddressPage";

const mockGetUserProfile = vi.fn();
const mockUpdateUserProfile = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "u@test.local",
        type: "user",
        role: "Customer",
        languagePreference: "en",
      },
      error: null,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock("@/auth/api", () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

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
      additionalDetails: "Gate code 1234",
      coordinates: [-118.24, 34.05],
    },
  },
  languagePreference: "en" as const,
};

const ADDRESS_FIELDS = [
  "Country",
  "State",
  "City",
  "Street",
  "Building number",
  "Door / unit number",
  "Complement",
  "Post code",
  "Region",
  "Additional details",
];

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={["/account/address"]}>
      <Routes>
        <Route path="/account/address" element={<CustomerAddressPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CustomerAddressPage", () => {
  beforeEach(() => {
    mockGetUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    toastSuccess.mockReset();
    mockGetUserProfile.mockResolvedValue({ ok: true, data: profile });
  });

  it("loads the current address", async () => {
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Address" }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("Country")).toHaveValue("USA");
    expect(screen.getByLabelText("State")).toHaveValue("CA");
    expect(screen.getByLabelText("City")).toHaveValue("Los Angeles");
    expect(screen.getByLabelText("Street")).toHaveValue("Main St");
    expect(screen.getByLabelText("Building number")).toHaveValue("123");
    expect(screen.getByLabelText("Post code")).toHaveValue("90001");
    expect(screen.getByLabelText("Additional details")).toHaveValue(
      "Gate code 1234",
    );
    expect(
      screen.queryByRole("textbox", { name: /coordinates/i }),
    ).not.toBeInTheDocument();
    expect(mockGetUserProfile).toHaveBeenCalledWith("u1");
  });

  it("saves only the address through the self-only profile update", async () => {
    const user = userEvent.setup();
    const updatedAddress = {
      ...profile.personalDetails.address,
      street: "Second St",
      additionalDetails: "Use the side gate\nRing twice",
    };
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: {
            ...profile.personalDetails,
            address: updatedAddress,
          },
        },
      },
    });

    await renderPage();
    const street = await screen.findByLabelText("Street");
    await user.clear(street);
    await user.type(street, "Second St");
    const additionalDetails = screen.getByLabelText("Additional details");
    await user.clear(additionalDetails);
    await user.type(
      additionalDetails,
      "<b>Use the side gate</b>{enter}Ring twice",
    );
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [userId, formData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(userId).toBe("u1");
    expect([...formData.keys()]).toEqual(["address"]);
    expect(JSON.parse(String(formData.get("address")))).toMatchObject({
      country: "USA",
      street: "Second St",
      postCode: "90001",
      additionalDetails: "Use the side gate\nRing twice",
      coordinates: [-118.24, 34.05],
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Your address has been saved.");
    });
  });

  it("clears the address when every field is emptied", async () => {
    const user = userEvent.setup();
    mockUpdateUserProfile.mockResolvedValue({
      ok: true,
      data: {
        message: "User updated successfully!",
        user: {
          ...profile,
          personalDetails: { ...profile.personalDetails, address: undefined },
        },
      },
    });

    await renderPage();

    for (const label of ADDRESS_FIELDS) {
      await user.clear(await screen.findByLabelText(label));
    }
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledTimes(1);
    });
    const [, formData] = mockUpdateUserProfile.mock.calls[0] as [
      string,
      FormData,
    ];
    expect(formData.get("address")).toBe("");
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Your address has been cleared.",
      );
    });
  });

  it("requires a complete address or a full clear", async () => {
    const user = userEvent.setup();

    await renderPage();
    const postCode = await screen.findByLabelText("Post code");
    await user.clear(postCode);
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Complete the country, state, city, street, building number, and post code, or clear every address field.",
    );
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });
});
