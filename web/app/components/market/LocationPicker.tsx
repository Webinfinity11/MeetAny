"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/map.css";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
const centers: Record<string,[number,number]> = {tbilisi:[41.7151,44.8271],batumi:[41.6461,41.6405],kutaisi:[42.2679,42.6946],rustavi:[41.5495,44.9932],zugdidi:[42.5088,41.8709],telavi:[41.9198,45.4732],gori:[41.9854,44.1083],georgia:[42.2,43.5]};
type Point = {lat:number;lng:number};
export function LocationPicker({city,value,disabled=false,onChange}:{city:string;value:Point|null;disabled?:boolean;onChange:(value:Point|null)=>void}) {
 const host=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<Marker|null>(null),leaflet=useRef<typeof import("leaflet")|null>(null);
 const latest=useRef({value,disabled,onChange});
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const [tileState,setTileState]=useState("loading");
 useEffect(()=>{latest.current={value,disabled,onChange};},[value,disabled,onChange]);
 useEffect(()=>{
  let cancelled=false,observer:ResizeObserver|undefined;
  const setup=async()=>{
   const {default:L}=await import("leaflet");
   if(cancelled||!host.current)return;
   leaflet.current=L;
   const m=L.map(host.current,{scrollWheelZoom:false,zoomControl:false,fadeAnimation:false,zoomAnimation:!matchMedia("(prefers-reduced-motion: reduce)").matches}).setView(centers.tbilisi,13);
   map.current=m;m.attributionControl.setPrefix(false);L.control.zoom({position:"bottomright"}).addTo(m);
   let loaded=false;
   const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
   tiles.on("tileload",()=>{loaded=true;});tiles.on("load",()=>{if(!cancelled)setTileState(loaded?"ready":"failed");});tiles.addTo(m);
   m.on("click",event=>{if(!latest.current.disabled)latest.current.onChange({lat:Number(event.latlng.lat.toFixed(6)),lng:Number(event.latlng.lng.toFixed(6))});});
   // Wheel zoom follows an intentional click or focus, preserving ordinary page scrolling.
   m.on("focus click",()=>m.scrollWheelZoom.enable());m.on("blur mouseout",()=>m.scrollWheelZoom.disable());
   observer=new ResizeObserver(()=>m.invalidateSize({pan:false}));observer.observe(host.current);
   setReady(true);
  };
  void setup().catch(()=>{if(!cancelled){map.current?.remove();map.current=null;setFailed(true);}});
  return()=>{cancelled=true;observer?.disconnect();map.current?.remove();map.current=null;marker.current=null;};
 },[]);
 useEffect(()=>{
  const m=map.current,L=leaflet.current;if(!ready||!m||!L)return;
  if(!value){marker.current?.remove();marker.current=null;m.setView(centers[city]||centers.tbilisi,city==="georgia"?7:13,{animate:false});return;}
  if(!marker.current){
   const pin=L.marker([value.lat,value.lng],{draggable:!disabled,title:"კომპანიის მდებარეობა",alt:"კომპანიის მდებარეობა",icon:L.divIcon({className:"map-pin",html:'<span class="map-pin__dot" aria-hidden="true"></span>',iconSize:[44,44],iconAnchor:[22,22]})});
   marker.current=pin;
   pin.on("dragend",()=>{const at=pin.getLatLng();latest.current.onChange({lat:Number(at.lat.toFixed(6)),lng:Number(at.lng.toFixed(6))});});
   pin.on("add",()=>{
    const element=pin.getElement();if(!element)return;
    element.setAttribute("aria-label","კომპანიის მდებარეობა. ისრებით შეცვალე წერტილი.");
    element.addEventListener("keydown",event=>{
     if(latest.current.disabled||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))return;
     event.preventDefault();event.stopPropagation();
     const point=m.project(pin.getLatLng()),step=event.shiftKey?48:12;
     point.x+=event.key==="ArrowRight"?step:event.key==="ArrowLeft"?-step:0;
     point.y+=event.key==="ArrowDown"?step:event.key==="ArrowUp"?-step:0;
     const at=m.unproject(point);latest.current.onChange({lat:Number(at.lat.toFixed(6)),lng:Number(at.lng.toFixed(6))});
    });
   });pin.addTo(m);
  }else marker.current.setLatLng([value.lat,value.lng]);
  if(disabled)marker.current.dragging?.disable();else marker.current.dragging?.enable();
  if(!m.getBounds().contains([value.lat,value.lng]))m.setView([value.lat,value.lng],Math.max(13,m.getZoom()),{animate:false});
 },[city,ready,disabled,value]);
 return <div className="profile-location-picker">
  <p className="ma-field__help" id="location-picker-help">მონიშნე წერტილი რუკაზე ან გადაადგილე მარკერი.</p>
  <div className="companies-map profile-location-map"><div ref={host} className="companies-map__canvas" role="region" aria-label="კომპანიის მდებარეობის არჩევა" aria-describedby="location-picker-help" aria-busy={!failed&&(!ready||tileState==="loading")}/>
   {!ready&&!failed?<div className="companies-map__loading" role="status">რუკა იტვირთება…</div>:null}
   {failed?<div className="companies-map__loading" role="alert">რუკა ვერ ჩაიტვირთა. შეგიძლია კოორდინატები მიუთითო.</div>:null}
   {ready&&tileState!=="ready"?<div className="companies-map__tile-status" role="status">{tileState==="loading"?"რუკა იტვირთება…":"რუკის ფონი ვერ ჩაიტვირთა."}</div>:null}
  </div>
  <div className="profile-location-actions"><Button variant="secondary" disabled={!ready||disabled} onClick={()=>{const at=map.current!.getCenter();onChange({lat:Number(at.lat.toFixed(6)),lng:Number(at.lng.toFixed(6))});requestAnimationFrame(()=>marker.current?.getElement()?.focus());}}><Icon name="map-pin"/>{value?"ცენტრში გადატანა":"ცენტრში მონიშვნა"}</Button>{value?<Button variant="ghost" disabled={disabled} onClick={()=>onChange(null)}>წერტილის წაშლა</Button>:null}<span role="status">{value?"მდებარეობა მონიშნულია":"წერტილი ჯერ არ არის მონიშნული"}</span></div>
  <p className="ma-field__help">მარკერის არჩევის შემდეგ ისრებით გადაადგილებაც შეგიძლია. მისამართი ცალკე მიუთითე.</p>
 </div>;
}
