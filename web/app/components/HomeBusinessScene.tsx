"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";

// Existing illustrative business photography; sources: assets/photos/cover/SOURCES.txt.
const sectors = [
  { id: "production", label: "წარმოება", photo: "ceramics", icon: "package" },
  { id: "logistics", label: "ლოგისტიკა", photo: "warehouse", icon: "truck" },
  { id: "food", label: "საკვები და სასმელი", photo: "produce", icon: "utensils" },
  { id: "marketing", label: "მარკეტინგი", photo: "team", icon: "megaphone" },
];

export function HomeBusinessScene() {
  const [paused, setPaused] = useState(false);
  return <nav className="hero-scene" aria-label="აღმოაჩინე კომპანიები დარგების მიხედვით" data-paused={paused || undefined}>
    <div className="hero-scene__orbit" aria-hidden="true" />
    <div className="hero-scene__photos">
      {sectors.map((sector, index) => <Link key={sector.id} href={`/companies/?industry=${sector.id}`} className={`hero-scene__card hero-scene__card--${index + 1}`}>
        <img src={`/assets/photos/cover/${sector.photo}.jpg`} width={320} height={400} alt="" decoding="async" />
        <span><Icon name={sector.icon} />{sector.label}</span>
      </Link>)}
    </div>
    <span className="hero-scene__connection" aria-hidden="true"><img src="/assets/meetany-symbol-transparent.png" width={44} height={44} alt="" /></span>
    <button className="hero-scene__motion" type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"} title={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"}><Icon name={paused ? "play" : "pause"} /></button>
  </nav>;
}
