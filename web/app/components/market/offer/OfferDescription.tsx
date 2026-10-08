"use client";
import { useState } from 'react';
import { Button } from '../../ui/Button';
import styles from './OfferFlow.module.css';
export function OfferDescription({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  return <div><p className={expanded ? styles.description : styles.preview}>{body}</p>{body.length > 180 ? <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'ნაკლები' : 'მეტი'}</Button> : null}</div>;
}
