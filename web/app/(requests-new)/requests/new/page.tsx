// market.js opens the new-request dialog over the list once (body[data-open="new-request"]),
// then replaces the URL with /requests/ — see renderAll() in site/dist/market.js.
export default function RequestsNewPage() {
  return <div id="requests-root" dangerouslySetInnerHTML={{ __html: "" }} />;
}
