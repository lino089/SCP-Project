import { Routes, Route, Navigate } from 'react-router-dom';
import PublicRoute from './PublicRoute';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { WebLayout } from '../components/layout';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import ProfilePage from '../pages/profile/ProfilePage';
import MasterDataPage from '../pages/waka/MasterDataPage';
import GradePromotionPage from '../pages/waka/GradePromotionPage';
import DashboardWakaPage from '../pages/waka/DashboardWakaPage';
import ScheduleManagementPage from '../pages/waka/ScheduleManagementPage';
import UploadImportPage from '../pages/waka/UploadImportPage';
import ReviewImportPage from '../pages/waka/ReviewImportPage';
import TeacherSchedulePage from '../pages/teacher/TeacherSchedulePage';
import TeacherJournalPage from '../pages/teacher/TeacherJournalPage';
import TeacherQuizPage from '../pages/teacher/TeacherQuizPage';
import MonitoringRecapPage from '../pages/waka/MonitoringRecapPage';
import PermissionVerifyPage from '../pages/teacher/PermissionVerifyPage';
import StudentPermissionPage from '../pages/student/StudentPermissionPage';
import StudentQuizPage from '../pages/student/StudentQuizPage';
import ParentMonitoringPage from '../pages/parent/ParentMonitoringPage';
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
        headerAction={<Badge variant="default">{phase}</Badge>}
        subtitle="School Class Progress"
      >
        <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 bg-gray-50 text-gray-700 border border-gray-200 rounded-full flex items-center justify-center">
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
            <Route path="/web/dashboard" element={<DashboardWakaPage />} />
            <Route path="/web/schedules" element={<ScheduleManagementPage />} />
            <Route path="/web/upload-import" element={<UploadImportPage />} />
            <Route path="/web/review-import/:id" element={<ReviewImportPage />} />
            <Route path="/web/review-import" element={<ReviewImportPage />} />
            <Route path="/web/master-data" element={<MasterDataPage />} />
            <Route path="/web/grade-promotion" element={<GradePromotionPage />} />
          </Route>

          {/* Shared Waka & Teacher (Kesiswaan) Monitoring Route */}
          <Route element={<RoleRoute allowedRoles={['waka', 'teacher']} />}>
            <Route path="/web/monitoring" element={<MonitoringRecapPage />} />
          </Route>

          {/* Teacher Routes */}
          <Route element={<RoleRoute allowedRoles={['teacher']} />}>
            <Route path="/teacher/schedule" element={<TeacherSchedulePage />} />
            <Route path="/teacher/journal" element={<TeacherJournalPage />} />
            <Route path="/teacher/quiz" element={<TeacherQuizPage />} />
            <Route path="/teacher/permissions" element={<PermissionVerifyPage />} />
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
            <Route path="/student/permissions" element={<StudentPermissionPage />} />
            <Route path="/student/quiz" element={<StudentQuizPage />} />
          </Route>

          {/* Parent Routes */}
          <Route element={<RoleRoute allowedRoles={['parent']} />}>
            <Route path="/parent/monitoring" element={<ParentMonitoringPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback & Root Redirection */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
