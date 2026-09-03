import { randomUUID } from "node:crypto";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function getTtlMin():number {
    const raw = process.env.ADMIN_SESSION_TTL_MIN;
    const parsed = raw !== undefined ? Number(raw) :NaN;
      return Number.isFinite(parsed) && parsed > 0 ?
    parsed : 5;    
}

export interface AdminSession {
    userId: number;
    jti: string;
    loginAt: number;
    lastSeen: number;
}

let adminSession: AdminSession | null = null;

export function getAdminSession(): AdminSession | null {
    return adminSession;
}

function isExpired(session: AdminSession, now:number):boolean {
if (now - session.loginAt >= EIGHT_HOURS_MS) 
    return true;
    return now - session.lastSeen >= getTtlMin() * 60 * 1000;
}

function isAlive(now:number): boolean {
    if (!adminSession) return false;
    if (isExpired(adminSession, now)){
        adminSession = null;
        return false;
    }    
    return true;
}

export function ensureAdminSession(userId: number): {ok: true; session: AdminSession} | { ok: false}
{
    const now = Date.now();
    if (isAlive(now)) return {ok:false};
    const session: AdminSession = { userId, jti: randomUUID(), loginAt: now, lastSeen: now};
    adminSession = session;
    return {ok: true, session}; 
}

export function validateAdminJti(jti:string | undefined):boolean {
 if (!jti) return false;
 const now = Date.now();
 if (!isAlive(now)) return false;
 return adminSession!.jti === jti;    
}

export function touchAdminSession(): void {
    if (adminSession) adminSession.lastSeen = Date.now();
}

export function clearAdminSession(jti?: string):
void {
    if (!adminSession) return;
    if (jti === undefined || adminSession.jti === jti) adminSession = null;
}
