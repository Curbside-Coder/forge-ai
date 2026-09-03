import { supabase } from '@/lib/supabase'

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const maxImageBytes = 10 * 1024 * 1024

export function getPastedImages(event: ClipboardEvent) {
  return Array.from(event.clipboardData?.files ?? []).filter((file) => allowedImageTypes.has(file.type))
}

export async function uploadForgeImage(file: File, ownerId: string, scope: 'chat' | 'work-items') {
  if (!supabase) throw new Error('Image uploads require a connected Forge workspace.')
  if (!allowedImageTypes.has(file.type)) {
    throw new Error('Use a PNG, JPG, WebP, or GIF image.')
  }
  if (file.size > maxImageBytes) {
    throw new Error('Choose an image smaller than 10 MB.')
  }
  const extension = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${ownerId}/${scope}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('forge-media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from('forge-media').getPublicUrl(path)
  return data.publicUrl
}

export function imageMarkdown(url: string, alt = 'Attached image') {
  return `![${alt}](${url})`
}
