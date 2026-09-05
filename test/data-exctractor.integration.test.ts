import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {lastValueFrom, toArray} from 'rxjs';

jest.mock('yamljs');

import * as YamlJs from 'yamljs';
import {DataExtractor} from '../src/data-exctractor';

const mockedYamlLoad = YamlJs.load as unknown as jest.Mock;

/**
 * The other suite mocks exceljs, so nothing there actually exercises the
 * spreadsheet library. These tests read a real .xlsx written by exceljs itself,
 * through the real filesystem, so a regression in the library (or in the uuid
 * override it depends on) fails here rather than in production.
 */
describe('DataExtractor against a real workbook', () => {
    let folder: string;

    beforeAll(async () => {
        folder = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-exporter-test-'));

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Tägliche Meldung');
        sheet.getCell('W2').value = 'TeamA';
        sheet.getCell('N2').value = 'Früh';
        sheet.getCell('K30').value = 1234;
        sheet.getCell('M30').value = {formula: 'K30*2', result: 2468} as any;
        sheet.getCell('J30').value = null;
        await workbook.xlsx.writeFile(path.join(folder, 'report.xlsx'));

        // must be ignored by filePattern
        fs.writeFileSync(path.join(folder, 'notes.txt'), 'not a workbook');
    });

    afterAll(() => {
        fs.rmSync(folder, {recursive: true, force: true});
    });

    const settings = (metrics: any[]) => ({
        targets: [{folder, filePattern: '.*\\.xlsx', metrics}]
    });

    const metric = (overrides: any = {}) => ({
        name: 'team_output_target_quantity',
        metricType: 'gauge',
        help: 'output quantity expected by the team',
        worksheet: 'Tägliche Meldung',
        labels: {team: {reference: 'W2'}, schicht: {reference: 'N2'}},
        value: {reference: 'K30'},
        ...overrides
    });

    const collect = () => lastValueFrom(new DataExtractor().getValues().pipe(toArray()));

    it('reads a value and its labels out of a real spreadsheet', async () => {
        mockedYamlLoad.mockReturnValue(settings([metric()]));

        const results: any = await collect();

        expect(results).toHaveLength(1);
        expect(results[0][0]).toEqual({
            metric: {
                name: 'team_output_target_quantity',
                help: 'output quantity expected by the team',
                metricType: 'gauge'
            },
            labels: ['team="TeamA"', 'schicht="Früh"'],
            value: 1234
        });
    });

    it('resolves a real formula cell to its cached result', async () => {
        mockedYamlLoad.mockReturnValue(settings([metric({value: {reference: 'M30'}})]));

        const results: any = await collect();

        expect(results[0][0].value).toBe(2468);
    });

    it('reports an empty cell as 0', async () => {
        mockedYamlLoad.mockReturnValue(settings([metric({value: {reference: 'J30'}})]));

        const results: any = await collect();

        expect(results[0][0].value).toBe(0);
    });

    it('ignores files in the folder that do not match filePattern', async () => {
        mockedYamlLoad.mockReturnValue(settings([metric()]));

        const results: any = await collect();

        // one emission per matching workbook; notes.txt must not produce one
        expect(results).toHaveLength(1);
    });

    it('emits nothing when the configured worksheet is absent', async () => {
        mockedYamlLoad.mockReturnValue(settings([metric({worksheet: 'Does Not Exist'})]));

        expect(await collect()).toEqual([]);
    });
});
