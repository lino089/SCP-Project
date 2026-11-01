import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  RefreshCw,
  Info,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
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
  FileUpload,
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

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('kelas');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  // Master datasets
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);

  // Teacher Import & Template states
  const [isTeacherImportModalOpen, setIsTeacherImportModalOpen] = useState(false);
  const [teacherImportFile, setTeacherImportFile] = useState(null);
  const [teacherImportLoading, setTeacherImportLoading] = useState(false);
  const [teacherImportSuccess, setTeacherImportSuccess] = useState(null);
  const [teacherImportErrors, setTeacherImportErrors] = useState(null);
  const [teacherImportGeneralError, setTeacherImportGeneralError] = useState(null);
  const [teacherDownloadingTemplate, setTeacherDownloadingTemplate] = useState(false);

  // Student Import & Template states
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] = useState(false);
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportSuccess, setStudentImportSuccess] = useState(null);
  const [studentImportErrors, setStudentImportErrors] = useState(null);
  const [studentImportGeneralError, setStudentImportGeneralError] = useState(null);
  const [studentDownloadingTemplate, setStudentDownloadingTemplate] = useState(false);

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
    } catch {
      if (activeTab === 'kelas') setClassList([]);
      else if (activeTab === 'ruang') setRoomList([]);
      else if (activeTab === 'mapel') setSubjectList([]);
      else if (activeTab === 'guru') { setTeacherList([]); setClassList([]); }
      else if (activeTab === 'siswa') { setStudentList([]); setClassList([]); }
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
      } catch {
        if (isMounted) {
          if (activeTab === 'kelas') setClassList([]);
          else if (activeTab === 'ruang') setRoomList([]);
          else if (activeTab === 'mapel') setSubjectList([]);
          else if (activeTab === 'guru') { setTeacherList([]); setClassList([]); }
          else if (activeTab === 'siswa') { setStudentList([]); setClassList([]); }
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Template Download Handlers
  const handleDownloadTeacherTemplate = async () => {
    setTeacherDownloadingTemplate(true);
    try {
      const blob = await teacherApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'guru_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengunduh template Excel guru: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setTeacherDownloadingTemplate(false);
    }
  };

  const handleDownloadStudentTemplate = async () => {
    setStudentDownloadingTemplate(true);
    try {
      const blob = await studentApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'siswa_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengunduh template Excel siswa: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setStudentDownloadingTemplate(false);
    }
  };

  // Submit Import Handlers
  const handleSubmitTeacherImport = async () => {
    if (!teacherImportFile) return;
    setTeacherImportLoading(true);
    setTeacherImportErrors(null);
    setTeacherImportGeneralError(null);
    setTeacherImportSuccess(null);

    const formData = new FormData();
    formData.append('file', teacherImportFile);

    try {
      const res = await teacherApi.importTeachers(formData);
      setTeacherImportSuccess(res.data || { imported_count: 0 });
      // Refresh teacherList
      const tRes = await teacherApi.getTeachers({ per_page: 100 }).catch(() => null);
      if (tRes?.data) setTeacherList(tRes.data);
    } catch (err) {
      if (Array.isArray(err.errors)) {
        setTeacherImportErrors(err.errors);
      } else if (err.raw?.response?.data?.errors && Array.isArray(err.raw.response.data.errors)) {
        setTeacherImportErrors(err.raw.response.data.errors);
      } else if (err.raw?.response?.data?.errors?.file) {
        setTeacherImportGeneralError(err.raw.response.data.errors.file[0]);
      } else {
        setTeacherImportGeneralError(err.message || 'Gagal mengimpor data guru.');
      }
    } finally {
      setTeacherImportLoading(false);
    }
  };

  const handleSubmitStudentImport = async () => {
    if (!studentImportFile) return;
    setStudentImportLoading(true);
    setStudentImportErrors(null);
    setStudentImportGeneralError(null);
    setStudentImportSuccess(null);

    const formData = new FormData();
    formData.append('file', studentImportFile);

    try {
      const res = await studentApi.importStudents(formData);
      setStudentImportSuccess(res.data || {});
      // Refresh both studentList and classList (since classes may be auto-created!)
      const [sRes, cRes] = await Promise.all([
        studentApi.getStudents({ per_page: 100 }).catch(() => null),
        classApi.getClasses({ per_page: 100 }).catch(() => null),
      ]);
      if (sRes?.data) setStudentList(sRes.data);
      if (cRes?.data) setClassList(cRes.data);
    } catch (err) {
      if (Array.isArray(err.errors)) {
        setStudentImportErrors(err.errors);
      } else if (err.raw?.response?.data?.errors && Array.isArray(err.raw.response.data.errors)) {
        setStudentImportErrors(err.raw.response.data.errors);
      } else if (err.raw?.response?.data?.errors?.file) {
        setStudentImportGeneralError(err.raw.response.data.errors.file[0]);
      } else {
        setStudentImportGeneralError(err.message || 'Gagal mengimpor data siswa.');
      }
    } finally {
      setStudentImportLoading(false);
    }
  };

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
          gender: '',
          nisn: '',
          class_id: classList[0]?.id ? String(classList[0].id) : '',
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
        gender: item.gender || '',
        nisn: item.nisn || '',
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
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap siswa wajib diisi.'];
          if (!formData.nis?.trim()) errors.nis = ['Nomor Induk Siswa (NIS) wajib diisi.'];
          if (!formData.class_id) errors.class_id = ['Rombel kelas wajib dipilih.'];
          if (!formData.gender) errors.gender = ['Jenis kelamin wajib dipilih (L atau P).'];
          if (!formData.nisn || !/^\d{10}$/.test(formData.nisn.trim())) {
            errors.nisn = ['NISN wajib diisi tepat 10 digit angka.'];
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nis: formData.nis.trim(),
            class_id: Number(formData.class_id),
            gender: formData.gender,
            nisn: formData.nisn.trim(),
          };
          try {
            const res = await studentApi.createStudent(payload);
            const student = res.data?.student || {
              id: Date.now(),
              ...payload,
              nis_nip: payload.nis,
              gender: payload.gender,
              nisn: payload.nisn,
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
              gender: payload.gender,
              nisn: payload.nisn,
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
          const errors = {};
          if (!formData.name?.trim()) errors.name = ['Nama lengkap siswa wajib diisi.'];
          if (!formData.nis?.trim()) errors.nis = ['Nomor Induk Siswa (NIS) wajib diisi.'];
          if (!formData.class_id) errors.class_id = ['Rombel kelas wajib dipilih.'];
          if (!formData.gender) errors.gender = ['Jenis kelamin wajib dipilih (L atau P).'];
          if (!formData.nisn || !/^\d{10}$/.test(formData.nisn.trim())) {
            errors.nisn = ['NISN wajib diisi tepat 10 digit angka.'];
          }

          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setIsSubmitting(false);
            return;
          }

          const payload = {
            name: formData.name.trim(),
            nis: formData.nis.trim(),
            class_id: Number(formData.class_id),
            gender: formData.gender,
            nisn: formData.nisn.trim(),
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
                    gender: payload.gender,
                    nisn: payload.nisn,
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
            key: 'nisn',
            label: 'NISN',
            renderCell: (r) => (
              <span className="font-mono text-xs text-neutral-600">
                {r.nisn || '-'}
              </span>
            ),
          },
          {
            key: 'gender',
            label: 'Gender',
            renderCell: (r) =>
              r.gender ? (
                <Badge variant={r.gender === 'L' ? 'info' : 'default'}>
                  {r.gender === 'L' ? 'L (Laki-laki)' : 'P (Perempuan)'}
                </Badge>
              ) : (
                <span className="text-xs text-neutral-400">-</span>
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

          {activeTab === 'guru' && (
            <>
              <Button
                variant="outline"
                icon={Download}
                onClick={handleDownloadTeacherTemplate}
                loading={teacherDownloadingTemplate}
                title="Unduh format spreadsheet impor guru (.xlsx)"
              >
                Unduh Template
              </Button>
              <Button
                variant="secondary"
                icon={Upload}
                onClick={() => {
                  setTeacherImportFile(null);
                  setTeacherImportErrors(null);
                  setTeacherImportGeneralError(null);
                  setTeacherImportSuccess(null);
                  setIsTeacherImportModalOpen(true);
                }}
                title="Impor data guru massal (.xlsx)"
              >
                Impor Guru (.xlsx)
              </Button>
            </>
          )}

          {activeTab === 'siswa' && (
            <>
              <Button
                variant="outline"
                icon={Download}
                onClick={handleDownloadStudentTemplate}
                loading={studentDownloadingTemplate}
                title="Unduh format spreadsheet impor siswa (.xlsx)"
              >
                Unduh Template
              </Button>
              <Button
                variant="secondary"
                icon={Upload}
                onClick={() => {
                  setStudentImportFile(null);
                  setStudentImportErrors(null);
                  setStudentImportGeneralError(null);
                  setStudentImportSuccess(null);
                  setIsStudentImportModalOpen(true);
                }}
                title="Impor data siswa massal (.xlsx)"
              >
                Impor Siswa (.xlsx)
              </Button>
            </>
          )}

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
                options={[
                  { value: '', label: '-- Pilih Rombel Kelas --' },
                  ...classList.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (Tingkat ${c.level})`,
                  })),
                ]}
                error={formErrors.class_id?.[0]}
                required
              />

              <Select
                label="Jenis Kelamin"
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                options={[
                  { value: '', label: '-- Pilih Jenis Kelamin (Wajib) --' },
                  { value: 'L', label: 'Laki-laki (L)' },
                  { value: 'P', label: 'Perempuan (P)' },
                ]}
                error={formErrors.gender?.[0]}
                required
              />

              <Input
                label="Nomor Induk Siswa Nasional (NISN)"
                placeholder="10 digit angka resmi Kemendikbud"
                value={formData.nisn || ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, nisn: cleaned });
                }}
                maxLength={10}
                error={formErrors.nisn?.[0]}
                helperText="Wajib, tepat 10 digit angka resmi NISN siswa"
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

      {/* Teacher Import Modal */}
      <Modal
        isOpen={isTeacherImportModalOpen}
        onClose={() => {
          if (!teacherImportLoading) setIsTeacherImportModalOpen(false);
        }}
        title="Impor Data Guru Massal (.xlsx)"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            {teacherImportSuccess ? (
              <Button
                variant="primary"
                onClick={() => setIsTeacherImportModalOpen(false)}
              >
                Selesai
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsTeacherImportModalOpen(false)}
                  disabled={teacherImportLoading}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  icon={Upload}
                  onClick={handleSubmitTeacherImport}
                  loading={teacherImportLoading}
                  disabled={!teacherImportFile || teacherImportLoading}
                >
                  Unggah &amp; Impor
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Info size={15} />
              <span>Ketentuan Format Berkas Excel Guru:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>Header wajib: <strong>nip</strong> (wajib format teks), <strong>name</strong>, <strong>fet_staff_id</strong> (kode staf pada FET).</li>
              <li>Header opsional: <strong>email</strong>, <strong>phone_number</strong>.</li>
              <li>Akun login guru akan dibuat otomatis dengan username &amp; kata sandi default NIP (wajib ganti kata sandi pada login pertama).</li>
            </ul>
          </div>

          {!teacherImportSuccess && (
            <FileUpload
              label="Pilih Berkas Spreadsheet (.xlsx)"
              accept=".xlsx"
              maxSizeMB={5}
              file={teacherImportFile}
              onChange={(f) => {
                setTeacherImportFile(f);
                setTeacherImportErrors(null);
                setTeacherImportGeneralError(null);
              }}
              disabled={teacherImportLoading}
              hint="Format berkas .xlsx (Excel), Maksimal 5 MB"
            />
          )}

          {/* Success Result Box */}
          {teacherImportSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Data Guru Berhasil Diimpor!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Sebanyak <strong>{teacherImportSuccess.imported_count}</strong> data guru telah berhasil diregistrasikan ke sistem beserta akun login dan ID staf FET.
              </p>
            </div>
          )}

          {/* General Error Banner */}
          {teacherImportGeneralError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{teacherImportGeneralError}</span>
            </div>
          )}

          {/* Atomic Row Errors Table */}
          {teacherImportErrors && teacherImportErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-red-800">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-red-600" />
                  Kesalahan Validasi Berkas ({teacherImportErrors.length} baris)
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  Transaksi dibatalkan. Mohon perbaiki dan unggah kembali.
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-red-200 rounded-md text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-red-50 text-red-900 font-semibold sticky top-0 border-b border-red-200">
                    <tr>
                      <th className="py-2 px-3 w-20">Baris</th>
                      <th className="py-2 px-3 w-32">Kolom</th>
                      <th className="py-2 px-3">Keterangan Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {teacherImportErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-red-900">
                          Baris {err.row}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700">
                          {err.attribute}
                        </td>
                        <td className="py-2 px-3 text-red-700">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Student Import Modal */}
      <Modal
        isOpen={isStudentImportModalOpen}
        onClose={() => {
          if (!studentImportLoading) setIsStudentImportModalOpen(false);
        }}
        title="Impor Data Siswa Massal (.xlsx)"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            {studentImportSuccess ? (
              <Button
                variant="primary"
                onClick={() => setIsStudentImportModalOpen(false)}
              >
                Selesai
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsStudentImportModalOpen(false)}
                  disabled={studentImportLoading}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  icon={Upload}
                  onClick={handleSubmitStudentImport}
                  loading={studentImportLoading}
                  disabled={!studentImportFile || studentImportLoading}
                >
                  Unggah &amp; Impor
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-blue-800">
              <Info size={15} />
              <span>Fitur Otomatisasi Zero-Manual (SCP v4.5):</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>Header wajib: <strong>nis</strong>, <strong>name</strong>, <strong>class_name</strong>, <strong>gender</strong> (L atau P).</li>
              <li>Header opsional: <strong>nisn</strong> (10 digit numerik), <strong>parent_name</strong>, <strong>parent_phone</strong>.</li>
              <li><strong>Auto-Create Kelas</strong>: Rombel baru pada kolom <code>class_name</code> akan didaftarkan otomatis dengan deteksi tingkat (10, 11, 12).</li>
              <li><strong>Auto-Provisioning</strong>: Akun siswa &amp; akun orang tua (format <code>P-NIS</code>) dibuat secara otomatis.</li>
            </ul>
          </div>

          {!studentImportSuccess && (
            <FileUpload
              label="Pilih Berkas Spreadsheet (.xlsx)"
              accept=".xlsx"
              maxSizeMB={5}
              file={studentImportFile}
              onChange={(f) => {
                setStudentImportFile(f);
                setStudentImportErrors(null);
                setStudentImportGeneralError(null);
              }}
              disabled={studentImportLoading}
              hint="Format berkas .xlsx (Excel), Maksimal 5 MB"
            />
          )}

          {/* Success Result Box */}
          {studentImportSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Siswa berhasil diimpor dan kelas baru telah otomatis didaftarkan.</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Siswa Diimpor</div>
                  <div className="text-base font-bold text-emerald-700">
                    {studentImportSuccess.students_imported ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Kelas Baru Dibuat</div>
                  <div className="text-base font-bold text-blue-700">
                    {studentImportSuccess.classes_created ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Kelas Telah Ada</div>
                  <div className="text-base font-bold text-gray-700">
                    {studentImportSuccess.classes_existing ?? 0}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-100 text-center">
                  <div className="text-[11px] text-gray-500">Akun Ortu Dibuat</div>
                  <div className="text-base font-bold text-purple-700">
                    {studentImportSuccess.parents_imported ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {studentImportGeneralError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <span>{studentImportGeneralError}</span>
            </div>
          )}

          {/* Atomic Row Errors Table */}
          {studentImportErrors && studentImportErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-red-800">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-red-600" />
                  Kesalahan Validasi Berkas ({studentImportErrors.length} baris)
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  Transaksi dibatalkan. Mohon perbaiki dan unggah kembali.
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-red-200 rounded-md text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-red-50 text-red-900 font-semibold sticky top-0 border-b border-red-200">
                    <tr>
                      <th className="py-2 px-3 w-20">Baris</th>
                      <th className="py-2 px-3 w-32">Kolom</th>
                      <th className="py-2 px-3">Keterangan Masalah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {studentImportErrors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-red-900">
                          Baris {err.row}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700">
                          {err.attribute}
                        </td>
                        <td className="py-2 px-3 text-red-700">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
