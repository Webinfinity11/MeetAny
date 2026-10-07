import { useRouter } from "next/navigation";
import { SearchCombobox } from "../SearchCombobox";
import { useSearchSuggestions } from "../../lib/search-suggestions";

export function CatalogSearch({ id, label, placeholder, value, onChange, mode, onCategory, resultIds }: {
  id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void;
  mode: "companies" | "requests"; resultIds: string[]; onCategory: (category: string) => void;
}) {
  const suggestions = useSearchSuggestions(mode, value, "", resultIds);
  const router = useRouter();
  return <SearchCombobox hideLabel id={id} label={label} placeholder={placeholder} value={value} onChange={onChange} suggestions={suggestions}
    onSelect={item => item.kind === "category" ? onCategory(item.category) : router.push(item.href)} />;
}
