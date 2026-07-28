export type PlaceholderShape = 'rectangle' | 'circle' | 'rounded'

export interface Placeholder {
  id: string
  type: 'image'
  shape: PlaceholderShape
  label: string
  confidence: number
  rotation: number
  x: number
  y: number
  width: number
  height: number
}

export type TemplateVisibility = 'public' | 'private'
export type TemplateStatus = 'draft' | 'published'

export interface Template {
  id: string
  owner_id: string
  title: string
  description: string | null
  category: string
  tags: string[]
  visibility: TemplateVisibility
  status: TemplateStatus
  image_path: string
  thumbnail_path: string
  image_width: number
  image_height: number
  placeholders: Placeholder[]
  views: number
  downloads: number
  likes: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface GeneratedImage {
  id: string
  template_id: string | null
  image_path: string
  inputs: { placeholderId: string; url: string }[]
  created_at: string
}

export interface Favorite {
  id: string
  user_id: string
  template_id: string
  created_at: string
}

export interface Like {
  id: string
  user_id: string
  template_id: string
  created_at: string
}

export interface TemplateCorrection {
  id: string
  template_id: string
  user_id: string
  original_prediction: Placeholder[]
  corrected_placeholders: Placeholder[]
  confidence: number | null
  created_at: string
}

export const CATEGORIES = [
  'General',
  'Birthday',
  'Social Media',
  'Flyer',
  'Collage',
  'Profile',
  'Logo',
  'Wedding',
  'Business',
  'Event',
] as const

export type Category = (typeof CATEGORIES)[number]

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Liked' },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'recent', label: 'Recently Added' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']
