import { createRouter, createWebHistory } from "vue-router";
import Dashboard from "../pages/Dashboard.vue";
import CommunityDetail from "../pages/CommunityDetail.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "Dashboard", component: Dashboard },
    { path: "/community/:communityId", name: "CommunityDetail", component: CommunityDetail, props: true }
  ]
});

export default router;
