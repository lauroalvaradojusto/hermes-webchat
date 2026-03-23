# Guía de Deploy - Topic Threader Frontend en Vercel

## Pasos Previos

### 1. Obtener Supabase Anon Key
1. Ir al dashboard de Supabase: https://supabase.com/dashboard/project/dgrtziddrgpqenppehae/settings/api
2. Copiar el "anon public" key (también llamado "anon key")
3. Reemplazar `TBD-OBTENER_DE_SUPABASE_DASHBOARD` en `.env`

### 2. Edge Functions de Supabase
El frontend necesita estas edge functions ya configuradas en Supabase:
- `chat-deepseek` - Chat con DeepSeek
- `analyze-document` - Análisis de documentos
- `create-checkout` - Checkout de Stripe
- `verify-payment` - Verificación de pagos
- `publish-to-twitter` - Publicación en Twitter/X
- `delete-from-twitter` - Eliminación de tweets
- `process-topic` - Procesamiento de temas

Estas functions YA EXISTEN en Supabase según el crawler.

## Deploy en Vercel

### Opción A: Via CLI
```bash
cd /opt/hermes/lovable-migrate/vercel-front
npm install
npm run build
vercel login
vercel
```

**Variables de Entorno para Vercel:**
```
VITE_SUPABASE_URL=https://dgrtziddrgpqenppehae.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncnR6aWRkcmdxcG1wcGVoYWUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA0MjA0OSwibmJmIjoxNzE4NDk2Njk0fQ.OrwUQWtIBt5Pm0ntsAop_SFCukNnK8jVAWjIy4AsCg
VITE_SUPABASE_PROJECT_ID=dgrtziddrgpqenppehae
VITE_PUBLIC_APP_NAME=Topic Threader
VITE_UPLOAD_MAX_MB=25
```

### Opción B: Via Dashboard
1. Ir a https://vercel.com/new
2. Importar repositorio: `/opt/hermes/lovable-migrate/vercel-front`
3. Configurar Framework Preset: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`

### Variables de Entorno en Vercel
En Vercel dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://dgrtziddrgpqenppehae.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRncnR6aWRkcmdxcG1wcGVoYWUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczODA0MjA0OSwibmJmIjoxNzE4NDk2Njk0fQ.OrwUQWtIBt5Pm0ntsAop_SFCukNnK8jVAWjIy4AsCg
VITE_SUPABASE_PROJECT_ID=dgrtziddrgpqenppehae
VITE_PUBLIC_APP_NAME=Topic Threader
VITE_UPLOAD_MAX_MB=25
```

(Opcional - si se usan)
```
VITE_STRIPE_PUBLIC_KEY=pk_live_...
VITE_TWITTER_CLIENT_ID=...
```

## Configuración de Rewrites (vercel.json)

Ya existe `vercel.json` con:
```json
{
  "rewrites": [
    {
      "source": "/auth",
      "destination": "/"
    },
    {
      "source": "/mant",
      "destination": "/"
    },
    {
      "source": "/payment-success",
      "destination": "/"
    }
  ]
}
```

Esto permite que las rutas SPA funcionen correctamente.

## Verificación Post-Deploy

1. **Build exitoso:** `npm run build` debería crear carpeta `dist/`
2. **Login funciona:** Intentar iniciar sesión en `/auth`
3. **Auth de Supabase:** Verificar que se conecta al proyecto correcto
4. **Edge functions:** Probar `chat-deepseek` desde el chat

## Problemas Comunes

### Error: "Falta VITE_SUPABASE_ANON_KEY"
**Solución:** Agregar la variable en Vercel Settings → Environment Variables

### Error: 404 en rutas
**Solución:** Verificar que `vercel.json` tiene los rewrites correctos

### Error: Edge function no responde
**Solución:** Verificar que las functions existen en Supabase Dashboard → Edge Functions

## Archivos Clave

- `.env` - Variables de entorno local
- `vercel.json` - Configuración de deploy Vercel
- `package.json` - Dependencias y scripts
- `vite.config.ts` - Configuración de Vite
- `tsconfig.json` - Configuración TypeScript

## Siguiente Paso

Una vez deployado el frontend, implementar el backend Docker con Hermes:
```
/opt/hermes/lovable-migrate/docker-hermes-backend-plan.md
```

## Contacto de Soporte

Si hay problemas:
1. Verificar logs de Vercel: Dashboard → Logs
2. Verificar logs de Supabase: Dashboard → Edge Functions → Logs
3. Verificar console del browser para errores de frontend
