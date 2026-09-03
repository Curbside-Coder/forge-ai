import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return respond({ ok: true })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Sign in to generate an image.' }, 401)
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<
      string,
      string
    >
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? publishableKeys.default
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!publishableKey || !url || !serviceKey || !apiKey)
      return respond({ error: 'Forge image generation is not configured yet.' }, 503)
    const client = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult } = await client.auth.getUser()
    if (!userResult.user) return respond({ error: 'Your Forge session is no longer valid.' }, 401)
    const body = (await request.json()) as { prompt?: string }
    const prompt = body.prompt?.trim().slice(0, 2000) ?? ''
    if (!prompt) return respond({ error: 'Describe the image you want Forge to create.' }, 400)
    const openai = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
      }),
    })
    const result = await openai.json()
    if (!openai.ok) {
      console.error('OpenAI image request failed', openai.status, result)
      return respond({ error: `OpenAI could not generate an image (${openai.status}).` }, 502)
    }
    const imageBase64 = result.data?.[0]?.b64_json as string | undefined
    if (!imageBase64) return respond({ error: 'OpenAI returned no image data.' }, 502)
    const binary = Uint8Array.from(atob(imageBase64), (character) => character.charCodeAt(0))
    const path = `${userResult.user.id}/chat/${crypto.randomUUID()}.png`
    const admin = createClient(url, serviceKey)
    const { error: uploadError } = await admin.storage.from('forge-media').upload(path, binary, {
      contentType: 'image/png',
      upsert: false,
    })
    if (uploadError) return respond({ error: uploadError.message }, 500)
    const { data: publicUrl } = admin.storage.from('forge-media').getPublicUrl(path)
    return respond({
      imageUrl: publicUrl.publicUrl,
      usage: {
        inputTokens: Number(result.usage?.input_tokens ?? 0),
        outputTokens: Number(result.usage?.output_tokens ?? 0),
        totalTokens: Number(result.usage?.total_tokens ?? 0),
      },
    })
  } catch (error) {
    console.error('Forge image failed', error)
    return respond({ error: 'Forge could not create that image. Please try again.' }, 500)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
