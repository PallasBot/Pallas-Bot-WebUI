import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import { fetchAiNcmStatus, postAiNcmLogout, postAiNcmSendSms, postAiNcmVerifySms } from "@/api/console";
import AiConfigField from "@/components/ai/AiConfigField";
import { AI_NCM_DEFAULTS } from "@/config/aiConstants";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pushConsoleToast } from "@/utils/consoleToast";

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

export default function AiConfigNcmSection() {
  const [phone, setPhone] = useState("");
  const [ctcode, setCtcode] = useState(String(AI_NCM_DEFAULTS.countryCode));
  const [captcha, setCaptcha] = useState("");

  const statusQ = useQuery({ queryKey: ["ai-ncm"], queryFn: fetchAiNcmStatus });

  const payload = (statusQ.data?.data || {}) as Record<string, unknown>;
  const loggedIn = Boolean(payload.success) && Boolean(payload.session);

  const sendMut = useMutation({
    mutationFn: () => postAiNcmSendSms({ phone: phone.trim(), ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode }),
    onSuccess: async (r) => {
      if (r.ok) notifyOk("验证码已发送");
      else notifyErr(r.error || "验证码发送失败");
      await statusQ.refetch();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const verifyMut = useMutation({
    mutationFn: () =>
      postAiNcmVerifySms({
        phone: phone.trim(),
        captcha: captcha.trim(),
        ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode,
      }),
    onSuccess: async (r) => {
      if (r.ok) notifyOk("登录成功");
      else notifyErr(r.error || "登录验证失败");
      await statusQ.refetch();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const logoutMut = useMutation({
    mutationFn: () => postAiNcmLogout(),
    onSuccess: async (r) => {
      if (r.ok) notifyOk("已登出");
      else notifyErr(r.error || "登出失败");
      await statusQ.refetch();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const busy = sendMut.isPending || verifyMut.isPending || logoutMut.isPending;

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">登录状态</h3>
          <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
            <Badge variant={loggedIn ? "success" : "secondary"}>{loggedIn ? "已登录" : "未登录"}</Badge>
            <pre className="mt-3 max-h-48 overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-2 text-xs">
              {JSON.stringify(statusQ.data, null, 2)}
            </pre>
          </StateBlock>
        </section>

        <section className="space-y-3 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4">
          <h3 className="text-sm font-medium">短信登录</h3>
          <div className="grid grid-cols-2 gap-3">
            <AiConfigField label="手机号">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </AiConfigField>
            <AiConfigField label="国家码" description="默认国家码（86）">
              <Input value={ctcode} onChange={(e) => setCtcode(e.target.value)} type="number" />
            </AiConfigField>
            <AiConfigField label="验证码" className="md:col-span-2">
              <Input value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
            </AiConfigField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Mail} disabled={busy} onClick={() => void sendMut.mutateAsync()}>
              发送验证码
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={ShieldCheck}
              disabled={busy}
              onClick={() => void verifyMut.mutateAsync()}
            >
              验证登录
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={LogOut}
              disabled={busy}
              onClick={() => void logoutMut.mutateAsync()}
            >
              登出
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
