import {
  classifyMapLinkTarget,
  isGoogleMapsHost,
  MapShortLink,
} from './map-short-link';

describe('MapShortLink.parse', () => {
  it.each([
    ['https://maps.app.goo.gl/AbCdEf123', 'https://maps.app.goo.gl/AbCdEf123'],
    ['https://MAPS.APP.GOO.GL/AbC', 'https://maps.app.goo.gl/AbC'],
    ['https://maps.app.goo.gl./AbC', 'https://maps.app.goo.gl/AbC'],
    ['https://maps.app.goo.gl:443/AbC', 'https://maps.app.goo.gl/AbC'],
    [
      '  https://maps.app.goo.gl/AbC?g_st=ic  ',
      'https://maps.app.goo.gl/AbC?g_st=ic',
    ],
    ['https://goo.gl/maps/XyZ987', 'https://goo.gl/maps/XyZ987'],
    ['https://maps.app.goo.gl/AbC#frag', 'https://maps.app.goo.gl/AbC'],
  ])('accepts %s', (raw, href) => {
    expect(MapShortLink.parse(raw)?.href).toBe(href);
  });

  it.each([
    'http://maps.app.goo.gl/AbC', // not https
    'https://user:pass@maps.app.goo.gl/AbC', // credentials
    'https://user@maps.app.goo.gl/AbC',
    'https://maps.app.goo.gl:8443/AbC', // non-default port
    'https://maps.app.goo.gl/', // no id
    'https://goo.gl/AbC', // goo.gl outside /maps/
    'https://goo.gl/maps/',
    'https://maps.app.goo.gl.evil.com/AbC', // lookalikes
    'https://evilmaps.app.goo.gl/AbC',
    'https://google.com.evil.io/maps',
    'https://evilgoogle.com/maps',
    'https://www.google.com/maps/@1,2,15z', // final URLs are not short links
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/AbC',
    'https://2852039166/AbC', // decimal IPv4
    'javascript:alert(1)',
    'file:///etc/passwd',
    'not a url',
    '',
    `https://maps.app.goo.gl/${'a'.repeat(3000)}`,
  ])('rejects %s', (raw) => {
    expect(MapShortLink.parse(raw)).toBeNull();
  });
});

describe('isGoogleMapsHost', () => {
  it.each([
    'google.com',
    'www.google.com',
    'maps.google.com',
    'www.google.es',
    'google.com.ec',
    'maps.google.co.uk',
  ])('accepts %s', (host) => {
    expect(isGoogleMapsHost(host)).toBe(true);
  });

  it.each([
    'evilgoogle.com',
    'google.com.evil.io',
    'maps.google.com.evil.io',
    'api.google.com',
    'google.evil',
    'google.community',
  ])('rejects %s', (host) => {
    expect(isGoogleMapsHost(host)).toBe(false);
  });
});

describe('classifyMapLinkTarget', () => {
  it('classifies another short link as a hop', () => {
    const t = classifyMapLinkTarget(new URL('https://maps.app.goo.gl/Next'));
    expect(t?.kind).toBe('short');
  });

  it('classifies a Google Maps URL as final', () => {
    expect(
      classifyMapLinkTarget(
        new URL('https://www.google.com/maps/place/@40.4,-3.7,17z'),
      ),
    ).toEqual({
      kind: 'final',
      url: 'https://www.google.com/maps/place/@40.4,-3.7,17z',
    });
  });

  it('unwraps consent.google.com?continue= into its final URL', () => {
    const cont = 'https://www.google.com/maps/place/@40.4,-3.7,17z';
    expect(
      classifyMapLinkTarget(
        new URL(
          `https://consent.google.com/m?continue=${encodeURIComponent(cont)}&gl=ES`,
        ),
      ),
    ).toEqual({ kind: 'final', url: cont });
  });

  it('rejects a consent page whose continue URL is not Google Maps', () => {
    expect(
      classifyMapLinkTarget(
        new URL(
          `https://consent.google.com/m?continue=${encodeURIComponent('http://169.254.169.254/')}`,
        ),
      ),
    ).toBeNull();
  });

  it.each([
    'http://169.254.169.254/latest/meta-data',
    'https://evil.com/',
    'https://google.com.evil.io/maps',
    'https://evilgoogle.com/maps',
    'https://user:pw@www.google.com/maps',
    'https://www.google.com:8080/maps',
    'ftp://www.google.com/maps',
  ])('rejects %s', (raw) => {
    expect(classifyMapLinkTarget(new URL(raw))).toBeNull();
  });
});
