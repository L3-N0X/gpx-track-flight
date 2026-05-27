import { serve, file } from 'bun'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite'

const adapter = new PrismaBunSqlite({
    url: process.env.DATABASE_URL || 'file:./dev.db'
})
const prisma = new PrismaClient({ adapter })

const isDevelopment = process.env.NODE_ENV !== 'production'
const port = process.env.PORT || 3030

const server = serve({
    port,
    development: isDevelopment,

    async fetch(req) {
        const url = new URL(req.url)
        const pathname = url.pathname
        const method = req.method

        // CORS headers for development
        const corsHeaders: Record<string, string> = isDevelopment
            ? {
                  'Access-Control-Allow-Origin': 'http://localhost:5174',
                  'Access-Control-Allow-Methods':
                      'GET, POST, PUT, DELETE, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                  'Access-Control-Allow-Credentials': 'true',
              }
            : {}

        // Handle preflight requests
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            })
        }

        // API Routes
        if (pathname.startsWith('/api')) {
            let response: Response

            switch (pathname) {
                case '/api/health':
                    if (method === 'GET') {
                        response = Response.json({
                            status: 'OK',
                            timestamp: new Date().toISOString(),
                            environment: isDevelopment
                                ? 'development'
                                : 'production',
                        })
                    } else {
                        response = new Response('Method not allowed', {
                            status: 405,
                        })
                    }
                    break

                case '/api/version':
                    if (method === 'GET') {
                        response = Response.json({
                            version: '1.0.0',
                            runtime: 'bun',
                            hot_reload: isDevelopment,
                        })
                    } else {
                        response = new Response('Method not allowed', {
                            status: 405,
                        })
                    }
                    break

                case '/api/share':
                    if (method === 'POST') {
                        try {
                            const { gpxContent } = (await req.json()) as { gpxContent?: string }
                            if (!gpxContent || typeof gpxContent !== 'string') {
                                response = Response.json({ error: 'gpxContent must be a string' }, { status: 400 })
                                break
                            }

                            // Basic validation: ensure it looks like a GPX file (starts with XML/GPX tag)
                            const trimmed = gpxContent.trim()
                            const hasGpxTag = trimmed.includes('<gpx')

                            if (!hasGpxTag) {
                                response = Response.json({ error: 'Invalid GPX content format' }, { status: 400 })
                                break
                            }

                            const shared = await prisma.sharedTrack.create({
                                data: { gpxContent: trimmed }
                            })

                            response = Response.json({ id: shared.id })
                        } catch (err) {
                            console.error('Error sharing GPX:', err)
                            response = Response.json({ error: 'Failed to share track' }, { status: 500 })
                        }
                    } else if (method === 'GET') {
                        try {
                            const id = url.searchParams.get('id')
                            if (!id) {
                                response = Response.json({ error: 'Missing track id parameter' }, { status: 400 })
                                break
                            }

                            const track = await prisma.sharedTrack.findUnique({
                                where: { id }
                            })

                            if (!track) {
                                response = Response.json({ error: 'Shared track not found' }, { status: 404 })
                                break
                            }

                            response = Response.json({ gpxContent: track.gpxContent })
                        } catch (err) {
                            console.error('Error fetching GPX:', err)
                            response = Response.json({ error: 'Failed to retrieve shared track' }, { status: 500 })
                        }
                    } else {
                        response = new Response('Method not allowed', { status: 405 })
                    }
                    break

                default:
                    response = Response.json(
                        {
                            error: 'API endpoint not found',
                            available_endpoints: [
                                '/api/health',
                                '/api/version',
                                '/api/share',
                            ],
                        },
                        { status: 404 }
                    )
            }

            // Add CORS headers to API responses
            const headers = new Headers(response.headers)
            Object.entries(corsHeaders).forEach(([key, value]) => {
                headers.set(key, value)
            })

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            })
        }

        // In development, all non-API routes should be handled by Vite dev server
        if (isDevelopment) {
            return new Response(
                'This server only handles API routes in development. Frontend is served by Vite dev server on http://localhost:5174',
                {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' },
                }
            )
        }

        // Production static file serving
        try {
            // Handle root path - serve index.html
            if (pathname === '/') {
                const indexFile = file(
                    join(process.cwd(), 'dist', 'index.html')
                )
                if (await indexFile.exists()) {
                    return new Response(indexFile)
                }
            }

            // Try to serve static file from dist directory
            const staticFile = file(join(process.cwd(), 'dist', pathname))
            if (await staticFile.exists()) {
                return new Response(staticFile)
            }

            // For SPA routing - serve index.html for non-API routes
            const indexFile = file(join(process.cwd(), 'dist', 'index.html'))
            if (await indexFile.exists()) {
                return new Response(indexFile)
            }

            return new Response('Not found', { status: 404 })
        } catch (error) {
            console.error('Static file serving error:', error)
            return new Response('Internal Server Error', { status: 500 })
        }
    },

    // Error handler
    error(error) {
        console.error('Server error:', error)
        return new Response('Internal Server Error', { status: 500 })
    },
})

console.log(`🚀 Bun server running on http://localhost:${server.port}`)
console.log(`🔧 Environment: ${isDevelopment ? 'development' : 'production'}`)
console.log(`🔗 API endpoints:`)
console.log(`   - GET /api/health`)
console.log(`   - GET /api/version`)

if (isDevelopment) {
    console.log(
        `📝 Note: Frontend is served by Vite dev server on http://localhost:5174`
    )
    console.log(`🔄 Hot reload enabled for server-side code`)
} else {
    console.log(`📁 Serving static files from ./dist directory`)
    console.log(`🌐 Full-stack server ready - API + Frontend`)
}
