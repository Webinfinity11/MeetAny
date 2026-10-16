"use client";
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from './Icon';
import { useMarketStore } from '../lib/market-client';
import { useUnreadMessageCount } from '../lib/chat-client';
import styles from './MobileNavigation.module.css';

export function MobileNavigation({ role }: { role: string | null }) {
 const path = usePathname();
 const params = useSearchParams();
 const { store, ready } = useMarketStore();
 const me = ready ? store?.currentUser() : null;
 const unreadMessages = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && role !== 'admin') || 0;
 const unreadNotices = me ? store?.engagement()?.unread || 0 : 0;
 const tab = params.get('tab') || 'overview';
 // These flows have their own reachable bottom actions. Keep navigation out of the typing area.
 if (['/onboarding/', '/requests/new/', '/requests/offer/', '/offers/new/'].some(prefix => path.startsWith(prefix))) return null;
 const signedIn = !!role && role !== 'guest';
 const links: {icon:string;label:string;fullLabel?:string;href:string;active:boolean;count?:number}[] = role === 'admin' ? [
  {icon:'layout-grid', label:'დაფა', href:'/admin/', active:path === '/admin/' && tab === 'overview'},
  {icon:'clipboard-list', label:'მოთხოვნები', href:'/admin/?tab=requests', active:path === '/admin/' && tab === 'requests'},
  {icon:'handshake', label:'გარიგებები', href:'/admin/?tab=deals', active:path === '/admin/' && tab === 'deals'},
  {icon:'flag', label:'მომართვები', href:'/admin/?tab=reports', active:path === '/admin/' && tab === 'reports'},
 ] : signedIn ? [
  {icon:'clipboard-list', label:'მოთხოვნები', href:'/requests/', active:path.startsWith('/requests/')},
  {icon:'message-square', label:'მიმოწერა', href:'/account/?tab=messages', active:path === '/account/' && tab === 'messages', count:unreadMessages},
  {icon:'bell', label:'სიახლეები', fullLabel:'შეტყობინებები', href:'/account/?tab=notifications', active:path === '/account/' && ['notifications','alerts'].includes(tab), count:unreadNotices},
  {icon:'user-round', label:'ანგარიში', href:'/account/', active:path === '/account/' && !['messages','notifications','alerts'].includes(tab)},
 ] : [
  {icon:'layout-grid', label:'მთავარი', href:'/', active:path === '/'},
  {icon:'clipboard-list', label:'მოთხოვნები', href:'/requests/', active:path.startsWith('/requests/')},
  {icon:'building-2', label:'კომპანიები', href:'/companies/', active:path.startsWith('/companies/')},
  {icon:'user-round', label:'შესვლა', href:'/account/', active:path === '/account/'},
 ];
 return <nav className={styles.nav} data-bottom-nav aria-label="სწრაფი ნავიგაცია">{links.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? 'page' : undefined} aria-label={`${link.fullLabel || link.label}${link.count ? `, ${link.count} წაუკითხავი` : ''}`}><span className={styles.icon}><Icon name={link.icon}/>{link.count ? <span className={styles.unread} aria-hidden="true"/> : null}</span><span>{link.label}</span></Link>)}</nav>;
}
