export interface User {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'user'
  profile_picture_url?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}
