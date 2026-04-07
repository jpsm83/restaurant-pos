import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { BusinessAddressLocationMap } from "../BusinessAddressLocationMap";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ setView: vi.fn() }),
}));

describe("BusinessAddressLocationMap", () => {
  it("renders map region and OSM footer notice for empty query", async () => {
    await renderWithI18n(
      <BusinessAddressLocationMap addressQuery="   " />,
    );
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(
      screen.getByText(/OpenStreetMap contributors/i),
    ).toBeInTheDocument();
  });

  it("shows short-query hint when address is non-empty but below minimum length", async () => {
    await renderWithI18n(<BusinessAddressLocationMap addressQuery="ab" />);
    expect(
      screen.getByText(/Add a bit more address detail/i),
    ).toBeInTheDocument();
  });
});
