// src\common\adapters\fastify.adapter.ts
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { FastifyAdapter } from "@nestjs/platform-fastify";

const app: FastifyAdapter = new FastifyAdapter ()

// Multipart plugin for file uploads (multipart/form-data)
app.register(fastifyMultipart, {
  limits: {
    fields: 10, // Max number of non-file fields
    fileSize: 1024 * 1024 * 6, // limit size 6M
    files: 5, // Max number of file fields
  }
})

// Parse and set HTTP cookies (request.cookies, reply.setCookie)
app.register(fastifyCookie, {
  secret: 'cookie-secret', // For signed cookies; trivial since no auth-related data is stored
})

// Global pre-request hook
app.getInstance().addHook('onRequest', (request, reply, done) => {
  // set undefined origin
  const { origin } = request.headers
  if (!origin)
    request.headers.origin = request.headers.host

  // forbidden php
  const { url } = request

  if (url.endsWith('.php')) {
    reply.raw.statusMessage
      = 'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'

    return reply.code(418).send()
  }

  // skip favicon request
  if (url.match(/favicon.ico$/) || url.match(/manifest.json$/))
    return reply.code(204).send()

  // Prevent HTTP method override attempts
  // Reject common method override headers and parameters
  const methodOverrideHeaders = [
    'x-http-method-override',
    'x-method-override',
    'x-http-method',
  ]

  for (const header of methodOverrideHeaders) {
    if (request.headers[header]) {
      return reply.code(400).send({
        statusCode: 400,
        message: 'HTTP method override is not allowed',
        error: 'Bad Request',
      })
    }
  }

  // Check for _method parameter in query string
  if (request.query && typeof request.query === 'object' && '_method' in request.query) {
    return reply.code(400).send({
      statusCode: 400,
      message: 'HTTP method override is not allowed',
      error: 'Bad Request',
    })
  }

  done()
})
