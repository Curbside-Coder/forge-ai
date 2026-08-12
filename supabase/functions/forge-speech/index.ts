const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return respond({ ok: true })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Sign in to hear Forge.' }, 401)
    const keySet = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<
      string,
      string
    >
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? keySet.default
    if (!publishableKey)
      return respond({ error: 'Forge voice is missing function configuration.' }, 503)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult } = await supabase.auth.getUser()
    if (!userResult.user) return respond({ error: 'Your Forge session is no longer valid.' }, 401)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return respond({ error: 'Forge voice is not configured yet.' }, 503)
    const body = (await request.json()) as { text?: string }
    const text = body.text?.trim().slice(0, 4096) ?? ''
    if (!text) return respond({ error: 'Nothing to speak.' }, 400)
    const speech = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'cedar',
        input: text,
        response_format: 'mp3',
        instructions:
          'Speak like a calm, precise, warm executive assistant. Natural pacing, confident but never theatrical.',
      }),
    })
    if (!speech.ok) {
      console.error('OpenAI speech failed', speech.status)
      return respond({ error: `OpenAI could not generate speech (${speech.status}).` }, 502)
    }
    const bytes = new Uint8Array(await speech.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    return respond({ audioBase64: btoa(binary) })
  } catch (error) {
    console.error('Forge speech failed', error)
    return respond({ error: 'Forge could not generate speech. Please try again.' }, 500)
  }
})

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
import { createClient } from 'npm:@supabase/supabase-js@2'
