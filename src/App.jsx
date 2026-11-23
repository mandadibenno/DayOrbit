import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SpaceProvider } from './context/SpaceContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AppShell from './components/AppShell.jsx';
import { afterAuthPath } from './lib/invites.js';

import Welcome from './pages/Welcome.jsx';
import { ForgotPassword, ResetPassword, SignIn, SignUp } from './pages/auth/AuthForms.jsx';
import { AboutYou, YourSpaces } from './pages/onboarding/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Lists from './pages/Lists.jsx';
import Money from './pages/money/Money.jsx';
import GroupDetail from './pages/money/GroupDetail.jsx';
import AddExpense from './pages/money/AddExpense.jsx';
import RecordPayment from './pages/money/RecordPayment.jsx';
import Menu from './pages/Menu.jsx';
import Calendar from './pages/Calendar.jsx';
import Health from './pages/health/Health.jsx';
import CycleToday from './pages/health/CycleToday.jsx';
import CycleCalendar from './pages/health/CycleCalendar.jsx';
import SharedCycle from './pages/health/SharedCycle.jsx';
import NewSpace from './pages/spaces/NewSpace.jsx';
import SpaceSettings from './pages/spaces/SpaceSettings.jsx';
import JoinSpace from './pages/spaces/JoinSpace.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

function Splash() {
  return <div className="splash"><div className="spinner" role="status" aria-label="Loading DayOrbit" /></div>;
}

/** Signed-in area: sends signed-out people to Welcome and new accounts through onboarding. */
function RequireAuth() {
  const { status, profile } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />;
  if (profile && !profile.onboarded && !location.pathname.startsWith('/onboarding')) return <Navigate to="/onboarding/about" replace />;
  return (
    <SpaceProvider>
      <Outlet />
    </SpaceProvider>
  );
}

function RootRedirect() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return <Navigate to={status === 'signedIn' ? afterAuthPath() : '/welcome'} replace />;
}

export default function App() {
  return (
    // Hash routes (/#/home) work on any static host, including GitHub Pages, with no server rewrites.
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/join/:token" element={<JoinSpace />} />

            <Route element={<RequireAuth />}>
              <Route path="/onboarding/about" element={<AboutYou />} />
              <Route path="/onboarding/spaces" element={<YourSpaces />} />
              <Route element={<AppShell />}>
                <Route path="/home" element={<Home />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/money" element={<Money />} />
                <Route path="/money/group/:groupId" element={<GroupDetail />} />
                <Route path="/money/group/:groupId/add" element={<AddExpense />} />
                <Route path="/money/group/:groupId/expense/:expenseId/edit" element={<AddExpense />} />
                <Route path="/money/group/:groupId/pay" element={<RecordPayment />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/health" element={<Health />} />
                <Route path="/health/cycle" element={<CycleToday />} />
                <Route path="/health/cycle/calendar" element={<CycleCalendar />} />
                <Route path="/health/shared/:ownerId" element={<SharedCycle />} />
                <Route path="/spaces/new" element={<NewSpace />} />
                <Route path="/spaces/settings" element={<SpaceSettings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
