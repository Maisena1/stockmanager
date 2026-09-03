export interface AuthPayload {
  userId: number;
  role: "ADMIN" | "EMPLOYEE";
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
