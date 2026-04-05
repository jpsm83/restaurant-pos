import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { geocoders } from "leaflet-control-geocoder";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: L.LatLngTuple = [20, 0];
const DEFAULT_ZOOM = 2;
const PIN_ZOOM = 16;
/** After the first geocode run for this mount, wait this long before the next one when `query` changes. */
const GEOCODE_DEBOUNCE_MS = 3000;
/** Nominatim needs a minimal string; short saved values (e.g. city + country) still geocode. */
const MIN_QUERY_LEN = 3;

/** Nominatim via leaflet-control-geocoder (OSM; respect usage policy for production). */
const nominatimGeocoder = geocoders.nominatim();

const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapViewSync({
  center,
  zoom,
}: {
  center: L.LatLngTuple;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

type GeocodeMapState = {
  position: L.LatLngTuple | null;
  geoHint: string | null;
  /** True while `query` is geocodable and we have not finished geocoding it yet (debounce + request). */
  isMapLoading: boolean;
};

/** Nominatim geocode + map UI state for a trimmed address string. */
function useGeocodeMapState(
  query: string,
  t: TFunction<"business">,
): GeocodeMapState {
  const [position, setPosition] = useState<L.LatLngTuple | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [settledQuery, setSettledQuery] = useState<string | null>(null);

  const isMapLoading = query.length >= MIN_QUERY_LEN && query !== settledQuery;

  useDebounce(
    [query],
    ({ cancelled }) => {
      void nominatimGeocoder.geocode(query).then(
        (results) => {
          if (cancelled) return;
          const first = results[0];
          if (first?.center) {
            const { lat, lng } = first.center;
            setPosition([lat, lng]);
            setGeoHint(null);
          } else {
            setPosition(null);
            setGeoHint(t("addressMap.geoNotFound"));
          }
          setSettledQuery(query);
        },
        () => {
          if (cancelled) return;
          setPosition(null);
          setGeoHint(t("addressMap.geoFailed"));
          setSettledQuery(query);
        },
      );
    },
    {
      debounceMs: GEOCODE_DEBOUNCE_MS,
      leadingDelayMs: 0,
      active: query.length >= MIN_QUERY_LEN,
      onInactive: () => {
        setPosition(null);
        setGeoHint(null);
        setSettledQuery(null);
      },
    },
  );

  return { position, geoHint, isMapLoading };
}

type MapBodyProps = {
  addressQuery: string;
  className?: string;
  mapContainerClassName?: string;
};

function AddressPreviewMapBody({
  addressQuery,
  className,
  mapContainerClassName,
}: MapBodyProps) {
  const { t } = useTranslation("business");
  const query = addressQuery.trim();
  const { position, geoHint, isMapLoading } = useGeocodeMapState(query, t);

  const center: L.LatLngTuple = position ?? DEFAULT_CENTER;
  const zoom = position ? PIN_ZOOM : DEFAULT_ZOOM;

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* Clip Leaflet panes (high z-index); without this, tiles can paint over the form action bar. */}
      <div className="relative isolate z-0 h-64 w-full min-h-0 overflow-hidden rounded-lg border border-neutral-200 md:h-[min(50vh,22rem)] md:min-h-72">
        <MapContainer
          center={center}
          zoom={zoom}
          className={cn(
            "z-0 h-full! w-full! rounded-none border-0",
            mapContainerClassName,
          )}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <MapViewSync center={center} zoom={zoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position ? (
            <Marker position={position} icon={defaultMarkerIcon} />
          ) : null}
        </MapContainer>
        {isMapLoading ? (
          <div
            className="pointer-events-none absolute inset-0 z-2000 flex bg-white/75"
            aria-busy="true"
            aria-live="polite"
            aria-label={t("addressMap.loadingAriaLabel")}
            role="status"
          >
            <Skeleton className="size-full rounded-lg border-0 shadow-none ring-0" />
          </div>
        ) : null}
      </div>
      {query.length > 0 && query.length < MIN_QUERY_LEN ? (
        <p className="text-xs text-neutral-500">
          {t("addressMap.shortQueryHint")}
        </p>
      ) : null}
      {geoHint ? (
        <p className="text-xs text-amber-800" role="status">
          {geoHint}
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-neutral-400">
        {t("addressMap.footerNotice")}
      </p>
    </div>
  );
}

export type BusinessAddressLocationMapProps = {
  /** Free-text query built from address fields (e.g. street, city, country). */
  addressQuery: string;
  className?: string;
  /** Applied to the Leaflet map container (size, radius). */
  mapContainerClassName?: string;
};

/**
 * Geocodes `addressQuery` with Nominatim (via leaflet-control-geocoder) and shows a pin on an OSM map.
 *
 * A plain function component is enough here: `useCallback`/`useMemo` are for stabilizing values inside
 * a component or its parent, not a substitute for `memo`. If a parent re-renders often with the same
 * props and the Leaflet subtree becomes costly, wrap this export in `memo()` or have the parent pass
 * stable props (e.g. `useCallback` only when passing function props).
 */
export function BusinessAddressLocationMap({
  addressQuery,
  className,
  mapContainerClassName,
}: BusinessAddressLocationMapProps) {
  return (
    <AddressPreviewMapBody
      addressQuery={addressQuery}
      className={className}
      mapContainerClassName={mapContainerClassName}
    />
  );
}
