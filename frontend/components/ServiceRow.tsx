'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function ServiceRow({
  children,
  className = 'service-row',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lift)' }}
      transition={{
        layout: { duration: 0.25 },
        default: { duration: 0.12, ease: 'easeOut' },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
