"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { useSiteContent } from "../lib/site-content";

// Genuine illustrative stock photography, optimised WebP crops; credits in photos/hero/SOURCES.txt.
const sectors = [
  { id: "production", label: "წარმოება", photo: "/assets/photos/hero/production.webp", icon: "package" },
  { id: "food", label: "საკვები და სასმელი", photo: "/assets/photos/hero/food.webp", icon: "utensils" },
  { id: "logistics", label: "ლოგისტიკა", photo: "/assets/photos/hero/logistics.webp", icon: "truck" },
  { id: "marketing", label: "მარკეტინგი", photo: "/assets/photos/hero/marketing.webp", icon: "megaphone" },
];

export function HomeBusinessScene() {
  const [paused, setPaused] = useState(false);
  const content = useSiteContent();
  const cards = sectors.map((sector, index) => ({
    ...sector,
    photo: content[`heroImage${index + 1}`] || sector.photo,
    label: content[`heroLabel${index + 1}`] || sector.label,
  }));
  const columns = [cards.slice(0, 2), cards.slice(2)];
  return <nav className="hero-scene" aria-label="აღმოაჩინე კომპანიები დარგების მიხედვით" data-paused={paused || undefined}>
    <div className="hero-scene__photos">
      {columns.map((column, index) => <div className="hero-scene__column" key={index}>
        <div className="hero-scene__track">
          {/* Equal groups give the descending loop no jump. Copies remain mouse-accessible,
              while screen readers and keyboard navigation encounter each destination once. */}
          {[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
            {column.map(sector => <Link key={sector.id} href={`/companies/?industry=${sector.id}`} className="hero-scene__card" tabIndex={duplicate ? -1 : undefined}>
              <img src={sector.photo} width={480} height={360} alt="" decoding="async" />
              <span><Icon name={sector.icon} />{sector.label}</span>
            </Link>)}
          </div>)}
        </div>
      </div>)}
    </div>
    <button className="hero-scene__motion" type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"} title={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"}><Icon name={paused ? "play" : "pause"} /></button>
  </nav>;
}
