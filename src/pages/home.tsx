import { ApiTest } from "@/components/api-test";
import { Counter } from "@/components/counter";

export function HomePage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-8">Simple Counter Demo</h1>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl">
        <Counter />

        <div className="flex-1 w-full lg:max-w-lg">
          <ApiTest />
        </div>
      </div>
    </>
  );
}
