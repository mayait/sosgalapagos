import {
  HttpMapLinkExpander,
  RedirectResponse,
} from './http-map-link-expander';
import { MapShortLink } from '../domain/map-short-link';

type TestResponse = RedirectResponse & { cancel: jest.Mock };

function redirect(location: string | null, status = 302): TestResponse {
  const cancel = jest.fn().mockResolvedValue(undefined);
  return {
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'location' ? location : null,
    },
    body: { cancel },
    cancel,
  };
}

function link(raw = 'https://maps.app.goo.gl/AbC'): MapShortLink {
  const parsed = MapShortLink.parse(raw);
  if (!parsed) throw new Error('test link must be valid');
  return parsed;
}

describe('HttpMapLinkExpander', () => {
  it('returns the final Google Maps URL without fetching it', async () => {
    const final = 'https://www.google.com/maps/place/@40.4,-3.7,17z';
    const fetchFn = jest.fn().mockResolvedValue(redirect(final));
    const expander = new HttpMapLinkExpander({ fetchFn });

    await expect(expander.expand(link())).resolves.toBe(final);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://maps.app.goo.gl/AbC');
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('never reads the body (cancels it)', async () => {
    const response = redirect('https://www.google.com/maps/@1,2,3z');
    const fetchFn = jest.fn().mockResolvedValue(response);
    await new HttpMapLinkExpander({ fetchFn }).expand(link());
    expect(response.cancel).toHaveBeenCalled();
  });

  it.each(['http://169.254.169.254/', 'https://evil.com'])(
    'Location to %s yields null with exactly one fetch',
    async (location) => {
      const fetchFn = jest.fn().mockResolvedValue(redirect(location));
      const expander = new HttpMapLinkExpander({ fetchFn });

      await expect(expander.expand(link())).resolves.toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'https://maps.app.goo.gl.evil.com/x',
    'https://google.com.evil.io/maps',
    'https://evilgoogle.com/maps',
  ])('rejects lookalike redirect host %s', async (location) => {
    const fetchFn = jest.fn().mockResolvedValue(redirect(location));
    await expect(
      new HttpMapLinkExpander({ fetchFn }).expand(link()),
    ).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('follows short-link hops, re-validating each one', async () => {
    const final = 'https://maps.google.com/?q=40.4,-3.7';
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(redirect('https://goo.gl/maps/Second'))
      .mockResolvedValueOnce(redirect(final, 301));
    const expander = new HttpMapLinkExpander({ fetchFn });

    await expect(expander.expand(link())).resolves.toBe(final);
    expect(fetchFn.mock.calls.map((c) => (c as [string])[0])).toEqual([
      'https://maps.app.goo.gl/AbC',
      'https://goo.gl/maps/Second',
    ]);
  });

  it('resolves relative Location headers against the current hop', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(redirect('/Second'))
      .mockResolvedValueOnce(redirect('https://www.google.com/maps/@1,2,3z'));
    await expect(
      new HttpMapLinkExpander({ fetchFn }).expand(link()),
    ).resolves.toBe('https://www.google.com/maps/@1,2,3z');
    expect((fetchFn.mock.calls[1] as [string])[0]).toBe(
      'https://maps.app.goo.gl/Second',
    );
  });

  it('unwraps consent.google.com without fetching it', async () => {
    const final = 'https://www.google.com/maps/place/@40.4,-3.7,17z';
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        redirect(
          `https://consent.google.com/ml?continue=${encodeURIComponent(final)}`,
        ),
      );
    await expect(
      new HttpMapLinkExpander({ fetchFn }).expand(link()),
    ).resolves.toBe(final);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxHops', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(redirect('https://maps.app.goo.gl/Loop'));
    const expander = new HttpMapLinkExpander({ fetchFn, maxHops: 3 });

    await expect(expander.expand(link())).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a 200 response', redirect(null, 200)],
    ['a redirect without Location', redirect(null, 302)],
    ['a 404', redirect('https://www.google.com/maps', 404)],
  ])('returns null on %s', async (_label, response) => {
    const fetchFn = jest.fn().mockResolvedValue(response);
    await expect(
      new HttpMapLinkExpander({ fetchFn }).expand(link()),
    ).resolves.toBeNull();
  });

  it('returns null when the request fails or times out', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(
      new HttpMapLinkExpander({ fetchFn }).expand(link()),
    ).resolves.toBeNull();
  });
});
