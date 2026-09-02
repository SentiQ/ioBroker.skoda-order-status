import { expect } from 'chai';
import { clampPollInterval, DEFAULT_POLL_INTERVAL, MAX_POLL_INTERVAL, MIN_POLL_INTERVAL } from './const';
import { checkpointDate, mapOrder, sanitizeId, statusLabel, type OrderDetails } from './order-mapper';

const SAMPLE_ORDER: OrderDetails = {
    orderStatus: 'IN_PRODUCTION',
    commissionId: 'ABC 12/34',
    name: 'Elroq',
    activationState: 'ACTIVE',
    vehicleSpecification: {
        model: 'Elroq',
        trimLevel: '60',
        exteriorColour: 'Black Magic',
        interiorColour: 'Black',
        battery: { capacityInKWh: 63 },
        maxPerformanceInKW: 150,
    },
    dealer: { servicePartnerId: 'DE123' },
    checkPoints: [
        { status: 'ORDER_CONFIRMED', date: '2026-01-10T10:00:00Z' },
        { status: 'IN_PRODUCTION', date: '2026-03-01T08:00:00Z' },
        { status: 'IN_DELIVERY' },
        { status: 'TO_HANDOVER' },
    ],
};

describe('statusLabel', () => {
    it('returns German labels for known statuses', () => {
        expect(statusLabel('ORDER_CONFIRMED')).to.equal('Bestätigt');
        expect(statusLabel('IN_PRODUCTION')).to.equal('In Produktion');
        expect(statusLabel('IN_DELIVERY')).to.equal('Unterwegs');
        expect(statusLabel('TO_HANDOVER')).to.equal('Zur Übergabe');
    });

    it('returns the raw status when unknown', () => {
        expect(statusLabel('SOMETHING_ELSE')).to.equal('SOMETHING_ELSE');
    });

    it('returns null for empty status', () => {
        expect(statusLabel(undefined)).to.equal(null);
        expect(statusLabel('')).to.equal(null);
    });
});

describe('sanitizeId', () => {
    it('keeps safe characters', () => {
        expect(sanitizeId('ABCdef-12_3')).to.equal('ABCdef-12_3');
    });

    it('replaces unsupported characters', () => {
        expect(sanitizeId('ABC 12/34')).to.equal('ABC_12_34');
    });

    it('falls back when the id would be empty', () => {
        expect(sanitizeId('***')).to.equal('order');
    });
});

describe('checkpointDate', () => {
    it('returns the date for a reached checkpoint', () => {
        expect(checkpointDate(SAMPLE_ORDER.checkPoints, 'ORDER_CONFIRMED')).to.equal('2026-01-10T10:00:00Z');
    });

    it('returns null when the checkpoint has no date', () => {
        expect(checkpointDate(SAMPLE_ORDER.checkPoints, 'IN_DELIVERY')).to.equal(null);
    });
});

describe('mapOrder', () => {
    it('maps API payload to ioBroker states', () => {
        const mapped = mapOrder(SAMPLE_ORDER);
        expect(mapped.deviceName).to.equal('Elroq');
        expect(mapped.orderStatus).to.equal('IN_PRODUCTION');
        expect(mapped.orderStatusLabel).to.equal('In Produktion');
        expect(mapped.batteryKwh).to.equal(63);
        expect(mapped.maxPerformanceKw).to.equal(150);
        expect(mapped.dealerId).to.equal('DE123');
        expect(mapped.orderConfirmedDate).to.equal('2026-01-10T10:00:00Z');
        expect(mapped.inProductionDate).to.equal('2026-03-01T08:00:00Z');
        expect(mapped.inDeliveryDate).to.equal(null);
        expect(mapped.checkpointsReached).to.have.length(2);
        expect(mapped.checkpointsPending).to.have.length(2);
        expect(mapped.checkpointsPending[0].label).to.equal('Unterwegs');
    });
});

describe('clampPollInterval', () => {
    it('uses the default for invalid values', () => {
        expect(clampPollInterval(undefined)).to.equal(DEFAULT_POLL_INTERVAL);
        expect(clampPollInterval('nope')).to.equal(DEFAULT_POLL_INTERVAL);
    });

    it('clamps to min and max', () => {
        expect(clampPollInterval(10)).to.equal(MIN_POLL_INTERVAL);
        expect(clampPollInterval(999999)).to.equal(MAX_POLL_INTERVAL);
        expect(clampPollInterval(1800)).to.equal(1800);
    });
});
