import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AlertBanner } from './components/AlertBanner';
import { LiveSync } from './components/LiveSync';
import { TabBar } from './components/TabBar';
import { BubbleCup } from './screens/BubbleCup';
import { ExploreMap } from './screens/ExploreMap';
import { Neighborhood } from './screens/Neighborhood';
import { Passport } from './screens/Passport';
import { Profile } from './screens/Profile';
import { StampEarned } from './screens/StampEarned';
import { TurfMap } from './screens/TurfMap';
import { Welcome } from './screens/Welcome';
import { useGame } from './store/game';

function Shell() {
  const onboarded = useGame((s) => s.onboarded);
  const { pathname } = useLocation();
  if (!onboarded && pathname !== '/welcome') return <Navigate to="/welcome" replace />;
  const hideTabs = pathname === '/welcome' || pathname.startsWith('/stamp');
  return (
    <div className="relative mx-auto min-h-[100dvh] max-w-[430px] bg-paper shadow-[0_0_40px_rgba(20,33,61,0.12)]">
      <LiveSync />
      <AlertBanner />
      <main>
        <Outlet />
      </main>
      {!hideTabs && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Passport />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/explore" element={<ExploreMap />} />
        <Route path="/turf" element={<TurfMap />} />
        <Route path="/n/:id" element={<Neighborhood />} />
        <Route path="/stamp/:id" element={<StampEarned />} />
        <Route path="/cup" element={<BubbleCup />} />
        <Route path="/me" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
