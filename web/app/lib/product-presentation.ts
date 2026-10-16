/** Illustrations for the eight explicitly marked legacy demo products.
 * Never replace an owner's uploaded product photo or write presentation URLs to the catalog.
 * Both the seeded identity and original gallery filename must match.
 */
const demos: Record<string, { prefix: string; photos: Record<string, string> }> = {
  '74cc28fc-47de-45cb-9563-93735b86855e': { prefix: 'wood', photos: {
    'კაფის ხის მაგიდა 70×70': 'demo-products/cafe-table.jpg', 'სავაჭრო თარო': 'demo-products/shop-shelves.jpg',
  } },
  '3d12ff1f-0d72-4a53-a92f-1830cfd5b290': { prefix: 'linen', photos: {
    'სასტუმროს თეთრეულის კომპლექტი': 'hotel-linen.jpg', 'რესტორნის სუფრა და ხელსახოცები': 'demo-products/table-linen.jpg',
  } },
  'cdb14451-5727-454e-9d04-6d47cf1d070e': { prefix: 'supply', photos: {
    'HoReCa ინვენტარის ნაკრები': 'cover/kitchen.jpg', 'შეფუთვის საბითუმო ნაკრები': 'cardboard-packaging.jpg',
  } },
  '85509946-985a-409d-86ad-26c87c185546': { prefix: 'food', photos: {
    'სეზონური ბოსტნეულის კალათა': 'fresh-produce.jpg', 'მწვანილის საბითუმო ნაკრები': 'demo-products/herbs.jpg',
  } },
};
type Product = { name: string; note?: string | null; photoUrl?: string | null };
// The published demo was re-seeded once after the local snapshot. Match that exact
// legacy asset, so a later owner upload still keeps its own photo.
const publishedWoodPhoto = 'https://k3kp1syowhtmw3er.public.blob.vercel-storage.com/74cc28fc-47de-45cb-9563-93735b86855e/gallery-demo-photo-1791467184924-nSZwnuqECRCp2KM0RqEr62bWfUxTiH.jpg';
export function productPresentation<T extends Product>(product: T, companyId = '') {
  if (!companyId) {
    try { companyId = new URL(product.photoUrl || '').pathname.split('/')[1]; } catch { /* Not a seeded remote image. */ }
  }
  const illustrative = /^სადემო(?: პროდუქტი)?\s*·\s*ფოტო საილუსტრაციოა/.test(product.note || '');
  const demo = demos[companyId];
  const originalPhoto = demo && (product.photoUrl?.includes(`/${companyId}/gallery-demo-${demo.prefix}-`) ||
    companyId === '74cc28fc-47de-45cb-9563-93735b86855e' && product.photoUrl === publishedWoodPhoto);
  const photo = illustrative && originalPhoto ? demo.photos[product.name] : undefined;
  return { ...product, photoUrl: photo ? '/assets/photos/' + photo : product.photoUrl, illustrative,
    photoPosition: photo === 'demo-products/cafe-table.jpg' ? '50% 72%' : undefined };
}
