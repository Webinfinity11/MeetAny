"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { suggestions } from "../lib/home-data";

export function DiscoverySearch() {
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form className={`discovery-search${dismissed ? " suggestions-dismissed" : ""}`} action="/companies/">
      <fieldset className="market-search-types">
        <legend className="sr-only">რას ეძებ?</legend>
        <label>
          <input type="radio" name="type" value="" defaultChecked />
          ყველა კომპანია
        </label>
        <label>
          <input type="radio" name="type" value="suppliers" />
          მომწოდებლები
        </label>
        <label>
          <input type="radio" name="type" value="services" />
          მომსახურება
        </label>
      </fieldset>
      <div
        className="discovery-query"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDismissed(true);
            inputRef.current?.focus();
          }
        }}
      >
        <label className="sr-only" htmlFor="home-search">
          რა სჭირდება შენს ბიზნესს?
        </label>
        <Icon name="search" />
        <input
          ref={inputRef}
          id="home-search"
          type="search"
          name="q"
          placeholder="აღწერე, რა გჭირდება"
          maxLength={200}
          autoComplete="off"
          onFocus={() => setDismissed(false)}
          onChange={() => setDismissed(false)}
        />
        <nav className="discovery-suggestions" aria-label="ძიების მაგალითები">
          <p>ან აირჩიე მომსახურება</p>
          {suggestions.map((s) => (
            <a key={s.label} href={`/companies/?q=${encodeURIComponent(s.label)}`}>
              <Icon name={s.icon} />
              <span>{s.label}</span>
              <Icon name="chevron-right" />
            </a>
          ))}
        </nav>
      </div>
      <button className="button" type="submit">
        მოძებნე <Icon name="arrow-right" />
      </button>
    </form>
  );
}
