"use client";
import { OnboardItems } from "./OnboardFields";
export function ProfileItems({id,label,items,disabled,onChange}:{id:string;label:string;items:string[];disabled?:boolean;onChange:(items:string[])=>void}) {
 return <fieldset id={id} className="account-block-fields" disabled={disabled}><OnboardItems rows label={label} values={items} onChange={onChange}/></fieldset>;
}
