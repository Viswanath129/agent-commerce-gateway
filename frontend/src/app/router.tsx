import { useState, useEffect } from 'react';
import type { TabId } from '../types/index.js';

export interface RouteState {
  tab: TabId;
  subParam?: string; // e.g. intentId for /transactions/:intentId
}

export function useAppRouter() {
  const parseHash = (): RouteState => {
    const rawHash = window.location.hash.replace(/^#/, '').replace(/^\//, '');
    if (!rawHash) return { tab: 'overview' };

    const parts = rawHash.split('/');
    const tabName = parts[0] as TabId;

    const validTabs: TabId[] = [
      'overview',
      'live-demo',
      'transactions',
      'mandates',
      'policies',
      'reservations',
      'audit-ledger',
      'system-health',
      'agent-compatibility',
    ];

    if (validTabs.includes(tabName)) {
      return {
        tab: tabName,
        subParam: parts[1] || undefined,
      };
    }

    return { tab: 'overview' };
  };

  const [route, setRoute] = useState<RouteState>(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (tab: TabId, subParam?: string) => {
    const hash = subParam ? `#${tab}/${subParam}` : `#${tab}`;
    window.location.hash = hash;
  };

  return {
    activeTab: route.tab,
    selectedParam: route.subParam,
    navigate,
  };
}
