import { GET } from "./og/route";

export const alt = "MeetAny — იპოვეთ თქვენი ბიზნესპარტნიორი";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return GET(new Request("https://meetany.invalid/og"));
}
