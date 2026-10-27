import type { FormEvent } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BusinessProfileSettingsFormShell,
  BusinessProfileSettingsLoadingCard,
  BusinessProfileSettingsStaticShell,
} from "../BusinessProfileSettingsFormShell";
import type { BusinessProfileSettingsReady } from "@/hooks/useBusinessProfileSettingsController";
import { renderWithI18n } from "@/test/i18nTestUtils";

const { useBusinessProfileSettingsController, useBusinessProfileSettingsGate } =
  vi.hoisted(() => ({
    useBusinessProfileSettingsController: vi.fn(),
    useBusinessProfileSettingsGate: vi.fn(),
  }));

vi.mock("@/hooks/useBusinessProfileSettingsController", () => ({
  useBusinessProfileSettingsController,
  useBusinessProfileSettingsGate,
}));

function readyFormController(): BusinessProfileSettingsReady {
  return {
    kind: "ready",
    businessId: "biz-1",
    profileQuery: {} as BusinessProfileSettingsReady["profileQuery"],
    register: vi.fn() as unknown as BusinessProfileSettingsReady["register"],
    control: {} as BusinessProfileSettingsReady["control"],
    setValue: vi.fn() as unknown as BusinessProfileSettingsReady["setValue"],
    handleSubmit: ((fn: (data: unknown) => void | Promise<void>) =>
      (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void fn({});
      }) as unknown as BusinessProfileSettingsReady["handleSubmit"],
    reset: vi.fn() as unknown as BusinessProfileSettingsReady["reset"],
    isDirty: false,
    errors: {},
    isSubmitted: false,
    isValid: true,
    updateMutation: {
      isPending: false,
    } as BusinessProfileSettingsReady["updateMutation"],
    submitError: null,
    setSubmitError: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    handleResetToLastSaved: vi.fn(),
    handleImageUpload: vi.fn(),
    imagePreviewUrl: null,
    imageUrl: "",
    imageFile: null,
    managementContactRows: [],
    unsavedChangesGuard: {
      isDialogOpen: false,
      shouldGuard: false,
      stayOnPage: vi.fn(),
      leavePage: vi.fn(),
      isLeaving: false,
    },
    navigationBypassAfterSave: false,
    onFormChangeCapture: vi.fn(),
  };
}

describe("BusinessProfileSettingsLoadingCard", () => {
  it("renders default skeleton blocks and action row", async () => {
    const { container } = await renderWithI18n(
      <BusinessProfileSettingsLoadingCard />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe("BusinessProfileSettingsFormShell", () => {
  it("shows loading main when controller is not ready", async () => {
    useBusinessProfileSettingsController.mockReturnValue({ kind: "loading" });

    await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Never</p>}
      </BusinessProfileSettingsFormShell>,
    );

    expect(
      screen.getByRole("status", { name: /loading business profile/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Never")).not.toBeInTheDocument();
  });

  it("renders form and children when controller is ready", async () => {
    useBusinessProfileSettingsController.mockReturnValue(readyFormController());

    await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Form body</p>}
      </BusinessProfileSettingsFormShell>,
    );

    expect(screen.getByText("Form body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reset changes/i })).toBeDisabled();
  });

  it("renders loading, error, and no-data copy in Spanish", async () => {
    useBusinessProfileSettingsController.mockReturnValue({ kind: "loading" });

    const loading = await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Never</p>}
      </BusinessProfileSettingsFormShell>,
      { language: "es" },
    );

    expect(
      screen.getByRole("status", {
        name: "Cargando el perfil del negocio...",
      }),
    ).toBeInTheDocument();
    loading.unmount();

    useBusinessProfileSettingsController.mockReturnValue({
      kind: "error",
      refetch: vi.fn(),
    });

    const error = await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Never</p>}
      </BusinessProfileSettingsFormShell>,
      { language: "es" },
    );

    expect(
      screen.getByRole("heading", { name: "No se pudo cargar el perfil" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Revisa el error y vuelve a intentar cargar el perfil.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No se pudo cargar el perfil del negocio."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    error.unmount();

    useBusinessProfileSettingsController.mockReturnValue({ kind: "no-data" });

    await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Never</p>}
      </BusinessProfileSettingsFormShell>,
      { language: "es" },
    );

    expect(
      screen.getByText(
        "No se devolvieron datos del perfil. Inténtalo de nuevo.",
      ),
    ).toBeInTheDocument();
  });

  it("renders translated save, reset, saving, and validation copy", async () => {
    useBusinessProfileSettingsController.mockReturnValue({
      ...readyFormController(),
      isSubmitted: true,
      isValid: false,
      updateMutation: {
        isPending: true,
      } as BusinessProfileSettingsReady["updateMutation"],
    });

    await renderWithI18n(
      <BusinessProfileSettingsFormShell>
        {() => <p>Form body</p>}
      </BusinessProfileSettingsFormShell>,
      { language: "es" },
    );

    expect(
      screen.getByText("Corrige los campos marcados antes de guardar."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descartar cambios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardando..." }),
    ).toBeInTheDocument();
  });
});

describe("BusinessProfileSettingsStaticShell", () => {
  it("shows loading when gate is not ready", async () => {
    useBusinessProfileSettingsGate.mockReturnValue({ kind: "loading" });

    await renderWithI18n(
      <BusinessProfileSettingsStaticShell>
        {() => <p>Never</p>}
      </BusinessProfileSettingsStaticShell>,
    );

    expect(
      screen.getByRole("status", { name: /loading business profile/i }),
    ).toBeInTheDocument();
  });

  it("renders children when gate is ready", async () => {
    useBusinessProfileSettingsGate.mockReturnValue({
      kind: "ready",
      businessId: "biz-1",
      profile: { id: "p1" } as never,
      profileQuery: {} as never,
    });

    await renderWithI18n(
      <BusinessProfileSettingsStaticShell>
        {() => <p>Static body</p>}
      </BusinessProfileSettingsStaticShell>,
    );

    expect(screen.getByText("Static body")).toBeInTheDocument();
  });
});
