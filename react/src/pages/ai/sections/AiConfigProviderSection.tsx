import LlmProvidersForm from "@/pages/ai/LlmProvidersForm";
import AiModelAdminPanel from "@/pages/ai/sections/AiModelAdminPanel";

export default function AiConfigProviderSection() {
  return (
    <div className="space-y-4">
      <LlmProvidersForm />
      <AiModelAdminPanel />
    </div>
  );
}
