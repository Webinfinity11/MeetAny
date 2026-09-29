"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, MarkerClusterGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { categories, cities } from "../../lib/categories";
import { avatarInitials } from "../ui/Avatar";

export type MapCompany = { id: string; name: string; industry: string; city: string; lat: number; lng: number };

// Georgia, when no company has coordinates.
const GEORGIA: [number, number] = [42.2, 43.5];

/** Company markers on an OpenStreetMap basemap. Leaflet loads only when this view opens. Popup content is
 *  built with DOM nodes (textContent), never HTML strings — company names come from users. */
/** `compact`: one company on its profile — street-level zoom, no popup, no clustering needed. */
export function CompaniesMap({ companies, compact = false }: { companies: MapCompany[]; compact?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<MarkerClusterGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Re-place markers only when the set of companies or their positions change — callers may pass a
  // fresh array on every render, and re-fitting then would snap the map back while someone pans.
  const key = companies.map(c => `${c.id}:${c.lat},${c.lng}`).join("|");
  const latest = useRef(companies);
  useEffect(() => { latest.current = companies; });

  useEffect(() => {
    let cancelled = false;
    // The cluster plugin augments the CommonJS Leaflet object, so both use its default export.
    import("leaflet").then(async ({ default: L }) => {
      await import("leaflet.markercluster");
      if (cancelled || !host.current || map.current) return;
      leaflet.current = L;
      // fadeAnimation off: tile fade-in waits on requestAnimationFrame, which never runs in a hidden
      // WebView (DevApp panel, background tabs), leaving tiles at opacity 0.
      const m = L.map(host.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, fadeAnimation: false }).setView(GEORGIA, 7);
      // The compact profile map is too small for 44px zoom buttons; pinch/double-click still zoom.
      if (!compact) L.control.zoom({ position: "bottomright" }).addTo(m);
      // OpenStreetMap's own tiles: keyless, fine for this traffic under its usage policy (attribution
      // required). Switch the URL to a keyed provider (MapTiler/Stadia) if traffic grows.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // Scroll-zoom only after the person engages with the map, so page scrolling never gets trapped.
      m.on("focus click", () => m.scrollWheelZoom.enable());
      m.on("blur mouseout", () => m.scrollWheelZoom.disable());
      map.current = m;
      // Nearby companies merge into one counted circle; it splits on click/zoom, and pins at the
      // exact same address fan out ("spiderfy") at the deepest zoom.
      layer.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 44,
        iconCreateFunction: cluster => L.divIcon({
          className: "map-cluster",
          html: `<span>${cluster.getChildCount()}</span>`,
          iconSize: [44, 44],
        }),
      }).addTo(m);
      setReady(true);
    }, () => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const L = leaflet.current, m = map.current, group = layer.current;
    if (!ready || !L || !m || !group) return;
    group.clearLayers();
    const points: [number, number][] = [];
    for (const c of latest.current) {
      const at: [number, number] = [c.lat, c.lng];
      const icon = L.divIcon({
        className: "map-pin",
        html: `<span class="map-pin__dot" aria-hidden="true"></span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        popupAnchor: [0, -38],
      });
      const marker = L.marker(at, { icon, title: c.name, alt: c.name, riseOnHover: true });
      marker.getElement()?.setAttribute("aria-label", c.name);
      const initials = document.createElement("span");
      initials.className = "map-pin__initials";
      initials.textContent = avatarInitials(c.name);
      marker.on("add", () => marker.getElement()?.querySelector(".map-pin__dot")?.appendChild(initials));
      if (!compact) marker.bindPopup(() => popup(c), { closeButton: true, className: "map-popup", maxWidth: 280, minWidth: 220 });
      marker.addTo(group);
      points.push(at);
    }
    if (points.length === 1) m.setView(points[0], compact ? 15 : 13);
    else if (points.length > 1) m.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
    else m.setView(GEORGIA, 7);
  }, [key, ready, compact]);

  return (
    <div className={`companies-map${compact ? " companies-map--compact" : ""}`}>
      <div ref={host} className="companies-map__canvas" role="region" aria-label={compact ? "კომპანიის მდებარეობა რუკაზე" : "კომპანიები რუკაზე"} />
      {!ready && !failed ? <div className="companies-map__loading" role="status">რუკა იტვირთება…</div> : null}
      {failed ? <div className="companies-map__loading" role="alert">რუკა ვერ ჩაიტვირთა. სცადე გვერდის განახლება.</div> : null}
    </div>
  );
}

function popup(c: MapCompany): HTMLElement {
  const root = document.createElement("div");
  root.className = "map-popup__body";
  const title = document.createElement("a");
  title.className = "map-popup__name";
  title.href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  title.textContent = c.name;
  const meta = document.createElement("p");
  meta.className = "map-popup__meta";
  meta.textContent = [categories[c.industry] || c.industry, cities[c.city] || c.city].filter(Boolean).join(" · ");
  const link = document.createElement("a");
  link.className = "map-popup__link";
  link.href = title.href;
  link.textContent = "პროფილის ნახვა →";
  root.append(title, meta, link);
  return root;
}
