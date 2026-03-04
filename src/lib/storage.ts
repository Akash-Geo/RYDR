import { supabase } from './supabase'

export async function uploadUserFile(args: {
  bucket: 'user-documents' | 'avatars'
  userId: string
  file: File
  filename: string
}) {
  const { bucket, userId, file, filename } = args
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error

  return path
}

export async function openSignedUrl(args: { bucket: 'user-documents' | 'avatars'; path: string }) {
  const { bucket, path } = args
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function getSignedUrl(args: { bucket: 'user-documents' | 'avatars'; path: string }) {
  const { bucket, path } = args
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

