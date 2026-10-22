export const ROLES = {
  WAKA: 'waka',
  VICE_PRINCIPAL: 'vice_principal',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
};

// Demo profiles for rapid UKK testing & evaluation fallback
export const DEMO_PROFILES = {
  waka: {
    id: 1,
    name: 'Waka Kurikulum',
    nis_nip: '198501152010011001',
    email: 'waka@smkn1bantul.sch.id',
    role: 'vice_principal',
    must_change_password: false,
    assignments: [],
  },
  kesiswaan: {
    id: 2,
    name: 'Budi Santoso, M.Kom. (Kesiswaan)',
    nis_nip: '198211102008011005',
    email: 'budi.santoso@sekolah.sch.id',
    role: 'teacher',
    must_change_password: false,
    assignments: [{ id: 101, type: 'kesiswaan', label: 'Tim Kesiswaan & Piket' }],
  },
  teacher: {
    id: 3,
    name: 'Drs. Ahmad Fauzi, M.Pd.',
    nis_nip: '197803122005011002',
    email: 'ahmad.fauzi@sekolah.sch.id',
    role: 'teacher',
    must_change_password: false,
    assignments: [{ id: 102, type: 'wali_kelas', class_id: 1, label: 'Wali Kelas X-1' }],
  },
  student: {
    id: 4,
    name: 'Aisyah Putri Ramadhani',
    nis_nip: '2024001',
    email: 'aisyah.putri@siswa.sch.id',
    role: 'student',
    class_id: 1,
    className: 'X-RPL-1',
    must_change_password: false,
    assignments: [],
  },
  parent: {
    id: 5,
    name: 'Bambang Sulistyo',
    nis_nip: 'W-2024001',
    email: 'bambang.s@gmail.com',
    role: 'parent',
    linked_student_id: 4,
    must_change_password: false,
    assignments: [],
  },
};
