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

  async importPlace(
    place_id: string,
    jenjang_override?: string,
    status_override?: 'Negeri' | 'Swasta',
    nama_override?: string,
  ) {
    return this.request<{ success: boolean; message: string; data: School }>(
      '/api/schools/search-on-the-fly',
      {
        method: 'POST',
        body: JSON.stringify({ import_place_id: place_id, jenjang_override, status_override, nama_override }),
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

  async me() {
    return this.request<{ success: boolean; user: User }>('/api/auth/me');
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

  // 6. Admin Panel (FR-A1)
  async getAdminUsers(role?: string) {
    const q = role && role !== 'SEMUA' ? `?role=${role}` : '';
    return this.request<{ success: boolean; total: number; users: User[] }>(`/api/admin/users${q}`);
  }

  async createAdminUser(data: { nama: string; email: string; password: string; role: string }) {
    return this.request<{ success: boolean; message: string; user: User }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminUserRole(id: string, role: string) {
    return this.request<{ success: boolean; message: string; user: User }>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async toggleAdminUserStatus(id: string) {
    return this.request<{ success: boolean; message: string; user: User }>(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
    });
  }

  async deleteAdminUser(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ── School Dashboard (akun sekolah) ────────────────────────────────────────

  async claimSchool(school_id: string) {
    return this.request<{ success: boolean; message: string; school_id: string }>(
      '/api/school-dashboard/claim',
      { method: 'POST', body: JSON.stringify({ school_id }) }
    );
  }

  async getSchoolDashboard() {
    return this.request<{
      success: boolean;
      school: { id: string; nama: string; jenjang: string; auto_approve_teacher: boolean };
      codes: Array<{ id: string; scope: string; code: string; valid_until: string }>;
      classes: Array<{
        id: string; nama: string; tingkat: string | number; created_at: string;
        kode_kelas: { id: string; code: string; valid_until: string } | null;
      }>;
      pending_guru: Array<{ membership_id: string; user_id: string; nama: string; email: string; joined_at: string }>;
    }>('/api/school-dashboard/me');
  }

  async createClass(data: { nama: string; tingkat: string | number }) {
    return this.request<{
      success: boolean;
      class: { id: string; nama: string; tingkat: string | number; kode_kelas: { id: string; code: string; valid_until: string } };
    }>('/api/school-dashboard/classes', { method: 'POST', body: JSON.stringify(data) });
  }

  async approveGuru(membership_id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/school-dashboard/guru/${membership_id}/approve`,
      { method: 'PATCH' }
    );
  }

  async updateSchoolSettings(data: { auto_approve_teacher: boolean }) {
    return this.request<{ success: boolean; auto_approve_teacher: boolean }>(
      '/api/school-dashboard/settings',
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  // ── Generate kode sekolah (FR-A4) ─────────────────────────────────────────

  async generateSchoolCode(school_id: string, scope: 'school_student' | 'school_teacher') {
    return this.request<{ success: boolean; code: { id: string; code: string; scope: string; valid_until: string } }>(
      '/api/codes/school',
      { method: 'POST', body: JSON.stringify({ school_id, scope }) }
    );
  }

  async generateClassCode(class_id: string) {
    return this.request<{ success: boolean; code: { id: string; code: string; valid_until: string } }>(
      '/api/codes/class',
      { method: 'POST', body: JSON.stringify({ class_id }) }
    );
  }

  async rotateCode(code_id: string) {
    return this.request<{ success: boolean; code: { id: string; code: string; valid_until: string } }>(
      `/api/codes/rotate/${code_id}`,
      { method: 'POST' }
    );
  }

  // ── Join sekolah & kelas (FR-A2) ───────────────────────────────────────────

  async joinSchool(code: string) {
    return this.request<{
      success: boolean;
      membership: { id: string; role: string; status: string; school_id: string };
      school_id?: string;
      school_name?: string;
    }>(
      '/api/join/school',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async joinClass(code: string) {
    return this.request<{
      success: boolean;
      membership: { id: string; role: string; status: string; class_id: string };
      class_id?: string;
      class_name?: string;
      tingkat?: string | number;
      school_id?: string;
    }>(
      '/api/join/class',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  // ── Monitoring Scope (FR-A5) ───────────────────────────────────────────────

  async getMonitoringScope() {
    return this.request<{
      role: string;
      kelas?: { id: string; nama: string; tingkat: string | number } | null;
      classes?: Array<{ id: string; nama: string; tingkat: string | number }>;
      school?: { id: string; nama: string } | null;
      schools?: Array<{ id: string; nama: string; jenjang?: string; member_count?: number; class_count?: number }>;
    }>('/api/monitoring/scope');
  }

  async getActivityHistory() {
    return this.request<{
      success: boolean;
      history: Array<{
        id: string;
        tipe: 'absensi' | 'anggota' | 'kelas' | 'sekolah' | 'sistem';
        judul: string;
        deskripsi: string;
        waktu: string;
        timestamp: string;
        icon: string;
        iconColor: string;
        iconBg: string;
      }>;
    }>('/api/monitoring/history');
  }

  // ── Delegasi Reset Password (FR-A16) ─────────────────────────────────────────

  async resetPasswordDelegasi(target_user_id: string) {
    return this.request<{ success: boolean; message: string; temp_password?: string }>(
      '/api/school-dashboard/reset-password',
      { method: 'POST', body: JSON.stringify({ target_user_id }) }
    );
  }

  // ── Absensi (FR-A13, FR-A17) ─────────────────────────────────────────────────

  async submitAttendanceSelf() {
    return this.request<{ success: boolean; message: string; attendance?: any }>(
      '/api/attendance/self',
      { method: 'POST' }
    );
  }

  async submitAttendanceGuru(data: {
    murid_id: string;
    class_id: string;
    date?: string;
    status: 'hadir' | 'sakit' | 'izin' | 'alpa';
    catatan?: string;
  }) {
    return this.request<{ success: boolean; message: string; attendance?: any; action?: string }>(
      '/api/attendance/guru',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getClassAttendance(class_id: string, date?: string) {
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request<{
      success: boolean;
      class_id: string;
      date: string;
      records: Array<{
        murid_id: string;
        nama: string;
        tanggal: string;
        status: string;
        catatan?: string;
        diisi_oleh: string;
        is_koreksi_guru: boolean;
      }>;
    }>(`/api/attendance/class/${class_id}${q}`);
  }

  async getMyAttendanceHistory(month?: string) {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request<{
      success: boolean;
      count: number;
      records: Array<{
        id: string;
        class_id: string;
        class_name: string;
        tanggal: string;
        status: 'hadir' | 'sakit' | 'izin' | 'alpa';
        waktu_isi: string;
        is_koreksi_guru: boolean;
      }>;
    }>(`/api/attendance/my-history${q}`);
  }

  // ── Pembubaran Kelas (FR-A11) ────────────────────────────────────────────────

  async getDissolutionBanner(class_id: string) {
    return this.request<{
      has_banner: boolean;
      schedule_id?: string;
      dissolution_time?: string;
      message?: string;
      can_manage?: boolean;
    }>(`/api/dissolution/banner/${class_id}`);
  }

  async getDissolutionPreview(school_id: string) {
    return this.request<{
      success: boolean;
      school_id: string;
      school_name: string;
      classes_count: number;
      students_count: number;
      teachers_count: number;
      duration_hours: number;
      warning_text: string;
    }>(`/api/dissolution/preview/${school_id}`);
  }

  async scheduleDissolution(school_id: string, confirmation_word: string) {
    return this.request<{ success: boolean; message: string; schedule: any }>(
      '/api/dissolution/schedule',
      { method: 'POST', body: JSON.stringify({ school_id, confirmation_word }) }
    );
  }

  async cancelDissolution(schedule_id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/dissolution/cancel/${schedule_id}`,
      { method: 'POST' }
    );
  }

  async executeDissolutionNow(schedule_id: string) {
    return this.request<{ success: boolean; message: string; stats?: any }>(
      `/api/dissolution/execute-now/${schedule_id}`,
      { method: 'POST' }
    );
  }

  // ── Anggota Kelas & Sekolah (FR-A5, FR-A9, FR-A10) ──────────────────────────

  async getClassMembers(class_id: string) {
    return this.request<{
      success: boolean;
      class_id: string;
      class_name: string;
      members: Array<{ user_id: string; nama: string; nomor_absen: number; role: string }>;
    }>(`/api/members/class/${class_id}`);
  }

  async leaveClass(class_id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/members/class/${class_id}/leave`,
      { method: 'POST' }
    );
  }

  async kickClassMember(class_id: string, user_id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/members/class/${class_id}/kick/${user_id}`,
      { method: 'POST' }
    );
  }

  async kickSchoolMember(school_id: string, user_id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/api/members/school/${school_id}/kick/${user_id}`,
      { method: 'POST' }
    );
  }

  async leaveSchool(school_id?: string) {
    return this.request<{ success: boolean; message: string }>(
      school_id ? `/api/members/school/${school_id}/leave` : '/api/members/school/leave-current',
      { method: 'POST' }
    );
  }

  async updateProfile(data: { nama: string }) {
    return this.request<{ success: boolean; message: string; user: User }>(
      '/api/auth/profile',
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  // ── Kalender Libur (FR-A13) ──────────────────────────────────────────────────

  async getHolidays() {
    return this.request<{ success: boolean; count: number; holidays: Array<{ id: string; tanggal: string; nama: string; jenis: string }> }>('/api/holidays');
  }

  async getSchoolCalendarOverrides(school_id: string) {
    return this.request<{ success: boolean; school_id: string; overrides: Array<{ id: string; tanggal: string; override_type: string; keterangan?: string }> }>(
      `/api/school-calendar/${school_id}`
    );
  }
}

export const api = new SkitaApiClient();
export const apiClient = api;
