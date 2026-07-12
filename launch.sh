#!/bin/bash
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
export NODE_ENV=development
cd "$(dirname "$0")"
exec /usr/local/bin/npm start
