export function deriveFeedbackGroupFromSession(params: {
  sessionGroupId: number | null | undefined;
  currentFeedbackGroup: string;
  userTouched: boolean;
}): string {
  if (params.userTouched) return params.currentFeedbackGroup;
  const gid = Number(params.sessionGroupId ?? 0);
  if (!Number.isFinite(gid) || gid <= 0) return params.currentFeedbackGroup;
  return String(Math.floor(gid));
}
