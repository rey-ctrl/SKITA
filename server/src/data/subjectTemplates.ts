import { Jenjang, StatusSekolah, SubjectTemplate } from '../types/index.js';

export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  // SMP (Negeri & Swasta)
  ...['Negeri', 'Swasta'].flatMap((status) =>
    [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika',
      'Ilmu Pengetahuan Alam (IPA)',
      'Ilmu Pengetahuan Sosial (IPS)',
      'Bahasa Inggris',
      'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
      'Informatika',
      'Seni dan Budaya',
      'Prakarya',
    ].map((nama) => ({
      jenjang: 'SMP' as Jenjang,
      status: status as StatusSekolah,
      nama,
    }))
  ),

  // SMA (Negeri & Swasta)
  ...['Negeri', 'Swasta'].flatMap((status) =>
    [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika (Umum)',
      'Matematika Tingkat Lanjut',
      'Bahasa Inggris',
      'Sejarah',
      'PJOK',
      'Fisika',
      'Kimia',
      'Biologi',
      'Ekonomi',
      'Sosiologi',
      'Geografi',
      'Informatika',
      'Seni Rupa/Musik/Tari',
    ].map((nama) => ({
      jenjang: 'SMA' as Jenjang,
      status: status as StatusSekolah,
      nama,
    }))
  ),

  // SMK (Negeri & Swasta)
  ...['Negeri', 'Swasta'].flatMap((status) =>
    [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika Terapan',
      'Bahasa Inggris & Asing Lainnya',
      'PJOK',
      'Sejarah',
      'Informatika',
      'Projek IPAS (Ilmu Pengetahuan Alam dan Sosial)',
      'Dasar-Dasar Program Keahlian',
      'Konsentrasi Keahlian / Kejuruan',
      'Projek Kreatif dan Kewirausahaan (PKK)',
      'Praktik Kerja Lapangan (PKL)',
    ].map((nama) => ({
      jenjang: 'SMK' as Jenjang,
      status: status as StatusSekolah,
      nama,
    }))
  ),
];
