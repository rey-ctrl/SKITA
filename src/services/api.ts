import { School, SchoolZone, ZoneEvaluation, User, ProvinceData } from '../types';
import { INITIAL_SCHOOLS, INITIAL_ZONES, PROVINCES_DATA } from '../data/initialData';
import { evaluateSchoolZonasi } from '../utils/zonasi';
import { Platform, NativeModules } from 'react-native';

export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'web') return 'http://localhost:5000';

  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/https?:\/\/([^/:]+)/);
    if (match && match[1] && match[1] !== '127.0.0.1' && match[1] !== 'localhost') {
      return `http://${match[1]}:5000`;
    }
  }

  // Active LAN IP of development machine
  return 'http://192.168.18.180:5000';
};

class SkitaApiClient {
  private token: string | null = null;

  setAuthToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Gagal menghubungi server' }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // 1. Get schools with backend filtering & Haversine calculation
  async getSchools(params: {
    search?: string;
    jenjang?: string;
    status?: string;
    lat?: number;
    lng?: number;
    max_km?: number;
    zonasi_only?: boolean;
    sort_by?: 'jarak' | 'nama';
  }): Promise<{ total: number; data: Array<School & { evaluation: ZoneEvaluation }> }> {
    try {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.jenjang && params.jenjang !== 'SEMUA') query.append('jenjang', params.jenjang);
      if (params.status && params.status !== 'SEMUA') query.append('status', params.status);
      if (params.lat) query.append('lat', params.lat.toString());
      if (params.lng) query.append('lng', params.lng.toString());
      if (params.max_km) query.append('max_km', params.max_km.toString());
      if (params.zonasi_only) query.append('zonasi_only', 'true');
      if (params.sort_by) query.append('sort_by', params.sort_by);

      return await this.request(`/api/schools?${query.toString()}`);
    } catch {
      // Offline fallback
      const uLat = params.lat || -6.5912;
      const uLng = params.lng || 106.7995;
      const filtered = INITIAL_SCHOOLS.map((school) => ({
        ...school,
        evaluation: evaluateSchoolZonasi(school, INITIAL_ZONES[school.id], uLat, uLng),
      }));
      return { total: filtered.length, data: filtered };
    }
  }

  // 2. Search-on-the-fly (proxy Google Places + auto-cache)
  async searchOnTheFly(query: string) {
    return this.request<{
      success: boolean;
      total: number;
      results: Array<Omit<School, 'id'> & { guessed_jenjang: string; already_saved: boolean }>;
    }>('/api/schools/search-on-the-fly', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async importPlace(place_id: string, jenjang_override?: string, status_override?: 'Negeri' | 'Swasta') {
    return this.request<{ success: boolean; message: string; data: School }>(
      '/api/schools/search-on-the-fly',
      {
        method: 'POST',
        body: JSON.stringify({ import_place_id: place_id, jenjang_override, status_override }),
      }
    );
  }

  async deleteSchool(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/schools/${id}`, {
      method: 'DELETE',
    });
  }

  // 3. Auth
  async login(email: string, password: string) {
    const res = await this.request<{ success: boolean; token: string; user: User }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    this.setAuthToken(res.token);
    return res;
  }

  async register(data: { nama: string; email: string; password: string; provinsi?: string; kota_kab?: string }) {
    const res = await this.request<{ success: boolean; token: string; user: User }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    this.setAuthToken(res.token);
    return res;
  }

  async loginWithGoogle(data: { nama: string; email: string; google_id_token?: string }) {
    const res = await this.request<{ success: boolean; token: string; user: User }>(
      '/api/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({
          google_id_token: data.google_id_token || 'mock_google_token',
          nama: data.nama,
          email: data.email,
        }),
      }
    );
    this.setAuthToken(res.token);
    return res;
  }

  // 4. Cascading Regions
  async getProvinces(): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await this.request<{ success: boolean; data: Array<{ id: string; name: string }> }>(
        '/api/regions/provinces'
      );
      return res.data;
    } catch {
      return PROVINCES_DATA.map((p) => ({ id: p.id, name: p.name }));
    }
  }

  async getCities(province: string): Promise<string[]> {
    try {
      const res = await this.request<{ success: boolean; cities: string[] }>(
        `/api/regions/cities?province=${encodeURIComponent(province)}`
      );
      return res.cities;
    } catch {
      const found = PROVINCES_DATA.find((p) => p.name.toLowerCase() === province.toLowerCase());
      return found ? found.cities : [];
    }
  }

  // 5. Routing via OSM (OSRM)
  async getRoute(params: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }): Promise<{
    jarak_m: number;
    durasi_motor_menit: number;
    durasi_jalan_menit: number;
    jarak_haversine_m: number;
    sumber: 'osrm' | 'estimasi';
  }> {
    try {
      const query = new URLSearchParams({
        originLat: params.originLat.toString(),
        originLng: params.originLng.toString(),
        destLat: params.destLat.toString(),
        destLng: params.destLng.toString(),
      });
      const res = await this.request<{
        success: boolean;
        data: {
          jarak_m: number;
          durasi_motor_menit: number;
          durasi_jalan_menit: number;
          jarak_haversine_m: number;
          sumber: 'osrm' | 'estimasi';
        };
      }>(`/api/route?${query.toString()}`);
      return res.data;
    } catch {
      // Fallback lokal
      return {
        jarak_m: 0,
        durasi_motor_menit: 0,
        durasi_jalan_menit: 0,
        jarak_haversine_m: 0,
        sumber: 'estimasi',
      };
    }
  }
}

export const api = new SkitaApiClient();
export const apiClient = api;
