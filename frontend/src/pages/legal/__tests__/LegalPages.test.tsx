import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import PrivacyNoticePage from "../PrivacyNoticePage";
import TermsPage from "../TermsPage";

interface LegalCase {
  name: string;
  path: string;
  element: ReactElement;
  title: string;
  bodyPrefix: string;
  lastUpdated: RegExp;
}

const englishCases: LegalCase[] = [
  {
    name: "privacy notice",
    path: "/legal/privacy",
    element: <PrivacyNoticePage />,
    title: "Privacy notice",
    bodyPrefix: "This privacy notice is a placeholder",
    lastUpdated: /last updated/i,
  },
  {
    name: "account terms",
    path: "/legal/terms",
    element: <TermsPage />,
    title: "Account terms",
    bodyPrefix: "These account terms are a placeholder",
    lastUpdated: /last updated/i,
  },
];

const spanishCases: LegalCase[] = [
  {
    name: "privacy notice",
    path: "/legal/privacy",
    element: <PrivacyNoticePage />,
    title: "Aviso de privacidad",
    bodyPrefix: "Este aviso de privacidad es un marcador de posición",
    lastUpdated: /última actualización/i,
  },
  {
    name: "account terms",
    path: "/legal/terms",
    element: <TermsPage />,
    title: "Términos de la cuenta",
    bodyPrefix: "Estos términos de la cuenta son un marcador de posición",
    lastUpdated: /última actualización/i,
  },
];

function renderLegalPage(legalCase: LegalCase, language?: "es") {
  return renderWithI18n(
    <MemoryRouter initialEntries={[legalCase.path]}>
      <Routes>
        <Route path={legalCase.path} element={legalCase.element} />
      </Routes>
    </MemoryRouter>,
    language ? { language } : undefined,
  );
}

describe("legal pages", () => {
  it.each(englishCases)("renders the English $name", async (legalCase) => {
    await renderLegalPage(legalCase);

    expect(
      screen.getByRole("heading", { level: 1, name: legalCase.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(legalCase.bodyPrefix))).toBeInTheDocument();
    expect(screen.getByText(legalCase.lastUpdated)).toBeInTheDocument();
  });

  it.each(spanishCases)("renders the Spanish $name", async (legalCase) => {
    await renderLegalPage(legalCase, "es");

    expect(
      screen.getByRole("heading", { level: 1, name: legalCase.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(legalCase.bodyPrefix))).toBeInTheDocument();
    expect(screen.getByText(legalCase.lastUpdated)).toBeInTheDocument();
  });
});
