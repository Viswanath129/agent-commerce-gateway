/**
 * Centralized Type Exports for ACG Control Plane
 */

export * from '../lib/api/types.js';
export * from '../lib/constants/index.js';

export type TabId =
  | 'overview'
  | 'live-demo'
  | 'transactions'
  | 'mandates'
  | 'policies'
  | 'reservations'
  | 'audit-ledger'
  | 'system-health'
  | 'agent-compatibility';

export type ExecutionStageState = 'idle' | 'processing' | 'success' | 'blocked' | 'failed';
