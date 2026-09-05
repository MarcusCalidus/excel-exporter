import {lastValueFrom, toArray} from 'rxjs';

jest.mock('fs');
jest.mock('yamljs');
jest.mock('exceljs');

import * as fs from 'fs';
import * as YamlJs from 'yamljs';
import * as ExcelJS from 'exceljs';
import {DataExtractor} from '../src/data-exctractor';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedYamlLoad = YamlJs.load as unknown as jest.Mock;
const mockedWorkbook = ExcelJS.Workbook as unknown as jest.Mock;

function makeSettings(targets: any[]) {
    return {targets};
}

function makeTarget(overrides: any = {}) {
    return {
        folder: '/fake/folder',
        filePattern: '.*\\.xlsx',
        metrics: [
            {
                name: 'team_output_actual_quantity',
                metricType: 'gauge',
                help: 'output quantity',
                worksheet: 'Sheet1',
                labels: {team: {reference: 'A1'}},
                value: {reference: 'B1'},
            },
        ],
        ...overrides,
    };
}

function makeWorkbookMock(cellValues: Record<string, any>, worksheetName = 'Sheet1') {
    const worksheet = {
        getCell: jest.fn((ref: string) => ({value: cellValues[ref]})),
    };
    return {
        xlsx: {readFile: jest.fn().mockResolvedValue(undefined)},
        getWorksheet: jest.fn((name: string) => (name === worksheetName ? worksheet : undefined)),
    };
}

async function collect(extractor: DataExtractor) {
    return lastValueFrom(extractor.getValues().pipe(toArray()));
}

describe('DataExtractor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('extracts a metric using the configured cell references', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx'] as any);
        mockedWorkbook.mockImplementation(() => makeWorkbookMock({A1: 'TeamA', B1: 42}));

        const results = await collect(new DataExtractor());

        expect(results).toEqual([
            [
                {
                    metric: {
                        name: 'team_output_actual_quantity',
                        help: 'output quantity',
                        metricType: 'gauge',
                    },
                    labels: ['team="TeamA"'],
                    value: 42,
                },
            ],
        ]);
    });

    it('only processes files in the target folder that match filePattern', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx', 'notes.txt', 'other.xls'] as any);
        mockedWorkbook.mockImplementation(() => makeWorkbookMock({A1: 'TeamA', B1: 1}));

        await collect(new DataExtractor());

        expect(mockedWorkbook).toHaveBeenCalledTimes(1);
    });

    it('resolves formula cells to their computed result', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx'] as any);
        mockedWorkbook.mockImplementation(() =>
            makeWorkbookMock({A1: 'TeamA', B1: {formula: 'SUM(A1:A2)', result: 7}})
        );

        const results: any = await collect(new DataExtractor());

        expect(results[0][0].value).toBe(7);
    });

    it('defaults falsy cell values to 0', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx'] as any);
        mockedWorkbook.mockImplementation(() => makeWorkbookMock({A1: 'TeamA', B1: null}));

        const results: any = await collect(new DataExtractor());

        expect(results[0][0].value).toBe(0);
    });

    it('skips metrics whose configured worksheet is missing from the workbook', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx'] as any);
        mockedWorkbook.mockImplementation(() => makeWorkbookMock({A1: 'TeamA', B1: 1}, 'OtherSheet'));

        const results = await collect(new DataExtractor());

        expect(results).toEqual([]);
    });

    it('propagates an error when a workbook fails to load', async () => {
        mockedYamlLoad.mockReturnValue(makeSettings([makeTarget()]));
        mockedFs.readdirSync.mockReturnValue(['data.xlsx'] as any);
        mockedWorkbook.mockImplementation(() => ({
            xlsx: {readFile: jest.fn().mockRejectedValue(new Error('corrupt file'))},
        }));

        await expect(collect(new DataExtractor())).rejects.toThrow('corrupt file');
    });

    it('processes multiple targets independently', async () => {
        mockedYamlLoad.mockReturnValue(
            makeSettings([
                makeTarget({
                    folder: '/fake/folder-a',
                    metrics: [
                        {
                            name: 'metric_a',
                            metricType: 'gauge',
                            help: 'a',
                            worksheet: 'Sheet1',
                            labels: {},
                            value: {reference: 'B1'},
                        },
                    ],
                }),
                makeTarget({
                    folder: '/fake/folder-b',
                    metrics: [
                        {
                            name: 'metric_b',
                            metricType: 'gauge',
                            help: 'b',
                            worksheet: 'Sheet1',
                            labels: {},
                            value: {reference: 'B1'},
                        },
                    ],
                }),
            ])
        );
        mockedFs.readdirSync.mockImplementation(
            (folder: any) => (folder === '/fake/folder-a' ? ['a.xlsx'] : ['b.xlsx']) as any
        );
        mockedWorkbook.mockImplementation(() => makeWorkbookMock({B1: 9}));

        const results: any = await collect(new DataExtractor());
        const names = results.map((r: any) => r[0].metric.name).sort();

        expect(names).toEqual(['metric_a', 'metric_b']);
    });
});
