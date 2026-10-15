# Sites deployment adapter

`preview-api.js` keeps the browser UI's `/api/*` contract while storing production data in Supabase. It subscribes to `site_profile`, `posts`, and `reactions` through Supabase Realtime and dispatches `hitokoto:remote-change` events for the UI.

During a Sites static deployment, copy this file to `dist/preview-api.js` and load it after `vendor/supabase.js` and before `auth.js`. If the Supabase schema is not installed yet, it falls back to browser-local sample data.
