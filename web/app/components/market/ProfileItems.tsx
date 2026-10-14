"use client";
import { MultiCombobox } from "../ui/MultiCombobox";
import { categoryTextOptions } from "../ui/combobox-options";
export function ProfileItems({id,label,items,disabled,onChange}:{id:string;label:string;items:string[];disabled?:boolean;onChange:(items:string[])=>void;compact?:boolean}) {
 return <MultiCombobox creatable limit={8} options={categoryTextOptions} id={id} label={label} value={items} disabled={disabled} onChange={onChange} />;
}
