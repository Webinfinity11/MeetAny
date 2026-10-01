export const distributionChannels: Record<string,string> = {horeca:"სასტუმროები და რესტორნები",retail_chain:"სუპერმარკეტები / ქსელები",retail_small:"მაღაზიები / კიოსკები",pharmacy:"აფთიაქები",subdistributors:"ქვედისტრიბუტორები",online:"ონლაინ",institutions:"კორპორატიული / ინსტიტუციები",export:"ექსპორტი"};
export const warehouses: Record<string,string> = {none:"არ არის",own:"საკუთარი საწყობი",rented:"ნაქირავები საწყობი"};
export const transports: Record<string,string> = {none:"არ არის",own:"საკუთარი ტრანსპორტი",contracted:"პარტნიორის ტრანსპორტი"};
export type Distribution = {id?:string;regions:string[];categories:string[];channels:string[];brands:string[];warehouse:string;transport:string;coldChain:boolean;minOrder:string;exclusive:boolean};
export const emptyDistribution: Distribution = {regions:[],categories:[],channels:[],brands:[],warehouse:"none",transport:"none",coldChain:false,minOrder:"",exclusive:false};
