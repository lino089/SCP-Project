import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicRoute from './PublicRoute';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { WebLayout } from '../components/layout';
import { LoadingOverlay } from '../components/feedback';

// Lazy-loaded Pages (Route-Based Code Splitting)
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ChangePasswordPage = lazy(() => import('../pages/auth/ChangePasswordPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const DashboardWakaPage = lazy(() => import('../pages/waka/DashboardWakaPage'));
const ScheduleManagementPage = lazy(() => import('../pages/waka/ScheduleManagementPage'));
const UploadImportPage = lazy(() => import('../pages/waka/UploadImportPage'));
const ReviewImportPage = lazy(() => import('../pages/waka/ReviewImportPage'));
const MasterDataPage = lazy(() => import('../pages/waka/MasterDataPage'));
const GradePromotionPage = lazy(() => import('../pages/waka/GradePromotionPage'));
const MonitoringRecapPage = lazy(() => import('../pages/waka/MonitoringRecapPage'));
const TeacherSchedulePage = lazy(() => import('../pages/teacher/TeacherSchedulePage'));
const TeacherJournalPage = lazy(() => import('../pages/teacher/TeacherJournalPage'));
const TeacherQuizPage = lazy(() => import('../pages/teacher/TeacherQuizPage'));
const PermissionVerifyPage = lazy(() => import('../pages/teacher/PermissionVerifyPage'));
const StudentHomePage = lazy(() => import('../pages/student/StudentHomePage'));
const StudentPermissionPage = lazy(() => import('../pages/student/StudentPermissionPage'));
const StudentQuizPage = lazy(() => import('../pages/student/StudentQuizPage'));
const ParentMonitoringPage = lazy(() => import('../pages/parent/ParentMonitoringPage'));

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingOverlay fixed message="Memuat antarmuka..." />}>
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
              <Route path="/student/home" element={<StudentHomePage />} />
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
    </Suspense>
  );
}
