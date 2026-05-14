'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useSyncExternalStore, type ReactNode } from 'react';
import SwitcherCard from './SwitcherCard';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
function getSnapshot() { return window.location.hash; }
function getServerSnapshot() { return ''; }

type Panel = 'status' | 'cc';

interface HomePanelsProps {
  statusPanel: ReactNode;
  ccPanel: ReactNode;
}

export default function HomePanels({ statusPanel, ccPanel }: HomePanelsProps) {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activePanel: Panel = hash === '#claude-code' ? 'cc' : 'status';

  const setPanel = (next: Panel) => {
    const targetHash = next === 'cc' ? '#claude-code' : '#status';
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  return (
    <div className="home-panels">
      <div className="switcher-cards">
        <SwitcherCard
          icon={<span>◎</span>}
          label="Status"
          sublabel="live"
          active={activePanel === 'status'}
          onClick={() => setPanel('status')}
        />
        <SwitcherCard
          icon={<span>⟡</span>}
          label="Claude Code"
          sublabel="analytics"
          active={activePanel === 'cc'}
          onClick={() => setPanel('cc')}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activePanel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="home-panels__body"
        >
          {activePanel === 'status' ? statusPanel : ccPanel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
