import { Center, Loader } from "@mantine/core";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AdminLayout } from "./layout/AdminLayout";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DecksPage } from "./pages/DecksPage";
import { GrammarEditPage } from "./pages/GrammarEditPage";
import { GrammarPage } from "./pages/GrammarPage";
import { ListeningEditPage } from "./pages/ListeningEditPage";
import { ListeningPage } from "./pages/ListeningPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ImageAssignPage } from "./pages/ImageAssignPage";
import { MediaPage } from "./pages/MediaPage";
import { WordEditPage } from "./pages/WordEditPage";
import { WordsPage } from "./pages/WordsPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AboutPage } from "./pages/AboutPage";
import { PremiumPerksPage } from "./pages/PremiumPerksPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { FeedbackSettingsPage } from "./pages/FeedbackSettingsPage";
import { FeedbackTicketPage } from "./pages/FeedbackTicketPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UsersPage } from "./pages/UsersPage";

/** Pulls in the Excel/CSV libraries, so it is loaded only when opened. */
const WordImportPage = lazy(() => import("./pages/WordImportPage").then((m) => ({ default: m.WordImportPage })));

export function App() {
  const { ready, admin } = useAuth();

  if (!ready) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }
  if (!admin) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="words" element={<WordsPage />} />
        <Route path="words/new" element={<WordEditPage key="new" />} />
        <Route
          path="words/import"
          element={
            <Suspense
              fallback={
                <Center py="xl">
                  <Loader />
                </Center>
              }
            >
              <WordImportPage />
            </Suspense>
          }
        />
        <Route path="words/:id" element={<WordEditPage />} />
        <Route path="decks" element={<DecksPage />} />
        <Route path="images" element={<MediaPage />} />
        <Route path="image-assign" element={<ImageAssignPage />} />
        <Route path="grammar" element={<GrammarPage />} />
        <Route path="grammar/new" element={<GrammarEditPage key="new" />} />
        <Route path="grammar/:slug" element={<GrammarEditPage />} />
        <Route path="listening" element={<ListeningPage />} />
        <Route path="listening/new" element={<ListeningEditPage key="new" />} />
        <Route path="listening/:slug" element={<ListeningEditPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="notifications" element={<ComingSoonPage title="Thông báo" phase="giai đoạn thông báo 2" />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="premium" element={<PremiumPerksPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="feedback/settings" element={<FeedbackSettingsPage />} />
        <Route path="feedback/:id" element={<FeedbackTicketPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
