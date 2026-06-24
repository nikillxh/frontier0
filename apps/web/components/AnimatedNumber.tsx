'use client';

import { animate, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';

export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [value, decimals, mv]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}
