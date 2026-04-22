import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';

const STORAGE_KEY = 'technician_signup_requests_v1';

export interface TechnicianSignupRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  service_area?: string;
  password: string;
  password_confirmation: string;
  created_at: string;
}

async function readAll(): Promise<TechnicianSignupRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list: TechnicianSignupRequest[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const technicianSignupRequestService = {
  async createRequest(params: {
    name: string;
    email: string;
    phone: string;
    service_area?: string;
    password: string;
    password_confirmation: string;
  }): Promise<TechnicianSignupRequest> {
    const current = await readAll();
    const exists = current.some((r) => r.email.toLowerCase() === params.email.trim().toLowerCase());
    if (exists) {
      throw new Error('A signup request with this email already exists.');
    }
    const next: TechnicianSignupRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: params.name.trim(),
      email: params.email.trim(),
      phone: params.phone.trim(),
      service_area: params.service_area?.trim() || undefined,
      password: params.password,
      password_confirmation: params.password_confirmation,
      created_at: new Date().toISOString(),
    };
    await writeAll([next, ...current]);
    return next;
  },

  async getRequests(): Promise<TechnicianSignupRequest[]> {
    const list = await readAll();
    const sorted = list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (sorted.length > 0) return sorted;
    return [
      {
        id: 'dummy-request-1',
        name: 'Ali Technician',
        email: 'ali.tech@example.com',
        phone: '+971501112233',
        service_area: 'Abu Dhabi',
        password: 'dummy123',
        password_confirmation: 'dummy123',
        created_at: new Date().toISOString(),
      },
    ];
  },

  async rejectRequest(id: string): Promise<void> {
    const list = await readAll();
    const next = list.filter((item) => item.id !== id);
    await writeAll(next);
  },

  async approveRequest(id: string): Promise<void> {
    const list = await readAll();
    const request = list.find((item) => item.id === id);
    if (!request) throw new Error('Request not found.');

    await authService.register({
      name: request.name,
      email: request.email,
      phone: request.phone,
      password: request.password,
      password_confirmation: request.password_confirmation,
      role: 'technician',
    });

    const next = list.filter((item) => item.id !== id);
    await writeAll(next);
  },
};

