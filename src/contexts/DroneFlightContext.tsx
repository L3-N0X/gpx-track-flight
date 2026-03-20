import {
    createContext,
    useContext,
    useRef,
    useState,
    useMemo,
    type MutableRefObject,
} from 'react'
import type { CatmullRomCurve3 } from 'three'

interface DroneFlightContextType {
    isPlaying: boolean
    setIsPlaying: (playing: boolean) => void
    speed: number
    setSpeed: (speed: number) => void
    progressRef: MutableRefObject<number>
    curveRef: MutableRefObject<CatmullRomCurve3 | null>
}

const DroneFlightContext = createContext<DroneFlightContextType | null>(null)

export function DroneFlightProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const progressRef = useRef(0)
    const curveRef = useRef<CatmullRomCurve3 | null>(null)

    const value = useMemo(
        () => ({
            isPlaying,
            setIsPlaying,
            speed,
            setSpeed,
            progressRef,
            curveRef,
        }),
        [isPlaying, speed]
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
