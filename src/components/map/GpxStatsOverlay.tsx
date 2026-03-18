import { Mountain, TrendingDown, TrendingUp, Gauge, Route } from "lucide-react";
import type { GpxStats } from "../../lib/gpxStats";

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary shrink-0">{icon}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="ml-auto font-semibold text-foreground tabular-nums text-xs">
        {value}
      </span>
    </div>
  );
}

export function GpxStatsOverlay({ stats }: { stats: GpxStats }) {
  return (
    <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-4 rounded-md text-sm border border-border pointer-events-none min-w-50">
      {/* Track name header */}
      <p className="font-semibold text-foreground mb-3 truncate max-w-55" title={stats.trackName}>
        {stats.trackName}
      </p>

      <div className="space-y-2">
        <StatRow
          icon={<Route size={13} />}
          label="Distance"
          value={`${stats.totalDistanceKm.toFixed(2)} km`}
        />
        <StatRow
          icon={<TrendingUp size={13} />}
          label="Elev. gain"
          value={`+${stats.elevationGainM} m`}
        />
        <StatRow
          icon={<TrendingDown size={13} />}
          label="Elev. loss"
          value={`−${stats.elevationLossM} m`}
        />

        {/* Divider — only shown when speed data exists */}
        {(stats.maxSpeedKmh !== null || stats.avgSpeedKmh !== null) && (
          <div className="border-t border-border pt-2 space-y-2">
            <StatRow
              icon={<Gauge size={13} />}
              label="Max speed"
              value={
                stats.maxSpeedKmh !== null
                  ? `${stats.maxSpeedKmh} km/h`
                  : "N/A"
              }
            />
            <StatRow
              icon={<Mountain size={13} />}
              label="Avg speed"
              value={
                stats.avgSpeedKmh !== null
                  ? `${stats.avgSpeedKmh} km/h`
                  : "N/A"
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
