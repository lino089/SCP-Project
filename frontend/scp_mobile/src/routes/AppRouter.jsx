import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ROLES } from '../context/authConstants';
import { useAuth } from '../hooks/useAuth';
import PublicRoute from './PublicRoute';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import MobileLayout from '../components/layout/MobileLayout';
import ForbiddenState from '../components/feedback/ForbiddenState';

// Lazy Loaded Pages for Performance & Optimal Chunking (Fase 7)
// Auth Pages
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ChangePasswordPage = lazy(() => import('../pages/auth/ChangePasswordPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));

// Waka Kurikulum Pages (Fase 4)
const WakaDashboardPage = lazy(() => import('../pages/waka/WakaDashboardPage'));
const AcademicCalendarPage = lazy(() => import('../pages/waka/AcademicCalendarPage'));
const ScheduleManagementPage = lazy(() => import('../pages/waka/ScheduleManagementPage'));
const MasterDataPage = lazy(() => import('../pages/waka/MasterDataPage'));
const GradePromotionPage = lazy(() => import('../pages/waka/GradePromotionPage'));
const MonitoringPage = lazy(() => import('../pages/waka/MonitoringPage'));

// Teacher & Kesiswaan Pages (Fase 3 & Fase 5)
const TeacherDashboardPage = lazy(() => import('../pages/teacher/TeacherDashboardPage'));
const TeacherCalendarPage = lazy(() => import('../pages/teacher/TeacherCalendarPage'));
const TeacherSchedulePage = lazy(() => import('../pages/teacher/TeacherSchedulePage'));
const TeacherJournalPage = lazy(() => import('../pages/teacher/TeacherJournalPage'));
const TeacherLeavePage = lazy(() => import('../pages/teacher/TeacherLeavePage'));
const PermissionVerifyPage = lazy(() => import('../pages/teacher/PermissionVerifyPage'));
const TeacherQuizPage = lazy(() => import('../pages/teacher/TeacherQuizPage'));
const QuizCreatePage = lazy(() => import('../pages/teacher/QuizCreatePage'));

// Student & Parent Shared Calendar (Fase 3) & Pages (Fase 6)
const StudentHomePage = lazy(() => import('../pages/student/StudentHomePage'));
const StudentCalendarPage = lazy(() => import('../pages/student/StudentCalendarPage'));
const StudentSchedulePage = lazy(() => import('../pages/student/StudentSchedulePage'));
const StudentPermissionPage = lazy(() => import('../pages/student/StudentPermissionPage'));
const StudentQuizPage = lazy(() => import('../pages/student/StudentQuizPage'));
const QuizIntroPage = lazy(() => import('../pages/student/QuizIntroPage'));
const QuizAttemptPage = lazy(() => import('../pages/student/QuizAttemptPage'));

const ParentMonitoringPage = lazy(() => import('../pages/parent/ParentMonitoringPage'));
const ParentCalendarPage = lazy(() => import('../pages/parent/ParentCalendarPage'));

function PageLoadingFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] p-6 text-[var(--color-text-muted)]">
      <div className="w-8 h-8 border-2 border-[var(--color-border-subtle)] border-t-[var(--color-action)] rounded-full animate-spin mb-2.5" />
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">Memuat halaman...</span>
    </div>
  );
}

function UnauthorizedView() {
  const navigate = useNavigate();
  const { getHomeRoute } = useAuth();
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--color-bg-app)]">
      <ForbiddenState onBack={() => navigate(getHomeRoute())} />
    </div>
  );
}

/**
 * AppRouter — SCP Mobile Routing Architecture
 * Strictly enforces role & assignment guards (`waka`, `teacher`, `student`, `parent`, `isKesiswaan`, `isWaliKelas`).
 * Explicitly excludes all Waka Data Import routes (`/kurikulum/jadwal/import`, `/web/schedule-import`, etc.).
 */
export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Mandatory Change Password Route (Isolated from MobileLayout) */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Protected Routes inside MobileLayout Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MobileLayout />}>
            {/* Universal Profile Route */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* ==========================================
                ROLE: WAKA KURIKULUM (Import Routes Excluded)
               ========================================== */}
            <Route element={<RoleRoute allowedRoles={[ROLES.WAKA]} />}>
              <Route path="/web/dashboard" element={<WakaDashboardPage />} />
              <Route path="/web/academic-calendar" element={<AcademicCalendarPage />} />
              <Route path="/web/schedules" element={<ScheduleManagementPage />} />
              <Route path="/web/master-data" element={<MasterDataPage />} />
              <Route path="/web/grade-promotion" element={<GradePromotionPage />} />
            </Route>

            {/* Shared Waka + Teacher Kesiswaan Route */}
            <Route
              element={<RoleRoute allowedRoles={[ROLES.WAKA]} allowKesiswaan />}
            >
              <Route path="/web/monitoring" element={<MonitoringPage />} />
            </Route>

            {/* ==========================================
                ROLE: TEACHER (Guru, Wali Kelas, Kesiswaan)
               ========================================== */}
            <Route
              element={<RoleRoute allowedRoles={[ROLES.TEACHER, ROLES.WAKA]} />}
            >
              <Route path="/teacher/dashboard" element={<TeacherDashboardPage />} />
              <Route path="/teacher/calendar" element={<TeacherCalendarPage />} />
              <Route path="/teacher/schedule" element={<TeacherSchedulePage />} />
              <Route path="/teacher/journal" element={<TeacherJournalPage />} />
              <Route path="/teacher/leave" element={<TeacherLeavePage />} />
              <Route path="/teacher/quiz" element={<TeacherQuizPage />} />
              <Route path="/teacher/quiz/create" element={<QuizCreatePage />} />
            </Route>

            {/* Teacher Permissions Verification (Waka / Kesiswaan / Wali Kelas) */}
            <Route
              element={
                <RoleRoute
                  allowKesiswaan
                  allowWaliKelas
                />
              }
            >
              <Route
                path="/teacher/permissions"
                element={<PermissionVerifyPage />}
              />
            </Route>

            {/* ==========================================
                ROLE: STUDENT (Siswa)
               ========================================== */}
            <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT]} />}>
              <Route path="/student" element={<Navigate to="/student/home" replace />} />
              <Route path="/student/home" element={<StudentHomePage />} />
              <Route path="/student/calendar" element={<StudentCalendarPage />} />
              <Route path="/student/schedule" element={<StudentSchedulePage />} />
              <Route path="/student/quiz" element={<StudentQuizPage />} />
              <Route path="/student/quiz/:id" element={<QuizIntroPage />} />
              <Route path="/student/quiz/:id/attempt" element={<QuizAttemptPage />} />
              <Route path="/student/quizzes" element={<StudentQuizPage />} />
              <Route path="/student/permission" element={<StudentPermissionPage />} />
              <Route path="/student/permissions" element={<StudentPermissionPage />} />
            </Route>

            {/* ==========================================
                ROLE: PARENT (Orang Tua / Wali)
               ========================================== */}
            <Route element={<RoleRoute allowedRoles={[ROLES.PARENT]} />}>
              <Route path="/parent" element={<Navigate to="/parent/monitoring" replace />} />
              <Route path="/parent/home" element={<Navigate to="/parent/monitoring" replace />} />
              <Route path="/parent/monitoring" element={<ParentMonitoringPage />} />
              <Route path="/parent/calendar" element={<ParentCalendarPage />} />
              <Route path="/parent/schedule" element={<Navigate to="/parent/monitoring" replace />} />
              <Route path="/parent/quizzes" element={<Navigate to="/parent/monitoring" replace />} />
              <Route path="/parent/permission" element={<Navigate to="/parent/monitoring" replace />} />
            </Route>
          </Route>
        </Route>

        {/* Unauthorized State */}
        <Route path="/unauthorized" element={<UnauthorizedView />} />

        {/* Root redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Fallback 404 Route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
