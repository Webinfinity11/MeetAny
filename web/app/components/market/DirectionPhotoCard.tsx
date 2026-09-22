import Link from "next/link";
import { Icon } from "../Icon";

export function DirectionPhotoCard({ title, imageSrc, href }: { title: string; imageSrc: string; href: string }) {
  return (
    <Link className="r2-photo-card" href={href}>
      <img src={imageSrc} alt="" width={640} height={360} />
      <span>
        {title} <Icon name="arrow-right" />
      </span>
    </Link>
  );
}
