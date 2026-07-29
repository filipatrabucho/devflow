import serverless from 'serverless-http';
import { createApp } from './app.js';

// Netlify Functions (like the AWS Lambda proxy integration they follow) need
// a binary response base64-encoded with `isBase64Encoded: true` — the
// default here would otherwise treat the Excel export's bytes as UTF-8 text
// and corrupt the file. Every other response in this app is JSON/text, so
// only this one content type needs to opt in.
export const handler = serverless(createApp(), {
  binary: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
});
