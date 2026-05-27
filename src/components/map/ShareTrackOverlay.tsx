import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Copy, Check, Loader2, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ShareTrackOverlayProps {
    gpxContent: string
    shareId?: string | null
}

export function ShareTrackOverlay({ gpxContent, shareId: initialShareId }: ShareTrackOverlayProps) {
    const [shareId, setShareId] = useState<string | null>(initialShareId || null)
    const [isSharing, setIsSharing] = useState(false)
    const [copied, setCopied] = useState(false)
    const [showCard, setShowCard] = useState(false)
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    // Locate portal target in header
    useEffect(() => {
        setPortalTarget(document.getElementById('header-share-button-portal'))
    }, [])

    // Click outside handler to close the popover card
    useEffect(() => {
        if (!showCard) return

        const handleClickOutside = (event: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
                setShowCard(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showCard])

    const handleShare = async () => {
        if (shareId) {
            setShowCard(!showCard)
            return
        }

        setIsSharing(true)
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gpxContent }),
            })

            if (!response.ok) {
                throw new Error('Failed to create share link')
            }

            const data = await response.json()
            setShareId(data.id)
            setShowCard(true)

            // Auto-copy the generated link to clipboard immediately
            const generatedUrl = `${window.location.origin}/map?share=${data.id}`
            try {
                await navigator.clipboard.writeText(generatedUrl)
                setCopied(true)
                toast.success('Track shared & link copied to clipboard!')
                setTimeout(() => setCopied(false), 2000)
            } catch (copyErr) {
                console.warn('Auto-copy failed, fallback to show link:', copyErr)
                toast.success('Track shared successfully!')
            }
        } catch (error) {
            console.error('Error sharing track:', error)
            toast.error('Failed to generate sharing link. Please try again.')
        } finally {
            setIsSharing(false)
        }
    }

    if (!portalTarget) return null

    const shareUrl = shareId
        ? `${window.location.origin}/map?share=${shareId}`
        : ''

    const handleCopy = () => {
        if (!shareUrl) return
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        toast.success('Link copied to clipboard!')
        setTimeout(() => setCopied(false), 2000)
    }

    return createPortal(
        <div className="relative" ref={cardRef}>
            <Button
                onClick={handleShare}
                disabled={isSharing}
                variant="outline"
                size="sm"
                className="bg-card hover:bg-muted border border-border text-foreground font-medium shadow-xs flex items-center gap-1.5 cursor-pointer transition-all duration-300 h-9 px-3"
            >
                {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : shareId ? (
                    <LinkIcon className="w-4 h-4 text-primary" />
                ) : (
                    <Share2 className="w-4 h-4 text-primary" />
                )}
                <span className="hidden sm:inline">
                    {isSharing ? 'Sharing...' : shareId ? 'Share Link' : 'Share Route'}
                </span>
            </Button>

            {showCard && shareId && (
                <div className="absolute right-0 top-11.5 z-50 bg-background/95 hover:bg-background/100 backdrop-blur-md p-3.5 rounded-xl border border-border text-sm shadow-xl flex flex-col gap-2 w-72 transition-all duration-300 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {initialShareId ? 'Viewing Shared Route' : 'Route Shared'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="relative flex-1 min-w-0">
                            <input
                                type="text"
                                readOnly
                                value={shareUrl}
                                onClick={handleCopy}
                                className="w-full bg-muted/60 text-xs px-2.5 py-1.5 rounded-lg border border-border/40 focus:outline-hidden text-muted-foreground truncate cursor-pointer hover:bg-muted/95 transition-colors"
                            />
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleCopy}
                            className="h-8 w-8 rounded-lg shrink-0 cursor-pointer hover:bg-muted"
                            title="Copy link"
                        >
                            {copied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                                <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>,
        portalTarget
    )
}
