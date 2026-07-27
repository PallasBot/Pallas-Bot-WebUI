import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";
import ConsoleSetupGuard from "@/components/ConsoleSetupGuard";
import AppShell from "@/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import { commonConfigLegacyRedirectPath } from "@/utils/commonConfigRedirects";
import { AI_OBSERVATION_DEFAULT_PATH } from "@/config/aiObservationSections";

const HomePage = lazy(() => import("@/pages/HomePage"));
const ChartsPage = lazy(() => import("@/pages/ChartsPage"));
const CommunityGalleryPage = lazy(() => import("@/pages/CommunityGalleryPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const DatabaseBackupsPage = lazy(() => import("@/pages/DatabaseBackupsPage"));
const DatabasePage = lazy(() => import("@/pages/DatabasePage"));
const FriendsGroupsPage = lazy(() => import("@/pages/FriendsGroupsPage"));
const InstancesPage = lazy(() => import("@/pages/InstancesPage"));
const LogErrorsPage = lazy(() => import("@/pages/LogErrorsPage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const PluginStorePage = lazy(() => import("@/pages/PluginStorePage"));
const PluginsPage = lazy(() => import("@/pages/PluginsPage"));
const PreferencesPage = lazy(() => import("@/pages/PreferencesPage"));
const SetupWizardPage = lazy(() => import("@/pages/SetupWizardPage"));
const ProtocolPage = lazy(() => import("@/pages/ProtocolPage"));
const ProtocolAccountsTab = lazy(() => import("@/pages/protocol/ProtocolAccountsTab"));
const ProtocolAssetsTab = lazy(() => import("@/pages/protocol/ProtocolAssetsTab"));
const ProtocolCreateTab = lazy(() => import("@/pages/protocol/ProtocolCreateTab"));
const ProtocolImportTab = lazy(() => import("@/pages/protocol/ProtocolImportTab"));
const ProtocolRuntimeTab = lazy(() => import("@/pages/protocol/ProtocolRuntimeTab"));
const UpdatePage = lazy(() => import("@/pages/UpdatePage"));
const AiConfigPage = lazy(() => import("@/pages/ai/AiConfigPage"));
const AiHistoryPage = lazy(() => import("@/pages/ai/AiHistoryPage"));
const AiLayout = lazy(() => import("@/pages/ai/AiLayout"));
const AiLogsPage = lazy(() => import("@/pages/ai/AiLogsPage"));
const AiMemoryPage = lazy(() => import("@/pages/ai/AiMemoryPage"));
const AiPeoplePage = lazy(() => import("@/pages/ai/AiPeoplePage"));
const AiToolsPage = lazy(() => import("@/pages/ai/AiToolsPage"));
const AiTasksPage = lazy(() => import("@/pages/ai/AiTasksPage"));
const AiObservationLayout = lazy(() => import("@/pages/ai/AiObservationLayout"));
const AiPersonaPage = lazy(() => import("@/pages/ai/AiPersonaPage"));
const AiStatisticsPage = lazy(() => import("@/pages/ai/AiStatisticsPage"));

function CommonConfigLegacyRedirect({ fromPathParam = false }: { fromPathParam?: boolean }) {
  const { sectionId } = useParams();
  const [search] = useSearchParams();
  const id = fromPathParam ? String(sectionId || "") : String(search.get("section") || "");
  if (!id.trim()) return <Navigate to="/plugins" replace />;
  return <Navigate to={commonConfigLegacyRedirectPath(id)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<ConsolePageSkeleton panels={1} />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/"
        element={
          <ConsoleSetupGuard>
            <AppShell />
          </ConsoleSetupGuard>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="log-errors" element={<LogErrorsPage />} />
        <Route path="instances" element={<InstancesPage />} />
        <Route path="protocol" element={<ProtocolPage />}>
          <Route index element={<ProtocolAccountsTab />} />
          <Route path="create" element={<ProtocolCreateTab />} />
          <Route path="import" element={<ProtocolImportTab />} />
          <Route path="assets" element={<ProtocolAssetsTab />} />
          <Route path="runtime" element={<ProtocolRuntimeTab />} />
          <Route path="*" element={<Navigate to="/protocol" replace />} />
        </Route>
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="plugins/:name" element={<PluginsPage />} />
        <Route path="plugin-store" element={<PluginStorePage />} />
        <Route path="friends-groups" element={<FriendsGroupsPage />} />
        <Route path="friends" element={<Navigate to="/friends-groups" replace />} />
        <Route path="groups" element={<Navigate to="/friends-groups" replace />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="database/backups" element={<DatabaseBackupsPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community-gallery" element={<CommunityGalleryPage />} />
        <Route path="corpus-config" element={<Navigate to="/plugins/pb_core" replace />} />
        <Route path="community-stats-config" element={<Navigate to="/plugins/pb_stats" replace />} />
        <Route path="common-config" element={<CommonConfigLegacyRedirect />} />
        <Route path="common-config/:sectionId" element={<CommonConfigLegacyRedirect fromPathParam />} />
        <Route path="preferences" element={<PreferencesPage />} />
        <Route path="setup" element={<SetupWizardPage />} />
        <Route path="security" element={<Navigate to="/preferences#console-password" replace />} />
        <Route path="update" element={<UpdatePage />} />
        <Route path="ai" element={<AiLayout />}>
          <Route element={<AiObservationLayout />}>
            <Route index element={<Navigate to="statistics" replace />} />
            <Route path="home" element={<Navigate to={AI_OBSERVATION_DEFAULT_PATH} replace />} />
            <Route path="statistics" element={<AiStatisticsPage />} />
            <Route path="session" element={<AiHistoryPage />} />
            <Route path="history" element={<Navigate to="/ai/session" replace />} />
            <Route path="memory" element={<AiMemoryPage />} />
            <Route path="people" element={<AiPeoplePage />} />
            <Route path="tools" element={<AiToolsPage />} />
            <Route path="tasks" element={<AiTasksPage />} />
            <Route path="persona" element={<AiPersonaPage />} />
            <Route path="logs" element={<AiLogsPage />} />
          </Route>
          <Route path="config" element={<Navigate to="provider" replace />} />
          <Route path="config/:section" element={<AiConfigPage />} />
          <Route path="wizard" element={<Navigate to={AI_OBSERVATION_DEFAULT_PATH} replace />} />
          <Route path="*" element={<Navigate to="statistics" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
