# Doqit

Gestión documental para reclutamiento — SaaS para empresas chilenas.

## Setup local

1. Copia `.env.local.example` a `.env.local` y completa las variables
2. Ejecuta el schema SQL en tu proyecto Supabase (`supabase/schema.sql`)
3. `npm install && npm run dev`

## Deploy en Vercel

1. Push a GitHub
2. Conecta el repo en vercel.com
3. Agrega las variables de entorno en Vercel Dashboard
4. Deploy automático en cada push a main
