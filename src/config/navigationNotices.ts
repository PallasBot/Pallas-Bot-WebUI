export type NavigationNotice = {
  key: string;
  revision: number;
  label: string;
  seenOn: "route" | "section";
};

export const COMMUNITY_FEDERATION_NOTICE: NavigationNotice = {
  key: "community:federation",
  revision: 1,
  label: "多机协同配置已更新",
  seenOn: "section",
};
