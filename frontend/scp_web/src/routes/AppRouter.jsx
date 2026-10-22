import { Routes, Route, Navigate } from 'react-router-dom';
import PublicRoute from './PublicRoute';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { WebLayout } from '../components/layout';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import ProfilePage from '../pages/profile/ProfilePage';
import { Card, Badge, Button } from '../components/shared';
import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Placeholder component for feature modules scheduled for future phases (Phase 2 - Phase 7)
 */
function ModulePlaceholder({ title, phase, description }) {
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-4">
      <Card
        title={title}
        headerAction={<Badge variant="primary">{phase}</Badge>}
        subtitle="School Class Project (SCP)"
      >
        <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Construction size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 max-w-md">{description}</p>
          <div className="pt-4">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
              Kembali
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Mandatory Change Password Route */}
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* Authenticated Protected Shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<WebLayout />}>
          {/* Universal Profile Route */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Waka Kurikulum Routes */}
          <Route element={<RoleRoute allowedRoles={['waka']} />}>
            <Route
              path="/web/dashboard"
              element={
                <ModulePlaceholder
                  title="Dashboard Akademik & KBM"
                  phase="Fase 7"
                  description="Ringkasan siklus jadwal putaran aktif, status upacara, dan rekapitulasi kepatuhan jurnal sekolah."
                />
              }
            />
            <Route
              path="/web/schedules"
              element={
                <ModulePlaceholder
                  title="Manajemen Jadwal Pelajaran"
                  phase="Fase 3"
                  description="Pengelolaan jadwal mingguan, matriks jam mengajar, dan alokasi ruang belajar."
                />
              }
            />
            <Route
              path="/web/upload-import"
              element={
                <ModulePlaceholder
                  title="Import Jadwal PDF FET"
                  phase="Fase 3"
                  description="Unggah berkas jadwal FET dan pemrosesan asinkron."
                />
              }
            />
            <Route
              path="/web/review-import"
              element={
                <ModulePlaceholder
                  title="Review & Resolusi Impor Jadwal"
                  phase="Fase 3"
                  description="Resolusi konflik jadwal bentrok dan konfirmasi komit data."
                />
              }
            />
            <Route
              path="/web/master-data"
              element={
                <ModulePlaceholder
                  title="Pengelolaan Master Data"
                  phase="Fase 2"
                  description="CRUD data referensi kelas, ruang belajar, mata pelajaran, guru, dan peserta didik."
                />
              }
            />
            <Route
              path="/web/grade-promotion"
              element={
                <ModulePlaceholder
                  title="Siklus Kenaikan Kelas & Kelulusan"
                  phase="Fase 2"
                  description="Pemrosesan promosi kelas massal, siswa tinggal kelas, dan kelulusan."
                />
              }
            />
            <Route
              path="/web/monitoring"
              element={
                <ModulePlaceholder
                  title="Monitoring & Rekapitulasi Presensi"
                  phase="Fase 5"
                  description="Rekapitulasi kehadiran institusi, persetujuan izin, dan delegasi piket."
                />
              }
            />
          </Route>

          {/* Teacher Routes */}
          <Route element={<RoleRoute allowedRoles={['teacher']} />}>
            <Route
              path="/teacher/schedule"
              element={
                <ModulePlaceholder
                  title="Jadwal Mengajar Guru"
                  phase="Fase 4"
                  description="Kalender jadwal KBM mingguan dan status mengajar."
                />
              }
            />
            <Route
              path="/teacher/journal"
              element={
                <ModulePlaceholder
                  title="Jurnal KBM & Presensi Siswa"
                  phase="Fase 4"
                  description="Pengisian jurnal KBM harian, unggah foto bukti, dan pencatatan presensi siswa."
                />
              }
            />
            <Route
              path="/teacher/quiz"
              element={
                <ModulePlaceholder
                  title="Manajemen Kuis Berbantuan AI"
                  phase="Fase 6"
                  description="Pembuatan kuis via Prompt AI, ekstraksi materi PDF/TXT, dan evaluasi hasil belajar siswa."
                />
              }
            />
            <Route
              path="/teacher/permissions"
              element={
                <ModulePlaceholder
                  title="Verifikasi Perizinan Siswa"
                  phase="Fase 5"
                  description="Pemeriksaan dan persetujuan pengajuan izin ketidakhadiran siswa."
                />
              }
            />
          </Route>

          {/* Student Routes */}
          <Route element={<RoleRoute allowedRoles={['student']} />}>
            <Route
              path="/student/home"
              element={
                <ModulePlaceholder
                  title="Beranda & Presensi Mandiri Siswa"
                  phase="Fase 7"
                  description="Presensi kehadiran kelas, riwayat absensi, dan jadwal KBM hari ini."
                />
              }
            />
            <Route
              path="/student/permissions"
              element={
                <ModulePlaceholder
                  title="Pengajuan Perizinan Siswa"
                  phase="Fase 5"
                  description="Form permohonan izin (Sakit/Izin Dispensasi) dan unggah surat bukti."
                />
              }
            />
            <Route
              path="/student/quiz"
              element={
                <ModulePlaceholder
                  title="Pengerjaan Kuis Interaktif AI"
                  phase="Fase 6"
                  description="Pengerjaan evaluasi materi kuis dan riwayat skor pengerjaan."
                />
              }
            />
          </Route>

          {/* Parent Routes */}
          <Route element={<RoleRoute allowedRoles={['parent']} />}>
            <Route
              path="/parent/monitoring"
              element={
                <ModulePlaceholder
                  title="Portal Monitoring Orang Tua"
                  phase="Fase 7"
                  description="Pemantauan kehadiran anak, status perizinan, dan capaian kuis harian."
                />
              }
            />
          </Route>
        </Route>
      </Route>

      {/* Fallback & Root Redirection */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
