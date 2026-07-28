export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
        }
        Update: {
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
        }
      }
      templates: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string | null
          category: string
          tags: string[]
          visibility: 'public' | 'private'
          status: 'draft' | 'published'
          image_path: string
          thumbnail_path: string
          image_width: number
          image_height: number
          placeholders: any[]
          views: number
          downloads: number
          likes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          title: string
          description?: string | null
          category?: string
          tags?: string[]
          visibility?: 'public' | 'private'
          status?: 'draft' | 'published'
          image_path: string
          thumbnail_path: string
          image_width: number
          image_height: number
          placeholders?: any[]
        }
        Update: {
          title?: string
          description?: string | null
          category?: string
          tags?: string[]
          visibility?: 'public' | 'private'
          status?: 'draft' | 'published'
          placeholders?: any[]
        }
      }
      template_corrections: {
        Row: {
          id: string
          template_id: string
          user_id: string
          original_prediction: any
          corrected_placeholders: any
          confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          user_id?: string
          original_prediction: any
          corrected_placeholders: any
          confidence?: number | null
        }
      }
      generated_images: {
        Row: {
          id: string
          template_id: string | null
          user_id: string
          image_path: string
          inputs: any[]
          created_at: string
        }
        Insert: {
          id?: string
          template_id?: string | null
          user_id?: string
          image_path: string
          inputs?: any[]
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          template_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          template_id: string
        }
      }
      likes: {
        Row: {
          id: string
          user_id: string
          template_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          template_id: string
        }
      }
      downloads: {
        Row: {
          id: string
          user_id: string | null
          template_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          template_id: string
        }
      }
    }
  }
}
