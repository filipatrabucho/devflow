import serverless from 'serverless-http';
import { createApp } from '../../server/src/app.js';

export const handler = serverless(createApp());
