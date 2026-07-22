import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { fetchAiNcmStatus, postAiNcmLogout, postAiNcmSendSms, postAiNcmVerifySms } from "@/api/console";
import { AI_NCM_DEFAULTS } from "@/config/aiConstants";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AiConfigNcmSection() {
  const [phone, setPhone] = useState("");
  const [ctcode, setCtcode] = useState(String(AI_NCM_DEFAULTS.countryCode));
  const [captcha, setCaptcha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["ai-ncm"], queryFn: fetchAiNcmStatus });

  const payload = (statusQ.data?.data || {}) as Record<string, unknown>;
  const loggedIn = Boolean(payload.success) && Boolean(payload.session);

  const sendMut = useMutation({
    mutationFn: () => postAiNcmSendSms({ phone: phone.trim(), ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode }),
    onSuccess: async (r) => {
      setMsg(r.ok ? "验证码已发送" : r.error || "发送失败");
      await statusQ.refetch();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const verifyMut = useMutation({
    mutationFn: () =>
      postAiNcmVerifySms({
        phone: phone.trim(),
        captcha: captcha.trim(),
        ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode,
      }),
    onSuccess: async (r) => {
      setMsg(r.ok ? "登录成功" : r.error || "验证失败");
      await statusQ.refetch();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const logoutMut = useMutation({
    mutationFn: () => postAiNcmLogout(),
    onSuccess: async (r) => {
      setMsg(r.ok ? "已登出" : r.error || "登出失败");
      await statusQ.refetch();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const busy = sendMut.isPending || verifyMut.isPending || logoutMut.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>网易云登录</CardTitle>
          <CardDescription>/ai-extension/ncm/*</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void statusQ.refetch()}>
          <RefreshCw className={statusQ.isFetching ? "animate-spin" : undefined} />
          刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {msg ? (
          <p className={cn("text-sm", /成功|已发送|已登出/.test(msg) ? "text-emerald-400" : "text-destructive")}>
            {msg}
          </p>
        ) : null}
        <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
          <Badge variant={loggedIn ? "success" : "secondary"}>{loggedIn ? "已登录" : "未登录"}</Badge>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-muted-foreground">手机号</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">国家码</span>
              <Input value={ctcode} onChange={(e) => setCtcode(e.target.value)} type="number" />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-muted-foreground">验证码</span>
              <Input value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void sendMut.mutateAsync(); }}>
              发送验证码
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void verifyMut.mutateAsync(); }}>
              验证登录
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void logoutMut.mutateAsync(); }}>
              登出
            </Button>
          </div>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
            {JSON.stringify(statusQ.data, null, 2)}
          </pre>
        </StateBlock>
      </CardContent>
    </Card>
  );
}
