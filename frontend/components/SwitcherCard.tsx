'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface SwitcherCardProps {
  icon: ReactNode;
  label: string;
  sublabel: string;
  active: boolean;
  onClick: () => void;
}

export default function SwitcherCard({ icon, label, sublabel, active, onClick }: SwitcherCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lift)' }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={`switcher-card${active ? ' switcher-card--active' : ''}`}
      aria-pressed={active}
    >
      <span className="switcher-card__icon" aria-hidden>{icon}</span>
      <span className="switcher-card__label">{label}</span>
      <span className="switcher-card__sublabel">{sublabel}</span>
    </motion.button>
  );
}
