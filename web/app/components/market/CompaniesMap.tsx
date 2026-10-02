"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { categories, cities } from "../../lib/categories";

export type MapCompany = { id: string; name: string; industry: string; city: string; lat: number; lng: number };

// Georgia, when no company has coordinates.
const GEORGIA: [number, number] = [42.2, 43.5];

/** Company markers on an OpenStreetMap basemap. Leaflet loads only when this view opens. Popup content is
 *  built with DOM nodes (textContent), never HTML strings — company names come from users. */
/** `compact`: one company on its profile — street-level zoom, no popup, no clustering needed. */
export function CompaniesMap({ companies, compact = false }: { companies: MapCompany[]; compact?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tiles, setTiles] = useState<"loading" | "ready" | "failed">("loading");
  // Re-place markers only when the set of companies or their positions change — callers may pass a
  // fresh array on every render, and re-fitting then would snap the map back while someone pans.
  const key = companies.map(c => `${c.id}:${c.lat},${c.lng}`).join("|");
  const latest = useRef(companies);
  useEffect(() => { latest.current = companies; });

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame = 0;
    // The cluster plugin augments the CommonJS Leaflet object, so both use its default export.
    const initialize = async () => {
      const { default: L } = await import("leaflet");
      if (!compact) await import("leaflet.markercluster");
      if (cancelled || !host.current || map.current) return;
      leaflet.current = L;
      // fadeAnimation off: tile fade-in waits on requestAnimationFrame, which never runs in a hidden
      // WebView (DevApp panel, background tabs), leaving tiles at opacity 0.
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const m = L.map(host.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, fadeAnimation: false, zoomAnimation: !reducedMotion }).setView(GEORGIA, 7);
      map.current = m;
      m.attributionControl.setPrefix(false);
      // The compact profile map is too small for 44px zoom buttons; pinch/double-click still zoom.
      if (!compact) L.control.zoom({ position: "bottomright" }).addTo(m);
      // OpenStreetMap's own tiles: keyless, fine for this traffic under its usage policy (attribution
      // required). Switch the URL to a keyed provider (MapTiler/Stadia) if traffic grows.
      let hasVisibleTiles = false;
      const basemap = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      // Library initialization is not proof that the basemap has arrived. Show the tile status until
      // the initial tile batch settles; if it fails, leave markers usable with a notice.
      basemap.on("tileload", () => {
        if (!cancelled && !hasVisibleTiles) {
          hasVisibleTiles = true;
        }
      });
      basemap.on("load", () => { if (!cancelled) setTiles(hasVisibleTiles ? "ready" : "failed"); });
      basemap.addTo(m);
      // Scroll-zoom only after the person engages with the map, so page scrolling never gets trapped.
      m.on("focus click", () => m.scrollWheelZoom.enable());
      m.on("blur mouseout", () => m.scrollWheelZoom.disable());
      // Nearby companies merge into one counted circle; it splits on click/zoom, and pins at the
      // exact same address fan out ("spiderfy") at the deepest zoom.
      layer.current = (compact ? L.layerGroup() : L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        animate: !reducedMotion,
        maxClusterRadius: 44,
        iconCreateFunction: cluster => L.divIcon({
          className: "map-cluster",
          html: `<span>${cluster.getChildCount()}</span>`,
          iconSize: [44, 44],
        }),
      })).addTo(m);
      // Profile panels and the catalog change width at mobile breakpoints without remounting.
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => { if (!cancelled) m.invalidateSize({ pan: false }); });
      });
      resizeObserver.observe(host.current);
      setReady(true);
    };
    void initialize().catch(() => {
      if (!cancelled) {
        resizeObserver?.disconnect();
        cancelAnimationFrame(resizeFrame);
        map.current?.remove();
        map.current = null;
        layer.current = null;
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      cancelAnimationFrame(resizeFrame);
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
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -18],
      });
      const marker = L.marker(at, { icon, title: c.name, alt: c.name, riseOnHover: true });
      marker.on("add", () => marker.getElement()?.setAttribute("aria-label", c.name));
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
      <div ref={host} className="companies-map__canvas" role="region" aria-busy={!failed && (!ready || tiles === "loading")} aria-label={compact ? "კომპანიის მდებარეობა რუკაზე" : "კომპანიები რუკაზე"} />
      {!ready && !failed ? <div className="companies-map__loading" role="status">რუკა იტვირთება…</div> : null}
      {failed ? <div className="companies-map__loading" role="alert">რუკა ვერ ჩაიტვირთა. სცადე გვერდის განახლება.</div> : null}
      {ready && !failed && tiles !== "ready" ? <div className="companies-map__tile-status" role="status">{tiles === "loading" ? "რუკა იტვირთება…" : "რუკის ფონი ვერ ჩაიტვირთა. მდებარეობა მონიშნულია."}</div> : null}
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
