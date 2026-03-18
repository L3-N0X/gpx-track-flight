import { useState, useEffect, useRef } from "react";
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { useDroneFlight } from "../../contexts/DroneFlightContext";

export function DroneFlightControls() {
  const { isPlaying, setIsPlaying, speed, setSpeed, progressRef } =
    useDroneFlight();
  const [isExpanded, setIsExpanded] = useState(true);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Use requestAnimationFrame to update the progress bar at 60fps without React re-renders
  useEffect(() => {
    let animationFrameId: number;

    const updateProgress = () => {
      if (progressBarRef.current) {
        // progressRef.current is a value between 0 and 1
        const percent = (progressRef.current * 100).toFixed(2);
        progressBarRef.current.style.width = `${percent}%`;
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    updateProgress();

    return () => cancelAnimationFrame(animationFrameId);
  }, [progressRef]);

  const speeds = [0.5, 1, 2, 5, 10];

  return (
    <>
      {/* Top Overlay: Controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
        <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-lg p-2 min-w-50 flex flex-col gap-2">
          {/* Header row to toggled expand/collapse */}
          <div
            className="flex items-center justify-between text-sm font-semibold text-muted-foreground px-2 py-1 cursor-pointer hover:text-foreground transition-colors select-none"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>Flight Controls</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {/* Expanded Controls */}
          {isExpanded && (
            <div className="flex flex-col gap-3 p-2 bg-card rounded-lg border border-border/50">
              <div className="flex justify-center">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded-md transition-colors w-full"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  {isPlaying ? "Pause" : "Play Flight"}
                </button>
              </div>

              <div className="space-y-1 text-center">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Playback Speed
                </div>
                <div className="flex gap-1 justify-center">
                  {speeds.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                        speed === s
                          ? "bg-accent text-accent-foreground border border-ring/50"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-96 h-12 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-auto group">
        <div className="w-full bg-background/90 backdrop-blur-md rounded-full h-4 border border-border overflow-hidden cursor-pointer shadow-md">
          <div
            ref={progressBarRef}
            className="bg-primary h-full rounded-full transition-none"
            style={{ width: "0%" }}
          ></div>
        </div>
        <div className="absolute -top-6 text-xs font-semibold text-foreground bg-background/80 px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Flight Progress
        </div>
      </div>
    </>
  );
}
