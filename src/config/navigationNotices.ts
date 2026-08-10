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

export const DATABASE_LIFECYCLE_NOTICE: NavigationNotice = {
  key: "database:lifecycle",
  revision: 1,
  label: "数据库生命周期管理已上线",
  seenOn: "section",
};
