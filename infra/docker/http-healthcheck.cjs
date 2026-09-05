'use strict';

const url = process.argv[2];

if (!url) {
  console.error('Usage: node http-healthcheck.cjs <url>');
  process.exit(1);
}

fetch(url)
  .then(async (response) => {
    if (!response.ok) {
      process.exit(1);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      process.exit(0);
    }

    const body = await response.json();
    process.exit(body && body.success === true ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
