import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { geocoders } from "leaflet-control-geocoder";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: L.LatLngTuple = [20, 0];
const DEFAULT_ZOOM = 2;
const PIN_ZOOM = 16;
/** After the first geocode for this mount, wait this long before re-querying when the address string changes. */
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
  const query = addressQuery.trim();
  const [position, setPosition] = useState<L.LatLngTuple | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  /** Last query we finished geocoding (success, empty result, or error); `null` if never settled or cleared. */
  const [settledQuery, setSettledQuery] = useState<string | null>(null);

  const isMapLoading =
    query.length >= MIN_QUERY_LEN && query !== settledQuery;
  /**
   * First time we schedule a geocode for a non-empty query (page load / saved address), run immediately.
   * Any later change to `addressQuery` is debounced. Ref is consumed when scheduling, not when the request finishes,
   * so edits before the first response still debounce correctly.
   */
  const initialGeocodePassRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    if (query.length < MIN_QUERY_LEN) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setPosition(null);
        setGeoHint(null);
        setSettledQuery(null);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const useDebounce = !initialGeocodePassRef.current;
    if (initialGeocodePassRef.current) {
      initialGeocodePassRef.current = false;
    }
    const delay = useDebounce ? GEOCODE_DEBOUNCE_MS : 0;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
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
            setGeoHint("Could not find that address on the map.");
          }
          setSettledQuery(query);
        },
        () => {
          if (cancelled) return;
          setPosition(null);
          setGeoHint("Geocoding request failed. Try again later.");
          setSettledQuery(query);
        },
      );
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const center: L.LatLngTuple = position ?? DEFAULT_CENTER;
  const zoom = position ? PIN_ZOOM : DEFAULT_ZOOM;

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* Clip Leaflet panes (high z-index); without this, tiles can paint over the form action bar. */}
      <div
        className={cn(
          "relative isolate z-0 h-64 w-full min-h-0 overflow-hidden rounded-lg border border-neutral-200 md:h-[min(50vh,22rem)] md:min-h-72",
        )}
      >
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
            aria-label="Loading map location"
            role="status"
          >
            <Skeleton className="size-full rounded-lg border-0 shadow-none ring-0" />
          </div>
        ) : null}
      </div>
      {query.length > 0 && query.length < MIN_QUERY_LEN ? (
        <p className="text-xs text-neutral-500">
          Add a bit more address detail to locate on the map.
        </p>
      ) : null}
      {geoHint ? (
        <p className="text-xs text-amber-800" role="status">
          {geoHint}
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-neutral-400">
        Map data © OpenStreetMap contributors. Geocoding uses the public Nominatim
        service—use sparingly in production or host your own instance.
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
