import {
  ExpandMapLink,
  InvalidMapShortLinkError,
  UnresolvableMapLinkError,
} from './expand-map-link';
import { MapLinkExpander } from '../domain/ports/map-link-expander';

function expanderReturning(value: string | null | Error): MapLinkExpander & {
  expand: jest.Mock;
} {
  return {
    expand: jest.fn(() =>
      value instanceof Error ? Promise.reject(value) : Promise.resolve(value),
    ),
  };
}

describe('ExpandMapLink', () => {
  it('returns the expanded URL', async () => {
    const expander = expanderReturning('https://www.google.com/maps/@1,2,3z');
    await expect(
      new ExpandMapLink(expander).execute('https://maps.app.goo.gl/AbC'),
    ).resolves.toEqual({ url: 'https://www.google.com/maps/@1,2,3z' });
  });

  it('rejects non-allowlisted input without touching the expander', async () => {
    const expander = expanderReturning('x');
    await expect(
      new ExpandMapLink(expander).execute('https://evil.com/AbC'),
    ).rejects.toBeInstanceOf(InvalidMapShortLinkError);
    expect(expander.expand).not.toHaveBeenCalled();
  });

  it.each([null, new Error('boom')])(
    'maps an unresolvable link (%p) to UnresolvableMapLinkError',
    async (value) => {
      await expect(
        new ExpandMapLink(expanderReturning(value)).execute(
          'https://maps.app.goo.gl/AbC',
        ),
      ).rejects.toBeInstanceOf(UnresolvableMapLinkError);
    },
  );
});
