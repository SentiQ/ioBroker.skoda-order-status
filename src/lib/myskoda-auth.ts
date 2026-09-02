import { createHash, randomBytes } from 'node:crypto';
import fetchCookie from 'fetch-cookie';
import nodeFetch, { type RequestInit as NodeFetchRequestInit, type Response as NodeFetchResponse } from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import {
    BASE_URL_IDENT,
    BASE_URL_SKODA,
    CLIENT_ID,
    MAX_AUTH_REDIRECTS,
    MAX_TOKEN_RETRIES,
    OIDC_SCOPE,
    REDIRECT_URI,
    USER_AGENT,
} from './const';
import { parseCsrfState } from './csrf';
import { MarketingConsentError, SkodaOrderAuthError, TermsAndConditionsError } from './errors';

export interface IdkSession {
    accessToken: string;
    refreshToken: string;
    idToken?: string;
}

export type FetchLike = (input: string | URL, init?: NodeFetchRequestInit) => Promise<NodeFetchResponse>;

function generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(16);
    let result = '';
    for (const byte of bytes) {
        result += chars[byte % chars.length];
    }
    return result;
}

function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

function decodeJwtPayload(token: string): { exp?: number } {
    const payload = token.split('.')[1];
    if (!payload) {
        return {};
    }
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function isJwtExpired(token: string, skewMinutes: number): boolean {
    const meta = decodeJwtPayload(token);
    const expiry = typeof meta.exp === 'number' ? meta.exp * 1000 : 0;
    return Date.now() + skewMinutes * 60_000 >= expiry;
}

function appPrefix(redirectUri: string): string {
    const splitStr = '://';
    const idx = redirectUri.indexOf(splitStr);
    if (idx === -1) {
        throw new SkodaOrderAuthError('Invalid redirect URI');
    }
    return redirectUri.slice(0, idx);
}

function resolveLocation(location: string, currentUrl: string): string {
    return new URL(location, currentUrl).href;
}

async function readJson(response: NodeFetchResponse): Promise<IdkSession> {
    const text = await response.text();
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new SkodaOrderAuthError(`Failed to parse token response: ${(error as Error).message}`);
    }
    const accessToken = parsed.accessToken;
    const refreshToken = parsed.refreshToken;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
        throw new SkodaOrderAuthError('Token response did not contain accessToken/refreshToken');
    }
    return {
        accessToken,
        refreshToken,
        idToken: typeof parsed.idToken === 'string' ? parsed.idToken : undefined,
    };
}

/**
 * MySkoda VW Identity login (PKCE) and token refresh.
 */
export class MySkodaAuth {
    private readonly fetchFn: FetchLike;
    private readonly jar: CookieJar;
    private email?: string;
    private password?: string;
    private session: IdkSession | null = null;
    private refreshLock: Promise<void> = Promise.resolve();

    public constructor() {
        this.jar = new CookieJar();
        this.fetchFn = fetchCookie(nodeFetch, this.jar);
    }

    public getRefreshToken(): string | undefined {
        return this.session?.refreshToken;
    }

    public async authorize(email: string, password: string): Promise<void> {
        this.email = email;
        this.password = password;
        this.session = await this.getIdkSession();
    }

    public async authorizeRefreshToken(refreshToken: string): Promise<void> {
        if (isJwtExpired(refreshToken, 1)) {
            throw new SkodaOrderAuthError('Refresh token has expired. Please authorize using username/password.');
        }
        await this.withRefreshLock(async () => {
            const response = await this.fetchFn(
                `${BASE_URL_SKODA}/api/v1/authentication/refresh-token?tokenType=CONNECT`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': USER_AGENT,
                    },
                    body: JSON.stringify({ token: refreshToken }),
                },
            );
            if (!response.ok) {
                throw new SkodaOrderAuthError(`Refresh token authorization failed with status ${response.status}`);
            }
            this.session = await readJson(response);
        });
    }

    public async getAccessToken(): Promise<string> {
        if (!this.session) {
            throw new SkodaOrderAuthError('Not authorized');
        }
        if (isJwtExpired(this.session.accessToken, 10)) {
            await this.refreshTokens();
        }
        if (!this.session) {
            throw new SkodaOrderAuthError('Not authorized');
        }
        return this.session.accessToken;
    }

    private async refreshTokens(): Promise<void> {
        await this.withRefreshLock(async () => {
            if (!this.session) {
                throw new SkodaOrderAuthError('Not authorized');
            }
            if (!isJwtExpired(this.session.accessToken, 10)) {
                return;
            }

            for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
                if (await this.performRefreshToken()) {
                    return;
                }
            }

            if (this.email && this.password) {
                this.session = await this.getIdkSession();
                return;
            }

            throw new SkodaOrderAuthError('Refreshing token failed');
        });
    }

    private async performRefreshToken(): Promise<boolean> {
        if (!this.session) {
            return false;
        }
        try {
            const response = await this.fetchFn(
                `${BASE_URL_SKODA}/api/v1/authentication/refresh-token?tokenType=CONNECT`,
                {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'user-agent': USER_AGENT,
                    },
                    body: JSON.stringify({ token: this.session.refreshToken }),
                },
            );
            if (!response.ok) {
                return false;
            }
            this.session = await readJson(response);
            return true;
        } catch {
            return false;
        }
    }

    private async getIdkSession(): Promise<IdkSession> {
        if (!this.email || !this.password) {
            throw new SkodaOrderAuthError('Email and password are required');
        }

        const verifier = generateNonce();
        const loginMeta = await this.initialOidcAuthorize(verifier);
        const passwordMeta = await this.enterEmailAddress(loginMeta);
        const code = await this.enterPassword(passwordMeta);
        return this.exchangeAuthCode(code, verifier);
    }

    private async initialOidcAuthorize(verifier: string): Promise<ReturnType<typeof parseCsrfState>> {
        const challenge = pkceChallenge(verifier);
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            nonce: generateNonce(),
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: OIDC_SCOPE,
            code_challenge: challenge,
            code_challenge_method: 's256',
            prompt: 'login',
        });

        const response = await this.fetchFn(`${BASE_URL_IDENT}/oidc/v1/authorize?${params.toString()}`, {
            headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        });
        if (!response.ok) {
            throw new SkodaOrderAuthError(`OIDC authorize failed with status ${response.status}`);
        }
        return parseCsrfState(await response.text());
    }

    private async enterEmailAddress(
        csrf: ReturnType<typeof parseCsrfState>,
    ): Promise<ReturnType<typeof parseCsrfState>> {
        const body = new URLSearchParams({
            relayState: csrf.relayState,
            email: this.email as string,
            hmac: csrf.hmac,
            _csrf: csrf.csrf,
        });

        const response = await this.fetchFn(`${BASE_URL_IDENT}/signin-service/v1/${CLIENT_ID}/login/identifier`, {
            method: 'POST',
            headers: {
                'user-agent': USER_AGENT,
                accept: 'text/html',
                'content-type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        if (!response.ok) {
            throw new SkodaOrderAuthError(`Email login step failed with status ${response.status}`);
        }
        return parseCsrfState(await response.text());
    }

    private async enterPassword(csrf: ReturnType<typeof parseCsrfState>): Promise<string> {
        const body = new URLSearchParams({
            relayState: csrf.relayState,
            email: this.email as string,
            password: this.password as string,
            hmac: csrf.hmac,
            _csrf: csrf.csrf,
        });

        const startUrl = `${BASE_URL_IDENT}/signin-service/v1/${CLIENT_ID}/login/authenticate`;
        const authResponse = await this.fetchFn(startUrl, {
            method: 'POST',
            headers: {
                'user-agent': USER_AGENT,
                accept: 'text/html',
                'content-type': 'application/x-www-form-urlencoded',
            },
            body,
            redirect: 'manual',
        });

        let location = authResponse.headers.get('location');
        if (!location) {
            throw new SkodaOrderAuthError(
                `Password login failed with status ${authResponse.status} (no redirect). Credentials may be incorrect.`,
            );
        }

        let currentUrl = startUrl;
        const prefix = appPrefix(REDIRECT_URI);
        let hops = 0;

        while (!location.startsWith(prefix)) {
            hops++;
            if (hops > MAX_AUTH_REDIRECTS) {
                throw new SkodaOrderAuthError('Too many redirects during login');
            }
            const absolute = resolveLocation(location, currentUrl);
            if (absolute.includes('terms-and-conditions')) {
                throw new TermsAndConditionsError(absolute);
            }
            if (absolute.includes('consent/marketing')) {
                throw new MarketingConsentError(absolute);
            }

            const response = await this.fetchFn(absolute, {
                headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
                redirect: 'manual',
            });
            const next = response.headers.get('location');
            if (!next) {
                throw new SkodaOrderAuthError(`Login redirect chain stopped with status ${response.status}`);
            }
            currentUrl = absolute;
            location = next;
        }

        const finalUrl = resolveLocation(location, currentUrl);
        const code = new URL(finalUrl).searchParams.get('code');
        if (!code) {
            throw new SkodaOrderAuthError(`Failed to extract authorization code from ${finalUrl}`);
        }
        return code;
    }

    private async exchangeAuthCode(code: string, verifier: string): Promise<IdkSession> {
        const response = await this.fetchFn(
            `${BASE_URL_SKODA}/api/v1/authentication/exchange-authorization-code?tokenType=CONNECT`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': USER_AGENT,
                },
                body: JSON.stringify({
                    code,
                    redirectUri: REDIRECT_URI,
                    verifier,
                }),
                redirect: 'manual',
            },
        );
        if (!response.ok) {
            throw new SkodaOrderAuthError(`Token exchange failed with status ${response.status}`);
        }
        return readJson(response);
    }

    private async withRefreshLock(task: () => Promise<void>): Promise<void> {
        const run = this.refreshLock.then(task, task);
        this.refreshLock = run.then(
            () => undefined,
            () => undefined,
        );
        await run;
    }
}
