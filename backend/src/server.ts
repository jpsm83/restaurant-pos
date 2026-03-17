import Fastify from 'fastify'

const server = Fastify({
  logger: true,
})

server.get('/health', async () => {
  return { ok: true }
})

const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '0.0.0.0'

await server.listen({ port, host })

