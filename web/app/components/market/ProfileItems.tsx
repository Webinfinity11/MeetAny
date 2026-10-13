"use client";
import { ChipsInput } from "../ui/ChipsInput";
export function ProfileItems({id,label,items,disabled,onChange,compact=false}:{id:string;label:string;items:string[];disabled?:boolean;onChange:(items:string[])=>void;compact?:boolean}) {
 return <ChipsInput id={id} label={label} values={items} disabled={disabled} onChange={onChange} compact={compact} />;
}
