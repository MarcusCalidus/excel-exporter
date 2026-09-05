const mockGetValues = jest.fn();

jest.mock('../src/data-exctractor', () => ({
    DataExtractor: jest.fn().mockImplementation(() => ({getValues: mockGetValues})),
}));

import request from 'supertest';
import {of, throwError} from 'rxjs';
import {app} from '../src/index';

function metric(name: string, help: string, value: any, labels: string[] = []) {
    return {metric: {name, help, metricType: 'gauge'}, labels, value};
}

describe('GET /valuesJson', () => {
    beforeEach(() => {
        mockGetValues.mockReset();
    });

    it('returns success with the extracted data as JSON', async () => {
        mockGetValues.mockReturnValue(of([metric('m1', 'help text', 5)]));

        const res = await request(app).get('/valuesJson');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toEqual({success: true, data: [[metric('m1', 'help text', 5)]]});
    });

    it('returns a 500 with error details when extraction fails', async () => {
        mockGetValues.mockReturnValue(throwError(() => new Error('boom')));

        const res = await request(app).get('/valuesJson');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});

describe('GET /values', () => {
    beforeEach(() => {
        mockGetValues.mockReset();
    });

    it('renders metrics in Prometheus text exposition format', async () => {
        mockGetValues.mockReturnValue(of([metric('m1', 'help text', 5, ['team="A"'])]));

        const res = await request(app).get('/values');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/plain/);
        expect(res.text).toBe(
            ['# HELP m1 help text', '# TYPE m1 gauge', 'm1{team="A"} 5', ''].join('\n')
        );
    });

    it('renders metrics without labels', async () => {
        mockGetValues.mockReturnValue(of([metric('m1', 'help text', 5)]));

        const res = await request(app).get('/values');

        expect(res.text).toContain('m1 5');
    });

    it('renders multiple metrics', async () => {
        mockGetValues.mockReturnValue(
            of([metric('m1', 'help 1', 1)], [metric('m2', 'help 2', 2)])
        );

        const res = await request(app).get('/values');

        expect(res.text).toContain('m1 1');
        expect(res.text).toContain('m2 2');
    });

    it('returns a 500 when extraction fails', async () => {
        // Note: catchError() on the underlying pipe intercepts the error and
        // ends the response itself (as JSON), so the plain-text error callback
        // passed to subscribe() below is never actually reached.
        mockGetValues.mockReturnValue(throwError(() => new Error('boom')));

        const res = await request(app).get('/values');

        expect(res.status).toBe(500);
        expect(JSON.parse(res.text).success).toBe(false);
    });
});
