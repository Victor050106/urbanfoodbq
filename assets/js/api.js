import { SHEET_API_URL } from './config.js';

export async function getJson(query = '') {
    if (!SHEET_API_URL) return null;
    try {
        const res = await fetch(SHEET_API_URL + query, { method: 'GET', cache: 'no-store' });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}
