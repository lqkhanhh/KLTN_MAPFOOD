import { SearchService } from './search.service';
import { RouteSearchDto } from './dto/route-search.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Google road routes and detour ranking', () => {
  const dto: RouteSearchDto = { pointA: { latitude: 10.83, longitude: 106.67 }, pointB: { latitude: 10.85, longitude: 106.68 }, radius: 500, travelMode: 'DRIVE' };
  const polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  let service: SearchService, query: jest.Mock, save: jest.Mock, fetcher: jest.SpyInstance;
  const originalKey = process.env.GOOGLE_ROUTES_API_KEY, legacyKey = process.env.GOOGLE_MAPS_API_KEY;
  const response = (distance = 1000, duration = '120s') => ({ ok: true, json: async () => ({ routes: [{ distanceMeters: distance, duration, polyline: { encodedPolyline: polyline } }] }) });
  beforeEach(() => {
    process.env.GOOGLE_ROUTES_API_KEY = 'fixture'; delete process.env.GOOGLE_MAPS_API_KEY;
    query = jest.fn().mockResolvedValue([]); save = jest.fn();
    service = new SearchService({ query } as never, { create: (v: unknown) => v, save } as never);
    fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(response() as Response);
  });
  afterEach(() => {
    fetcher.mockRestore();
    if (originalKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY; else process.env.GOOGLE_ROUTES_API_KEY = originalKey;
    if (legacyKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = legacyKey;
  });
  it('fails explicitly without a key and never returns straight-line ETA', async () => {
    delete process.env.GOOGLE_ROUTES_API_KEY;
    await expect(service.route(dto)).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled(); expect(query).not.toHaveBeenCalled();
  });
  it('ranks road detours rather than spatial proximity, forwards vehicle and stop', async () => {
    query.mockResolvedValue([{ id: 'near', latitude: 10.84, longitude: 106.67, distance_meters: 10 }, { id: 'far', latitude: 10.85, longitude: 106.68, distance_meters: 200 }]);
    fetcher.mockResolvedValueOnce(response() as Response).mockResolvedValueOnce(response(2000, '300s') as Response).mockResolvedValueOnce(response(1200, '150s') as Response);
    const result = await service.route({ ...dto, travelMode: 'TWO_WHEELER' });
    expect(result.restaurants.map(r => r.id)).toEqual(['far', 'near']);
    expect(result.restaurants[0]).toMatchObject({ detourDistanceMeters: 200, detourDurationSeconds: 30 });
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.travelMode).toBe('TWO_WHEELER'); expect(body.routingPreference).toBe('TRAFFIC_UNAWARE');
    expect(body.intermediates).toEqual([{ location: { latLng: { latitude: 10.84, longitude: 106.67 } } }]);
    expect(query.mock.calls[0][0]).toContain('ST_DWithin'); expect(save).toHaveBeenCalledTimes(1);
  });
  it('omits failed candidates with a warning; does not fabricate a zero detour', async () => {
    query.mockResolvedValue([{ id: 'a', latitude: 10.84, longitude: 106.67 }, { id: 'b', latitude: 10.85, longitude: 106.68 }]);
    fetcher.mockResolvedValueOnce(response() as Response).mockRejectedValueOnce(new Error('provider secret')).mockResolvedValueOnce(response(1300,'160s') as Response);
    const result = await service.route(dto);
    expect(result.unavailableRoutes).toBe(1); expect(result.restaurants).toHaveLength(1); expect(result.warning).toBeTruthy();
  });
  it('caps candidate calls and reports truncation', async () => {
    query.mockResolvedValue(Array.from({ length: 13 }, (_, i) => ({ id: String(i), latitude: 10.84, longitude: 106.67 })));
    const result = await service.route(dto); expect(result.truncated).toBe(true); expect(result.restaurants).toHaveLength(12); expect(fetcher).toHaveBeenCalledTimes(13);
  });
  it('rejects invalid provider geometry, HTTP errors and no-route responses', async () => {
    for (const data of [{ ok: false }, { ok: true, json: async () => ({ routes: [] }) }, { ok: true, json: async () => ({ routes: [{ distanceMeters: 12, duration: '10s', polyline: { encodedPolyline: '_' } }] }) }]) {
      fetcher.mockResolvedValue(data as Response); await expect(service.route(dto)).rejects.toMatchObject({ status: 502 });
    }
  });
  it('validates coordinates, corridor bounds and travel modes', async () => {
    for (const body of [{}, { ...dto, pointA: { latitude: 100, longitude: 1 } }, { ...dto, radius: -1 }, { ...dto, radius: 100000 }, { ...dto, travelMode: 'FLY' }]) {
      expect((await validate(plainToInstance(RouteSearchDto, body))).length).toBeGreaterThan(0);
    }
  });
});
