import { Routes, Route } from "react-router-dom";
import { routes } from "../routes.tsx";

export const AppRoutes = () => (
  <Routes>
    {routes.map(({ path, component: Component }) => (
      <Route key={path} path={path} element={<Component />} />
    ))}
  </Routes>
);
