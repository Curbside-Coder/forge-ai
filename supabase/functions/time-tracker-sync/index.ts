import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors })
const hash = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response({ ok: true })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  try {
    const body = (await request.json()) as {
      token?: string
      action?: 'get' | 'start' | 'stop'
      projectId?: string
      description?: string
      values?: Record<string, string>
      pageUrl?: string
      pageTitle?: string
    }
    if (!body.token || !body.action)
      return response({ error: 'Missing extension credentials.' }, 400)
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const url = Deno.env.get('SUPABASE_URL')
    if (!serviceKey || !url) return response({ error: 'Time sync is unavailable.' }, 503)
    const admin = createClient(url, serviceKey)
    const tokenHash = await hash(body.token)
    const { data: credential } = await admin
      .from('time_tracker_extension_tokens')
      .select('id,owner_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!credential) return response({ error: 'Pair this Chrome extension with Forge first.' }, 401)
    await admin
      .from('time_tracker_extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credential.id)
    const { data: active, error: activeError } = await admin
      .from('active_time_trackers')
      .select('*')
      .eq('owner_id', credential.owner_id)
      .maybeSingle()
    if (activeError) return response({ error: activeError.message }, 500)
    if (body.action === 'get') return response({ active })
    if (body.action === 'start') {
      if (!body.projectId)
        return response({ error: 'Choose a project in Forge before starting.' }, 400)
      const tracker = {
        owner_id: credential.owner_id,
        project_id: body.projectId,
        started_at: new Date().toISOString(),
        description: body.description?.slice(0, 1000) ?? '',
        custom_fields: body.values ?? {},
        page_url: body.pageUrl?.slice(0, 2000) ?? null,
        page_title: body.pageTitle?.slice(0, 500) ?? null,
      }
      const { data, error } = await admin
        .from('active_time_trackers')
        .upsert(tracker, { onConflict: 'owner_id' })
        .select()
        .single()
      return error ? response({ error: error.message }, 500) : response({ active: data })
    }
    if (!active) return response({ active: null })
    const endedAt = new Date().toISOString()
    const duration = Math.max(
      1,
      Math.floor((new Date(endedAt).getTime() - new Date(active.started_at).getTime()) / 1000),
    )
    const { error: saveError } = await admin.from('time_entries').insert({
      owner_id: credential.owner_id,
      project_id: active.project_id,
      started_at: active.started_at,
      ended_at: endedAt,
      duration_seconds: duration,
      description: active.description,
      billing_status: active.custom_fields?.billing_status ?? 'Billable',
      approval_status: active.custom_fields?.approval_status ?? 'Not Submitted',
      custom_fields: active.custom_fields ?? {},
      source: active.page_url ? 'chrome-extension' : 'forge',
      page_url: active.page_url,
      page_title: active.page_title,
    })
    if (saveError) return response({ error: saveError.message }, 500)
    const { error: removeError } = await admin
      .from('active_time_trackers')
      .delete()
      .eq('owner_id', credential.owner_id)
    return removeError
      ? response({ error: removeError.message }, 500)
      : response({ active: null, stopped: true })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Time sync failed.' }, 500)
  }
})
