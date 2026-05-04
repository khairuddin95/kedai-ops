export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          role: 'staff' | 'supervisor' | 'owner'
          branch: string
          avatar: string
          pin: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      shifts: {
        Row: { id: string; label: string; start_time: string; end_time: string }
        Insert: Database['public']['Tables']['shifts']['Row']
        Update: Partial<Database['public']['Tables']['shifts']['Row']>
      }
      task_groups: {
        Row: { id: string; title: string; time: string; icon: string; color: string; sort_order: number }
        Insert: Database['public']['Tables']['task_groups']['Row']
        Update: Partial<Database['public']['Tables']['task_groups']['Row']>
      }
      tasks: {
        Row: {
          id: string; title: string; est: number; items: string[]
          requires_photo: boolean; group_id: string; sort_order: number
        }
        Insert: Database['public']['Tables']['tasks']['Row']
        Update: Partial<Database['public']['Tables']['tasks']['Row']>
      }
      submissions: {
        Row: {
          id: string; task_id: string; task_title: string
          staff_id: string; staff_name: string; staff_avatar: string
          branch: string; shift_id: string; submitted_at: string
          checked_items: number[]; photos: string[]; notes: string
          rating: number; status: 'pending' | 'approved' | 'rejected'
          supervisor_comment: string | null; flag: boolean
          group_title: string | null; group_color: string | null
        }
        Insert: Omit<Database['public']['Tables']['submissions']['Row'], 'id' | 'submitted_at'> & { id?: string; submitted_at?: string }
        Update: Partial<Database['public']['Tables']['submissions']['Insert']>
      }
      task_states: {
        Row: {
          id: string; user_id: string; task_id: string
          status: 'pending' | 'in_progress' | 'done' | 'late'
          checked_items: number[]; photos: string[]; notes: string
          rating: number; updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['task_states']['Row'], 'id' | 'updated_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['task_states']['Insert']>
      }
    }
  }
}
