export interface AuthPayload {
  userId: number;
  role: "ADMIN" | "EMPLOYEE";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
