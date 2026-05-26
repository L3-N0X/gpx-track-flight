import { useEffect, useRef } from 'react'
import { useDroneFlight } from '../../contexts/DroneFlightContext'

function getSupportedMimeType(): string {
    const types = [
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ]
    for (const type of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
            return type
        }
    }
    return ''
}

export function FlightRecorder() {
    const { isRecording, setIsRecording, progressRef, isPlaying, setIsPlaying } = useDroneFlight()

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    useEffect(() => {
        let activeStream: MediaStream | null = null

        const startRecording = async () => {
            chunksRef.current = []

            try {
                // Use getDisplayMedia to capture the entire browser tab, including all overlays
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: false
                })
                activeStream = stream

                // Handle case where user stops sharing via the browser's built-in "Stop sharing" UI
                stream.getVideoTracks()[0].onended = () => {
                    setIsRecording(false)
                }

                const mimeType = getSupportedMimeType()
                const recorder = new MediaRecorder(stream, {
                    mimeType,
                    videoBitsPerSecond: 15000000 // 15 Mbps for ultra-high-definition capture
                })
                mediaRecorderRef.current = recorder

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        chunksRef.current.push(e.data)
                    }
                }

                recorder.onstop = () => {
                    // Close all tracks to dismiss the browser's "sharing tab" prompt
                    stream.getTracks().forEach(track => track.stop())

                    const blob = new Blob(chunksRef.current, { type: mimeType })
                    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'

                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `gpx-flight-recording.${extension}`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }

                recorder.start(1000)

                // Auto-start playback from the beginning
                progressRef.current = 0
                setIsPlaying(true)
            } catch (err) {
                console.error('Failed to start screen capture/MediaRecorder:', err)
                setIsRecording(false)
            }
        }

        if (isRecording) {
            startRecording()
        } else {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
            mediaRecorderRef.current = null
        }

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop())
            }
        }
    }, [isRecording, progressRef, setIsPlaying, setIsRecording])

    // Auto-stop recording when the flight completes (progress reaches 1)
    useEffect(() => {
        if (isRecording && !isPlaying && progressRef.current >= 0.999) {
            setIsRecording(false)
        }
    }, [isPlaying, isRecording, progressRef, setIsRecording])

    return null
}
