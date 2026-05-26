import {
    createContext,
    useContext,
    useRef,
    useState,
    useMemo,
    type MutableRefObject,
} from 'react'
import type { CatmullRomCurve3 } from 'three'

export type DroneFlightMode = 'fixed' | 'track-speed'

interface DroneFlightContextType {
    isPlaying: boolean
    setIsPlaying: (playing: boolean) => void
    speed: number
    setSpeed: (speed: number) => void
    mode: DroneFlightMode
    setMode: (mode: DroneFlightMode) => void
    progressRef: MutableRefObject<number>
    curveRef: MutableRefObject<CatmullRomCurve3 | null>
    isRecording: boolean
    setIsRecording: (recording: boolean) => void
}

const DroneFlightContext = createContext<DroneFlightContextType | null>(null)

export function DroneFlightProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [mode, setMode] = useState<DroneFlightMode>('fixed')
    const [fixedSpeed, setFixedSpeed] = useState(1)
    const [trackSpeedMultiplier, setTrackSpeedMultiplier] = useState(50)
    const [isRecording, setIsRecording] = useState(false)
    const progressRef = useRef(0)
    const curveRef = useRef<CatmullRomCurve3 | null>(null)
    const speed = mode === 'track-speed' ? trackSpeedMultiplier : fixedSpeed

    const value = useMemo(
        () => ({
            isPlaying,
            setIsPlaying,
            speed,
            setSpeed: (nextSpeed: number) => {
                if (mode === 'track-speed') {
                    setTrackSpeedMultiplier(nextSpeed)
                    return
                }

                setFixedSpeed(nextSpeed)
            },
            mode,
            setMode,
            progressRef,
            curveRef,
            isRecording,
            setIsRecording,
        }),
        [isPlaying, mode, speed, isRecording]
    )

    return (
        <DroneFlightContext.Provider value={value}>
            {children}
        </DroneFlightContext.Provider>
    )
}

export function useDroneFlight() {
    const context = useContext(DroneFlightContext)
    if (!context) {
        throw new Error(
            'useDroneFlight must be used within a DroneFlightProvider'
        )
    }
    return context
}
