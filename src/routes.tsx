import { type FC } from "react";
import { HomePage } from "./pages/home.tsx";
import { AboutPage } from "./pages/about.tsx";

export interface AppRoute {
  path: string;
  title: string;
  description: string;
  component: FC;
  showInNavbar?: boolean;
  category?: "main" | "docs" | "other";
}

export const routes: AppRoute[] = [
  {
    path: "/",
    title: "Home",
    description: "Return to the homepage with all the latest updates.",
    component: HomePage,
    showInNavbar: true,
    category: "main",
  },
  {
    path: "/about",
    title: "About",
    description: "Learn more about our mission and what we do.",
    component: AboutPage,
    showInNavbar: true,
    category: "main",
  },
];

// Helper functions for type-safe routing
export const getRouteByPath = (path: string): AppRoute | undefined => {
  return routes.find((route) => route.path === path);
};

export const getNavbarRoutes = (): AppRoute[] => {
  return routes.filter((route) => route.showInNavbar);
};

export const getRoutesByCategory = (category: AppRoute["category"]): AppRoute[] => {
  return routes.filter((route) => route.category === category);
};
