export const CLIENT_ID = '7f045eee-7003-4379-9968-9355ed2adb06@apps_vw-dilab_com';
export const REDIRECT_URI = 'myskoda://redirect/login/';
export const BASE_URL_SKODA = 'https://mysmob.api.connect.skoda-auto.cz';
export const BASE_URL_IDENT = 'https://identity.vwgroup.io';

export const GARAGE_PATH =
    '/v2/garage?connectivityGenerations=MOD1' +
    '&connectivityGenerations=MOD2' +
    '&connectivityGenerations=MOD3' +
    '&connectivityGenerations=MOD4';

export const DEFAULT_POLL_INTERVAL = 3600;
export const MIN_POLL_INTERVAL = 900;
export const MAX_POLL_INTERVAL = 86400;
export const HTTP_TIMEOUT_MS = 30_000;
export const MAX_TOKEN_RETRIES = 5;
export const MAX_AUTH_REDIRECTS = 20;

export const OIDC_SCOPE =
    'address badge birthdate cars driversLicense dealers email mileage mbb nationalIdentifier openid phone profession profile vin';

export const USER_AGENT =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export const STATUS_LABELS: Record<string, string> = {
    ORDER_CONFIRMED: 'Confirmed',
    IN_PRODUCTION: 'In production',
    IN_DELIVERY: 'In delivery',
    TO_HANDOVER: 'To handover',
};

export function clampPollInterval(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return DEFAULT_POLL_INTERVAL;
    }
    return Math.min(MAX_POLL_INTERVAL, Math.max(MIN_POLL_INTERVAL, Math.round(n)));
}
