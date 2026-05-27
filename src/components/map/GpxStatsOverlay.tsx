import { useState } from 'react'
import { Mountain, TrendingUp, Gauge, Route, ChevronDown } from 'lucide-react'
import type { GpxStats } from '../../lib/gpxStats'

function StatRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-primary shrink-0">{icon}</span>
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="ml-auto font-semibold text-foreground tabular-nums text-xs">
                {value}
            </span>
        </div>
    )
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}min`
}

export function GpxStatsOverlay({ stats }: { stats: GpxStats }) {
    const [isOpen, setIsOpen] = useState(true)

    const hasDuration = stats.totalDurationS !== null
    const hasSpeed = stats.maxSpeedKmh !== null || stats.avgSpeedKmh !== null

    // Compute dynamic height based on available data rows
    let expandedHeight = 'h-[148px]' // Base: Header + Distance + Elevation Gain
    if (hasDuration && hasSpeed) {
        expandedHeight = 'h-[220px]' // All stats present
    } else if (hasDuration || hasSpeed) {
        expandedHeight = hasDuration ? 'h-[172px]' : 'h-[196px]'
    }

    return (
        <div
            className={`absolute left-4 z-20 border border-border bg-background/75 backdrop-blur-sm pointer-events-auto shadow-md transition-all duration-300 ease-in-out select-none flex flex-col overflow-hidden ${
                isOpen
                    ? `bottom-14 md:bottom-4 w-56 ${expandedHeight} p-4 rounded-xl`
                    : 'bottom-4 w-10 h-10 p-0 rounded-lg items-center justify-center cursor-pointer hover:bg-background/95 hover:text-foreground text-muted-foreground'
            }`}
            onClick={!isOpen ? () => setIsOpen(true) : undefined}
        >
            {/* Collapsed Button Content */}
            <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                    isOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'
                }`}
            >
                <Route size={16} className="text-primary" />
            </div>

            {/* Expanded Card Content */}
            <div
                className={`flex flex-col h-full transition-all duration-300 ${
                    isOpen ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-90'
                }`}
            >
                {/* Clickable Header to Collapse */}
                <div
                    className="flex items-center justify-between cursor-pointer font-semibold mb-3 select-none text-foreground hover:text-primary transition-colors gap-4"
                    onClick={(e) => {
                        e.stopPropagation() // Prevent triggering container's open action
                        setIsOpen(false)
                    }}
                >
                    <p
                        className="truncate max-w-40 text-xs tracking-wider uppercase text-muted-foreground font-bold"
                        title={stats.trackName}
                    >
                        {stats.trackName || 'Route Details'}
                    </p>
                    <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </div>

                <div className="space-y-2 mt-0.5">
                    <StatRow
                        icon={<Route size={13} />}
                        label="Distance"
                        value={`${stats.totalDistanceKm.toFixed(2)} km`}
                    />
                    {stats.totalDurationS !== null && (
                        <StatRow
                            icon={<Gauge size={13} />}
                            label="Duration"
                            value={formatDuration(stats.totalDurationS)}
                        />
                    )}
                    <StatRow
                        icon={<TrendingUp size={13} />}
                        label="Elev. gain"
                        value={`+${stats.elevationGainM} m`}
                    />

                    {(stats.maxSpeedKmh !== null || stats.avgSpeedKmh !== null) && (
                        <>
                            <StatRow
                                icon={<Gauge size={13} />}
                                label="Max speed"
                                value={
                                    stats.maxSpeedKmh !== null
                                        ? `${stats.maxSpeedKmh} km/h`
                                        : 'N/A'
                                }
                            />
                            <StatRow
                                icon={<Mountain size={13} />}
                                label="Avg speed"
                                value={
                                    stats.avgSpeedKmh !== null
                                        ? `${stats.avgSpeedKmh} km/h`
                                        : 'N/A'
                                }
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
