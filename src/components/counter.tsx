import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <Card className="flex-1 w-full lg:max-w-lg">
      <CardHeader>
        <CardTitle>Counter</CardTitle>
        <CardDescription>Simple counter demonstration</CardDescription>
        <CardAction>
          <Button
            onClick={() => {
              setCount(0);
              toast.success("Counter reset!");
            }}
            variant="outline"
            size="sm"
          >
            Reset
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="text-6xl font-mono font-bold">{count}</div>
          <Button onClick={() => setCount((count) => count + 1)} size="lg" className="min-w-32">
            Increment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
