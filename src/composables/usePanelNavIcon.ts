import { computed } from "vue";
import { useRoute } from "vue-router";
import { mainNavIconForPath } from "@/config/mainNav";

/** 当前路由在主导航中的图标，用于各页 `panel__title` 前缀 */
export function usePanelNavIcon() {
  const route = useRoute();
  return computed(() => mainNavIconForPath(route.path));
}
