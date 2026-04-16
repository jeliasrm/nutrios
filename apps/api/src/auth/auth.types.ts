export type Role = 'superadmin' | 'admin' | 'nutriologo' | 'recepcionista' | 'paciente'

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  name: string
  role: Role
}

export interface AccessTokenPayload {
  sub: string
  tenantId: string
  role: Role
}

export interface RefreshTokenPayload {
  sub: string
  tenantId: string
  jti: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
}
