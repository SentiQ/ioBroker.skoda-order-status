export class SkodaOrderApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SkodaOrderApiError';
    }
}

export class SkodaOrderAuthError extends SkodaOrderApiError {
    constructor(message: string) {
        super(message);
        this.name = 'SkodaOrderAuthError';
    }
}

export class TermsAndConditionsError extends SkodaOrderAuthError {
    constructor(location: string) {
        super(`Terms and conditions must be accepted in the MySkoda app: ${location}`);
        this.name = 'TermsAndConditionsError';
    }
}

export class MarketingConsentError extends SkodaOrderAuthError {
    constructor(location: string) {
        super(`Marketing consent must be accepted in the MySkoda app: ${location}`);
        this.name = 'MarketingConsentError';
    }
}
