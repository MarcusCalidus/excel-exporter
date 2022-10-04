import {mergeMap, Observable, of} from 'rxjs';
import * as ExcelJS from 'exceljs'
import * as YamlJs from 'yamljs';
import path from 'path';
import * as fs from 'fs';

export class DataExtractor {
    getValues(): Observable<any> {
        const settings = YamlJs.load(path.resolve(__dirname, '../config/settings.yaml'));

        const xlsxFiles: string[] = fs.readdirSync(settings.targets[0].folder);
        return of(xlsxFiles)
            .pipe(
                mergeMap(files => files),
                mergeMap(
                    xlsxFile => {
                        return new Observable<any[]>(subscriber => {
                                const workbook = new ExcelJS.Workbook();

                                workbook.xlsx.readFile(path.resolve(settings.targets[0].folder, xlsxFile))
                                    .then(
                                        () => {
                                            settings.targets[0].metrics.forEach(
                                                (metricSetting: any) => {
                                                    const worksheet = workbook.getWorksheet(metricSetting.worksheet);

                                                    const labels = [];

                                                    for (const key in metricSetting.labels) {
                                                        if (metricSetting.labels.hasOwnProperty(key)) {
                                                            labels.push(
                                                                key + '="' +
                                                                worksheet.getCell(
                                                                    metricSetting.labels[key].reference
                                                                ).value + '"'
                                                            );
                                                        }
                                                    }

                                                    let cellValue = worksheet.getCell(
                                                        metricSetting.value.reference
                                                    ).value;

                                                    if (cellValue instanceof Object) {
                                                        cellValue = (cellValue as any).result;
                                                    }

                                                    const metric = {
                                                        metric: {
                                                            name: metricSetting.name,
                                                            help: metricSetting.help,
                                                            metricType: metricSetting.metricType,
                                                        },
                                                        labels,
                                                        value: cellValue
                                                    }

                                                    subscriber.next([metric]);
                                                }
                                            )
                                        }
                                    )
                                    .then(
                                        () => subscriber.complete()
                                    )
                            }
                        )
                    }
                )
            )
    }
}
