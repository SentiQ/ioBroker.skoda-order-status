export interface CsrfState {
    csrf: string;
    hmac: string;
    relayState: string;
}

function extractIdkObject(html: string): string {
    const marker = html.indexOf('window._IDK');
    if (marker === -1) {
        throw new Error('CSRF data not found in login page');
    }

    const equals = html.indexOf('=', marker);
    const start = html.indexOf('{', equals);
    if (start === -1) {
        throw new Error('CSRF object not found in login page');
    }

    let depth = 0;
    let inString: string | null = null;
    let escape = false;

    for (let i = start; i < html.length; i++) {
        const ch = html[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === inString) {
                inString = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            inString = ch;
            continue;
        }
        if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                return html.slice(start, i + 1);
            }
        }
    }

    throw new Error('CSRF object unterminated in login page');
}

function extractQuotedField(source: string, name: string): string | undefined {
    const quoted = new RegExp(`['"]?${name}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
    const quotedMatch = quoted.exec(source);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }
    const unquoted = new RegExp(`['"]?${name}['"]?\\s*:\\s*([A-Za-z0-9_-]+)`);
    return unquoted.exec(source)?.[1];
}

/**
 * Parse CSRF, HMAC and relayState from a VW Identity HTML login page.
 */
export function parseCsrfState(html: string): CsrfState {
    const raw = extractIdkObject(html);
    const csrf = extractQuotedField(raw, 'csrf_token');
    const hmac = extractQuotedField(raw, 'hmac');
    const relayState = extractQuotedField(raw, 'relayState');

    if (!csrf || !hmac || !relayState) {
        throw new Error('Failed to parse CSRF information from login page');
    }

    return { csrf, hmac, relayState };
}
