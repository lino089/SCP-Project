import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Table,
  Badge,
  Tabs,
  SearchInput,
  ConfirmDialog,
} from '../../components/shared';
import { SkeletonRow, EmptyState, ErrorState } from '../../components/feedback';
import {
  classApi,
  roomApi,
  subjectApi,
  teacherApi,
  studentApi,
} from '../../services/masterDataApi';
import InitialCredentialModal from './components/InitialCredentialModal';
import TeacherAssignmentModal from './components/TeacherAssignmentModal';
import DeleteConflictDialog from './components/DeleteConflictDialog';
import './MasterData.css';

// Initial fallback mock data if backend connection is unavailable (Offline UKK mode)
const FALLBACK_CLASSES = [
  { id: 1, name: 'X-RPL-1', level: 10, next_class_id: 5 },
  { id: 2, name: 'X-TKJ-1', level: 10, next_class_id: 6 },
  { id: 3, name: 'X-DKV-1', level: 10, next_class_id: 7 },
  { id: 4, name: 'X-AKL-1', level: 10, next_class_id: 8 },
  { id: 5, name: 'XI-RPL-1', level: 11, next_class_id: 9 },
  { id: 6, name: 'XI-TKJ-1', level: 11, next_class_id: 10 },
  { id: 7, name: 'XI-DKV-1', level: 11, next_class_id: 11 },
  { id: 8, name: 'XI-AKL-1', level: 11, next_class_id: 12 },
  { id: 9, name: 'XII-RPL-1', level: 12, next_class_id: null },
  { id: 10, name: 'XII-TKJ-1', level: 12, next_class_id: null },
  { id: 11, name: 'XII-DKV-1', level: 12, next_class_id: null },
  { id: 12, name: 'XII-AKL-1', level: 12, next_class_id: null },
];

const FALLBACK_ROOMS = [
  { id: 1, name: 'R-101', capacity: 36 },
  { id: 2, name: 'R-102', capacity: 36 },
  { id: 3, name: 'R-103', capacity: 36 },
  { id: 4, name: 'Lab Komputer 1', capacity: 36 },
  { id: 5, name: 'Lab Komputer 2', capacity: 36 },
  { id: 6, name: 'Bengkel Praktik', capacity: 32 },
];

const FALLBACK_SUBJECTS = [
  { id: 1, name: 'Pemrograman Web & Perangkat Bergerak' },
  { id: 2, name: 'Basis Data' },
  { id: 3, name: 'Pemodelan Perangkat Lunak' },
  { id: 4, name: 'Administrasi Infrastruktur Jaringan' },
  { id: 5, name: 'Matematika' },
  { id: 6, name: 'Bahasa Indonesia' },
  { id: 7, name: 'Bahasa Inggris' },
];

const FALLBACK_TEACHERS = [
  {
    id: 1,
    name: 'Drs. Ahmad Fauzi, M.Pd.',
    nis_nip: '198501152010011001',
    fet_staff_id: 'AFAUZI',
    email: 'ahmad.fauzi@sekolah.sch.id',
    assignments: [{ id: 101, type: 'wali_kelas', class_id: 1, school_class: { name: 'X-RPL-1' } }],
  },
  {
    id: 2,
    name: 'Siti Nurhaliza, S.Pd.',
    nis_nip: '198703222011012002',
    fet_staff_id: 'SNURHALIZA',
    email: 'siti.nurhaliza@sekolah.sch.id',
    assignments: [],
  },
  {
    id: 3,
    name: 'Budi Santoso, S.T., M.T.',
    nis_nip: '199005102012011003',
    fet_staff_id: 'BSANTOSO',
    email: 'budi.santoso@sekolah.sch.id',
    assignments: [{ id: 102, type: 'kesiswaan' }],
  },
];

const FALLBACK_STUDENTS = [
  {
    id: 1,
    name: 'Aisyah Putri Ramadhani',
    nis_nip: '2024001',
    class_id: 1,
    schoolClass: { name: 'X-RPL-1', level: 10 },
  },
  {
    id: 2,
    name: 'Bayu Aditya Pratama',
    nis_nip: '2024002',
    class_id: 1,
    schoolClass: { name: 'X-RPL-1', level: 10 },
  },
  {
    id: 3,
    name: 'Citra Dewi Lestari',
    nis_nip: '2024003',
    class_id: 2,
    schoolClass: { name: 'X-TKJ-1', level: 10 },
  },
  {
    id: 4,
    name: 'Dimas Arya Nugraha',
    nis_nip: '2024004',
    class_id: 5,
    schoolClass: { name: 'XI-RPL-1', level: 11 },
  },
];

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('kelas');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  // Master datasets
  const [classList, setClassList] = useState(FALLBACK_CLASSES);
  const [roomList, setRoomList] = useState(FALLBACK_ROOMS);
  const [subjectList, setSubjectList] = useState(FALLBACK_SUBJECTS);
  const [teacherList, setTeacherList] = useState(FALLBACK_TEACHERS);
  const [studentList, setStudentList] = useState(FALLBACK_STUDENTS);

  // Loading & error state per tab
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Form modal states
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog states
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictError, setConflictError] = useState(null); // { entityName, entityType, message }

  // Initial credential modal (shows newly generated password)
  const [credentialModalData, setCredentialModalData] = useState(null);

  // Teacher assignment modal
  const [assignmentTeacher, setAssignmentTeacher] = useState(null);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'kelas') {
        const res = await classApi.getClasses({ per_page: 100 });
        if (res?.data) setClassList(res.data);
      } else if (activeTab === 'ruang') {
        const res = await roomApi.getRooms({ per_page: 100 });
        if (res?.data) setRoomList(res.data);
      } else if (activeTab === 'mapel') {
        const res = await subjectApi.getSubjects({ per_page: 100 });
        if (res?.data) setSubjectList(res.data);
      } else if (activeTab === 'guru') {
        const [tRes, cRes] = await Promise.all([
          teacherApi.getTeachers({ per_page: 100 }),
          classApi.getClasses({ per_page: 100 }).catch(() => null),
        ]);
        if (tRes?.data) setTeacherList(tRes.data);
        if (cRes?.data) setClassList(cRes.data);
      } else if (activeTab === 'siswa') {
        const [sRes, cRes] = await Promise.all([
          studentApi.getStudents({ per_page: 100 }),
          classApi.getClasses({ per_page: 100 }).catch(() => null),
        ]);
        if (sRes?.data) setStudentList(sRes.data);
        if (cRes?.data) setClassList(cRes.data);
      }
    } catch (err) {
      console.warn('Backend API unavailable, using local cache/fallback:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // Load data on mount & tab change without cascading render
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        if (activeTab === 'kelas') {
          const res = await classApi.getClasses({ per_page: 100 });
          if (isMounted && res?.data) setClassList(res.data);
        } else if (activeTab === 'ruang') {
          const res = await roomApi.getRooms({ per_page: 100 });
          if (isMounted && res?.data) setRoomList(res.data);
        } else if (activeTab === 'mapel') {
          const res = await subjectApi.getSubjects({ per_page: 100 });
          if (isMounted && res?.data) setSubjectList(res.data);
        } else if (activeTab === 'guru') {
          const [tRes, cRes] = await Promise.all([
            teacherApi.getTeachers({ per_page: 100 }),
            classApi.getClasses({ per_page: 100 }).catch(() => null),
          ]);
          if (isMounted && tRes?.data) setTeacherList(tRes.data);
          if (isMounted && cRes?.data) setClassList(cRes.data);
        } else if (activeTab === 'siswa') {
          const [sRes, cRes] = await Promise.all([
            studentApi.getStudents({ per_page: 100 }),
            classApi.getClasses({ per_page: 100 }).catch(() => null),
          ]);
          if (isMounted && sRes?.data) setStudentList(sRes.data);
          if (isMounted && cRes?.data) setClassList(cRes.data);
        }
      } catch (err) {
        console.warn('Backend API unavailable, using local cache/fallback:', err?.message);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Tab definitions
  const tabs = useMemo(
    () => [
      { id: 'kelas', label: 'Kelas', count: classList.length },
      { id: 'ruang', label: 'Ruang', count: roomList.length },
      { id: 'mapel', label: 'Mata Pelajaran', count: subjectList.length },
      { id: 'guru', label: 'Guru', count: teacherList.length },
      { id: 'siswa', label: 'Siswa', count: studentList.length },
    ],
    [classList.length, roomList.length, subjectList.length, teacherList.length, studentList.length]
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
    setLevelFilter('ALL');
    setFormErrors({});
  };

  // Open Add modal
  const handleOpenAdd = () => {
    setModalType('create');
    setEditingItem(null);
    setFormErrors({});

    switch (activeTab) {
      case 'kelas':
        setFormData({ name: '', level: '10', next_class_id: '' });
        break;
      case 'ruang':
        setFormData({ name: '', capacity: '36' });
        break;
      case 'mapel':
        setFormData({ name: '' });
        break;
      case 'guru':
        setFormData({
          name: '',
          nip: '',
          fet_staff_id: '',
          email: '',
        });
        break;
      case 'siswa':
        setFormData({
          name: '',
          nis: '',
          class_id: classList[0]?.id ? String(classList[0].id) : '1',
        });
        break;
      default:
        setFormData({});
    }
  };

  // Open Edit modal
  const handleOpenEdit = useCallback((item) => {
    setModalType('edit');
    setEditingItem(item);
    setFormErrors({});

    if (activeTab === 'kelas') {
      setFormData({
        name: item.name || '',
        level: String(item.level || 10),
        next_class_id: item.next_class_id ? String(item.next_class_id) : '',
      });
    } else if (activeTab === 'ruang') {
      setFormData({
        name: item.name || '',
        capacity: String(item.capacity || 36),
      });
    } else if (activeTab === 'mapel') {
      setFormData({
        name: item.name || '',
      });
    } else if (activeTab === 'guru') {
      setFormData({
        name: item.name || '',
        nip: item.nis_nip || item.nip || '',
        fet_staff_id: item.fet_staff_id || '',
        email: item.email || '',
      });
    } else if (activeTab === 'siswa') {
      setFormData({
        name: item.name || '',
        nis: item.nis_nip || item.nis || '',
        class_id: item.class_id ? String(item.class_id) : '',
      });
    }
  }, [activeTab]);

  // Save form handler (Create / Edit)
  const handleSaveForm = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      if (modalType === 'create') {
        if (activeTab === 'kelas') {
          const payload = {
            name: formData.name,
            level: Number(formData.level),
            next_class_id: formData.next_class_id ? Number(formData.next_class_id) : null,
          };
          try {
            const res = await classApi.createClass(payload);
            setClassList((prev) => [...prev, res.data || { id: Date.now(), ...payload }]);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
            // Offline fallback
            setClassList((prev) => [...prev, { id: Date.now(), ...payload }]);
          }
        } else if (activeTab === 'ruang') {
          const payload = {
            name: formData.name,
            capacity: Number(formData.capacity),
          };
          try {
            const res = await roomApi.createRoom(payload);
            setRoomList((prev) => [...prev, res.data || { id: Date.now(), ...payload }]);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
            setRoomList((prev) => [...prev, { id: Date.now(), ...payload }]);
          }
        } else if (activeTab === 'mapel') {
          const payload = { name: formData.name };
          try {
            const res = await subjectApi.createSubject(payload);
            setSubjectList((prev) => [...prev, res.data || { id: Date.now(), ...payload }]);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
            setSubjectList((prev) => [...prev, { id: Date.now(), ...payload }]);
          }
        } else if (activeTab === 'guru') {
          const payload = {
            name: formData.name,
            nip: formData.nip,
            fet_staff_id: formData.fet_staff_id || null,
            email: formData.email || null,
          };
          try {
            const res = await teacherApi.createTeacher(payload);
            const createdTeacher = res.data?.teacher || { id: Date.now(), ...payload, assignments: [] };
            const password = res.data?.password || 'GURU' + Math.floor(100000 + Math.random() * 900000);
            setTeacherList((prev) => [...prev, createdTeacher]);
            // Pop up the initial credential modal
            setCredentialModalData({
              type: 'teacher',
              teacher: createdTeacher,
              password,
            });
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
            // Offline fallback
            const dummyPass = 'GURU' + Math.floor(1000 + Math.random() * 9000);
            const fallbackItem = { id: Date.now(), ...payload, nis_nip: payload.nip, assignments: [] };
            setTeacherList((prev) => [...prev, fallbackItem]);
            setCredentialModalData({
              type: 'teacher',
              teacher: fallbackItem,
              password: dummyPass,
            });
          }
        } else if (activeTab === 'siswa') {
          const payload = {
            name: formData.name,
            nis: formData.nis,
            class_id: Number(formData.class_id),
          };
          try {
            const res = await studentApi.createStudent(payload);
            const student = res.data?.student || {
              id: Date.now(),
              ...payload,
              nis_nip: payload.nis,
              schoolClass: classList.find((c) => c.id === payload.class_id),
            };
            const parent = res.data?.parent || {
              name: 'Wali dari ' + payload.name,
              nis_nip: 'P-' + payload.nis,
            };
            const password = res.data?.generate_password || 'SISWA' + Math.floor(1000 + Math.random() * 9000);

            setStudentList((prev) => [...prev, student]);
            setCredentialModalData({
              type: 'student',
              student,
              parent,
              password,
            });
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
            // Offline fallback
            const dummyPass = 'SISWA' + Math.floor(1000 + Math.random() * 9000);
            const fallbackStudent = {
              id: Date.now(),
              name: payload.name,
              nis_nip: payload.nis,
              class_id: payload.class_id,
              schoolClass: classList.find((c) => c.id === payload.class_id),
            };
            setStudentList((prev) => [...prev, fallbackStudent]);
            setCredentialModalData({
              type: 'student',
              student: fallbackStudent,
              parent: { name: 'Wali dari ' + payload.name, nis_nip: 'P-' + payload.nis },
              password: dummyPass,
            });
          }
        }
      } else if (modalType === 'edit') {
        const id = editingItem.id;
        if (activeTab === 'kelas') {
          const payload = {
            name: formData.name,
            level: Number(formData.level),
            next_class_id: formData.next_class_id ? Number(formData.next_class_id) : null,
          };
          try {
            await classApi.updateClass(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setClassList((prev) => prev.map((c) => (c.id === id ? { ...c, ...payload } : c)));
        } else if (activeTab === 'ruang') {
          const payload = {
            name: formData.name,
            capacity: Number(formData.capacity),
          };
          try {
            await roomApi.updateRoom(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setRoomList((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
        } else if (activeTab === 'mapel') {
          const payload = { name: formData.name };
          try {
            await subjectApi.updateSubject(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setSubjectList((prev) => prev.map((s) => (s.id === id ? { ...s, ...payload } : s)));
        } else if (activeTab === 'guru') {
          const payload = {
            name: formData.name,
            nip: formData.nip,
            fet_staff_id: formData.fet_staff_id || null,
            email: formData.email || null,
          };
          try {
            await teacherApi.updateTeacher(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setTeacherList((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...payload, nis_nip: payload.nip } : t))
          );
        } else if (activeTab === 'siswa') {
          const payload = {
            name: formData.name,
            nis: formData.nis,
            class_id: Number(formData.class_id),
          };
          try {
            await studentApi.updateStudent(id, payload);
          } catch (apiErr) {
            if (apiErr.errors) {
              setFormErrors(apiErr.errors);
              setIsSubmitting(false);
              return;
            }
          }
          setStudentList((prev) =>
            prev.map((st) =>
              st.id === id
                ? {
                    ...st,
                    ...payload,
                    nis_nip: payload.nis,
                    schoolClass: classList.find((c) => c.id === payload.class_id),
                  }
                : st
            )
          );
        }
      }

      setModalType(null);
      setEditingItem(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Action Handler
  const handleOpenDelete = useCallback((item) => {
    setDeletingItem(item);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);

    const id = deletingItem.id;
    const name = deletingItem.name || 'Item';

    try {
      if (activeTab === 'kelas') {
        try {
          await classApi.deleteClass(id);
        } catch (err) {
          if (err.status === 409 || err.message?.includes('jadwal')) {
            setDeletingItem(null);
            setConflictError({
              entityName: name,
              entityType: 'Kelas',
              errorMessage: err.message,
            });
            return;
          }
        }
        setClassList((prev) => prev.filter((c) => c.id !== id));
      } else if (activeTab === 'ruang') {
        try {
          await roomApi.deleteRoom(id);
        } catch (err) {
          if (err.status === 409 || err.message?.includes('jadwal')) {
            setDeletingItem(null);
            setConflictError({
              entityName: name,
              entityType: 'Ruangan',
              errorMessage: err.message,
            });
            return;
          }
        }
        setRoomList((prev) => prev.filter((r) => r.id !== id));
      } else if (activeTab === 'mapel') {
        try {
          await subjectApi.deleteSubject(id);
        } catch (err) {
          if (err.status === 409 || err.message?.includes('jadwal')) {
            setDeletingItem(null);
            setConflictError({
              entityName: name,
              entityType: 'Mata Pelajaran',
              errorMessage: err.message,
            });
            return;
          }
        }
        setSubjectList((prev) => prev.filter((s) => s.id !== id));
      } else if (activeTab === 'guru') {
        try {
          await teacherApi.deleteTeacher(id);
        } catch (err) {
          if (err.status === 409 || err.message?.includes('jadwal')) {
            setDeletingItem(null);
            setConflictError({
              entityName: name,
              entityType: 'Guru',
              errorMessage: err.message,
            });
            return;
          }
        }
        setTeacherList((prev) => prev.filter((t) => t.id !== id));
      } else if (activeTab === 'siswa') {
        try {
          await studentApi.deleteStudent(id);
        } catch (err) {
          if (err.status === 409) {
            setDeletingItem(null);
            setConflictError({
              entityName: name,
              entityType: 'Siswa',
              errorMessage: err.message,
            });
            return;
          }
        }
        setStudentList((prev) => prev.filter((s) => s.id !== id));
      }
      setDeletingItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Teacher Assignment Handlers
  const handleOpenAssignment = useCallback((teacher) => {
    setAssignmentTeacher(teacher);
  }, []);

  const handleAssignRole = async (teacherId, payload) => {
    const res = await teacherApi.assignRole(teacherId, payload);
    const newAssignment = res?.data || {
      id: Date.now(),
      type: payload.type,
      class_id: payload.class_id,
      school_class: classList.find((c) => c.id === payload.class_id),
    };

    setTeacherList((prev) =>
      prev.map((t) =>
        t.id === teacherId
          ? { ...t, assignments: [...(t.assignments || []), newAssignment] }
          : t
      )
    );

    // Update current modal teacher object
    setAssignmentTeacher((prev) =>
      prev && prev.id === teacherId
        ? { ...prev, assignments: [...(prev.assignments || []), newAssignment] }
        : prev
    );
  };

  const handleRevokeRole = async (teacherId, assignmentId) => {
    await teacherApi.revokeRole(teacherId, assignmentId);

    setTeacherList((prev) =>
      prev.map((t) =>
        t.id === teacherId
          ? {
              ...t,
              assignments: (t.assignments || []).filter((a) => a.id !== assignmentId),
            }
          : t
      )
    );

    setAssignmentTeacher((prev) =>
      prev && prev.id === teacherId
        ? {
            ...prev,
            assignments: (prev.assignments || []).filter((a) => a.id !== assignmentId),
          }
        : prev
    );
  };

  // Filtered dataset based on search & levels
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeTab === 'kelas') {
      return classList.filter((c) => {
        if (levelFilter !== 'ALL' && String(c.level) !== levelFilter) return false;
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || String(c.level).includes(q);
      });
    }

    if (activeTab === 'ruang') {
      return roomList.filter((r) => {
        if (!q) return true;
        return r.name.toLowerCase().includes(q) || String(r.capacity).includes(q);
      });
    }

    if (activeTab === 'mapel') {
      return subjectList.filter((s) => {
        if (!q) return true;
        return s.name.toLowerCase().includes(q);
      });
    }

    if (activeTab === 'guru') {
      return teacherList.filter((t) => {
        if (!q) return true;
        const nip = t.nis_nip || t.nip || '';
        const fet = t.fet_staff_id || '';
        return (
          t.name.toLowerCase().includes(q) ||
          nip.toLowerCase().includes(q) ||
          fet.toLowerCase().includes(q)
        );
      });
    }

    if (activeTab === 'siswa') {
      return studentList.filter((s) => {
        const nis = s.nis_nip || s.nis || '';
        const className = s.schoolClass?.name || s.className || '';
        if (levelFilter !== 'ALL' && String(s.schoolClass?.level) !== levelFilter) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          nis.toLowerCase().includes(q) ||
          className.toLowerCase().includes(q)
        );
      });
    }

    return [];
  }, [activeTab, searchQuery, levelFilter, classList, roomList, subjectList, teacherList, studentList]);

  // Dynamic columns definition
  const columns = useMemo(() => {
    const baseActionCol = {
      key: 'actions',
      label: 'Aksi',
      align: 'right',
      renderCell: (row) => (
        <div className="master-data__action-cell">
          {activeTab === 'guru' && (
            <button
              type="button"
              className="master-data__assignment-btn"
              onClick={() => handleOpenAssignment(row)}
              title="Kelola Tugas Tambahan"
            >
              <UserCheck size={14} />
              <span>Penugasan</span>
            </button>
          )}

          <button
            type="button"
            className="master-data__icon-btn"
            onClick={() => handleOpenEdit(row)}
            title="Edit Data"
            aria-label="Edit Data"
          >
            <Pencil size={14} />
          </button>

          <button
            type="button"
            className="master-data__icon-btn master-data__icon-btn--danger"
            onClick={() => handleOpenDelete(row)}
            title="Hapus Data"
            aria-label="Hapus Data"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    };

    switch (activeTab) {
      case 'kelas':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Rombel',
            renderCell: (r) => (
              <strong className="font-mono text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          {
            key: 'level',
            label: 'Tingkat',
            renderCell: (r) => (
              <Badge variant="neutral">Tingkat {r.level}</Badge>
            ),
          },
          {
            key: 'next_class',
            label: 'Kelas Kenaikan',
            renderCell: (r) => {
              const target = classList.find((c) => c.id === r.next_class_id);
              if (r.next_class_id && target) {
                return (
                  <span className="font-mono text-[11.5px] font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                    &rarr; {target.name}
                  </span>
                );
              }
              if (r.level === 12) {
                return (
                  <Badge variant="success">Tingkat Akhir (Lulus)</Badge>
                );
              }
              return (
                <span className="text-xs text-neutral-400 italic">Belum Dipetakan</span>
              );
            },
          },
          baseActionCol,
        ];

      case 'ruang':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Ruang',
            renderCell: (r) => (
              <strong className="font-mono text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          {
            key: 'capacity',
            label: 'Kapasitas',
            align: 'right',
            renderCell: (r) => (
              <span className="font-mono text-xs text-neutral-700">{r.capacity} Kursi</span>
            ),
          },
          baseActionCol,
        ];

      case 'mapel':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Mata Pelajaran',
            renderCell: (r) => (
              <strong className="text-sm text-neutral-900">{r.name}</strong>
            ),
          },
          baseActionCol,
        ];

      case 'guru':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Lengkap Guru',
            renderCell: (r) => (
              <div>
                <strong className="text-sm text-neutral-900">{r.name}</strong>
                {r.email && (
                  <p className="text-xs text-neutral-500">{r.email}</p>
                )}
              </div>
            ),
          },
          {
            key: 'nip',
            label: 'NIP / ID',
            renderCell: (r) => (
              <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                {r.nis_nip || r.nip || '-'}
              </code>
            ),
          },
          {
            key: 'fet_staff_id',
            label: 'FET Staff ID',
            renderCell: (r) =>
              r.fet_staff_id ? (
                <code className="font-mono text-[11.5px] font-semibold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                  {r.fet_staff_id}
                </code>
              ) : (
                <span className="text-xs text-neutral-400 italic">Belum Ada</span>
              ),
          },
          {
            key: 'assignments',
            label: 'Tugas Tambahan',
            renderCell: (r) => {
              const asgns = r.assignments || [];
              if (asgns.length === 0) {
                return <span className="text-xs text-neutral-400">-</span>;
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {asgns.map((a, i) => {
                    const isWali = a.type === 'wali_kelas';
                    const cName = a.school_class?.name || a.schoolClass?.name || '';
                    return (
                      <Badge key={a.id || i} variant={isWali ? 'default' : 'warning'}>
                        {isWali ? `Wali ${cName}` : 'Kesiswaan'}
                      </Badge>
                    );
                  })}
                </div>
              );
            },
          },
          baseActionCol,
        ];

      case 'siswa':
        return [
          {
            key: 'no',
            label: 'No',
            renderCell: (_, idx) => (
              <span className="font-mono text-xs text-neutral-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
            ),
          },
          {
            key: 'name',
            label: 'Nama Siswa',
            renderCell: (r) => (
              <div>
                <strong className="text-sm text-neutral-900">{r.name}</strong>
                <p className="text-xs text-neutral-500 font-mono">
                  Wali: P-{r.nis_nip || r.nis}
                </p>
              </div>
            ),
          },
          {
            key: 'nis',
            label: 'NIS',
            renderCell: (r) => (
              <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                {r.nis_nip || r.nis}
              </code>
            ),
          },
          {
            key: 'class',
            label: 'Kelas',
            renderCell: (r) => (
              <Badge variant="neutral">
                {r.schoolClass?.name || r.className || 'Belum Masuk Kelas'}
              </Badge>
            ),
          },
          baseActionCol,
        ];

      default:
        return [];
    }
  }, [activeTab, classList, handleOpenEdit, handleOpenAssignment, handleOpenDelete]);

  return (
    <div className="master-data-page">
      {/* Header */}
      <div className="master-data__header">
        <div>
          <h1 className="master-data__title">Pengelolaan Master Data Sekolah</h1>
          <p className="master-data__subtitle">
            Kelola data institusi kelas rombel, ruang belajar, mata pelajaran, profil guru, dan peserta didik.
          </p>
        </div>

        <div className="master-data__header-actions">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={handleRefresh}
            loading={isLoading}
            title="Muat Ulang Data"
          >
            Refresh
          </Button>

          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Tambah {tabs.find((t) => t.id === activeTab)?.label}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="master-data__tabs-wrapper">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      {/* Toolbar (Search & Filter) */}
      <div className="master-data__toolbar">
        <div className="master-data__search">
          <SearchInput
            placeholder={`Cari ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()}...`}
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
          />
        </div>

        <div className="master-data__filters">
          {(activeTab === 'kelas' || activeTab === 'siswa') && (
            <select
              className="master-data__filter-select"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="10">Tingkat 10</option>
              <option value="11">Tingkat 11</option>
              <option value="12">Tingkat 12</option>
            </select>
          )}
        </div>
      </div>

      {/* Table Data or States */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <SkeletonRow count={6} />
        </div>
      ) : fetchError ? (
        <ErrorState
          title="Gagal Memuat Data"
          message={fetchError}
          onRetry={handleRefresh}
        />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title="Tidak Ada Data Ditemukan"
          message={
            searchQuery
              ? `Tidak ditemukan hasil yang cocok dengan kata kunci "${searchQuery}".`
              : `Belum ada data ${tabs.find((t) => t.id === activeTab)?.label.toLowerCase()} yang terdaftar.`
          }
          actionLabel={searchQuery ? 'Reset Pencarian' : `Tambah Data Baru`}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenAdd}
        />
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
          <Table columns={columns} data={filteredData} />
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <Modal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={
          modalType === 'create'
            ? `Tambah ${tabs.find((t) => t.id === activeTab)?.label} Baru`
            : `Edit ${tabs.find((t) => t.id === activeTab)?.label}`
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setModalType(null)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveForm}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {modalType === 'create' ? 'Simpan Data' : 'Perbarui Data'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveForm} className="master-data-form">
          {formErrors.general && (
            <div className="master-data-form__error">{formErrors.general}</div>
          )}

          {/* TAB 1: KELAS */}
          {activeTab === 'kelas' && (
            <>
              <Input
                label="Nama Kelas / Rombel"
                placeholder="Contoh: X-RPL-1, XI-TKJ-2"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Select
                label="Tingkat Kelas"
                value={formData.level || '10'}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                options={[
                  { value: '10', label: 'Tingkat 10 (Kelas Sepuluh)' },
                  { value: '11', label: 'Tingkat 11 (Kelas Sebelas)' },
                  { value: '12', label: 'Tingkat 12 (Kelas Dua Belas)' },
                ]}
              />

              <Select
                label="Kelas Kenaikan Tujuan (next_class_id)"
                value={formData.next_class_id || ''}
                onChange={(e) => setFormData({ ...formData, next_class_id: e.target.value })}
                options={[
                  { value: '', label: '-- Tidak Ada / Tingkat Akhir (Lulus) --' },
                  ...classList
                    .filter((c) => !editingItem || c.id !== editingItem.id)
                    .map((c) => ({
                      value: String(c.id),
                      label: `${c.name} (Tingkat ${c.level})`,
                    })),
                ]}
              />
            </>
          )}

          {/* TAB 2: RUANGAN */}
          {activeTab === 'ruang' && (
            <>
              <Input
                label="Nama Ruangan"
                placeholder="Contoh: R-101, Lab Multimedia 1"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="Kapasitas Kursi Siswa"
                type="number"
                min="1"
                max="100"
                value={formData.capacity || '36'}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                error={formErrors.capacity?.[0]}
                required
              />
            </>
          )}

          {/* TAB 3: MATA PELAJARAN */}
          {activeTab === 'mapel' && (
            <Input
              label="Nama Mata Pelajaran"
              placeholder="Contoh: Matematika, Pemrograman Web"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name?.[0]}
              required
            />
          )}

          {/* TAB 4: GURU */}
          {activeTab === 'guru' && (
            <>
              <Input
                label="Nama Lengkap Guru (beserta Gelar)"
                placeholder="Contoh: Drs. Bambang Irawan, M.Pd."
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="NIP / Identitas Pegawai"
                placeholder="Nomor Induk Pegawai 18 digit atau kode unik"
                value={formData.nip || ''}
                onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                error={formErrors.nip?.[0] || formErrors.nis_nip?.[0]}
                required
              />

              <Input
                label="FET Staff ID"
                placeholder="Kode Guru pada Timetable FET (Contoh: BIRAWAN)"
                value={formData.fet_staff_id || ''}
                onChange={(e) => setFormData({ ...formData, fet_staff_id: e.target.value })}
                error={formErrors.fet_staff_id?.[0]}
              />

              <Input
                label="Email Institusi (Opsional)"
                type="email"
                placeholder="guru@sekolah.sch.id"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formErrors.email?.[0]}
              />

              {modalType === 'create' && (
                <div className="master-data-form__hint">
                  <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                  <span>
                    Kata sandi acak 8 karakter akan dibuat secara otomatis oleh backend dan wajib disalin setelah data berhasil disimpan.
                  </span>
                </div>
              )}
            </>
          )}

          {/* TAB 5: SISWA */}
          {activeTab === 'siswa' && (
            <>
              <Input
                label="Nama Lengkap Siswa"
                placeholder="Contoh: Ananda Pratama"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0]}
                required
              />

              <Input
                label="Nomor Induk Siswa (NIS)"
                placeholder="Contoh: 2024001"
                value={formData.nis || ''}
                onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                error={formErrors.nis?.[0]}
                required
              />

              <Select
                label="Rombel Kelas"
                value={formData.class_id || ''}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                options={classList.map((c) => ({
                  value: String(c.id),
                  label: `${c.name} (Tingkat ${c.level})`,
                }))}
                required
              />

              {modalType === 'create' && (
                <div className="master-data-form__hint">
                  <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                  <span>
                    Sistem akan membuat 2 akun sekaligus: akun <strong>Siswa</strong> (NIS) dan akun <strong>Orang Tua</strong> (format <code>P-NIS</code>) dengan kredensial awal.
                  </span>
                </div>
              )}
            </>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Master"
        message={`Apakah Anda yakin ingin menghapus "${deletingItem?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Data"
        cancelLabel="Batal"
        confirmVariant="danger"
        loading={isDeleting}
      />

      {/* HTTP 409 Conflict Dialog */}
      <DeleteConflictDialog
        isOpen={conflictError !== null}
        onClose={() => setConflictError(null)}
        entityName={conflictError?.entityName}
        entityType={conflictError?.entityType}
        errorMessage={conflictError?.errorMessage}
      />

      {/* Initial Credential Modal */}
      <InitialCredentialModal
        isOpen={credentialModalData !== null}
        onClose={() => setCredentialModalData(null)}
        data={credentialModalData}
      />

      {/* Teacher Assignment Modal */}
      <TeacherAssignmentModal
        isOpen={assignmentTeacher !== null}
        onClose={() => setAssignmentTeacher(null)}
        teacher={assignmentTeacher}
        classList={classList}
        onAssign={handleAssignRole}
        onRevoke={handleRevokeRole}
      />
    </div>
  );
}
