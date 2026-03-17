import { RootProviders } from "@/providers";
import { Layout } from "@/components/layout";
import { AppRoutes } from "@/components/app-routes.tsx";

function App() {
  return (
    <RootProviders>
      <Layout>
        <AppRoutes />
      </Layout>
    </RootProviders>
  );
}

export default App;
