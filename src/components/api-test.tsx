import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card";

interface ApiResponse {
  status?: string;
  timestamp?: string;
  version?: string;
  runtime?: string;
  error?: string;
}

export function ApiTest() {
  const [healthResponse, setHealthResponse] = useState<ApiResponse | null>(null);
  const [versionResponse, setVersionResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<{ health: boolean; version: boolean }>({
    health: false,
    version: false,
  });

  const testHealthEndpoint = async () => {
    setLoading((prev) => ({ ...prev, health: true }));
    try {
      const response = await fetch("/api/health");
      const data = await response.json();
      setHealthResponse(data);
    } catch (error) {
      setHealthResponse({ error: `Failed to fetch: ${error}` });
    } finally {
      setLoading((prev) => ({ ...prev, health: false }));
    }
  };

  const testVersionEndpoint = async () => {
    setLoading((prev) => ({ ...prev, version: true }));
    try {
      const response = await fetch("/api/version");
      const data = await response.json();
      setVersionResponse(data);
    } catch (error) {
      setVersionResponse({ error: `Failed to fetch: ${error}` });
    } finally {
      setLoading((prev) => ({ ...prev, version: false }));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Endpoint Test</CardTitle>
        <CardDescription>
          Test the available API endpoints to check server connectivity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Button onClick={testHealthEndpoint} disabled={loading.health} className="mr-4">
              {loading.health ? "Testing..." : "Test /api/health"}
            </Button>
            {healthResponse && (
              <div className="mt-2 p-3 bg-muted rounded text-sm">
                <pre>{JSON.stringify(healthResponse, null, 2)}</pre>
              </div>
            )}
          </div>

          <div>
            <Button onClick={testVersionEndpoint} disabled={loading.version} className="mr-4">
              {loading.version ? "Testing..." : "Test /api/version"}
            </Button>
            {versionResponse && (
              <div className="mt-2 p-3 bg-muted rounded text-sm">
                <pre>{JSON.stringify(versionResponse, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Click the buttons above to test API endpoints
        </p>
      </CardFooter>
    </Card>
  );
}
