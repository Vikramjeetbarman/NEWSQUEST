
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';

const ArenaPage = lazy(() => import('./pages/Arena').then((m) => ({ default: m.ArenaPage })));
const ArticlePage = lazy(() => import('./pages/Article').then((m) => ({ default: m.ArticlePage })));
const AuthPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.AuthPage })));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard').then((m) => ({ default: m.LeaderboardPage })));
const NewsPage = lazy(() => import('./pages/News').then((m) => ({ default: m.NewsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFoundPage })));
const PlayPage = lazy(() => import('./pages/Play').then((m) => ({ default: m.PlayPage })));
const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })));
const SourcesPage = lazy(() => import('./pages/Sources').then((m) => ({ default: m.SourcesPage })));
const VaultPage = lazy(() => import('./pages/Vault').then((m) => ({ default: m.VaultPage })));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="news/:section" element={<NewsPage />} />
        <Route path="article/:id" element={<ArticlePage />} />
        <Route path="arena" element={<ArenaPage />} />
        <Route path="play/:sid" element={<PlayPage />} />
        <Route path="vault" element={<VaultPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<Navigate to="/login?mode=register" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}