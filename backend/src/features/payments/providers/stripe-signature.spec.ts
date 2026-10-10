import { verifyStripeSignature } from './stripe-signature';

// Golden HMAC generated independently with .NET HMACSHA256 over UTF-8 bytes.
const body = Buffer.from('{"object":"event","id":"evt_fixture","note":"ทดสอบ"}', 'utf8');
const secret = 'whsec_fixture_only';
const timestamp = 1700000000;
const v1 = 'a2ecbb39bc8544c06031a75883310bbc971fd0c855559ebacb8c988b963414ab';
const header = `t=${timestamp},v1=${v1}`;

describe('Stripe raw-byte signature boundary', () => {
  it('matches an independent UTF-8 HMAC golden vector', () => {
    expect(verifyStripeSignature(body, header, secret, timestamp)).toBe(true);
  });
  it('accepts any matching v1 signature during secret rotation, ignoring other schemes', () => {
    expect(verifyStripeSignature(body, `t=${timestamp},v0=${v1},v1=${'0'.repeat(64)},v1=${v1}`, secret, timestamp)).toBe(true);
    expect(verifyStripeSignature(body, `t=${timestamp},v0=${v1}`, secret, timestamp)).toBe(false);
  });
  it('rejects changed bytes, wrong secret, empty body and reserialized JSON', () => {
    for (const payload of [Buffer.concat([body, Buffer.from(' ')]),
      Buffer.from('{"id":"evt_fixture","object":"event","note":"ทดสอบ"}'), Buffer.alloc(0)]) {
      expect(verifyStripeSignature(payload, header, secret, timestamp)).toBe(false);
    }
    expect(verifyStripeSignature(body, header, secret + 'wrong', timestamp)).toBe(false);
    expect(verifyStripeSignature(body, header, '', timestamp)).toBe(false);
  });
  it('bounds the signature timestamp in both directions without using event.created', () => {
    for (const age of [-300, 300]) expect(verifyStripeSignature(body, header, secret, timestamp + age)).toBe(true);
    for (const age of [-301, 301]) expect(verifyStripeSignature(body, header, secret, timestamp + age)).toBe(false);
  });
  it('fails closed for absent, ambiguous, malformed and overlong headers', () => {
    for (const value of [undefined, [header], '', header + `,t=${timestamp}`, `t=1e9,v1=${v1}`,
      `t=${timestamp},v1=zz`, `t=${timestamp},v1=${v1.slice(1)}`, 'x'.repeat(8193)]) {
      expect(verifyStripeSignature(body, value, secret, timestamp)).toBe(false);
    }
  });
});
