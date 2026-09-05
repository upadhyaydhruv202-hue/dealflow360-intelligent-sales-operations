'use strict';

const { connect } = require('node:net');

const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
let parsed;

try {
  parsed = new URL(redisUrl);
} catch {
  process.exit(1);
}

const host = parsed.hostname || 'redis';
const port = Number(parsed.port || 6379);
const socket = connect({ host, port });

const fail = () => {
  socket.destroy();
  process.exit(1);
};

socket.setTimeout(3000);
socket.once('connect', () => {
  socket.end();
  process.exit(0);
});
socket.once('timeout', fail);
socket.once('error', fail);
