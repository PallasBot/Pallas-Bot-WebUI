import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import ConsoleSetupGuard from "@/components/ConsoleSetupGuard";
import AppShell from "@/layout/AppShell";
import ChartsPage from "@/pages/ChartsPage";
import CommunityPage from "@/pages/CommunityPage";
import DatabaseBackupsPage from "@/pages/DatabaseBackupsPage";
import DatabasePage from "@/pages/DatabasePage";
import FriendsGroupsPage from "@/pages/FriendsGroupsPage";
import HomePage from "@/pages/HomePage";
import InstancesPage from "@/pages/InstancesPage";
import LogErrorsPage from "@/pages/LogErrorsPage";
import LogsPage from "@/pages/LogsPage";
import PluginStorePage from "@/pages/PluginStorePage";
import PluginsPage from "@/pages/PluginsPage";
import PreferencesPage from "@/pages/PreferencesPage";
import SetupWizardPage from "@/pages/SetupWizardPage";
import ProtocolPage from "@/pages/ProtocolPage";
import ProtocolAccountsTab from "@/pages/protocol/ProtocolAccountsTab";
import ProtocolAssetsTab from "@/pages/protocol/ProtocolAssetsTab";
import ProtocolCreateTab from "@/pages/protocol/ProtocolCreateTab";
import ProtocolImportTab from "@/pages/protocol/ProtocolImportTab";
import UpdatePage from "@/pages/UpdatePage";
import AiConfigPage from "@/pages/ai/AiConfigPage";
import AiHistoryPage from "@/pages/ai/AiHistoryPage";
import AiHomePage from "@/pages/ai/AiHomePage";
import AiLayout from "@/pages/ai/AiLayout";
import AiStatisticsPage from "@/pages/ai/AiStatisticsPage";
import AiWizardPage from "@/pages/ai/AiWizardPage";
import { commonConfigLegacyRedirectPath } from "@/utils/commonConfigRedirects";

/** 对齐 Vue：旧 /common-config 书签重定向到插件页 / AI 配置 */
function CommonConfigLegacyRedirect({ fromPathParam = false }: { fromPathParam?: boolean }) {
  const { sectionId } = useParams();
  const [search] = useSearchParams();
  const id = fromPathParam ? String(sectionId || "") : String(search.get("section") || "");
  if (!id.trim()) return <Navigate to="/plugins" replace />;
  return <Navigate to={commonConfigLegacyRedirectPath(id)} replace />;
}

export default function App() {
  return (
    <ConsoleSetupGuard>
    <Routes>
      <Route path="/" element={<AppShell />}>
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
        <Route path="common-config" element={<CommonConfigLegacyRedirect />} />
        <Route path="common-config/:sectionId" element={<CommonConfigLegacyRedirect fromPathParam />} />
        <Route path="preferences" element={<PreferencesPage />} />
        <Route path="setup" element={<SetupWizardPage />} />
        <Route path="security" element={<Navigate to="/preferences#console-password" replace />} />
        <Route path="update" element={<UpdatePage />} />
        <Route path="ai" element={<AiLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<AiHomePage />} />
          <Route path="statistics" element={<AiStatisticsPage />} />
          <Route path="history" element={<AiHistoryPage />} />
          <Route path="config" element={<Navigate to="provider" replace />} />
          <Route path="config/:section" element={<AiConfigPage />} />
          <Route path="wizard" element={<AiWizardPage />} />
          <Route path="*" element={<Navigate to="home" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ConsoleSetupGuard>
  );
}
