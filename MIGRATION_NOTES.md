# Topic Threader front for Vercel

Estado:
- Frontend reconstruido como Vite + React + TypeScript.
- Build local validado con `npm run build`.
- Rutas SPA preservadas: `/`, `/auth`, `/mant`, `/payment-success`.

Qué quedó implementado:
- Shell principal de chat.
- Panel lateral de historial/configuración.
- Auth básico con Supabase.
- Modal de credenciales de X/Twitter.
- Modal de créditos/paywall.
- Vista admin.
- Vista payment-success.
- Rewrites para Vercel.

Qué sigue pendiente:
- Reemplazar placeholders `.env` con valores reales.
- Conectar edge functions de Supabase: `chat-deepseek`, `analyze-document`, `create-checkout`, `verify-payment`, `publish-to-twitter`, `delete-from-twitter`, `process-topic`.
- Definir backend separado en Docker donde corra Hermes como runtime de automatización y orquestación.
- Diseñar integración entre frontend Vercel, Supabase y backend Docker/Hermes.
- Validar tablas/roles reales de `profiles` y flujos de créditos.
- Revisar code-splitting; el bundle principal supera 500 kB.

No se inventaron secretos ni métricas. Valores faltantes quedaron como `TBD`.
