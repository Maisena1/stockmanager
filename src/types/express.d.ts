export interface AuthPayload {
  userId: number;
  username: string;
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
