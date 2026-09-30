import { apiFetch } from './api-client';
import type { SignalAccount } from './types';

const SIGNAL_DEVICE_NAME = process.env.NEXT_PUBLIC_SIGNAL_DEVICE_NAME || 'UptimeMonitor';

export const getSignalQRCodeUrl = () => {
  return `/api/signal-proxy/v1/qrcodelink?device_name=${encodeURIComponent(SIGNAL_DEVICE_NAME)}&ts=${Date.now()}`;
};

export const getSignalDeviceName = () => SIGNAL_DEVICE_NAME;

export const getSignalAccounts = async (): Promise<SignalAccount[]> => {
  return apiFetch<SignalAccount[]>('settings/signal-config/accounts');
};

export const syncSignalAccounts = async (): Promise<{ accountsSynced: number; groupsSynced: number; removed: number }> => {
  return apiFetch<{ accountsSynced: number; groupsSynced: number; removed: number }>('settings/signal-config/sync', {
    method: 'POST',
  });
};

export const toggleGroupAlerts = async (groupId: string, receiveAlerts: boolean) => {
  return apiFetch(`settings/signal-config/groups/${encodeURIComponent(groupId)}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ receiveAlerts }),
  });
};

export const deleteSignalAccount = async (phoneNumber: string) => {
  return apiFetch(`settings/signal-config/accounts/${encodeURIComponent(phoneNumber)}`, {
    method: 'DELETE',
  });
};
