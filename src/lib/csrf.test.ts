import { expect } from 'chai';
import { parseCsrfState } from './csrf';

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<body>
<script>
  window._IDK = {
    csrf_token: 'csrf-abc-123',
    templateModel: {
      hmac: 'deadbeefhmac',
      relayState: 'relay-456',
    },
  };
</script>
</body>
</html>
`;

describe('parseCsrfState', () => {
    it('extracts csrf, hmac and relayState from VW Identity HTML', () => {
        const csrf = parseCsrfState(SAMPLE_HTML);
        expect(csrf.csrf).to.equal('csrf-abc-123');
        expect(csrf.hmac).to.equal('deadbeefhmac');
        expect(csrf.relayState).to.equal('relay-456');
    });

    it('supports quoted keys and values', () => {
        const html = `window._IDK = { "csrf_token": "tok", "templateModel": { "hmac": "h1", "relayState": "r1" } };`;
        const csrf = parseCsrfState(html);
        expect(csrf.csrf).to.equal('tok');
        expect(csrf.hmac).to.equal('h1');
        expect(csrf.relayState).to.equal('r1');
    });

    it('throws when window._IDK is missing', () => {
        expect(() => parseCsrfState('<html></html>')).to.throw('CSRF data not found');
    });
});
