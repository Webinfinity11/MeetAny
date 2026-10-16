"use client";
import { useState } from "react";
import { notFound } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { OfferSentModal } from "../../components/market/modals/OfferSentModal";
import { SelectOfferModal } from "../../components/market/modals/SelectOfferModal";
import { ReviewModal } from "../../components/market/modals/ReviewModal";
import { DealTermsForm } from "../../components/market/DealTermsForm";
import type { ComparedOffer, Deal } from "../../lib/deal-client";

const company="ქართული წარმოებისა და ადგილზე მიწოდების კომპანია";
const offer: ComparedOffer = { id:"qa",request_id:"qa",company_id:"qa",company,city:"tbilisi",verified:true,price:120,price_type:"unit",total_gel:1800,best_price:true,fastest:false,delivery_days:7,vat_included:true,delivery_included:true,body:"სრული მომსახურება ადგილზე აწყობით.",status:"sent",eligible:true,valid_until:null,payment_terms:"100% მიწოდებისას",commercial_terms:["ტრანსპორტირება","გარანტია"],updated_at:"2026-10-09T11:00:00Z" };
const deal: Deal={id:"qa",request_id:"qa",offer_id:"qa",buyer_id:"qa",supplier_id:"qa",stage:"terms",revision:1,selected_at:"2026-10-09T11:00:00Z",discuss_at:null,terms_at:null,progress_at:null,complete_at:null,cancelled_at:null,total_price:1800,quantity:15,unit:"pcs",delivery_days:7,delivery_date:null,delivery_place:"თბილისი, მომხმარებლის მიერ მითითებულ მისამართზე",payment_terms:"100% მიწოდებისას",includes:["ტრანსპორტირება","ადგილზე აწყობა"],buyer_confirmed_at:null,supplier_confirmed_at:null,rating:null,review:null,rated_at:null};
export default function LayoutPreview(){
 const [mode,setMode]=useState("");
 if(process.env.NODE_ENV==="production")notFound();
 const close=()=>setMode("");
 return <main className="ma-container ma-stack"><h1>QA განლაგების შემოწმება</h1><div>{["sent","select","terms","review","long"].map(name=><Button key={name} onClick={()=>setMode(name)}>{name}</Button>)}</div>
  <OfferSentModal open={mode==="sent"} onClose={close}/>
  <SelectOfferModal offer={mode==="select"?{company:offer.company,verified:offer.verified,total:offer.total_gel,deliveryDays:offer.delivery_days}:null} request={{title:"საოფისე მაგიდები, მიწოდებითა და ადგილზე აწყობით"}} othersCount={4} pending={false} onConfirm={close} onClose={close}/>
  {mode==="terms"?<Modal open onClose={close} width={560} title="ახალი პირობები" lead="ცვლილებას მეორე მხარის თანხმობა სჭირდება."><DealTermsForm deal={deal} pending={false} commentAvailable onCancel={close} onSubmit={async()=>true}/></Modal>:null}
  {mode==="review"?<ReviewModal supplier={company} request="საოფისე მაგიდები" pending={false} onClose={close} onRate={async()=>true}/>:null}
  {mode==="long"?<Modal open onClose={close} icon="circle-check" tone="success" title="შეთავაზება გაიგზავნა" lead={Array(3).fill(company).join(" — ")} actions={<><Button variant="secondary">ჩემი შეთავაზებები</Button><Button>სხვა შესაძლებლობები</Button></>}><p>{Array(5).fill("შეგიძლიათ განაახლოთ შეთავაზების დეტალები, სანამ მყიდველი აირჩევს მომწოდებელს.").join(" ")}</p></Modal>:null}
 </main>;
}
