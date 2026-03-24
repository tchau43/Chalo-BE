import { FastifyAdapter } from "@nestjs/platform-fastify"

const app: FastifyAdapter = new FastifyAdapter({
    trustProxy: true,
    logger: false,
})

export { app as fastifyApp }